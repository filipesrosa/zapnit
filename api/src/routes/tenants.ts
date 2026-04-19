import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { prisma } from '../db.js'
import { authenticate } from '../middleware/auth.js'
import bcrypt from 'bcryptjs'
import { nanoid } from 'nanoid'

function adminGuard(req: FastifyRequest, reply: FastifyReply): boolean {
  const key = req.headers['x-admin-key']
  if (!key || key !== process.env.ADMIN_SECRET) {
    reply.status(403).send({ error: 'Forbidden' })
    return true
  }
  return false
}

interface CreateTenantBody {
  name: string
  plan_id: string
  is_internal?: boolean
}

interface AddPhoneNumberBody {
  phone_number_id: string
  waba_id: string
  access_token: string
  display_number: string
}

interface UpdateBotConfigBody {
  bot_enabled?: boolean
  bot_context?: string
  bot_tone?: string
}

interface PhoneNumberParams {
  id: string
}

export default async function tenantsRoutes(app: FastifyInstance): Promise<void> {
  // GET /api/v1/tenants/me — Dados do tenant atual
  app.get('/me', { preHandler: authenticate }, async (req: FastifyRequest) => {
    const { tenant } = req
    return {
      id: tenant.id,
      name: tenant.name,
      plan: {
        id: tenant.plan.id,
        name: tenant.plan.name,
        slug: tenant.plan.slug
      },
      is_internal: tenant.isInternal,
      quota: {
        used: tenant.usedMessages,
        limit: tenant.monthlyQuota,
        resets_at: tenant.quotaResetAt
      }
    }
  })

  // POST /api/v1/tenants — Criar novo tenant (admin)
  app.post<{ Body: CreateTenantBody }>('/', {
    schema: {
      body: {
        type: 'object',
        required: ['name', 'plan_id'],
        properties: {
          name:        { type: 'string' },
          plan_id:     { type: 'string' },
          is_internal: { type: 'boolean', default: false }
        }
      }
    }
  }, async (req, reply) => {
    if (adminGuard(req, reply)) return

    const { name, plan_id, is_internal = false } = req.body

    const plan = await prisma.plan.findUnique({ where: { id: plan_id } })
    if (!plan) return reply.status(404).send({ error: 'Plan not found' })

    const clientId = `zap_${nanoid(16)}`
    const rawSecret = nanoid(32)
    const hashedSecret = await bcrypt.hash(rawSecret, 10)

    const tenant = await prisma.tenant.create({
      data: {
        name,
        clientId,
        clientSecret: hashedSecret,
        isInternal: is_internal,
        planId: plan.id,
        monthlyQuota: is_internal ? 999999 : plan.monthlyQuota,
        quotaResetAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      }
    })

    return reply.status(201).send({
      id: tenant.id,
      name: tenant.name,
      client_id: clientId,
      client_secret: rawSecret,
      plan: { id: plan.id, name: plan.name, slug: plan.slug },
      is_internal: tenant.isInternal,
      message: '⚠️ Save the client_secret — it will not be shown again'
    })
  })

  // GET /api/v1/tenants/phone-numbers — Listar números do tenant
  app.get('/phone-numbers', { preHandler: authenticate }, async (req: FastifyRequest) => {
    const { tenant } = req
    const phones = await prisma.phoneNumber.findMany({
      where: { tenantId: tenant.id },
      orderBy: { createdAt: 'asc' }
    })

    const webhookBase = `${process.env.API_BASE_URL}/webhook/${tenant.id}`

    return phones.map(p => ({
      id: p.id,
      display_number: p.displayNumber,
      phone_number_id: p.phoneNumberId,
      waba_id: p.wabaId,
      is_active: p.isActive,
      webhook_url: webhookBase,
      webhook_verify_token: p.webhookVerifyToken,
      bot: {
        enabled: p.botEnabled,
        context: p.botContext ?? '',
        tone: p.botTone ?? 'profissional'
      }
    }))
  })

  // PATCH /api/v1/tenants/phone-numbers/:id/bot — Atualizar configuração do bot
  app.patch<{ Params: PhoneNumberParams; Body: UpdateBotConfigBody }>(
    '/phone-numbers/:id/bot',
    {
      preHandler: authenticate,
      schema: {
        body: {
          type: 'object',
          properties: {
            bot_enabled: { type: 'boolean' },
            bot_context: { type: 'string', maxLength: 8000 },
            bot_tone:    { type: 'string', enum: ['profissional', 'amigavel', 'formal', 'empatico'] }
          }
        }
      }
    },
    async (req, reply) => {
      const { tenant } = req
      const { id } = req.params
      const { bot_enabled, bot_context, bot_tone } = req.body

      const phone = await prisma.phoneNumber.findFirst({
        where: { id, tenantId: tenant.id }
      })
      if (!phone) return reply.status(404).send({ error: 'Phone number not found' })

      const updated = await prisma.phoneNumber.update({
        where: { id },
        data: {
          ...(bot_enabled !== undefined && { botEnabled: bot_enabled }),
          ...(bot_context !== undefined && { botContext: bot_context }),
          ...(bot_tone    !== undefined && { botTone:    bot_tone })
        }
      })

      return {
        id: updated.id,
        bot: {
          enabled: updated.botEnabled,
          context: updated.botContext ?? '',
          tone:    updated.botTone ?? 'profissional'
        }
      }
    }
  )

  // POST /api/v1/tenants/phone-numbers — Vincular número WhatsApp
  app.post<{ Body: AddPhoneNumberBody }>('/phone-numbers', { preHandler: authenticate }, async (req, reply) => {
    const { tenant } = req
    const { phone_number_id, waba_id, access_token, display_number } = req.body

    const webhookVerifyToken = nanoid(24)

    const phoneNumber = await prisma.phoneNumber.create({
      data: {
        tenantId: tenant.id,
        phoneNumberId: phone_number_id,
        wabaId: waba_id,
        accessToken: access_token,
        displayNumber: display_number,
        webhookVerifyToken
      }
    })

    const webhookUrl = `${process.env.API_BASE_URL}/webhook/${tenant.id}`

    return reply.status(201).send({
      id: phoneNumber.id,
      display_number: phoneNumber.displayNumber,
      webhook_url: webhookUrl,
      webhook_verify_token: webhookVerifyToken,
      instructions: `Configure este webhook no Meta for Developers: ${webhookUrl}`
    })
  })
}
