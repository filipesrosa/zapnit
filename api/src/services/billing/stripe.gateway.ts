import type { PaymentGateway, GatewaySubscription, GatewayWebhookEvent } from './gateway.js'

export class StripeGateway implements PaymentGateway {
  async createCustomer(_params: { name: string; email: string }): Promise<{ customerId: string }> {
    throw new Error('Stripe gateway not yet implemented')
  }

  async createCheckoutSession(_params: {
    customerId: string
    priceId: string
    tenantId: string
    successUrl: string
    cancelUrl: string
  }): Promise<{ url: string }> {
    throw new Error('Stripe gateway not yet implemented')
  }

  async cancelSubscription(_subscriptionId: string): Promise<void> {
    throw new Error('Stripe gateway not yet implemented')
  }

  async getSubscription(_subscriptionId: string): Promise<GatewaySubscription> {
    throw new Error('Stripe gateway not yet implemented')
  }

  async constructWebhookEvent(_payload: Buffer, _signature: string): Promise<GatewayWebhookEvent> {
    throw new Error('Stripe gateway not yet implemented')
  }
}
