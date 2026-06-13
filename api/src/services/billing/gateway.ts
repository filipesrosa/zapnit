export interface GatewaySubscription {
  id: string
  status: 'active' | 'past_due' | 'canceled' | 'trialing' | 'pending'
  currentPeriodEnd: Date
  priceId: string
  customerId: string
}

export interface GatewayWebhookEvent {
  type: 'subscription.activated' | 'subscription.updated' | 'subscription.canceled' | 'payment.failed'
  subscriptionId: string
  subscription?: GatewaySubscription
}

export interface PaymentGateway {
  createCustomer(params: { name: string; email: string }): Promise<{ customerId: string }>

  createCheckoutSession(params: {
    customerId: string
    priceId: string
    tenantId: string
    successUrl: string
    cancelUrl: string
  }): Promise<{ url: string }>

  cancelSubscription(subscriptionId: string): Promise<void>

  getSubscription(subscriptionId: string): Promise<GatewaySubscription>

  constructWebhookEvent(payload: Buffer, signature: string, requestId?: string): Promise<GatewayWebhookEvent>
}
