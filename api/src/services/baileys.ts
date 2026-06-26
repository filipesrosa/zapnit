import {
  makeWASocket,
  makeCacheableSignalKeyStore,
  DisconnectReason,
  fetchLatestBaileysVersion,
  downloadMediaMessage,
  jidNormalizedUser,
  type WASocket,
  type ConnectionState,
  type CacheStore,
  // type-only: `proto` is NOT a real named export of the CJS module (the
  // cjs-module-lexer can't see it), so a value import would crash at runtime
  // under ESM. We only use it in type positions here, so import it as a type.
  type proto,
} from '@whiskeysockets/baileys'
import { toDataURL } from 'qrcode'
import pino from 'pino'
import { EventEmitter } from 'events'
import { prisma } from '../db.js'
import { useDbAuthState } from './baileys-auth.js'
import { askGemini } from './gemini.js'
import { decodeQRCode } from './qrcode-reader.js'

export type MediaType = 'image' | 'audio' | 'video' | 'document'

export type ActivationStatus = 'trial' | 'active' | 'paused' | 'trial_expired'

const silentLogger = pino({ level: 'silent' })

/**
 * Minimal TTL cache implementing Baileys' CacheStore.
 * Used for msgRetryCounterCache / placeholderResendCache so that retry-receipt
 * state survives socket reconnections (the internal default cache is recreated
 * on every new socket, losing retry counts mid-flight).
 *
 * Also used as the injectable Signal key cache for makeCacheableSignalKeyStore,
 * exposing `invalidatePrefix` so multi-device sync events can surgically evict
 * stale session entries without a full socket reconnect.
 */
class TTLCache implements CacheStore {
  private store = new Map<string, { value: unknown; expires: number }>()
  constructor(private readonly ttlMs: number, private readonly maxSize = 5000) {}

  get<T>(key: string): T | undefined {
    const entry = this.store.get(key)
    if (!entry) return undefined
    if (entry.expires < Date.now()) {
      this.store.delete(key)
      return undefined
    }
    return entry.value as T
  }

  set<T>(key: string, value: T): void {
    // Lazy TTL only expires on read, so cap the size to bound memory: evict the
    // oldest entry (Map preserves insertion order) when full.
    if (this.store.size >= this.maxSize && !this.store.has(key)) {
      this.store.delete(this.store.keys().next().value!)
    }
    this.store.set(key, { value, expires: Date.now() + this.ttlMs })
  }

  del(key: string): void {
    this.store.delete(key)
  }

  flushAll(): void {
    this.store.clear()
  }

  /** Evict all entries whose key starts with `prefix`. */
  invalidatePrefix(prefix: string): void {
    for (const key of this.store.keys()) {
      if (key.startsWith(prefix)) this.store.delete(key)
    }
  }
}

// ---------------------------------------------------------------------------
// Baileys version cache — fetchLatestBaileysVersion() makes an HTTP request on
// every connect(). With exponential-backoff reconnects this adds latency and
// can fail during network hiccups. Cache the result for 5 minutes so rapid
// reconnect cycles reuse the last known-good version instead of hitting the
// network every time.
// ---------------------------------------------------------------------------
let _cachedVersion: { version: [number, number, number]; isLatest: boolean } | null = null
let _versionFetchedAt = 0
const VERSION_CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutes

