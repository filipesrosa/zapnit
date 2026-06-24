import { Queue } from 'bullmq'
import { Redis } from 'ioredis'

export const redisConnection = new Redis(process.env.REDIS_URL!, { maxRetriesPerRequest: null })

export const qrMessagesQueue = new Queue('qr-messages', { connection: redisConnection })

export interface QrSendJob {
  zapnitId: string
  instanceId: string
  userId: string
  instanceType: 'baileys' | 'wppweb'
  sendType: 'text' | 'image' | 'audio' | 'document'
  phone: string
  message?: string
  mediaUrl?: string
  mediaBase64?: string
  mimetype?: string
  filename?: string
  caption?: string
  ptt?: boolean
}
