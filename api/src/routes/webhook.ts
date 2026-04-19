import type { FastifyInstance } from 'fastify'

declare module 'fastify' {
  interface FastifyContextConfig {
    rawBody?: boolean
  }
}
import { prisma } from '../db.js'
import { handleInboundMessage } from '../services/chatbot.js'
import crypto from 'crypto'

interface VerifyQuery {
  'hub.mode': string
  'hub.verify_token': string
  'hub.challenge': string
}

interface WebhookParams {
  tenantId: string
}

interface MetaContact {
  profile?: { name?: string }
}

interface MetaMessage {
  id: string
  from: string
  type?: string
  text?: { body: string }
}

interface MetaStatus {
  id: string
  status: string
  timestamp: string
  errors?: Array<{ message: string }>
}

interface MetaValue {
  metadata?: { phone_number_id?: string }
  messages?: MetaMessage[]
  statuses?: MetaStatus[]
  contacts?: MetaContact[]
}

interface WebhookBody {
  entry?: Array<{
    changes?: Array<{ value?: MetaValue }>
  }>
}

export default async function webhookRoutes(app: FastifyInstance): Promise<void> {
  // GET /webhook/:tenantId — Verificação do webhook pela Meta
  app.get<{ Params: WebhookParams; Querystring: VerifyQuery }>('/:tenantId', async (req, reply) => {
    const { tenantId } = req.params
    const { 'hub.mode': mode, 'hub.verify_token': token, 'hub.challenge': challenge } = req.query

    if (mode !== 'subscribe') return reply.status(400).send('Invalid mode')

    const phoneNumber = await prisma.phoneNumber.findFirst({
      where: { tenantId, webhookVerifyToken: token }
    })

    if (!phoneNumber) return reply.status(403).send('Forbidden')

    return reply.send(challenge)
  })

  // POST /webhook/:tenantId — Recebe mensagens da Meta
  app.post<{ Params: WebhookParams; Body: WebhookBody }>('/:tenantId', {
    config: { rawBody: true }
  }, async (req, reply) => {
    const { tenantId } = req.params

    const signature = req.headers['x-hub-signature-256'] as string | undefined
    if (process.env.META_APP_SECRET && signature) {
      const rawBody = (req as unknown as { rawBody?: string }).rawBody
      const expectedSig = 'sha256=' + crypto
        .createHmac('sha256', process.env.META_APP_SECRET)
        .update(rawBody ?? JSON.stringify(req.body))
        .digest('hex')

      if (signature !== expectedSig) return reply.status(401).send('Invalid signature')
    }

    reply.status(200).send('EVENT_RECEIVED')
    processWebhookAsync(tenantId, req.body).catch(console.error)
  })
}

async function processWebhookAsync(tenantId: string, body: WebhookBody): Promise<void> {
  const value = body?.entry?.[0]?.changes?.[0]?.value
  if (!value) return

  if (value.messages?.length) {
    for (const msg of value.messages) {
      await handleIncomingMessage(tenantId, value, msg)
    }
  }

  if (value.statuses?.length) {
    for (const status of value.statuses) {
      await handleStatusUpdate(status)
    }
  }
}

async function handleIncomingMessage(
  tenantId: string,
  value: MetaValue,
  msg: MetaMessage
): Promise<void> {
  const phoneNumberId = value.metadata?.phone_number_id
  const from = msg.from
  const text = msg.text?.body

  const phoneNumber = await prisma.phoneNumber.findFirst({
    where: { phoneNumberId, tenantId }
  })
  if (!phoneNumber) return

  const contact = await prisma.contact.upsert({
    where: { tenantId_waId: { tenantId, waId: from } },
    update: { name: value.contacts?.[0]?.profile?.name },
    create: { tenantId, waId: from, name: value.contacts?.[0]?.profile?.name }
  })

  let conversation = await prisma.conversation.findFirst({
    where: { tenantId, contactId: contact.id, status: { in: ['OPEN', 'BOT'] } }
  })

  if (!conversation) {
    conversation = await prisma.conversation.create({
      data: { tenantId, phoneNumberId: phoneNumber.id, contactId: contact.id, status: 'BOT' }
    })
  }

  await prisma.message.create({
    data: {
      tenantId,
      phoneNumberId: phoneNumber.id,
      contactId: contact.id,
      conversationId: conversation.id,
      waMessageId: msg.id,
      direction: 'INBOUND',
      type: (msg.type?.toUpperCase() ?? 'TEXT') as 'TEXT' | 'IMAGE' | 'DOCUMENT' | 'AUDIO' | 'VIDEO' | 'TEMPLATE',
      content: text ?? '[non-text message]',
      status: 'READ'
    }
  })

  if (text && conversation.status === 'BOT' && phoneNumber.botEnabled) {
    await handleInboundMessage({ tenantId, conversationId: conversation.id, phoneNumber, contact, message: text })
  }
}

async function handleStatusUpdate(status: MetaStatus): Promise<void> {
  const { id: waMessageId, status: newStatus, timestamp } = status

  const updateData: Record<string, unknown> = { status: newStatus.toUpperCase() }

  if (newStatus === 'sent')      updateData.sentAt      = new Date(Number(timestamp) * 1000)
  if (newStatus === 'delivered') updateData.deliveredAt = new Date(Number(timestamp) * 1000)
  if (newStatus === 'read')      updateData.readAt      = new Date(Number(timestamp) * 1000)
  if (newStatus === 'failed')    updateData.errorMessage = status.errors?.[0]?.message

  await prisma.message.updateMany({ where: { waMessageId }, data: updateData })
}
