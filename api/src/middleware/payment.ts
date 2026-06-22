import type { FastifyRequest, FastifyReply } from 'fastify'
import { prisma } from '../db.js'

export async function requireActiveSubscription(req: FastifyRequest, reply: FastifyReply): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: req.authUser.id },
    include: { tenant: { include: { plan: true } } },
  })

  if (!user?.tenant) {
    return void reply.status(402).send({
      error: 'subscription_required',
      message: 'Conta não vinculada a um plano. Acesse o painel de billing.',
    })
  }

  const { tenant } = user
  if (tenant.isInternal) return

  if (tenant.plan.slug === 'free' || !tenant.gatewaySubscriptionId) {
    return void reply.status(402).send({
      error: 'subscription_required',
      message: 'É necessário ter uma assinatura ativa para criar instâncias.',
      payment_url: '/dashboard/billing',
    })
  }

  if (tenant.paymentStatus === 'past_due' || tenant.paymentStatus === 'canceled') {
    return void reply.status(402).send({
      error: 'payment_required',
      message: 'Assinatura vencida ou cancelada. Regularize no painel de billing.',
      payment_status: tenant.paymentStatus,
      payment_url: '/dashboard/billing',
    })
  }
}
