import { MercadoPagoConfig, Customer, PreApproval, WebhookSignatureValidator } from 'mercadopago'
import type { PaymentGateway, GatewaySubscription, GatewayWebhookEvent } from './gateway.js'

function client() {
  return new MercadoPagoConfig({ accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN! })
}

function mapStatus(status?: string): GatewaySubscription['status'] {
  switch (status) {
    case 'authorized': return 'active'
    case 'pending': return 'pending'
    case 'paused': return 'past_due'
    case 'cancelled': return 'canceled'
    default: return 'pending'
  }
}

export class MercadoPagoGateway implements PaymentGateway {
  async createCustomer({ name, email }: { name: string; email: string }) {
    const customer = await new Customer(client()).create({
      body: { email, first_name: name.split(' ')[0] }
    })
    if (!customer.id) throw new Error('MercadoPago: failed to create customer')
    return { customerId: customer.id }
  }

  async createCheckoutSession({
    priceId,
    tenantId,
    successUrl,
  }: {
    customerId: string
    priceId: string
    tenantId: string
    successUrl: string
    cancelUrl: string
  }) {
    const preapproval = await new PreApproval(client()).create({
      body: {
        preapproval_plan_id: priceId,
        back_url: successUrl,
        external_reference: tenantId,
        status: 'pending',
      }
    })
    if (!preapproval.init_point) throw new Error('MercadoPago: no checkout URL returned')
    return { url: preapproval.init_point }
  }

  async cancelSubscription(subscriptionId: string) {
    await new PreApproval(client()).update({
      id: subscriptionId,
      body: { status: 'cancelled' }
    })
  }

  async getSubscription(subscriptionId: string): Promise<GatewaySubscription> {
    const sub = await new PreApproval(client()).get({ id: subscriptionId })
    const raw = sub as unknown as { preapproval_plan_id?: string; auto_recurring?: { end_date?: string } }
    return {
      id: subscriptionId,
      status: mapStatus(sub.status),
      currentPeriodEnd: sub.next_payment_date
        ? new Date(sub.next_payment_date)
        : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      priceId: raw.preapproval_plan_id ?? '',
      customerId: '',
    }
  }

  async constructWebhookEvent(payload: Buffer, signature: string, requestId?: string): Promise<GatewayWebhookEvent> {
    const body = JSON.parse(payload.toString()) as { type?: string; data?: { id?: string } }
    const dataId = body?.data?.id ?? ''

    const secret = process.env.MERCADOPAGO_WEBHOOK_SECRET
    if (secret) {
      WebhookSignatureValidator.validate({
        xSignature: signature,
        xRequestId: requestId ?? null,
        dataId,
        secret,
        toleranceSeconds: 300
      })
    }

    const { type } = body
    if (!dataId) throw new Error('MercadoPago: missing data.id in webhook')

    if (type === 'subscription_preapproval') {
      const subscription = await this.getSubscription(dataId)
      let eventType: GatewayWebhookEvent['type']
      switch (subscription.status) {
        case 'active': eventType = 'subscription.activated'; break
        case 'canceled': eventType = 'subscription.canceled'; break
        case 'past_due': eventType = 'payment.failed'; break
        default: eventType = 'subscription.updated'
      }
      return { type: eventType, subscriptionId: dataId, subscription }
    }

    throw new Error(`MercadoPago: unhandled webhook type: ${type}`)
  }
}
