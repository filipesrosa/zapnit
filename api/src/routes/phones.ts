import type { FastifyInstance, FastifyRequest } from 'fastify'
import { prisma } from '../db.js'
import { authenticate } from '../middleware/auth.js'
import { nanoid } from 'nanoid'

interface AddPhoneBody {
  display_number: string
  phone_number_id: string
  waba_id: string
  access_token: string
}

interface PhoneParams {
  id: string
}

interface UpdateBotBody {
  bot_enabled?: boolean
  bot_context?: string
  bot_tone?: string
}

interface ToggleActiveBody {
  is_active: boolean
}

const BOT_TONES = ['profissional', 'amigavel', 'formal', 'empatico'] as const

function formatPhone(p: {
  id: string
  displayNumber: string
  phoneNumberId: string
  wabaId: string
  isActive: boolean
  webhookVerifyToken: string
  botEnabled: boolean
  botContext: string | null
  botTone: string | null
  createdAt: Date
}, webhookBase: string) {
  return {
    id:                   p.id,
    display_number:       p.displayNumber,
    phone_number_id:      p.phoneNumberId,
    waba_id:              p.wabaId,
    is_active:            p.isActive,
    webhook_url:          webhookBase,
    webhook_verify_token: p.webhookVerifyToken,
    bot: {
      enabled: p.botEnabled,
      context: p.botContext ?? '',
      tone:    p.botTone ?? 'profissional'
    },
    created_at: p.createdAt
  }
}

export default async function phonesRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', authenticate)

  // GET /phones — Listar números do tenant
  app.get('/', async (req: FastifyRequest) => {
    const { tenant } = req

    const phones = await prisma.phoneNumber.findMany({
      where: { tenantId: tenant.id },
      orderBy: { createdAt: 'asc' }
    })

    const webhookBase = `${process.env.API_BASE_URL ?? ''}/webhook/${tenant.id}`

    return phones.map(p => formatPhone(p, webhookBase))
  })

  // POST /phones — Vincular novo número
  app.post<{ Body: AddPhoneBody }>('/', {
    schema: {
      body: {
        type: 'object',
        required: ['display_number', 'phone_number_id', 'waba_id', 'access_token'],
        properties: {
          display_number:  { type: 'string' },
          phone_number_id: { type: 'string' },
          waba_id:         { type: 'string' },
          access_token:    { type: 'string' }
        }
      }
    }
  }, async (req, reply) => {
    const { tenant } = req
    const { display_number, phone_number_id, waba_id, access_token } = req.body

    const exists = await prisma.phoneNumber.findUnique({
      where: { phoneNumberId: phone_number_id }
    })
    if (exists) {
      return reply.status(409).send({ error: 'Número já vinculado a uma conta' })
    }

    const webhookVerifyToken = nanoid(24)

    const phone = await prisma.phoneNumber.create({
      data: {
        tenantId:          tenant.id,
        displayNumber:     display_number,
        phoneNumberId:     phone_number_id,
        wabaId:            waba_id,
        accessToken:       access_token,
        webhookVerifyToken
      }
    })

    const webhookBase = `${process.env.API_BASE_URL ?? ''}/webhook/${tenant.id}`

    return reply.status(201).send(formatPhone(phone, webhookBase))
  })

  // PATCH /phones/:id/bot — Atualizar configuração do bot
  app.patch<{ Params: PhoneParams; Body: UpdateBotBody }>('/:id/bot', {
    schema: {
      body: {
        type: 'object',
        properties: {
          bot_enabled: { type: 'boolean' },
          bot_context: { type: 'string', maxLength: 8000 },
          bot_tone:    { type: 'string', enum: BOT_TONES }
        }
      }
    }
  }, async (req, reply) => {
    const { tenant } = req
    const { id } = req.params
    const { bot_enabled, bot_context, bot_tone } = req.body

    const phone = await prisma.phoneNumber.findFirst({
      where: { id, tenantId: tenant.id }
    })
    if (!phone) {
      return reply.status(404).send({ error: 'Número não encontrado' })
    }

    const updated = await prisma.phoneNumber.update({
      where: { id },
      data: {
        ...(bot_enabled !== undefined && { botEnabled: bot_enabled }),
        ...(bot_context !== undefined && { botContext: bot_context }),
        ...(bot_tone    !== undefined && { botTone:    bot_tone })
      }
    })

    return reply.send({
      id:  updated.id,
      bot: {
        enabled: updated.botEnabled,
        context: updated.botContext ?? '',
        tone:    updated.botTone ?? 'profissional'
      }
    })
  })

  // PATCH /phones/:id/toggle — Ativar ou desativar número
  app.patch<{ Params: PhoneParams; Body: ToggleActiveBody }>('/:id/toggle', {
    schema: {
      body: {
        type: 'object',
        required: ['is_active'],
        properties: {
          is_active: { type: 'boolean' }
        }
      }
    }
  }, async (req, reply) => {
    const { tenant } = req
    const { id } = req.params
    const { is_active } = req.body

    const phone = await prisma.phoneNumber.findFirst({
      where: { id, tenantId: tenant.id }
    })
    if (!phone) {
      return reply.status(404).send({ error: 'Número não encontrado' })
    }

    const updated = await prisma.phoneNumber.update({
      where: { id },
      data: { isActive: is_active }
    })

    return reply.send({ id: updated.id, is_active: updated.isActive })
  })

  // DELETE /phones/:id — Desvincular número
  app.delete<{ Params: PhoneParams }>('/:id', async (req, reply) => {
    const { tenant } = req
    const { id } = req.params

    const phone = await prisma.phoneNumber.findFirst({
      where: { id, tenantId: tenant.id }
    })
    if (!phone) {
      return reply.status(404).send({ error: 'Número não encontrado' })
    }

    await prisma.phoneNumber.delete({ where: { id } })

    return reply.status(204).send()
  })
}
