// whatsapp-web.js (WPP Web) manager — parallel integration path to Baileys.
//
// Mirrors the public shape of services/baileys.ts (InstanceInfo, manager API,
// SSE events) so the frontend and routing layers stay symmetric, but is backed
// by whatsapp-web.js + Puppeteer instead of the Baileys protocol.
//
// whatsapp-web.js is CommonJS, so we import the default export and destructure.
import wwebPkg from 'whatsapp-web.js'
import { toDataURL } from 'qrcode'
import { EventEmitter } from 'events'
import path from 'path'
import { prisma } from '../db.js'
import { askGemini } from './gemini.js'
import { decodeQRCode } from './qrcode-reader.js'

const { Client, LocalAuth, MessageMedia } = wwebPkg

type WAClient = InstanceType<typeof Client>

export type MediaType = 'image' | 'audio' | 'video' | 'document'

export type ActivationStatus = 'trial' | 'active' | 'paused' | 'trial_expired'

export type InstanceStatus = 'disconnected' | 'qr' | 'connected'

// Session auth state lives on disk (LocalAuth). Volume-mounted in Docker.
const AUTH_PATH = process.env.WWEBJS_AUTH_PATH ?? path.resolve(process.cwd(), '.wwebjs_auth')

export const WEBHOOK_EVENTS = [
  'messages.upsert',
  'messages.update',
  'message-receipt.update',
  'presence.update',
  'call',
  'qrcode.detected',
] as const

export type WebhookEvent = typeof WEBHOOK_EVENTS[number]

export interface InstanceInfo {
  id: string
  userId: string | null
  status: InstanceStatus
  activationStatus: ActivationStatus
  trialEndsAt: string
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

function toChatId(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  return `${digits}@c.us`
}

class WppwebInstance extends EventEmitter {
  readonly id: string
  userId: string | null
  status: InstanceStatus = 'disconnected'
  activationStatus: ActivationStatus
  trialEndsAt: Date
  qrDataUrl: string | null = null
  waNumber: string | null = null
  waName: string | null = null
  connectedAt: string | null = null
  webhookUrl: string | null = null
  webhookEvents: string[] = []
  aiEnabled: boolean = false
  aiSystemPrompt: string | null = null
  qrCodeDetection: boolean = false

  private client: WAClient | null = null
  private starting = false
  private lastQr: string | null = null

