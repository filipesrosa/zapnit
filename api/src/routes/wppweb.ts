import type { FastifyInstance } from 'fastify'
import { randomBytes } from 'crypto'
import { mgr, WEBHOOK_EVENTS } from '../services/wppweb.js'
import { baileysManager } from '../services/baileys.js'
import { authenticateUser } from '../middleware/auth.js'
import { prisma } from '../db.js'
import { qrMessagesQueue } from '../queues.js'
import { getTrialWatermark } from '../services/systemConfig.js'

// To revert: set WPPWEB_USE_BAILEYS=false (or remove it) and rebuild.
const USE_BAILEYS = process.env.WPPWEB_USE_BAILEYS === 'true'
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mgr: any = USE_BAILEYS ? baileysManager : mgr
const jobInstanceType = USE_BAILEYS ? 'baileys' : 'wppweb'
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const msgTable: any = USE_BAILEYS ? prisma.baileysMessage : msgTable

interface Params { id: string }
interface SendBody { phone: string; message: string }
interface SendImageBody    { phone: string; mediaUrl?: string; mediaBase64?: string; caption?: string }
interface SendAudioBody    { phone: string; mediaUrl?: string; mediaBase64?: string; mimetype?: string; ptt?: boolean }
interface SendDocumentBody { phone: string; mediaUrl?: string; mediaBase64?: string; filename?: string; caption?: string; mimetype?: string }
interface EventsQuery { token?: string }
interface WebhookBody { url: string; events: string[] }
interface AiConfigBody { aiEnabled: boolean; aiSystemPrompt?: string; qrCodeDetection?: boolean }

// Instância WPP Web: id fixo de 32 caracteres (A-Z maiúsculas + dígitos).
const ID_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
function generateWppId(): string {
  const bytes = randomBytes(32)
  let id = ''
  for (let i = 0; i < 32; i++) id += ID_ALPHABET[bytes[i] % ID_ALPHABET.length]
  return id
}

function blockedReply(reply: any, activationStatus: string) {
  return reply.status(402).send({
    error: 'instance_not_active',
    activation_status: activationStatus,
    message: activationStatus === 'trial_expired'
      ? 'Período de trial encerrado. Escolha um plano para continuar.'
      : 'Instância pausada. Regularize o pagamento para continuar.',
    payment_url: '/dashboard/billing',
  })
}

