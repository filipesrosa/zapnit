import type { FastifyInstance } from 'fastify'
import { prisma } from '../db.js'
import { authenticateUser } from '../middleware/auth.js'
import { getPaymentGateway } from '../services/billing/index.js'

interface CheckoutBody {
  plan_id: string
}

export default async function billingRoutes(app: FastifyInstance): Promise<void> {
  // GET /billing/plans — lista planos disponíveis (público)
  app.get('/plans', {
    schema: { tags: ['Billing'], summary: 'Listar planos disponíveis' }
  }, async () => {
    const plans = await prisma.plan.findMany({
      where: { isActive: true },
      orderBy: { price: 'asc' },
      select: {
        id: true,
        name: true,
        slug: true,
        monthlyQuota: true,
        price: true,
        billingInterval: true,
        features: true,
        gatewayPriceId: true
      }
    })
    return plans.map(p => ({
      id: p.id,
      name: p.name,
      slug: p.slug,
      monthly_quota: p.monthlyQuota,
      price: p.price,
      billing_interval: p.billingInterval,
      effective_monthly_price: p.billingInterval === 'annual' ? Number(p.price) / 12 : Number(p.price),
      features: p.features,
      gateway_price_id: p.gatewayPriceId,
      is_free: p.slug === 'free'
    }))
  })

  await app.register(async (auth) => {
    auth.addHook('preHandler', authenticateUser)

    // GET /billing/subscription — status da assinatura atual
    auth.get('/subscription', {
      schema: { tags: ['Billing'], summary: 'Status da assinatura atual', security: [{ bearerAuth: [] }] }
    }, async (req, reply) => {
      const user = await prisma.user.findUnique({
        where: { id: req.authUser.id },
        include: { tenant: { include: { plan: true } } }
      })
      if (!user?.tenant) return reply.status(404).send({ error: 'Tenant not found' })

      const { tenant } = user
      return {
        plan: { id: tenant.plan.id, name: tenant.plan.name, slug: tenant.plan.slug, price: tenant.plan.price },
        payment_status: tenant.paymentStatus ?? 'active',
        billing_cycle_end: tenant.billingCycleEnd,
        has_active_subscription: !!tenant.gatewaySubscriptionId,
        quota: { used: tenant.usedMessages, limit: tenant.monthlyQuota, resets_at: tenant.quotaResetAt }
      }
    })

    // POST /billing/checkout — inicia assinatura via gateway de pagamento
    auth.post<{ Body: CheckoutBody }>('/checkout', {
      schema: {
        tags: ['Billing'],
        summary: 'Iniciar checkout de assinatura',
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          required: ['plan_id'],
          properties: { plan_id: { type: 'string' } }
        }
      }
    }, async (req, reply) => {
      const user = await prisma.user.findUnique({
        where: { id: req.authUser.id },
        include: { tenant: { include: { plan: true } } }
      })
      if (!user?.tenant) return reply.status(404).send({ error: 'Tenant not found' })

      const plan = await prisma.plan.findUnique({ where: { id: req.body.plan_id } })
      if (!plan) return reply.status(404).send({ error: 'Plan not found' })
      if (!plan.gatewayPriceId) return reply.status(400).send({ error: 'Este plano não tem um preço configurado no gateway de pagamento' })

      const gateway = getPaymentGateway()
      const { tenant } = user

      let customerId = tenant.gatewayCustomerId
      if (!customerId) {
        const created = await gateway.createCustomer({ name: user.name, email: user.email })
        customerId = created.customerId
        await prisma.tenant.update({ where: { id: tenant.id }, data: { gatewayCustomerId: customerId } })
      }

      const baseUrl = process.env.APP_BASE_URL ?? process.env.API_BASE_URL ?? 'http://localhost:3001'
      const { url } = await gateway.createCheckoutSession({
        customerId,
        priceId: plan.gatewayPriceId,
        tenantId: tenant.id,
        successUrl: `${baseUrl}/dashboard/billing?status=success`,
        cancelUrl: `${baseUrl}/dashboard/billing?status=canceled`
      })

      return reply.status(201).send({ checkout_url: url })
    })

    // POST /billing/cancel — cancela assinatura ativa
    auth.post('/cancel', async (req, reply) => {
      const user = await prisma.user.findUnique({
        where: { id: req.authUser.id },
        include: { tenant: true }
      })
      if (!user?.tenant) return reply.status(404).send({ error: 'Tenant not found' })
      if (!user.tenant.gatewaySubscriptionId) return reply.status(400).send({ error: 'Nenhuma assinatura ativa' })

      const gateway = getPaymentGateway()
      await gateway.cancelSubscription(user.tenant.gatewaySubscriptionId)
      await prisma.tenant.update({
        where: { id: user.tenant.id },
        data: { paymentStatus: 'canceled' }
      })

      return { message: 'Assinatura cancelada com sucesso' }
    })
  })

  // POST /billing/webhook — recebe notificações do gateway (sem auth, valida assinatura)
  // Stripe sends stripe-signature; MercadoPago sends x-signature + x-request-id.
  // Raw body must be preserved for HMAC verification — parsed via buffer content-type parser.
  app.addContentTypeParser('application/json', { parseAs: 'buffer' }, (req, body, done) => {
    req.rawBody = body as Buffer
    try { done(null, JSON.parse((body as Buffer).toString())) }
    catch (err) { done(err as Error) }
  })

  app.post('/webhook', async (req, reply) => {
    const isStripe = !!(req.headers['stripe-signature'])
    const signature = isStripe
      ? (req.headers['stripe-signature'] as string)
      : ((req.headers['x-signature'] as string) ?? '')
    const requestId = req.headers['x-request-id'] as string | undefined

    const rawBody = req.rawBody ?? Buffer.from(JSON.stringify(req.body))

    let event
    try {
      event = await getPaymentGateway().constructWebhookEvent(rawBody, signature, requestId)
    } catch (err) {
      app.log.warn({ err }, 'billing webhook signature validation failed')
      return reply.status(400).send({ error: 'invalid_signature' })
    }

    const { subscriptionId, subscription } = event

    if (!subscription) return reply.send({ received: true })

    const tenant = await prisma.tenant.findFirst({
      where: { gatewaySubscriptionId: subscriptionId },
      include: { plan: true }
    })

    if (!tenant) {
      app.log.warn({ subscriptionId }, 'billing webhook: tenant not found for subscription')
      return reply.send({ received: true })
    }

    switch (event.type) {
      case 'subscription.activated': {
        const plan = await prisma.plan.findFirst({ where: { gatewayPriceId: subscription.priceId } })
        await prisma.tenant.update({
          where: { id: tenant.id },
          data: {
            gatewaySubscriptionId: subscriptionId,
            gatewayPriceId: subscription.priceId,
            paymentStatus: 'active',
            billingCycleEnd: subscription.currentPeriodEnd,
            ...(plan && { planId: plan.id, monthlyQuota: plan.monthlyQuota })
          }
        })
        break
      }
      case 'subscription.updated': {
        await prisma.tenant.update({
          where: { id: tenant.id },
          data: {
            paymentStatus: subscription.status === 'active' ? 'active' : subscription.status,
            billingCycleEnd: subscription.currentPeriodEnd
          }
        })
        break
      }
      case 'subscription.canceled': {
        const freePlan = await prisma.plan.findUnique({ where: { slug: 'free' } })
        await prisma.tenant.update({
          where: { id: tenant.id },
          data: {
            paymentStatus: 'canceled',
            gatewaySubscriptionId: null,
            ...(freePlan && { planId: freePlan.id, monthlyQuota: freePlan.monthlyQuota })
          }
        })
        break
      }
      case 'payment.failed': {
        await prisma.tenant.update({
          where: { id: tenant.id },
          data: { paymentStatus: 'past_due' }
        })
        break
      }
    }

    return reply.send({ received: true })
  })
}