  constructor(
    id: string,
    userId: string | null = null,
    webhookUrl: string | null = null,
    webhookEvents: string[] = [],
    aiEnabled: boolean = false,
    aiSystemPrompt: string | null = null,
    qrCodeDetection: boolean = false,
    activationStatus: ActivationStatus = 'trial',
    trialEndsAt: Date = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
  ) {
    super()
    this.id = id
    this.userId = userId
    this.webhookUrl = webhookUrl
    this.webhookEvents = webhookEvents
    this.aiEnabled = aiEnabled
    this.aiSystemPrompt = aiSystemPrompt
    this.qrCodeDetection = qrCodeDetection
    this.activationStatus = activationStatus
    this.trialEndsAt = trialEndsAt
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
      console.error(`[wppweb] webhook error ${this.id}`, err)
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

  private async _handleAiMessage(msg: any): Promise<void> {
    const from = msg.from as string | undefined
    if (!from || msg.fromMe) return

    const text: string | undefined = msg.body || undefined
    const hasMedia: boolean = !!msg.hasMedia

    if (!text && !hasMedia) return

    try {
      let media: { data: string; mimetype: string } | undefined
      if (hasMedia) {
        const downloaded = await msg.downloadMedia()
        if (downloaded) media = { data: downloaded.data, mimetype: downloaded.mimetype }
      }

      // QR code detection (images only) — fires webhook and returns, skipping AI
      if (media && media.mimetype.startsWith('image/') && this.qrCodeDetection) {
        const qrContent = await decodeQRCode(Buffer.from(media.data, 'base64'))
        if (qrContent) {
          await this._fireWebhook('qrcode.detected', { from, content: qrContent })
          return
        }
      }

      if (!this.aiEnabled) return

      let response: string
      if (text && !media) {
        response = await askGemini(this.aiSystemPrompt, text)
      } else if (media) {
        // Only image/audio/PDF supported (mirrors Baileys AI handling)
        const mime = media.mimetype
        const ok = mime.startsWith('image/') || mime.startsWith('audio/') || mime.includes('pdf')
        if (!ok) return
        response = await askGemini(this.aiSystemPrompt, text, {
          data: Buffer.from(media.data, 'base64'),
          mimeType: mime,
        })
      } else {
        return
      }

      await this.sendText(from, response)
    } catch (err) {
      console.error(`[wppweb] AI error ${this.id}`, err)
    }
  }

  connect(): void {
    if (this.starting || this.client) return
    this.starting = true

    const client = new Client({
      authStrategy: new LocalAuth({ clientId: this.id, dataPath: AUTH_PATH }),
      puppeteer: {
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
        ],
      },
    })
    this.client = client

    client.on('qr', async (qr: string) => {
      this.lastQr = qr
      this.status = 'qr'
      this.qrDataUrl = await toDataURL(qr)
      this.emit('qr', this.qrDataUrl)
      this.emit('status', 'qr')
    })

    client.on('ready', () => {
      this.status = 'connected'
      this.qrDataUrl = null
      this.lastQr = null
      this.connectedAt = new Date().toISOString()
      const info = client.info
      this.waNumber = info?.wid?.user ?? null
      this.waName = info?.pushname ?? null
      this.emit('status', 'connected')
      this.emit('connected', { waNumber: this.waNumber, waName: this.waName })
    })

    client.on('disconnected', () => {
      this.status = 'disconnected'
      this.qrDataUrl = null
      this.waNumber = null
      this.waName = null
      this.connectedAt = null
      this.emit('status', 'disconnected')
      // whatsapp-web.js destroys its browser on disconnect; recreate and retry.
      this.client = null
      setTimeout(() => this.connect(), 3000)
    })

    client.on('message', (msg: any) => {
      this._fireWebhook('messages.upsert', {
        from: msg.from, to: msg.to, body: msg.body, id: msg.id?._serialized, timestamp: msg.timestamp,
      })
      // Update lastActivityAt on inbound messages
      prisma.wppwebInstance.update({
        where: { id: this.id },
        data: { lastActivityAt: new Date() },
      }).catch(() => {})

      if (this.aiEnabled || this.qrCodeDetection) {
        this._handleAiMessage(msg).catch(err =>
          console.error(`[wppweb] AI handle error ${this.id}`, err)
        )
      }
    })

    client.initialize()
      .catch((err) => {
        console.error(`[wppweb] initialize error ${this.id}`, err)
        this.client = null
        setTimeout(() => this.connect(), 5000)
      })
      .finally(() => { this.starting = false })
  }

  async requestPairingCode(phoneNumber: string): Promise<string> {
    if (!this.client) throw new Error('Instância não iniciada')
    if (this.status === 'connected') throw new Error('Instância já conectada')
    const normalized = phoneNumber.replace(/\D/g, '')
    // showNotification=false: just return the code without a phone push.
    const code = await this.client.requestPairingCode(normalized)
    return code
  }

  async sendText(to: string, text: string): Promise<string | undefined> {
    if (!this.client || this.status !== 'connected') throw new Error('Instância não conectada')
    const chatId = to.includes('@') ? to : toChatId(to)
    const result = await this.client.sendMessage(chatId, text)
    return result?.id?._serialized ?? undefined
  }

  async sendMedia(
    to: string,
    mediaType: MediaType,
    media: { mimetype: string; data: string; filename?: string },
    options: { caption?: string; ptt?: boolean } = {},
  ): Promise<string | undefined> {
    if (!this.client || this.status !== 'connected') throw new Error('Instância não conectada')
    const chatId = to.includes('@') ? to : toChatId(to)
    const msgMedia = new MessageMedia(media.mimetype, media.data, media.filename ?? null)
    const sendOptions: Record<string, unknown> = {}
    if (options.caption) sendOptions.caption = options.caption
    if (mediaType === 'audio') sendOptions.sendAudioAsVoice = options.ptt ?? false
    if (mediaType === 'document') sendOptions.sendMediaAsDocument = true
    const result = await this.client.sendMessage(chatId, msgMedia, sendOptions)
    return result?.id?._serialized ?? undefined
  }

