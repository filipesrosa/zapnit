import type { FastifyInstance } from 'fastify'
import { nanoid } from 'nanoid'
import { baileysManager } from '../services/baileys.js'
import { authenticateUser } from '../middleware/auth.js'
import { prisma } from '../db.js'

interface Params { id: string }
interface SendBody { phone: string; message: string }
interface EventsQuery { token?: string }

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

      const instance = await baileysManager.getByUserToken(req.params.id, clientToken)
      if (!instance) return reply.status(401).send({ error: 'Token inválido ou instância não encontrada' })
      if (instance.status !== 'connected') return reply.status(503).send({ error: 'WhatsApp não conectado' })

      const jid = req.body.phone.replace(/\D/g, '') + '@s.whatsapp.net'
      try {
        await instance.sendText(jid, req.body.message)
        return { ok: true }
      } catch (err: unknown) {
        return reply.status(500).send({ error: (err as Error).message })
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

    // POST /instances — criar e iniciar nova instância
    auth.post('/instances', async (req, reply) => {
      const userId = req.authUser.id
      const id = nanoid(12)
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
  })
}
