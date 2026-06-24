import Stripe from 'stripe'
import type { PaymentGateway, GatewaySubscription, GatewayWebhookEvent } from './gateway.js'

function client(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) throw new Error('STRIPE_SECRET_KEY not set')
  return new Stripe(key)
}

function mapStatus(s: Stripe.Subscription.Status): GatewaySubscription['status'] {
  switch (s) {
    case 'active':   return 'active'
    case 'trialing': return 'trialing'
    case 'past_due': return 'past_due'
    case 'canceled': return 'canceled'
    default:         return 'pending'
  }
}

function mapSubscription(sub: Stripe.Subscription): GatewaySubscription {
  const item = sub.items.data[0]
  // current_period_end exists at runtime but Stripe SDK v22 types changed the shape
  const periodEnd = (sub as unknown as Record<string, number>)['current_period_end']
  return {
    id: sub.id,
    status: mapStatus(sub.status),
    currentPeriodEnd: new Date(periodEnd * 1000),
    priceId: item?.price.id ?? '',
    customerId: typeof sub.customer === 'string' ? sub.customer : sub.customer.id,
  }
}

export class StripeGateway implements PaymentGateway {
  async createCustomer(params: { name: string; email: string }): Promise<{ customerId: string }> {
    const stripe = client()
    const customer = await stripe.customers.create({ name: params.name, email: params.email })
    return { customerId: customer.id }
  }

  async createCheckoutSession(params: {
    customerId: string
    priceId: string
    tenantId: string
    successUrl: string
    cancelUrl: string
  }): Promise<{ url: string }> {
    const stripe = client()
    const session = await stripe.checkout.sessions.create({
      customer: params.customerId,
      mode: 'subscription',
      line_items: [{ price: params.priceId, quantity: 1 }],
      success_url: params.successUrl,
      cancel_url: params.cancelUrl,
      subscription_data: { metadata: { tenantId: params.tenantId } },
      metadata: { tenantId: params.tenantId },
    })
    if (!session.url) throw new Error('Stripe did not return a checkout URL')
    return { url: session.url }
  }

  async cancelSubscription(subscriptionId: string): Promise<void> {
    const stripe = client()
    await stripe.subscriptions.cancel(subscriptionId)
  }

  async getSubscription(subscriptionId: string): Promise<GatewaySubscription> {
    const stripe = client()
    const sub = await stripe.subscriptions.retrieve(subscriptionId, {
      expand: ['items.data.price'],
    })
    return mapSubscription(sub)
  }

  async constructWebhookEvent(payload: Buffer, signature: string): Promise<GatewayWebhookEvent> {
    const stripe = client()
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
    if (!webhookSecret) throw new Error('STRIPE_WEBHOOK_SECRET not set')

    const event = stripe.webhooks.constructEvent(payload, signature, webhookSecret)

    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const sub = event.data.object as Stripe.Subscription
        const mapped = mapSubscription(sub)
        return {
          type: event.type === 'customer.subscription.created'
            ? 'subscription.activated'
            : 'subscription.updated',
          subscriptionId: sub.id,
          subscription: mapped,
        }
      }
      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription
        return {
          type: 'subscription.canceled',
          subscriptionId: sub.id,
          subscription: mapSubscription(sub),
        }
      }
      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice
        // subscription field exists at runtime; SDK v22 types changed its shape
        const sub = (invoice as unknown as Record<string, unknown>)['subscription']
        const subId = typeof sub === 'string' ? sub : (sub as { id?: string } | null)?.id ?? ''
        return { type: 'payment.failed', subscriptionId: subId }
      }
      default:
        throw new Error(`Unhandled Stripe event type: ${event.type}`)
    }
  }
}
