import type { PaymentGateway } from './gateway.js'
import { MercadoPagoGateway } from './mercadopago.gateway.js'
import { StripeGateway } from './stripe.gateway.js'

let _gateway: PaymentGateway | null = null

export function getPaymentGateway(): PaymentGateway {
  if (!_gateway) {
    switch (process.env.PAYMENT_GATEWAY) {
      case 'stripe':
        _gateway = new StripeGateway()
        break
      default:
        _gateway = new MercadoPagoGateway()
    }
  }
  return _gateway
}

export type { PaymentGateway, GatewaySubscription, GatewayWebhookEvent } from './gateway.js'