export default async function wppwebRoutes(app: FastifyInstance) {
  // POST /wpp-instances/:id/send-text — autenticado por X-Client-Token (sem JWT)
  app.post<{ Params: Params; Body: SendBody }>(
    '/wpp-instances/:id/send-text',
    {
      schema: {
        body: {
          type: 'object',
          required: ['phone', 'message'],
          properties: {
            phone:   { type: 'string' },
            message: { type: 'string' },
          },
        },
      },
    },
    async (req, reply) => {
      const clientToken = req.headers['x-client-token']
      if (!clientToken || typeof clientToken !== 'string') {
        return reply.status(401).send({ error: 'X-Client-Token ausente' })
      }

      const result = await mgr.getByUserToken(req.params.id, clientToken)
      if (!result) return reply.status(401).send({ error: 'Token inválido ou instância não encontrada' })
      const { instance, userId } = result

      if (instance.activationStatus === 'paused' || instance.activationStatus === 'trial_expired') {
        return blockedReply(reply, instance.activationStatus)
      }

      const isTrial = instance.activationStatus === 'trial'
      const watermark = isTrial ? await getTrialWatermark() : ''
      const message = isTrial ? `${watermark}\n\n${req.body.message}` : req.body.message

      const record = await msgTable.create({
        data: { userId, instanceId: req.params.id, messageId: null, ip: req.ip ?? null, status: 'queued' },
      })

      await qrMessagesQueue.add('send', {
        zapnitId: record.id, instanceId: req.params.id, userId,
        instanceType: jobInstanceType, sendType: 'text',
        phone: req.body.phone, message,
      })

      return { zapnitId: record.id, status: 'queued' }
    }
  )

  // POST /wpp-instances/:id/send-image (X-Client-Token)
  app.post<{ Params: Params; Body: SendImageBody }>(
    '/wpp-instances/:id/send-image',
    {
      schema: {
        body: {
          type: 'object',
          required: ['phone'],
          properties: {
            phone:       { type: 'string' },
            mediaUrl:    { type: 'string' },
            mediaBase64: { type: 'string' },
            caption:     { type: 'string' },
          },
        },
      },
    },
    async (req, reply) => {
      const clientToken = req.headers['x-client-token']
      if (!clientToken || typeof clientToken !== 'string') return reply.status(401).send({ error: 'X-Client-Token ausente' })
      const result = await mgr.getByUserToken(req.params.id, clientToken)
      if (!result) return reply.status(401).send({ error: 'Token inválido ou instância não encontrada' })
      const { instance, userId } = result

      if (instance.activationStatus === 'paused' || instance.activationStatus === 'trial_expired') {
        return blockedReply(reply, instance.activationStatus)
      }

      if (!req.body.mediaUrl && !req.body.mediaBase64) {
        return reply.status(400).send({ error: 'Informe mediaUrl ou mediaBase64' })
      }

      const isTrial = instance.activationStatus === 'trial'
      const watermark = isTrial ? await getTrialWatermark() : ''
      const caption = isTrial
        ? `${watermark}\n\n${req.body.caption ?? ''}`.trim()
        : req.body.caption

      const record = await msgTable.create({
        data: { userId, instanceId: req.params.id, messageId: null, ip: req.ip ?? null, status: 'queued' },
      })

      await qrMessagesQueue.add('send', {
        zapnitId: record.id, instanceId: req.params.id, userId,
        instanceType: jobInstanceType, sendType: 'image',
        phone: req.body.phone, mediaUrl: req.body.mediaUrl, mediaBase64: req.body.mediaBase64, caption,
      })

      return { zapnitId: record.id, status: 'queued' }
    }
  )

  // POST /wpp-instances/:id/send-audio (X-Client-Token)
  app.post<{ Params: Params; Body: SendAudioBody }>(
    '/wpp-instances/:id/send-audio',
    {
      schema: {
        body: {
          type: 'object',
          required: ['phone'],
          properties: {
            phone:       { type: 'string' },
            mediaUrl:    { type: 'string' },
            mediaBase64: { type: 'string' },
            mimetype:    { type: 'string' },
            ptt:         { type: 'boolean' },
          },
        },
      },
    },
    async (req, reply) => {
      const clientToken = req.headers['x-client-token']
      if (!clientToken || typeof clientToken !== 'string') return reply.status(401).send({ error: 'X-Client-Token ausente' })
      const result = await mgr.getByUserToken(req.params.id, clientToken)
      if (!result) return reply.status(401).send({ error: 'Token inválido ou instância não encontrada' })
      const { instance, userId } = result

      if (instance.activationStatus === 'paused' || instance.activationStatus === 'trial_expired') {
        return blockedReply(reply, instance.activationStatus)
      }

      if (!req.body.mediaUrl && !req.body.mediaBase64) {
        return reply.status(400).send({ error: 'Informe mediaUrl ou mediaBase64' })
      }

      const record = await msgTable.create({
        data: { userId, instanceId: req.params.id, messageId: null, ip: req.ip ?? null, status: 'queued' },
      })

      await qrMessagesQueue.add('send', {
        zapnitId: record.id, instanceId: req.params.id, userId,
        instanceType: jobInstanceType, sendType: 'audio',
        phone: req.body.phone, mediaUrl: req.body.mediaUrl, mediaBase64: req.body.mediaBase64,
        mimetype: req.body.mimetype, ptt: req.body.ptt,
      })

      return { zapnitId: record.id, status: 'queued' }
    }
  )

  // POST /wpp-instances/:id/send-document (X-Client-Token)
  app.post<{ Params: Params; Body: SendDocumentBody }>(
    '/wpp-instances/:id/send-document',
    {
      schema: {
        body: {
          type: 'object',
          required: ['phone'],
          properties: {
            phone:       { type: 'string' },
            mediaUrl:    { type: 'string' },
            mediaBase64: { type: 'string' },
            filename:    { type: 'string' },
            caption:     { type: 'string' },
            mimetype:    { type: 'string' },
          },
        },
      },
    },
    async (req, reply) => {
      const clientToken = req.headers['x-client-token']
      if (!clientToken || typeof clientToken !== 'string') return reply.status(401).send({ error: 'X-Client-Token ausente' })
      const result = await mgr.getByUserToken(req.params.id, clientToken)
      if (!result) return reply.status(401).send({ error: 'Token inválido ou instância não encontrada' })
      const { instance, userId } = result

      if (instance.activationStatus === 'paused' || instance.activationStatus === 'trial_expired') {
        return blockedReply(reply, instance.activationStatus)
      }

      if (!req.body.mediaUrl && !req.body.mediaBase64) {
        return reply.status(400).send({ error: 'Informe mediaUrl ou mediaBase64' })
      }

      const isTrial = instance.activationStatus === 'trial'
      const watermark = isTrial ? await getTrialWatermark() : ''
      const caption = isTrial
        ? `${watermark}\n\n${req.body.caption ?? ''}`.trim()
        : req.body.caption

      const record = await msgTable.create({
        data: { userId, instanceId: req.params.id, messageId: null, ip: req.ip ?? null, status: 'queued' },
      })

      await qrMessagesQueue.add('send', {
        zapnitId: record.id, instanceId: req.params.id, userId,
        instanceType: jobInstanceType, sendType: 'document',
        phone: req.body.phone, mediaUrl: req.body.mediaUrl, mediaBase64: req.body.mediaBase64,
        filename: req.body.filename, caption, mimetype: req.body.mimetype,
      })

      return { zapnitId: record.id, status: 'queued' }
    }
  )

  // GET /wpp-instances/:id/messages/:zapnitId — poll send status
  app.get<{ Params: { id: string; zapnitId: string } }>(
    '/wpp-instances/:id/messages/:zapnitId',
    async (req, reply) => {
      const clientToken = req.headers['x-client-token']
      if (!clientToken || typeof clientToken !== 'string') return reply.status(401).send({ error: 'X-Client-Token ausente' })
      const result = await mgr.getByUserToken(req.params.id, clientToken)
      if (!result) return reply.status(401).send({ error: 'Token inválido ou instância não encontrada' })

      const msg = await msgTable.findFirst({
        where: { id: req.params.zapnitId, instanceId: req.params.id },
      })
      if (!msg) return reply.status(404).send({ error: 'Message not found' })
      return { zapnitId: msg.id, status: msg.status, messageId: msg.messageId, error: msg.error, createdAt: msg.createdAt }
    }
  )

  // GET /wpp-instances/:id/qr-code — retorna base64 do QR code atual (X-Client-Token)
  app.get<{ Params: Params }>('/wpp-instances/:id/qr-code', async (req, reply) => {
    const clientToken = req.headers['x-client-token']
    if (!clientToken || typeof clientToken !== 'string') {
      return reply.status(401).send({ error: 'X-Client-Token ausente' })
    }

    const result = await mgr.getByUserToken(req.params.id, clientToken)
    if (!result) return reply.status(401).send({ error: 'Token inválido ou instância não encontrada' })

    const { instance } = result
    if (instance.status !== 'qr' || !instance.qrDataUrl) {
      return reply.status(409).send({ error: 'QR code não disponível', status: instance.status })
    }
    return { qrBase64: instance.qrDataUrl }
  })

  // GET /wpp-instances/:id/events — SSE com JWT via query string
  app.get<{ Params: Params; Querystring: EventsQuery }>('/wpp-instances/:id/events', async (req, reply) => {
    const queryToken = req.query.token
    if (!queryToken) return reply.status(401).send({ error: 'Token ausente' })

    let userId: string
    try {
      const decoded = app.jwt.verify<{ userId: string }>(queryToken)
      userId = decoded.userId
    } catch {
      return reply.status(401).send({ error: 'Token inválido' })
    }

    const user = await prisma.user.findUnique({ where: { id: userId } })
    if (!user) return reply.status(401).send({ error: 'Unauthorized' })

    const instance = mgr.getForUser(req.params.id, userId)
    if (!instance) return reply.status(404).send({ error: 'Instância não encontrada' })

    const raw = reply.raw
    const origin = req.headers.origin ?? '*'
    raw.setHeader('Access-Control-Allow-Origin', origin)
    raw.setHeader('Access-Control-Allow-Credentials', 'true')
    raw.setHeader('Content-Type', 'text/event-stream')
    raw.setHeader('Cache-Control', 'no-cache')
    raw.setHeader('Connection', 'keep-alive')
    raw.setHeader('X-Accel-Buffering', 'no')
    raw.flushHeaders()

    reply.hijack()

    const send = (event: string, data: unknown) => {
      try { raw.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`) } catch (_) {}
    }

    send('status', { status: instance.status })
    if (instance.qrDataUrl && instance.status === 'qr') {
      send('qr', { qr: instance.qrDataUrl })
    }
    if (instance.status === 'connected') {
      send('connected', { waNumber: instance.waNumber, waName: instance.waName })
    }

    const onQr      = (qr: string)     => send('qr', { qr })
    const onStatus  = (status: string) => send('status', { status })
    const onConnect = (info: unknown)  => send('connected', info)

    instance.on('qr', onQr)
    instance.on('status', onStatus)
    instance.on('connected', onConnect)

    const heartbeat = setInterval(() => {
      try { raw.write(': ping\n\n') } catch (_) { clearInterval(heartbeat) }
    }, 25000)

    await new Promise<void>((resolve) => {
      req.raw.on('close', resolve)
    })

    instance.off('qr', onQr)
    instance.off('status', onStatus)
    instance.off('connected', onConnect)
    clearInterval(heartbeat)
  })

  // Rotas abaixo exigem JWT via Authorization header
  await app.register(async (auth) => {
    auth.addHook('preHandler', authenticateUser)

    // POST /wpp-instances — criar e iniciar nova instância (trial 2 dias)
    auth.post('/wpp-instances', async (req, reply) => {
      const userId = req.authUser.id
      const id = generateWppId()
      const instance = await mgr.create(id, userId)
      instance.connect()
      return reply.status(201).send(instance.info())
    })

    // GET /wpp-instances — listar instâncias do usuário
    auth.get('/wpp-instances', async (req) => mgr.allForUser(req.authUser.id))

    // GET /wpp-instances/:id/status
    auth.get<{ Params: Params }>('/wpp-instances/:id/status', async (req, reply) => {
      const instance = mgr.getForUser(req.params.id, req.authUser.id)
      if (!instance) return reply.status(404).send({ error: 'Instância não encontrada' })
      return instance.info()
    })

    // POST /wpp-instances/:id/pairing-code — código para vincular sem QR (JWT)
    auth.post<{ Params: Params; Body: { phone: string } }>(
      '/wpp-instances/:id/pairing-code',
      {
        schema: {
          body: {
            type: 'object',
            required: ['phone'],
            properties: { phone: { type: 'string' } },
          },
        },
      },
      async (req, reply) => {
        const instance = mgr.getForUser(req.params.id, req.authUser.id)
        if (!instance) return reply.status(404).send({ error: 'Instância não encontrada' })
        try {
          const code = await instance.requestPairingCode(req.body.phone)
          return { code }
        } catch (err: unknown) {
          return reply.status(409).send({ error: (err as Error).message })
        }
      }
    )

    // DELETE /wpp-instances/:id — desconectar e remover
    auth.delete<{ Params: Params }>('/wpp-instances/:id', async (req, reply) => {
      const instance = mgr.getForUser(req.params.id, req.authUser.id)
      if (!instance) return reply.status(404).send({ error: 'Instância não encontrada' })
      await mgr.remove(req.params.id)
      return reply.status(204).send()
    })

    // PUT /wpp-instances/:id/webhook
    auth.put<{ Params: Params; Body: WebhookBody }>(
      '/wpp-instances/:id/webhook',
      {
        schema: {
          body: {
            type: 'object',
            required: ['url', 'events'],
            properties: {
              url: { type: 'string', format: 'uri' },
              events: {
                type: 'array',
                items: { type: 'string', enum: WEBHOOK_EVENTS as unknown as string[] },
                minItems: 1,
              },
            },
          },
        },
      },
      async (req, reply) => {
        const invalid = req.body.events.filter(e => !(WEBHOOK_EVENTS as readonly string[]).includes(e))
        if (invalid.length) return reply.status(400).send({ error: `Eventos inválidos: ${invalid.join(', ')}` })

        const instance = await mgr.updateWebhook(req.params.id, req.authUser.id, req.body.url, req.body.events)
        if (!instance) return reply.status(404).send({ error: 'Instância não encontrada' })
        return instance.info()
      }
    )

    // DELETE /wpp-instances/:id/webhook
    auth.delete<{ Params: Params }>('/wpp-instances/:id/webhook', async (req, reply) => {
      const instance = await mgr.updateWebhook(req.params.id, req.authUser.id, null, [])
      if (!instance) return reply.status(404).send({ error: 'Instância não encontrada' })
      return reply.status(204).send()
    })

    // PUT /wpp-instances/:id/ai — configurar IA Gemini
    auth.put<{ Params: Params; Body: AiConfigBody }>(
      '/wpp-instances/:id/ai',
      {
        schema: {
          body: {
            type: 'object',
            required: ['aiEnabled'],
            properties: {
              aiEnabled:       { type: 'boolean' },
              aiSystemPrompt:  { type: 'string' },
              qrCodeDetection: { type: 'boolean' },
            },
          },
        },
      },
      async (req, reply) => {
        const instance = await mgr.updateAi(
          req.params.id,
          req.authUser.id,
          req.body.aiEnabled,
          req.body.aiSystemPrompt ?? null,
          req.body.qrCodeDetection ?? false,
        )
        if (!instance) return reply.status(404).send({ error: 'Instância não encontrada' })
        return instance.info()
      }
    )
  })
}
