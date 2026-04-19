import {
  makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  type WASocket,
  type ConnectionState,
} from '@whiskeysockets/baileys'
import { toDataURL } from 'qrcode'
import pino from 'pino'
import { EventEmitter } from 'events'
import { rmSync } from 'fs'
import { join } from 'path'
import { prisma } from '../db.js'
import { randomUUID } from 'crypto'

const silentLogger = pino({ level: 'silent' })

export type InstanceStatus = 'disconnected' | 'qr' | 'connected'

export interface InstanceInfo {
  id: string
  userId: string | null
  clientToken: string
  status: InstanceStatus
  qrDataUrl: string | null
  waNumber: string | null
  waName: string | null
  connectedAt: string | null
}

class BaileysInstance extends EventEmitter {
  readonly id: string
  userId: string | null
  readonly clientToken: string
  status: InstanceStatus = 'disconnected'
  qrDataUrl: string | null = null
  waNumber: string | null = null
  waName: string | null = null
  connectedAt: string | null = null

  private sock: WASocket | null = null
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private readonly authDir: string

  constructor(id: string, userId: string | null = null, clientToken: string = randomUUID()) {
    super()
    this.id = id
    this.userId = userId
    this.clientToken = clientToken
    this.authDir = join(process.cwd(), 'sessions', id)
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

    const sock = makeWASocket({
      version,
      logger: silentLogger,
      auth: state,
      printQRInTerminal: false,
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

  async sendText(to: string, text: string) {
    if (!this.sock || this.status !== 'connected') throw new Error('Instância não conectada')
    await this.sock.sendMessage(to, { text })
  }

  info(): InstanceInfo {
    return {
      id: this.id,
      userId: this.userId,
      clientToken: this.clientToken,
      status: this.status,
      qrDataUrl: this.qrDataUrl,
      waNumber: this.waNumber,
      waName: this.waName,
      connectedAt: this.connectedAt,
    }
  }
}

class BaileysManager {
  private instances = new Map<string, BaileysInstance>()

  async init() {
    const rows = await prisma.baileysInstance.findMany()
    for (const row of rows) {
      const instance = new BaileysInstance(row.id, row.userId, row.clientToken)
      this.instances.set(row.id, instance)
      this._watch(instance)
      instance.connect().catch(err => console.error(`[baileys] reconnect error ${row.id}`, err))
    }
  }

  async create(id: string, userId: string | null = null): Promise<BaileysInstance> {
    if (this.instances.has(id)) return this.instances.get(id)!
    const clientToken = randomUUID()
    const instance = new BaileysInstance(id, userId, clientToken)
    this.instances.set(id, instance)
    this._watch(instance)
    await prisma.baileysInstance.create({ data: { id, userId, clientToken } })
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

  getByToken(id: string, clientToken: string): BaileysInstance | undefined {
    const instance = this.instances.get(id)
    if (!instance) return undefined
    if (instance.clientToken !== clientToken) return undefined
    return instance
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