async function getBaileysVersion(): Promise<{ version: [number, number, number]; isLatest: boolean }> {
  if (_cachedVersion && Date.now() - _versionFetchedAt < VERSION_CACHE_TTL_MS) {
    return _cachedVersion
  }
  const result = await fetchLatestBaileysVersion()
  _cachedVersion = result
  _versionFetchedAt = Date.now()
  return result
}

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
  activationStatus: ActivationStatus
  trialEndsAt: string
  sleeping: boolean
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

  private sock: WASocket | null = null
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private cleanupTimer: ReturnType<typeof setInterval> | null = null
  private reconnectAttempts = 0
  private connecting = false
  // No in-memory messageStore — getMessage reads directly from Postgres so
  // messages survive restarts, server crashes, and sleep/wake cycles without
  // any size cap. The DB is the single source of truth.
  // Persisted across reconnects so retry-receipt state isn't lost when the
  // socket is recreated (the Baileys-internal default caches would be wiped).
  private readonly msgRetryCounterCache: CacheStore = new TTLCache(60 * 60 * 1000)
  private readonly placeholderResendCache: CacheStore = new TTLCache(60 * 60 * 1000)
  // Injected into makeCacheableSignalKeyStore so we can surgically evict stale
  // Signal sessions when another device (WA Web / phone) syncs a message to us.
  // 5 min TTL mirrors the Baileys default (DEFAULT_CACHE_TTLS.SIGNAL_STORE = 300s).
  private readonly signalCache = new TTLCache(5 * 60 * 1000)

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

  /** Wipe persisted Signal auth state for this instance (logout / disconnect). */
  private _clearAuthState() {
    prisma.baileysAuthState.deleteMany({ where: { instanceId: this.id } }).catch(() => {})
  }

  /**
   * Schedule a reconnect. If connect() rejects (e.g. DB/network error before
   * the connection.update handler is wired), we'd otherwise have no socket and
   * no scheduled retry — the instance would be stranded. The catch keeps the
   * backoff loop alive.
   */
  /** Initial connect that retries (with backoff) if the first attempt throws. */
  connectWithRetry() {
    this.connect().catch((err) => {
      console.error(`[baileys] initial connect error ${this.id}`, err)
      this._scheduleReconnect(3000 + Math.floor(Math.random() * 1000))
    })
  }

  private _scheduleReconnect(delayMs: number) {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer)
    this.reconnectTimer = setTimeout(() => {
      this.connect().catch((err) => {
        console.error(`[baileys] connect error ${this.id}`, err)
        this.reconnectAttempts += 1
        const base = Math.min(3000 * 2 ** (this.reconnectAttempts - 1), 60000)
        this._scheduleReconnect(base + Math.floor(Math.random() * 1000))
      })
    }, delayMs)
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
    // Write directly to DB — no in-memory Map. This means getMessage always
    // reads from Postgres, giving consistent behaviour across restarts, crashes,
    // and sleep/wake cycles without any message count limit.
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
    // Single-flight: prevent overlapping sockets from racing on the same
    // instance's Signal auth state, which corrupts the session ratchet.
    if (this.connecting) return
    this.connecting = true

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }

    if (this.sock) {
      try { this.sock.end(undefined) } catch (_) {}
      this.sock = null
    }

    let state, saveCreds, version
    try {
      ;({ state, saveCreds } = await useDbAuthState(this.id))
      ;({ version } = await getBaileysVersion())
    } finally {
      this.connecting = false
    }

    // Start periodic cleanup of old message store rows (runs every 24 h while
    // connected). Doing this on a timer — not only on connect() — ensures long-
    // lived sessions also prune stale rows without needing a reconnect.
    if (this.cleanupTimer) clearInterval(this.cleanupTimer)
    this._pruneMessageStore()
    this.cleanupTimer = setInterval(() => this._pruneMessageStore(), 24 * 60 * 60 * 1000)

    const sock = makeWASocket({
      version,
      logger: silentLogger,
      auth: {
        creds: state.creds,
        // Inject our own TTLCache so we can call invalidatePrefix() from the
        // multi-device sync handler below. Without this, stale session entries
        // linger in the default node-cache and cause "Waiting for this message"
        // after WA Web / phone interaction with the same contacts.
        keys: makeCacheableSignalKeyStore(state.keys, silentLogger, this.signalCache),
      },
      printQRInTerminal: false,
      // Headless gateway: stay "offline" so WhatsApp keeps routing message
      // notifications and retry receipts to this socket (and pushes to the
      // owner's phone), instead of treating us as the foreground device.
      markOnlineOnConnect: false,
      // Disable full history sync — reduces orphan Signal sessions that form
      // when history messages reference devices no longer in the key store.
      syncFullHistory: false,
      msgRetryCounterCache: this.msgRetryCounterCache,
      placeholderResendCache: this.placeholderResendCache,
      getMessage: async (key) => {
        if (!key.id) return undefined
        // DB is the single source of truth — no in-memory fallback needed.
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
          this._clearAuthState()
          this.emit('logged_out')
          this.reconnectAttempts = 0
          this._scheduleReconnect(1000)
        } else {
          // Exponential backoff with jitter to avoid reconnect storms that
          // make an old (tearing-down) and new socket race on the same
          // instance's Signal auth state.
          this.reconnectAttempts += 1
          const base = Math.min(3000 * 2 ** (this.reconnectAttempts - 1), 60000)
          this._scheduleReconnect(base + Math.floor(Math.random() * 1000))
        }
      }

      if (connection === 'open') {
        this.reconnectAttempts = 0
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
        // Only our own outbound messages can be the target of a retry receipt,
        // so only those need to be retrievable by getMessage.
        if (msg.key.fromMe && msg.key.id && msg.message) this._storeMessage(msg.key.id, msg.message)
      }

      // type='append' means messages synced from another linked device (WA Web,
      // phone). When another device interacts with a contact, that contact's WA
      // may reset or advance their Signal session state. Baileys' in-memory
      // signalCache still holds the old session → next outbound send uses stale
      // keys → recipient sees "Waiting for this message".
      //
      // Fix: evict the session from both cache and DB for those contacts.
      // Baileys will fetch a fresh prekey bundle on the next send, establishing
      // a new LID-aware session transparently.
      //
      // Recency guard: only act on messages sent within the last 5 minutes.
      // On connect, WA replays historical messages as type='append' too — those
      // have old timestamps and would otherwise cause mass session eviction,
      // which triggers the "linked device syncing" notification on every reconnect.
      if (data.type === 'append') {
        const recentThreshold = Math.floor(Date.now() / 1000) - 5 * 60
        const jids = new Set<string>()
        for (const msg of data.messages) {
          if (
            msg.key.fromMe &&
            msg.key.remoteJid &&
            !msg.key.remoteJid.endsWith('@g.us') &&
            Number(msg.messageTimestamp) > recentThreshold
          ) {
            jids.add(jidNormalizedUser(msg.key.remoteJid))
          }
        }
        for (const jid of jids) {
          const number = jid.split('@')[0]
          this.signalCache.invalidatePrefix(`session.${number}`)
          prisma.baileysAuthState.deleteMany({
            where: { instanceId: this.id, category: 'session', keyId: { startsWith: number } },
          }).catch(() => {})
        }
      }

      this._fireWebhook('messages.upsert', data)

      // Update lastActivityAt on inbound messages
      if (data.type === 'notify') {
        prisma.baileysInstance.update({
          where: { id: this.id },
          data: { lastActivityAt: new Date() },
        }).catch(() => {})
      }

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

  private _pruneMessageStore() {
    // Keep 7 days of outbound message content — enough for any WhatsApp retry
    // window. Rows older than this are unreachable by the retry protocol and
    // only cost storage space.
    prisma.baileysMessageStore.deleteMany({
      where: {
        instanceId: this.id,
        createdAt: { lt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
      },
    }).catch(() => {})
  }

  // Close socket for sleep — does NOT clear Postgres auth state (preserves session for wake-up)
  softDisconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer)
      this.cleanupTimer = null
    }
    if (this.sock) {
      try { this.sock.end(undefined) } catch (_) {}
      this.sock = null
    }
    this.status = 'disconnected'
    this.qrDataUrl = null
  }

  disconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer)
      this.cleanupTimer = null
    }
    if (this.sock) {
      try { this.sock.end(undefined) } catch (_) {}
      this.sock = null
    }
    this.status = 'disconnected'
    this.qrDataUrl = null
    this.signalCache.flushAll()
    this._clearAuthState()
  }

  // Resolves when connected; rejects on timeout. Used after wake-up.
  waitForConnection(timeoutMs: number): Promise<void> {
    if (this.status === 'connected') return Promise.resolve()
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.off('status', onStatus)
        reject(new Error(`Baileys connection timeout after ${timeoutMs}ms`))
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

  async requestPairingCode(phoneNumber: string): Promise<string> {
    if (!this.sock) throw new Error('Instância não iniciada')
    if (this.status === 'connected') throw new Error('Instância já conectada')
    // Normaliza: remove tudo que não for dígito
    const normalized = phoneNumber.replace(/\D/g, '')
    const code = await this.sock.requestPairingCode(normalized)
    return code
  }

  async sendText(to: string, text: string): Promise<string | undefined> {
    if (!this.sock || this.status !== 'connected') throw new Error('Instância não conectada')
    const jid = jidNormalizedUser(to)
    const result = await this.sock.sendMessage(jid, { text })
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

    const jid = jidNormalizedUser(to)
    const result = await this.sock.sendMessage(jid, content)
    if (result?.key?.id && result?.message) this._storeMessage(result.key.id, result.message)
    return result?.key?.id ?? undefined
  }

  /**
   * Flush all Signal sessions from DB then reconnect.
   *
   * Fixes the LID migration problem: existing sessions are keyed to PN
   * (phone number) but WhatsApp now routes Signal via LID. Clearing forces
   * Baileys to re-fetch fresh prekey bundles on the next send — those bundles
   * are LID-aware in 6.17.x, so new sessions encrypt correctly.
   *
   * Does NOT clear credentials — the instance stays logged in. Callers see
   * a brief disconnected → connected transition (~2-5 s).
   */
  async flushSignalSessions(): Promise<void> {
    this.softDisconnect()
    await prisma.baileysAuthState.deleteMany({
      where: { instanceId: this.id, category: 'session' },
    })
    this.connectWithRetry()
  }

  info(): InstanceInfo {
    return {
      id: this.id,
      userId: this.userId,
      status: this.status,
      activationStatus: this.activationStatus,
      trialEndsAt: this.trialEndsAt.toISOString(),
      sleeping: false, // in-memory instances are never sleeping (sleeping ones are removed from map)
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
    const now = new Date()

    for (const row of rows) {
      // Sleeping instances are not loaded into memory — woken on demand
      if (row.sleeping) continue

      // Expire stale trials that passed during downtime
      let activationStatus = row.activationStatus as ActivationStatus
      if (activationStatus === 'trial' && row.trialEndsAt <= now) {
        activationStatus = 'trial_expired'
        prisma.baileysInstance.update({ where: { id: row.id }, data: { activationStatus: 'trial_expired' } }).catch(() => {})
      }

      const instance = new BaileysInstance(
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
      instance.connectWithRetry()
    }
  }

  async create(id: string, userId: string | null = null): Promise<BaileysInstance> {
    if (this.instances.has(id)) return this.instances.get(id)!
    const trialEndsAt = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000)
    const instance = new BaileysInstance(id, userId, null, [], false, null, false, 'trial', trialEndsAt)
    this.instances.set(id, instance)
    this._watch(instance)
    await prisma.baileysInstance.create({ data: { id, userId, activationStatus: 'trial', trialEndsAt } })
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

  async setActivationStatus(id: string, status: ActivationStatus): Promise<void> {
    const instance = this.instances.get(id)
    if (instance) instance.activationStatus = status
    await prisma.baileysInstance.update({ where: { id }, data: { activationStatus: status } })
  }

  async setActivationStatusForUserId(userId: string, status: ActivationStatus): Promise<void> {
    for (const inst of this.instances.values()) {
      if (inst.userId === userId) inst.activationStatus = status
    }
    await prisma.baileysInstance.updateMany({ where: { userId }, data: { activationStatus: status } })
  }

  // Sleep: close socket without clearing auth (auth preserved in Postgres → no QR re-scan on wake)
  async sleep(id: string): Promise<void> {
    const instance = this.instances.get(id)
    if (!instance) return
    instance.softDisconnect()
    this.instances.delete(id)
    await prisma.baileysInstance.update({ where: { id }, data: { sleeping: true } })
  }

  // Wake up a sleeping instance: restore from DB, reconnect using Postgres auth (no QR)
  async wakeUp(id: string, userId: string): Promise<BaileysInstance | null> {
    if (this.instances.has(id)) return this.instances.get(id)!
    const row = await prisma.baileysInstance.findUnique({ where: { id } })
    if (!row || (row.userId && row.userId !== userId)) return null

    const activationStatus = row.activationStatus as ActivationStatus
    const instance = new BaileysInstance(
      row.id, row.userId, row.webhookUrl, row.webhookEvents,
      row.aiEnabled, row.aiSystemPrompt, row.qrCodeDetection,
      activationStatus, row.trialEndsAt,
    )
    this.instances.set(id, instance)
    this._watch(instance)
    await prisma.baileysInstance.update({ where: { id }, data: { sleeping: false } })
    instance.connectWithRetry()
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
    const row = await prisma.baileysInstance.findUnique({ where: { id }, select: { activationStatus: true } })
    if (row) instance.activationStatus = row.activationStatus as ActivationStatus
    return { instance, userId: user.id }
  }

  async flushSignalSessions(id: string, userId: string): Promise<boolean> {
    const instance = this.getForUser(id, userId)
    if (!instance) return false
    await instance.flushSignalSessions()
    return true
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

  // For admin memory report
  allInstances(): BaileysInstance[] {
    return Array.from(this.instances.values())
  }
}

export const baileysManager = new BaileysManager()
