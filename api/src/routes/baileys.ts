import type { FastifyInstance } from 'fastify'
import { customAlphabet } from 'nanoid'

const generateInstanceId = customAlphabet('ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789', 32)
const newInstanceId = () => `ZN-${generateInstanceId()}`
import { baileysManager, WEBHOOK_EVENTS } from '../services/baileys.js'
import { authenticateUser } from '../middleware/auth.js'
import { prisma } from '../db.js'
import { qrMessagesQueue } from '../queues.js'
import { getTrialWatermark } from '../services/systemConfig.js'

interface Params { id: string }
interface SendBody { phone: string; message: string }
interface SendImageBody   { phone: string; mediaUrl?: string; mediaBase64?: string; caption?: string }
interface SendAudioBody   { phone: string; mediaUrl?: string; mediaBase64?: string; mimetype?: string; ptt?: boolean }
interface SendDocumentBody { phone: string; mediaUrl?: string; mediaBase64?: string; filename?: string; caption?: string; mimetype?: string }
interface EventsQuery { token?: string }
interface WebhookBody { url: string; events: string[] }
interface AiConfigBody { aiEnabled: boolean; aiSystemPrompt?: string; qrCodeDetection?: boolean }

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

export default async function baileysRoutes(app: FastifyInstance) {
  // POST /instances/:id/send-text — autenticado por X-Client-Token (sem JWT)
  app.post<{ Params: Params; Body: SendBody }>(
    '/instances/:id/send-text',
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

      const result = await baileysManager.getByUserToken(req.params.id, clientToken)
      if (!result) return reply.status(401).send({ error: 'Token inválido ou instância não encontrada' })
      const { instance, userId } = result

      if (instance.activationStatus === 'paused' || instance.activationStatus === 'trial_expired') {
        return blockedReply(reply, instance.activationStatus)
      }

      const isTrial = instance.activationStatus === 'trial'
      const watermark = isTrial ? await getTrialWatermark() : ''
      const message = isTrial ? `${watermark}\n\n${req.body.message}` : req.body.message

      const record = await prisma.baileysMessage.create({
        data: { userId, instanceId: req.params.id, messageId: null, ip: req.ip ?? null, status: 'queued' }
      })

      await qrMessagesQueue.add('send', {
        zapnitId: record.id,
        instanceId: req.params.id,
        userId,
        instanceType: 'baileys',
        sendType: 'text',
        phone: req.body.phone,
        message,
      })

      return { zapnitId: record.id, status: 'queued' }
    }
  )

  // POST /instances/:id/send-image (X-Client-Token)
  app.post<{ Params: Params; Body: SendImageBody }>(
    '/instances/:id/send-image',
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
      const result = await baileysManager.getByUserToken(req.params.id, clientToken)
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

      const record = await prisma.baileysMessage.create({
        data: { userId, instanceId: req.params.id, messageId: null, ip: req.ip ?? null, status: 'queued' },
      })

      await qrMessagesQueue.add('send', {
        zapnitId: record.id, instanceId: req.params.id, userId,
        instanceType: 'baileys', sendType: 'image',
        phone: req.body.phone, mediaUrl: req.body.mediaUrl, mediaBase64: req.body.mediaBase64, caption,
      })

      return { zapnitId: record.id, status: 'queued' }
    }
  )

  // POST /instances/:id/send-audio (X-Client-Token)
  app.post<{ Params: Params; Body: SendAudioBody }>(
    '/instances/:id/send-audio',
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
      const result = await baileysManager.getByUserToken(req.params.id, clientToken)
      if (!result) return reply.status(401).send({ error: 'Token inválido ou instância não encontrada' })
      const { instance, userId } = result

      if (instance.activationStatus === 'paused' || instance.activationStatus === 'trial_expired') {
        return blockedReply(reply, instance.activationStatus)
      }

      if (!req.body.mediaUrl && !req.body.mediaBase64) {
        return reply.status(400).send({ error: 'Informe mediaUrl ou mediaBase64' })
      }

      const record = await prisma.baileysMessage.create({
        data: { userId, instanceId: req.params.id, messageId: null, ip: req.ip ?? null, status: 'queued' },
      })

      await qrMessagesQueue.add('send', {
        zapnitId: record.id, instanceId: req.params.id, userId,
        instanceType: 'baileys', sendType: 'audio',
        phone: req.body.phone, mediaUrl: req.body.mediaUrl, mediaBase64: req.body.mediaBase64,
        mimetype: req.body.mimetype, ptt: req.body.ptt,
      })

      return { zapnitId: record.id, status: 'queued' }
    }
  )

  // POST /instances/:id/send-document (X-Client-Token)
  app.post<{ Params: Params; Body: SendDocumentBody }>(
    '/instances/:id/send-document',
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
      const result = await baileysManager.getByUserToken(req.params.id, clientToken)
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
        ? `${req.body.caption ?? ''}\n\n${watermark}`.trim()
        : req.body.caption

      const record = await prisma.baileysMessage.create({
        data: { userId, instanceId: req.params.id, messageId: null, ip: req.ip ?? null, status: 'queued' },
      })

      await qrMessagesQueue.add('send', {
        zapnitId: record.id, instanceId: req.params.id, userId,
        instanceType: 'baileys', sendType: 'document',
        phone: req.body.phone, mediaUrl: req.body.mediaUrl, mediaBase64: req.body.mediaBase64,
        filename: req.body.filename, caption, mimetype: req.body.mimetype,
      })

      return { zapnitId: record.id, status: 'queued' }
    }
  )

  // GET /instances/:id/messages/:zapnitId — poll send status
  app.get<{ Params: { id: string; zapnitId: string } }>(
    '/instances/:id/messages/:zapnitId',
    async (req, reply) => {
      const clientToken = req.headers['x-client-token']
      if (!clientToken || typeof clientToken !== 'string') return reply.status(401).send({ error: 'X-Client-Token ausente' })
      const result = await baileysManager.getByUserToken(req.params.id, clientToken)
      if (!result) return reply.status(401).send({ error: 'Token inválido ou instância não encontrada' })

      const msg = await prisma.baileysMessage.findFirst({
        where: { id: req.params.zapnitId, instanceId: req.params.id },
      })
      if (!msg) return reply.status(404).send({ error: 'Message not found' })
      return { zapnitId: msg.id, status: msg.status, messageId: msg.messageId, error: msg.error, createdAt: msg.createdAt }
    }
  )

  // GET /instances/:id/qr-code — retorna base64 do QR code atual (X-Client-Token)
  app.get<{ Params: Params }>('/instances/:id/qr-code', async (req, reply) => {
    const clientToken = req.headers['x-client-token']
    if (!clientToken || typeof clientToken !== 'string') {
      return reply.status(401).send({ error: 'X-Client-Token ausente' })
    }

    const result = await baileysManager.getByUserToken(req.params.id, clientToken)
    if (!result) return reply.status(401).send({ error: 'Token inválido ou instância não encontrada' })

    const { instance } = result
    if (instance.status !== 'qr' || !instance.qrDataUrl) {
      return reply.status(409).send({ error: 'QR code não disponível', status: instance.status })
    }

    return { qrBase64: instance.qrDataUrl }
  })

  // POST /instances/:id/pairing-code — solicita código de 8 caracteres para vincular sem QR (X-Client-Token)
  app.post<{ Params: Params; Body: { phone: string } }>(
    '/instances/:id/pairing-code',
    {
      schema: {
        body: {
          type: 'object',
          required: ['phone'],
          properties: {
            phone: { type: 'string' },
          },
        },
      },
    },
    async (req, reply) => {
      const clientToken = req.headers['x-client-token']
      if (!clientToken || typeof clientToken !== 'string') {
        return reply.status(401).send({ error: 'X-Client-Token ausente' })
      }

      const result = await baileysManager.getByUserToken(req.params.id, clientToken)
      if (!result) return reply.status(401).send({ error: 'Token inválido ou instância não encontrada' })

      const { instance } = result
      try {
        const code = await instance.requestPairingCode(req.body.phone)
        return { code }
      } catch (err: unknown) {
        return reply.status(409).send({ error: (err as Error).message })
      }
    }
  )

  // GET /instances/:id/events — SSE com JWT via query string (EventSource não suporta headers)
  app.get<{ Params: Params; Querystring: EventsQuery }>('/instances/:id/events', async (req, reply) => {
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

    const instance = baileysManager.getForUser(req.params.id, userId)
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

    // POST /instances — criar e iniciar nova instância (trial 2 dias)
    auth.post('/instances', async (req, reply) => {
      const userId = req.authUser.id
      const id = newInstanceId()
      const instance = await baileysManager.create(id, userId)
      instance.connect().catch(err => app.log.error(err, 'baileys connect error'))
      return reply.status(201).send(instance.info())
    })

    // GET /instances — listar instâncias do usuário
    auth.get('/instances', async (req) => baileysManager.allForUser(req.authUser.id))

    // GET /instances/:id/status — status atual
    auth.get<{ Params: Params }>('/instances/:id/status', async (req, reply) => {
      const instance = baileysManager.getForUser(req.params.id, req.authUser.id)
      if (!instance) return reply.status(404).send({ error: 'Instância não encontrada' })
      return instance.info()
    })

    // DELETE /instances/:id — desconectar e remover instância
    auth.delete<{ Params: Params }>('/instances/:id', async (req, reply) => {
      const instance = baileysManager.getForUser(req.params.id, req.authUser.id)
      if (!instance) return reply.status(404).send({ error: 'Instância não encontrada' })
      await baileysManager.remove(req.params.id)
      return reply.status(204).send()
    })

    // PUT /instances/:id/webhook — configurar webhook
    auth.put<{ Params: Params; Body: WebhookBody }>(
      '/instances/:id/webhook',
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

        const instance = await baileysManager.updateWebhook(req.params.id, req.authUser.id, req.body.url, req.body.events)
        if (!instance) return reply.status(404).send({ error: 'Instância não encontrada' })
        return instance.info()
      }
    )

    // POST /instances/:id/flush-sessions — clear stale Signal sessions (LID migration fix)
    // Deletes all Signal session rows from DB then reconnects. Sessions are
    // re-established fresh with LID-correct keys on the next send.
    // Fixes "Waiting for this message" on all contacts after WhatsApp LID migration.
    auth.post<{ Params: Params }>('/instances/:id/flush-sessions', async (req, reply) => {
      const ok = await baileysManager.flushSignalSessions(req.params.id, req.authUser.id)
      if (!ok) return reply.status(404).send({ error: 'Instância não encontrada' })
      return reply.status(204).send()
    })

    // DELETE /instances/:id/webhook — remover webhook
    auth.delete<{ Params: Params }>('/instances/:id/webhook', async (req, reply) => {
      const instance = await baileysManager.updateWebhook(req.params.id, req.authUser.id, null, [])
      if (!instance) return reply.status(404).send({ error: 'Instância não encontrada' })
      return reply.status(204).send()
    })

    // PUT /instances/:id/ai — configurar IA Gemini
    auth.put<{ Params: Params; Body: AiConfigBody }>(
      '/instances/:id/ai',
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
        const instance = await baileysManager.updateAi(
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
