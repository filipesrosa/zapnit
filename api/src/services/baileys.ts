import {
  makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  downloadMediaMessage,
  type WASocket,
  type ConnectionState,
  proto,
} from '@whiskeysockets/baileys'
import { toDataURL } from 'qrcode'
import pino from 'pino'
import { EventEmitter } from 'events'
import { rmSync } from 'fs'
import { join } from 'path'
import { prisma } from '../db.js'
import { askGemini } from './gemini.js'
import { decodeQRCode } from './qrcode-reader.js'

export type MediaType = 'image' | 'audio' | 'video' | 'document'

const silentLogger = pino({ level: 'silent' })

export type InstanceStatus = 'disconnected' | 'qr' | 'connected'

export const WEBHOOK_EVENTS = [
  'messages.upsert',
  'messages.update',
  'messages.reaction',
  'message-receipt.update',
  'messages.delete',
  'presence.update',
  'call',
  'qrcode.detected',
] as const

export type WebhookEvent = typeof WEBHOOK_EVENTS[number]

export interface InstanceInfo {
  id: string
  userId: string | null
  status: InstanceStatus
  qrDataUrl: string | null
  waNumber: string | null
  waName: string | null
  connectedAt: string | null
  webhookUrl: string | null
  webhookEvents: string[]
  aiEnabled: boolean
  aiSystemPrompt: string | null
  qrCodeDetection: boolean
}

class BaileysInstance extends EventEmitter {
  readonly id: string
  userId: string | null
  status: InstanceStatus = 'disconnected'
  qrDataUrl: string | null = null
  waNumber: string | null = null
  waName: string | null = null
  connectedAt: string | null = null
  webhookUrl: string | null = null
  webhookEvents: string[] = []
  aiEnabled: boolean = false
  aiSystemPrompt: string | null = null
  qrCodeDetection: boolean = false

  private sock: WASocket | null = null
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private readonly authDir: string
  private messageStore = new Map<string, proto.IMessage>()
  private readonly MESSAGE_STORE_LIMIT = 500

  constructor(
    id: string,
    userId: string | null = null,
    webhookUrl: string | null = null,
    webhookEvents: string[] = [],
    aiEnabled: boolean = false,
    aiSystemPrompt: string | null = null,
    qrCodeDetection: boolean = false,
  ) {
    super()
    this.id = id
    this.userId = userId
    this.webhookUrl = webhookUrl
    this.webhookEvents = webhookEvents
    this.aiEnabled = aiEnabled
    this.aiSystemPrompt = aiSystemPrompt
    this.qrCodeDetection = qrCodeDetection
    this.authDir = join(process.cwd(), 'sessions', id)
  }

