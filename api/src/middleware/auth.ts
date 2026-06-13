import type { FastifyRequest, FastifyReply } from 'fastify'
import { prisma } from '../db.js'

export async function authenticateUser(req: FastifyRequest, reply: FastifyReply): Promise<void> {
  try {
    await req.jwtVerify()
    const { userId } = req.user as { userId?: string }
    if (!userId) return void reply.status(401).send({ error: 'Unauthorized' })
    const user = await prisma.user.findUnique({ where: { id: userId } })
    if (!user) return void reply.status(401).send({ error: 'Unauthorized' })
    req.authUser = user
  } catch {
    reply.status(401).send({ error: 'Unauthorized' })
  }
}

export async function authenticate(req: FastifyRequest, reply: FastifyReply): Promise<void> {
  try {
    await req.jwtVerify()

    const tenant = await prisma.tenant.findUnique({
      where: { id: (req.user as { tenantId: string }).tenantId },
      include: { plan: true }
    })

    if (!tenant) {
      reply.status(401).send({ error: 'Tenant not found' })
      return
    }

    req.tenant = tenant
  } catch {
    reply.status(401).send({ error: 'Unauthorized' })
  }
}

export async function checkQuota(req: FastifyRequest, reply: FastifyReply): Promise<void> {
  const { tenant } = req

  if (tenant.isInternal) return

  if (new Date() > tenant.quotaResetAt) {
    await prisma.tenant.update({
      where: { id: tenant.id },
      data: {
        usedMessages: 0,
        quotaResetAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      }
    })
    tenant.usedMessages = 0
  }

  const isPaidPlan = tenant.plan.slug !== 'free'
  const paymentBlocked = isPaidPlan && (tenant.paymentStatus === 'past_due' || tenant.paymentStatus === 'canceled')
  if (paymentBlocked) {
    return void reply.status(402).send({
      error: 'payment_required',
      message: 'Assinatura vencida ou cancelada. Acesse o painel de billing para regularizar.',
      payment_status: tenant.paymentStatus
    })
  }

  if (tenant.usedMessages >= tenant.monthlyQuota) {
    return void reply.status(429).send({
      error: 'quota_exceeded',
      message: `Monthly quota of ${tenant.monthlyQuota} messages exceeded`,
      used: tenant.usedMessages,
      limit: tenant.monthlyQuota
    })
  }
}
