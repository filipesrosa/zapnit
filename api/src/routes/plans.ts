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
  features?: string[]
  isActive?: boolean
}

interface UpdatePlanBody {
  name?: string
  monthlyQuota?: number
  price?: number
  features?: string[]
  isActive?: boolean
}

interface PlanParams {
  id: string
}

export default async function plansRoutes(app: FastifyInstance): Promise<void> {
  // GET /api/v1/plans — Lista planos ativos (público)
  app.get('/', async () => {
    return prisma.plan.findMany({
      where: { isActive: true },
      orderBy: { price: 'asc' },
      select: {
        id: true,
        name: true,
        slug: true,
        monthlyQuota: true,
        price: true,
        features: true
      }
    })
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
          name:         { type: 'string' },
          slug:         { type: 'string' },
          monthlyQuota: { type: 'integer' },
          price:        { type: 'number' },
          features:     { type: 'array', items: { type: 'string' } },
          isActive:     { type: 'boolean', default: true }
        }
      }
    }
  }, async (req, reply) => {
    if (adminGuard(req, reply)) return

    const { name, slug, monthlyQuota, price, features, isActive = true } = req.body

    const existing = await prisma.plan.findUnique({ where: { slug } })
    if (existing) return reply.status(409).send({ error: 'Slug already in use' })

    const plan = await prisma.plan.create({
      data: { name, slug, monthlyQuota, price, features, isActive }
    })

    return reply.status(201).send(plan)
  })

  // PATCH /api/v1/plans/:id — Atualizar plano (admin)
  app.patch<{ Params: PlanParams; Body: UpdatePlanBody }>('/:id', {
    schema: {
      body: {
        type: 'object',
        properties: {
          name:         { type: 'string' },
          monthlyQuota: { type: 'integer' },
          price:        { type: 'number' },
          features:     { type: 'array', items: { type: 'string' } },
          isActive:     { type: 'boolean' }
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