  // Destroy Chromium without touching LocalAuth files — auth preserved on disk for no-QR wake-up
  async destroy(): Promise<void> {
    if (this.client) {
      try { await this.client.destroy() } catch (_) {}
      this.client = null
    }
    this.status = 'disconnected'
    this.qrDataUrl = null
    this.starting = false
  }

  // Logout: erases auth (LocalAuth files deleted). Only call on explicit user disconnect.
  async logout(): Promise<void> {
    if (this.client) {
      try { await this.client.logout() } catch (_) {}
      try { await this.client.destroy() } catch (_) {}
      this.client = null
    }
    this.status = 'disconnected'
    this.qrDataUrl = null
  }

  // Resolves when connected; rejects on timeout. Used after wake-up.
  waitForConnection(timeoutMs: number): Promise<void> {
    if (this.status === 'connected') return Promise.resolve()
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.off('status', onStatus)
        reject(new Error(`WPP Web connection timeout after ${timeoutMs}ms`))
      }, timeoutMs)
      const onStatus = (status: string) => {
        if (status === 'connected') {
          clearTimeout(timeout)
          this.off('status', onStatus)
          resolve()
        }
      }
      this.on('status', onStatus)
    })
  }

  info(): InstanceInfo {
    return {
      id: this.id,
      userId: this.userId,
      status: this.status,
      activationStatus: this.activationStatus,
      trialEndsAt: this.trialEndsAt.toISOString(),
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

class WppwebManager {
  private instances = new Map<string, WppwebInstance>()

  async init() {
    const rows = await prisma.wppwebInstance.findMany()
    const now = new Date()

    for (const row of rows) {
      // Sleeping instances are not loaded into memory — woken on demand
      if (row.sleeping) continue

      // Expire stale trials that passed during downtime
      let activationStatus = row.activationStatus as ActivationStatus
      if (activationStatus === 'trial' && row.trialEndsAt <= now) {
        activationStatus = 'trial_expired'
        prisma.wppwebInstance.update({ where: { id: row.id }, data: { activationStatus: 'trial_expired' } }).catch(() => {})
      }

      const instance = new WppwebInstance(
        row.id,
        row.userId,
        row.webhookUrl,
        row.webhookEvents,
        row.aiEnabled,
        row.aiSystemPrompt,
        row.qrCodeDetection,
        activationStatus,
        row.trialEndsAt,
      )
      this.instances.set(row.id, instance)
      this._watch(instance)
      instance.connect()
    }
  }

  async create(id: string, userId: string | null = null): Promise<WppwebInstance> {
    if (this.instances.has(id)) return this.instances.get(id)!
    const trialEndsAt = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000)
    const instance = new WppwebInstance(id, userId, null, [], false, null, false, 'trial', trialEndsAt)
    this.instances.set(id, instance)
    this._watch(instance)
    await prisma.wppwebInstance.create({ data: { id, userId, activationStatus: 'trial', trialEndsAt } })
    return instance
  }

  async updateWebhook(id: string, userId: string, webhookUrl: string | null, webhookEvents: string[]): Promise<WppwebInstance | undefined> {
    const instance = this.getForUser(id, userId)
    if (!instance) return undefined
    instance.setWebhook(webhookUrl, webhookEvents)
    await prisma.wppwebInstance.update({ where: { id }, data: { webhookUrl, webhookEvents } })
    return instance
  }

  async updateAi(id: string, userId: string, aiEnabled: boolean, aiSystemPrompt: string | null, qrCodeDetection: boolean): Promise<WppwebInstance | undefined> {
    const instance = this.getForUser(id, userId)
    if (!instance) return undefined
    instance.setAi(aiEnabled, aiSystemPrompt, qrCodeDetection)
    await prisma.wppwebInstance.update({ where: { id }, data: { aiEnabled, aiSystemPrompt, qrCodeDetection } })
    return instance
  }

  async setActivationStatus(id: string, status: ActivationStatus): Promise<void> {
    const instance = this.instances.get(id)
    if (instance) {
      instance.activationStatus = status
      // Paused/expired: free Chromium memory, LocalAuth files preserved for reactivation
      if (status === 'paused' || status === 'trial_expired') {
        await instance.destroy()
        this.instances.delete(id)
      }
    }
    await prisma.wppwebInstance.update({ where: { id }, data: { activationStatus: status } })
  }

  async setActivationStatusForUserId(userId: string, status: ActivationStatus): Promise<void> {
    const toDestroy: WppwebInstance[] = []
    for (const inst of this.instances.values()) {
      if (inst.userId === userId) {
        inst.activationStatus = status
        if (status === 'paused' || status === 'trial_expired') {
          toDestroy.push(inst)
        }
      }
    }
    for (const inst of toDestroy) {
      await inst.destroy()
      this.instances.delete(inst.id)
    }
    await prisma.wppwebInstance.updateMany({ where: { userId }, data: { activationStatus: status } })
  }

  // Sleep: destroy Chromium without removing LocalAuth → no QR re-scan on wake-up
  async sleep(id: string): Promise<void> {
    const instance = this.instances.get(id)
    if (!instance) return
    await instance.destroy()
    this.instances.delete(id)
    await prisma.wppwebInstance.update({ where: { id }, data: { sleeping: true } })
  }

  // Wake up a sleeping instance: restore from DB, reconnect using LocalAuth on disk (no QR)
  async wakeUp(id: string, userId: string): Promise<WppwebInstance | null> {
    if (this.instances.has(id)) return this.instances.get(id)!
    const row = await prisma.wppwebInstance.findUnique({ where: { id } })
    if (!row || (row.userId && row.userId !== userId)) return null

    const activationStatus = row.activationStatus as ActivationStatus
    const instance = new WppwebInstance(
      row.id, row.userId, row.webhookUrl, row.webhookEvents,
      row.aiEnabled, row.aiSystemPrompt, row.qrCodeDetection,
      activationStatus, row.trialEndsAt,
    )
    this.instances.set(id, instance)
    this._watch(instance)
    await prisma.wppwebInstance.update({ where: { id }, data: { sleeping: false } })
    instance.connect()
    return instance
  }

  private _watch(instance: WppwebInstance) {
    instance.on('connected', ({ waNumber, waName }: { waNumber: string; waName: string }) => {
      prisma.wppwebInstance.update({
        where: { id: instance.id },
        data: { status: 'connected', waNumber, waName, connectedAt: new Date() },
      }).catch(() => {})
    })

    instance.on('status', (status: string) => {
      if (status === 'disconnected') {
        prisma.wppwebInstance.update({
          where: { id: instance.id },
          data: { status: 'disconnected', waNumber: null, waName: null, connectedAt: null },
        }).catch(() => {})
      } else if (status === 'qr') {
        prisma.wppwebInstance.update({ where: { id: instance.id }, data: { status: 'qr' } }).catch(() => {})
      }
    })
  }

  get(id: string): WppwebInstance | undefined {
    return this.instances.get(id)
  }

  getForUser(id: string, userId: string): WppwebInstance | undefined {
    const instance = this.instances.get(id)
    if (!instance) return undefined
    if (instance.userId !== null && instance.userId !== userId) return undefined
    return instance
  }

  async getByUserToken(id: string, clientToken: string): Promise<{ instance: WppwebInstance; userId: string } | undefined> {
    const user = await prisma.user.findUnique({ where: { clientToken } })
    if (!user) return undefined
    const instance = this.getForUser(id, user.id)
    if (!instance) return undefined
    return { instance, userId: user.id }
  }

  async remove(id: string): Promise<void> {
    const instance = this.instances.get(id)
    if (instance) {
      await instance.logout()
      this.instances.delete(id)
    }
    await prisma.wppwebInstance.delete({ where: { id } }).catch(() => {})
  }

  allForUser(userId: string): InstanceInfo[] {
    return Array.from(this.instances.values())
      .filter(i => i.userId === userId)
      .map(i => i.info())
  }

  // For admin memory report
  allInstances(): WppwebInstance[] {
    return Array.from(this.instances.values())
  }
}

export const wppwebManager = new WppwebManager()