  private async _fireWebhook(event: string, data: unknown) {
    if (!this.webhookUrl || !this.webhookEvents.includes(event)) return
    try {
      await fetch(this.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instanceId: this.id, event, timestamp: new Date().toISOString(), data }),
        signal: AbortSignal.timeout(10000),
      })
    } catch (err) {
      console.error(`[baileys] webhook error ${this.id}`, err)
    }
  }

  private _storeMessage(id: string, message: proto.IMessage) {
    if (this.messageStore.size >= this.MESSAGE_STORE_LIMIT) {
      this.messageStore.delete(this.messageStore.keys().next().value!)
    }
    this.messageStore.set(id, message)
    // Persist to DB so getMessage survives restarts
    prisma.baileysMessageStore.upsert({
      where: { instanceId_messageId: { instanceId: this.id, messageId: id } },
      create: { instanceId: this.id, messageId: id, content: message as object },
      update: { content: message as object },
    }).catch(() => {})
  }

  private async _handleAiMessage(msg: proto.IWebMessageInfo): Promise<void> {
    const from = msg.key.remoteJid
    if (!from || !msg.message) return

    const { message } = msg

    const text =
      message.conversation ||
      message.extendedTextMessage?.text ||
      undefined

    const hasImage    = !!message.imageMessage
    const hasAudio    = !!message.audioMessage
    const hasDocument = !!message.documentMessage

    if (!text && !hasImage && !hasAudio && !hasDocument) return

    try {
      // Download buffer once for any media type
      let buffer: Buffer | undefined
      if (hasImage || hasAudio || hasDocument) {
        buffer = await downloadMediaMessage(
          msg,
          'buffer',
          {},
          this.sock ? { logger: silentLogger, reuploadRequest: this.sock.updateMediaMessage } : undefined,
        ) as Buffer
      }

      // QR code detection (images only) — fires webhook and returns, skipping AI
      if (hasImage && this.qrCodeDetection && buffer) {
        const qrContent = await decodeQRCode(buffer)
        if (qrContent) {
          await this._fireWebhook('qrcode.detected', { from, content: qrContent })
          return
        }
      }

      // AI processing
      if (!this.aiEnabled) return

      let response: string

      if (text && !hasImage && !hasAudio && !hasDocument) {
        response = await askGemini(this.aiSystemPrompt, text)
      } else if (buffer) {
        let mimeType: string
        let caption: string | undefined

        if (hasImage) {
          mimeType = message.imageMessage!.mimetype ?? 'image/jpeg'
          caption  = message.imageMessage!.caption ?? text
        } else if (hasAudio) {
          mimeType = message.audioMessage!.mimetype ?? 'audio/ogg'
          caption  = text
        } else {
          // document — only PDF supported
          mimeType = message.documentMessage!.mimetype ?? 'application/octet-stream'
          if (!mimeType.includes('pdf')) return
          caption = message.documentMessage!.caption ?? text
        }

        response = await askGemini(this.aiSystemPrompt, caption, { data: buffer, mimeType })
      } else {
        return
      }

      await this.sendText(from, response)
    } catch (err) {
      console.error(`[baileys] AI error ${this.id}`, err)
    }
  }

  setWebhook(url: string | null, events: string[]) {
    this.webhookUrl = url
    this.webhookEvents = events
  }

  setAi(enabled: boolean, systemPrompt: string | null, qrCodeDetection: boolean) {
    this.aiEnabled = enabled
    this.aiSystemPrompt = systemPrompt
    this.qrCodeDetection = qrCodeDetection
  }

  async connect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }

    if (this.sock) {
      try { this.sock.end(undefined) } catch (_) {}
      this.sock = null
    }

    const { state, saveCreds } = await useMultiFileAuthState(this.authDir)
    const { version } = await fetchLatestBaileysVersion()

    // Clean up message store entries older than 7 days on every connect
    prisma.baileysMessageStore.deleteMany({
      where: {
        instanceId: this.id,
        createdAt: { lt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
      },
    }).catch(() => {})

    const sock = makeWASocket({
      version,
      logger: silentLogger,
      auth: state,
      printQRInTerminal: false,
      getMessage: async (key) => {
        if (!key.id) return undefined
        const cached = this.messageStore.get(key.id)
        if (cached) return cached
        // Fallback to DB — covers messages from before server restart
        try {
          const row = await prisma.baileysMessageStore.findUnique({
            where: { instanceId_messageId: { instanceId: this.id, messageId: key.id } },
          })
          if (row) return row.content as proto.IMessage
        } catch {}
        return undefined
      },
    })

    this.sock = sock

    sock.ev.on('connection.update', async (update: Partial<ConnectionState>) => {
      if (sock !== this.sock) return

      const { connection, lastDisconnect, qr } = update

      if (qr) {
        this.status = 'qr'
        this.qrDataUrl = await toDataURL(qr)
        this.emit('qr', this.qrDataUrl)
        this.emit('status', 'qr')
      }

      if (connection === 'close') {
        this.status = 'disconnected'
        this.qrDataUrl = null
        this.waNumber = null
        this.waName = null
        this.connectedAt = null
        this.emit('status', 'disconnected')

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const statusCode = (lastDisconnect?.error as any)?.output?.statusCode
        const loggedOut = statusCode === DisconnectReason.loggedOut

        if (loggedOut) {
          rmSync(this.authDir, { recursive: true, force: true })
          this.emit('logged_out')
        }

        this.reconnectTimer = setTimeout(() => this.connect(), loggedOut ? 1000 : 3000)
      }

      if (connection === 'open') {
        this.status = 'connected'
        this.qrDataUrl = null
        this.connectedAt = new Date().toISOString()

        const [numberWithDevice] = (sock.user!.id).split('@')
        const [number] = numberWithDevice.split(':')
        this.waNumber = number
        this.waName = sock.user!.name ?? null

        this.emit('status', 'connected')
        this.emit('connected', { waNumber: this.waNumber, waName: this.waName })
      }
    })

    sock.ev.on('creds.update', saveCreds)

    sock.ev.on('messages.upsert', (data) => {
      for (const msg of data.messages) {
        if (msg.key.id && msg.message) this._storeMessage(msg.key.id, msg.message)
      }
      this._fireWebhook('messages.upsert', data)

      if ((this.aiEnabled || this.qrCodeDetection) && data.type === 'notify') {
        for (const msg of data.messages) {
          if (!msg.key.fromMe && msg.message) {
            this._handleAiMessage(msg).catch(err =>
              console.error(`[baileys] AI handle error ${this.id}`, err)
            )
          }
        }
      }
    })
    sock.ev.on('messages.update', (data) => this._fireWebhook('messages.update', data))
    sock.ev.on('messages.reaction', (data) => this._fireWebhook('messages.reaction', data))
    sock.ev.on('message-receipt.update', (data) => this._fireWebhook('message-receipt.update', data))
    sock.ev.on('messages.delete', (data) => this._fireWebhook('messages.delete', data))
    sock.ev.on('presence.update', (data) => this._fireWebhook('presence.update', data))
    sock.ev.on('call', (data) => this._fireWebhook('call', data))
  }

  disconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    if (this.sock) {
      try { this.sock.end(undefined) } catch (_) {}
      this.sock = null
    }
    this.status = 'disconnected'
    this.qrDataUrl = null
    rmSync(this.authDir, { recursive: true, force: true })
  }

  async sendText(to: string, text: string): Promise<string | undefined> {
    if (!this.sock || this.status !== 'connected') throw new Error('Instância não conectada')
    const result = await this.sock.sendMessage(to, { text })
    if (result?.key?.id && result?.message) this._storeMessage(result.key.id, result.message)
    return result?.key?.id ?? undefined
  }

  async sendMedia(
    to: string,
    mediaType: MediaType,
    media: Buffer | { url: string },
    options: { caption?: string; filename?: string; mimetype?: string; ptt?: boolean } = {},
  ): Promise<string | undefined> {
    if (!this.sock || this.status !== 'connected') throw new Error('Instância não conectada')

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let content: any

    switch (mediaType) {
      case 'image':
        content = { image: media, caption: options.caption }
        break
      case 'audio':
        content = { audio: media, mimetype: options.mimetype ?? 'audio/mp4', ptt: options.ptt ?? false }
        break
      case 'video':
        content = { video: media, caption: options.caption }
        break
      case 'document':
        content = {
          document: media,
          mimetype: options.mimetype ?? 'application/octet-stream',
          fileName: options.filename ?? 'document',
          caption: options.caption,
        }
        break
    }

    const result = await this.sock.sendMessage(to, content)
    if (result?.key?.id && result?.message) this._storeMessage(result.key.id, result.message)
    return result?.key?.id ?? undefined
  }

  info(): InstanceInfo {
    return {
      id: this.id,
      userId: this.userId,
      status: this.status,
      qrDataUrl: this.qrDataUrl,
      waNumber: this.waNumber,
      waName: this.waName,
      connectedAt: this.connectedAt,
      webhookUrl: this.webhookUrl,
      webhookEvents: this.webhookEvents,
      aiEnabled: this.aiEnabled,
      aiSystemPrompt: this.aiSystemPrompt,
      qrCodeDetection: this.qrCodeDetection,
    }
  }
}

