import type { FastifyInstance } from 'fastify'
import { prisma } from '../db.js'
import { authenticate, checkQuota } from '../middleware/auth.js'
import { messageQueue } from '../jobs/messageWorker.js'

interface SendMessageBody {
  to: string
  message: string
  phone_number_id: string
  preview_url?: boolean
}

interface SendTemplateBody {
  to: string
  phone_number_id: string
  template_name: string
  language?: string
  components?: unknown[]
}

interface MessageParams {
  id: string
}

export default async function messagesRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', authenticate)

  // POST /api/v1/messages/send
  app.post<{ Body: SendMessageBody }>('/send', {
    preHandler: [checkQuota],
    schema: {
      body: {
        type: 'object',
        required: ['to', 'message', 'phone_number_id'],
        properties: {
          to:             { type: 'string' },
          message:        { type: 'string', maxLength: 4096 },
          phone_number_id: { type: 'string' },
          preview_url:    { type: 'boolean', default: false }
        }
      }
    }
  }, async (req, reply) => {
    const { to, message, phone_number_id, preview_url } = req.body
    const { tenant } = req

    const phoneNumber = await prisma.phoneNumber.findFirst({
      where: { phoneNumberId: phone_number_id, tenantId: tenant.id, isActive: true }
    })
    if (!phoneNumber) return reply.status(404).send({ error: 'Phone number not found or not active' })

    const contact = await prisma.contact.upsert({
      where: { tenantId_waId: { tenantId: tenant.id, waId: to } },
      update: {},
      create: { tenantId: tenant.id, waId: to }
    })

    const msg = await prisma.message.create({
      data: {
        tenantId: tenant.id,
        phoneNumberId: phoneNumber.id,
        contactId: contact.id,
        direction: 'OUTBOUND',
        type: 'TEXT',
        content: message,
        status: 'QUEUED'
      }
    })

    await messageQueue.add('send-message', {
      messageId: msg.id,
      phoneNumberId: phoneNumber.phoneNumberId,
      accessToken: phoneNumber.accessToken,
      to,
      message,
      preview_url
    }, { attempts: 3, backoff: { type: 'exponential', delay: 2000 } })

    await prisma.tenant.update({
      where: { id: tenant.id },
      data: { usedMessages: { increment: 1 } }
    })

    return reply.status(202).send({ message_id: msg.id, status: 'queued' })
  })

  // POST /api/v1/messages/send-template
  app.post<{ Body: SendTemplateBody }>('/send-template', {
    preHandler: [checkQuota],
    schema: {
      body: {
        type: 'object',
        required: ['to', 'template_name', 'language', 'phone_number_id'],
        properties: {
          to:              { type: 'string' },
          phone_number_id: { type: 'string' },
          template_name:   { type: 'string' },
          language:        { type: 'string', default: 'pt_BR' },
          components:      { type: 'array' }
        }
      }
    }
  }, async (req, reply) => {
    const { to, phone_number_id, template_name, language = 'pt_BR', components = [] } = req.body
    const { tenant } = req

    const phoneNumber = await prisma.phoneNumber.findFirst({
      where: { phoneNumberId: phone_number_id, tenantId: tenant.id, isActive: true }
    })
    if (!phoneNumber) return reply.status(404).send({ error: 'Phone number not found' })

    const contact = await prisma.contact.upsert({
      where: { tenantId_waId: { tenantId: tenant.id, waId: to } },
      update: {},
      create: { tenantId: tenant.id, waId: to }
    })

    const msg = await prisma.message.create({
      data: {
        tenantId: tenant.id,
        phoneNumberId: phoneNumber.id,
        contactId: contact.id,
        direction: 'OUTBOUND',
        type: 'TEMPLATE',
        content: template_name,
        status: 'QUEUED',
        metadata: { template_name, language, components: components as unknown as import('@prisma/client').Prisma.InputJsonValue }
      }
    })

    await messageQueue.add('send-template', {
      messageId: msg.id,
      phoneNumberId: phoneNumber.phoneNumberId,
      accessToken: phoneNumber.accessToken,
      to,
      template_name,
      language,
      components
    }, { attempts: 3, backoff: { type: 'exponential', delay: 2000 } })

    await prisma.tenant.update({
      where: { id: tenant.id },
      data: { usedMessages: { increment: 1 } }
    })

    return reply.status(202).send({ message_id: msg.id, status: 'queued' })
  })

  // GET /api/v1/messages/:id
  app.get<{ Params: MessageParams }>('/:id', async (req, reply) => {
    const { tenant } = req
    const msg = await prisma.message.findFirst({
      where: { id: req.params.id, tenantId: tenant.id }
    })
    if (!msg) return reply.status(404).send({ error: 'Message not found' })

    return {
      id: msg.id,
      status: msg.status,
      direction: msg.direction,
      type: msg.type,
      sent_at: msg.sentAt,
      delivered_at: msg.deliveredAt,
      read_at: msg.readAt,
      error: msg.errorMessage
    }
  })
}
