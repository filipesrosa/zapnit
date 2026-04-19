import type { FastifyInstance, FastifyRequest } from 'fastify'
import { prisma } from '../db.js'
import { authenticate } from '../middleware/auth.js'

interface UpdateCompanyBody {
  name: string
}

export default async function companyRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', authenticate)

  // GET /company — Dados da empresa + quota
  app.get('/', async (req: FastifyRequest) => {
    const { tenant } = req

    // Reset de quota se necessário
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

    return {
      id:          tenant.id,
      name:        tenant.name,
      client_id:   tenant.clientId,
      is_internal: tenant.isInternal,
      plan: {
        name:  tenant.plan.name,
        slug:  tenant.plan.slug,
        price: Number(tenant.plan.price)
      },
      quota: {
        used:      tenant.usedMessages,
        limit:     tenant.monthlyQuota,
        resets_at: tenant.quotaResetAt
      },
      created_at: tenant.createdAt
    }
  })

  // PATCH /company — Atualizar nome da empresa
  app.patch<{ Body: UpdateCompanyBody }>('/', {
    schema: {
      body: {
        type: 'object',
        required: ['name'],
        properties: {
          name: { type: 'string', minLength: 1, maxLength: 100 }
        }
      }
    }
  }, async (req, reply) => {
    const { tenant } = req
    const { name } = req.body

    const updated = await prisma.tenant.update({
      where: { id: tenant.id },
      data: { name }
    })

    return reply.send({ id: updated.id, name: updated.name })
  })
}
