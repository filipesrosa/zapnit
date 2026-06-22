import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { prisma } from '../db.js'

function adminGuard(req: FastifyRequest, reply: FastifyReply): boolean {
  const key = req.headers['x-admin-key']
  if (!key || key !== process.env.ADMIN_SECRET) {
    reply.status(403).send({ error: 'Forbidden' })
    return true
  }
  return false
}

interface CreatePlanBody {
  name: string
  slug: string
  monthlyQuota: number
  price: number
  billingInterval?: 'monthly' | 'annual'
  features?: string[]
  isActive?: boolean
  gatewayPriceId?: string
}

interface UpdatePlanBody {
  name?: string
  monthlyQuota?: number
  price?: number
  billingInterval?: 'monthly' | 'annual'
  features?: string[]
  isActive?: boolean
  gatewayPriceId?: string
}

interface PlanParams {
  id: string
}

export default async function plansRoutes(app: FastifyInstance): Promise<void> {
  // GET /api/v1/plans — Lista planos ativos, agrupados por intervalo (público)
  app.get('/', async () => {
    const plans = await prisma.plan.findMany({
      where: { isActive: true },
      orderBy: [{ billingInterval: 'asc' }, { price: 'asc' }],
      select: { id: true, name: true, slug: true, monthlyQuota: true, price: true, billingInterval: true, features: true }
    })

    // For annual plans, expose the effective monthly equivalent price
    return plans.map(p => ({
      ...p,
      billing_interval: p.billingInterval,
      effective_monthly_price: p.billingInterval === 'annual'
        ? Number(p.price) / 12
        : Number(p.price),
    }))
  })

  // GET /api/v1/plans/:id — Detalhe de um plano (público)
  app.get<{ Params: PlanParams }>('/:id', async (req, reply) => {
    const plan = await prisma.plan.findUnique({ where: { id: req.params.id } })
    if (!plan) return reply.status(404).send({ error: 'Plan not found' })
    return plan
  })

  // POST /api/v1/plans — Criar plano (admin)
  app.post<{ Body: CreatePlanBody }>('/', {
    schema: {
      body: {
        type: 'object',
        required: ['name', 'slug', 'monthlyQuota', 'price'],
        properties: {
          name:            { type: 'string' },
          slug:            { type: 'string' },
          monthlyQuota:    { type: 'integer' },
          price:           { type: 'number' },
          billingInterval: { type: 'string', enum: ['monthly', 'annual'], default: 'monthly' },
          features:        { type: 'array', items: { type: 'string' } },
          isActive:        { type: 'boolean', default: true },
          gatewayPriceId:  { type: 'string' },
        }
      }
    }
  }, async (req, reply) => {
    if (adminGuard(req, reply)) return

    const { name, slug, monthlyQuota, price, billingInterval = 'monthly', features, isActive = true, gatewayPriceId } = req.body

    const existing = await prisma.plan.findUnique({ where: { slug } })
    if (existing) return reply.status(409).send({ error: 'Slug already in use' })

    const plan = await prisma.plan.create({
      data: { name, slug, monthlyQuota, price, billingInterval, features, isActive, gatewayPriceId }
    })

    return reply.status(201).send(plan)
  })

  // PATCH /api/v1/plans/:id — Atualizar plano (admin)
  app.patch<{ Params: PlanParams; Body: UpdatePlanBody }>('/:id', {
    schema: {
      body: {
        type: 'object',
        properties: {
          name:            { type: 'string' },
          monthlyQuota:    { type: 'integer' },
          price:           { type: 'number' },
          billingInterval: { type: 'string', enum: ['monthly', 'annual'] },
          features:        { type: 'array', items: { type: 'string' } },
          isActive:        { type: 'boolean' },
          gatewayPriceId:  { type: 'string' },
        }
      }
    }
  }, async (req, reply) => {
    if (adminGuard(req, reply)) return

    const plan = await prisma.plan.findUnique({ where: { id: req.params.id } })
    if (!plan) return reply.status(404).send({ error: 'Plan not found' })

    return prisma.plan.update({ where: { id: req.params.id }, data: req.body })
  })

  // DELETE /api/v1/plans/:id — Desativar plano (admin, soft delete)
  app.delete<{ Params: PlanParams }>('/:id', async (req, reply) => {
    if (adminGuard(req, reply)) return

    const plan = await prisma.plan.findUnique({ where: { id: req.params.id } })
    if (!plan) return reply.status(404).send({ error: 'Plan not found' })

    await prisma.plan.update({ where: { id: req.params.id }, data: { isActive: false } })
    return reply.status(204).send()
  })
}
