import type { FastifyInstance } from 'fastify'
import { randomBytes } from 'crypto'
import { wppwebManager, WEBHOOK_EVENTS } from '../services/wppweb.js'
import { authenticateUser } from '../middleware/auth.js'
import { prisma } from '../db.js'
import { incrementUserMessages } from '../lib/quota.js'

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

// Resolve mídia (url ou base64) para o formato { mimetype, data } esperado por
// whatsapp-web.js (MessageMedia espera base64). URLs remotas são baixadas aqui.
async function resolveMedia(
  mediaUrl: string | undefined,
  mediaBase64: string | undefined,
  mimetype: string | undefined,
): Promise<{ mimetype: string; data: string } | null> {
  if (mediaUrl) {
    const res = await fetch(mediaUrl)
    if (!res.ok) return null
    const buf = Buffer.from(await res.arrayBuffer())
    const mime = mimetype ?? res.headers.get('content-type') ?? 'application/octet-stream'
    return { mimetype: mime, data: buf.toString('base64') }
  }
  if (!mediaBase64) return null
  const dataUrlMatch = mediaBase64.match(/^data:([^;]+);base64,(.+)$/)
  if (dataUrlMatch) {
    return { mimetype: mimetype ?? dataUrlMatch[1], data: dataUrlMatch[2] }
  }
  return { mimetype: mimetype ?? 'application/octet-stream', data: mediaBase64 }
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

      const result = await wppwebManager.getByUserToken(req.params.id, clientToken)
      if (!result) return reply.status(401).send({ error: 'Token inválido ou instância não encontrada' })
      const { instance, userId } = result
      if (instance.status !== 'connected') return reply.status(503).send({ error: 'WhatsApp não conectado' })

      try {
        const messageId = await instance.sendText(req.body.phone, req.body.message)
        const record = await prisma.wppwebMessage.create({
          data: { userId, instanceId: req.params.id, messageId: messageId ?? null, ip: req.ip ?? null },
        })
        incrementUserMessages(userId)
        return { zapnitId: record.id, messageId: messageId ?? null }
      } catch (err: unknown) {
        return reply.status(500).send({ error: (err as Error).message })
      }
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
      const result = await wppwebManager.getByUserToken(req.params.id, clientToken)
      if (!result) return reply.status(401).send({ error: 'Token inválido ou instância não encontrada' })
      const { instance, userId } = result
      if (instance.status !== 'connected') return reply.status(503).send({ error: 'WhatsApp não conectado' })

      const resolved = await resolveMedia(req.body.mediaUrl, req.body.mediaBase64, 'image/jpeg')
      if (!resolved) return reply.status(400).send({ error: 'Informe mediaUrl ou mediaBase64' })

      try {
        const messageId = await instance.sendMedia(req.body.phone, 'image', resolved, { caption: req.body.caption })
        const record = await prisma.wppwebMessage.create({
          data: { userId, instanceId: req.params.id, messageId: messageId ?? null, ip: req.ip ?? null },
        })
        incrementUserMessages(userId)
        return { zapnitId: record.id, messageId: messageId ?? null }
      } catch (err: unknown) {
        return reply.status(500).send({ error: (err as Error).message })
      }
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
      const result = await wppwebManager.getByUserToken(req.params.id, clientToken)
      if (!result) return reply.status(401).send({ error: 'Token inválido ou instância não encontrada' })
      const { instance, userId } = result
      if (instance.status !== 'connected') return reply.status(503).send({ error: 'WhatsApp não conectado' })

      const resolved = await resolveMedia(req.body.mediaUrl, req.body.mediaBase64, req.body.mimetype ?? 'audio/mp4')
      if (!resolved) return reply.status(400).send({ error: 'Informe mediaUrl ou mediaBase64' })

      try {
        const messageId = await instance.sendMedia(req.body.phone, 'audio', resolved, { ptt: req.body.ptt })
        const record = await prisma.wppwebMessage.create({
          data: { userId, instanceId: req.params.id, messageId: messageId ?? null, ip: req.ip ?? null },
        })
        incrementUserMessages(userId)
        return { zapnitId: record.id, messageId: messageId ?? null }
      } catch (err: unknown) {
        return reply.status(500).send({ error: (err as Error).message })
      }
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
      const result = await wppwebManager.getByUserToken(req.params.id, clientToken)
      if (!result) return reply.status(401).send({ error: 'Token inválido ou instância não encontrada' })
      const { instance, userId } = result
      if (instance.status !== 'connected') return reply.status(503).send({ error: 'WhatsApp não conectado' })

      const resolved = await resolveMedia(req.body.mediaUrl, req.body.mediaBase64, req.body.mimetype)
      if (!resolved) return reply.status(400).send({ error: 'Informe mediaUrl ou mediaBase64' })

      try {
        const messageId = await instance.sendMedia(
          req.body.phone, 'document',
          { ...resolved, filename: req.body.filename },
          { caption: req.body.caption },
        )
        const record = await prisma.wppwebMessage.create({
          data: { userId, instanceId: req.params.id, messageId: messageId ?? null, ip: req.ip ?? null },
        })
        incrementUserMessages(userId)
        return { zapnitId: record.id, messageId: messageId ?? null }
      } catch (err: unknown) {
        return reply.status(500).send({ error: (err as Error).message })
      }
    }
  )

  // GET /wpp-instances/:id/qr-code — retorna base64 do QR code atual (X-Client-Token)
  app.get<{ Params: Params }>('/wpp-instances/:id/qr-code', async (req, reply) => {
    const clientToken = req.headers['x-client-token']
    if (!clientToken || typeof clientToken !== 'string') {
      return reply.status(401).send({ error: 'X-Client-Token ausente' })
    }

    const result = await wppwebManager.getByUserToken(req.params.id, clientToken)
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

    const instance = wppwebManager.getForUser(req.params.id, userId)
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

    // POST /wpp-instances — criar e iniciar nova instância (id de 32 chars)
    auth.post('/wpp-instances', async (req, reply) => {
      const userId = req.authUser.id
      const id = generateWppId()
      const instance = await wppwebManager.create(id, userId)
      instance.connect()
      return reply.status(201).send(instance.info())
    })

    // GET /wpp-instances — listar instâncias do usuário
    auth.get('/wpp-instances', async (req) => wppwebManager.allForUser(req.authUser.id))

    // GET /wpp-instances/:id/status
    auth.get<{ Params: Params }>('/wpp-instances/:id/status', async (req, reply) => {
      const instance = wppwebManager.getForUser(req.params.id, req.authUser.id)
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
        const instance = wppwebManager.getForUser(req.params.id, req.authUser.id)
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
      const instance = wppwebManager.getForUser(req.params.id, req.authUser.id)
      if (!instance) return reply.status(404).send({ error: 'Instância não encontrada' })
      await wppwebManager.remove(req.params.id)
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

        const instance = await wppwebManager.updateWebhook(req.params.id, req.authUser.id, req.body.url, req.body.events)
        if (!instance) return reply.status(404).send({ error: 'Instância não encontrada' })
        return instance.info()
      }
    )

    // DELETE /wpp-instances/:id/webhook
    auth.delete<{ Params: Params }>('/wpp-instances/:id/webhook', async (req, reply) => {
      const instance = await wppwebManager.updateWebhook(req.params.id, req.authUser.id, null, [])
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
        const instance = await wppwebManager.updateAi(
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