class BaileysManager {
  private instances = new Map<string, BaileysInstance>()

  async init() {
    const rows = await prisma.baileysInstance.findMany()
    for (const row of rows) {
      const instance = new BaileysInstance(
        row.id,
        row.userId,
        row.webhookUrl,
        row.webhookEvents,
        row.aiEnabled,
        row.aiSystemPrompt,
        row.qrCodeDetection,
      )
      this.instances.set(row.id, instance)
      this._watch(instance)
      instance.connect().catch(err => console.error(`[baileys] reconnect error ${row.id}`, err))
    }
  }

  async create(id: string, userId: string | null = null): Promise<BaileysInstance> {
    if (this.instances.has(id)) return this.instances.get(id)!
    const instance = new BaileysInstance(id, userId)
    this.instances.set(id, instance)
    this._watch(instance)
    await prisma.baileysInstance.create({ data: { id, userId } })
    return instance
  }

  async updateWebhook(id: string, userId: string, webhookUrl: string | null, webhookEvents: string[]): Promise<BaileysInstance | undefined> {
    const instance = this.getForUser(id, userId)
    if (!instance) return undefined
    instance.setWebhook(webhookUrl, webhookEvents)
    await prisma.baileysInstance.update({
      where: { id },
      data: { webhookUrl, webhookEvents },
    })
    return instance
  }

  async updateAi(id: string, userId: string, aiEnabled: boolean, aiSystemPrompt: string | null, qrCodeDetection: boolean): Promise<BaileysInstance | undefined> {
    const instance = this.getForUser(id, userId)
    if (!instance) return undefined
    instance.setAi(aiEnabled, aiSystemPrompt, qrCodeDetection)
    await prisma.baileysInstance.update({
      where: { id },
      data: { aiEnabled, aiSystemPrompt, qrCodeDetection },
    })
    return instance
  }

  private _watch(instance: BaileysInstance) {
    instance.on('connected', ({ waNumber, waName }: { waNumber: string; waName: string }) => {
      prisma.baileysInstance.update({
        where: { id: instance.id },
        data: { status: 'connected', waNumber, waName, connectedAt: new Date() },
      }).catch(() => {})
    })

    instance.on('status', (status: string) => {
      if (status === 'disconnected') {
        prisma.baileysInstance.update({
          where: { id: instance.id },
          data: { status: 'disconnected', waNumber: null, waName: null, connectedAt: null },
        }).catch(() => {})
      } else if (status === 'qr') {
        prisma.baileysInstance.update({
          where: { id: instance.id },
          data: { status: 'qr' },
        }).catch(() => {})
      }
    })
  }

  get(id: string): BaileysInstance | undefined {
    return this.instances.get(id)
  }

  getForUser(id: string, userId: string): BaileysInstance | undefined {
    const instance = this.instances.get(id)
    if (!instance) return undefined
    if (instance.userId !== null && instance.userId !== userId) return undefined
    return instance
  }

  async getByUserToken(id: string, clientToken: string): Promise<{ instance: BaileysInstance; userId: string } | undefined> {
    const user = await prisma.user.findUnique({ where: { clientToken } })
    if (!user) return undefined
    const instance = this.getForUser(id, user.id)
    if (!instance) return undefined
    return { instance, userId: user.id }
  }

  async remove(id: string): Promise<void> {
    const instance = this.instances.get(id)
    if (instance) {
      instance.disconnect()
      this.instances.delete(id)
    }
    await prisma.baileysInstance.delete({ where: { id } }).catch(() => {})
  }

  allForUser(userId: string): InstanceInfo[] {
    return Array.from(this.instances.values())
      .filter(i => i.userId === userId)
      .map(i => i.info())
  }
}

export const baileysManager = new BaileysManager()
