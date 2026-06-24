import { Worker } from 'bullmq'
import { baileysManager } from '../services/baileys.js'
import { wppwebManager } from '../services/wppweb.js'
import { prisma } from '../db.js'
import { incrementUserMessages } from '../lib/quota.js'
import { redisConnection, type QrSendJob } from '../queues.js'

async function resolveMediaForBaileys(
  mediaUrl: string | undefined,
  mediaBase64: string | undefined,
  mimetype: string | undefined,
): Promise<{ media: Buffer | { url: string }; mimetype: string | undefined } | null> {
  if (mediaUrl) return { media: { url: mediaUrl }, mimetype }
  if (!mediaBase64) return null
  const dataUrlMatch = mediaBase64.match(/^data:([^;]+);base64,(.+)$/)
  if (dataUrlMatch) {
    return { media: Buffer.from(dataUrlMatch[2], 'base64'), mimetype: mimetype ?? dataUrlMatch[1] }
  }
  return { media: Buffer.from(mediaBase64, 'base64'), mimetype }
}

async function resolveMediaForWppweb(
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

export function startQrMessageWorker(): Worker {
  return new Worker('qr-messages', async (job) => {
    const data = job.data as QrSendJob
    const manager = data.instanceType === 'baileys' ? baileysManager : wppwebManager

    let instance = manager.getForUser(data.instanceId, data.userId) ?? null

    if (!instance) {
      // Instance may be sleeping — wake it up (auth preserved, no QR re-scan)
      instance = await manager.wakeUp(data.instanceId, data.userId)
      if (!instance) throw new Error(`Instance ${data.instanceId} not found`)
      await instance.waitForConnection(35_000)
    } else if (instance.status !== 'connected') {
      await instance.waitForConnection(35_000)
    }

    let messageId: string | null = null

    if (data.sendType === 'text') {
      if (data.instanceType === 'baileys') {
        const jid = data.phone.replace(/\D/g, '') + '@s.whatsapp.net'
        messageId = await (instance as ReturnType<typeof baileysManager.get>)!.sendText(jid, data.message!) ?? null
      } else {
        messageId = await (instance as ReturnType<typeof wppwebManager.get>)!.sendText(data.phone, data.message!) ?? null
      }
    } else {
      if (data.instanceType === 'baileys') {
        const resolved = await resolveMediaForBaileys(data.mediaUrl, data.mediaBase64, data.mimetype)
        if (!resolved) throw new Error('Could not resolve media')
        const baileysInst = instance as ReturnType<typeof baileysManager.get>
        const jid = data.phone.replace(/\D/g, '') + '@s.whatsapp.net'
        messageId = await baileysInst!.sendMedia(jid, data.sendType as any, resolved.media, {
          caption: data.caption,
          filename: data.filename,
          mimetype: resolved.mimetype,
          ptt: data.ptt,
        }) ?? null
      } else {
        const resolved = await resolveMediaForWppweb(data.mediaUrl, data.mediaBase64, data.mimetype)
        if (!resolved) throw new Error('Could not resolve media')
        const wppInst = instance as ReturnType<typeof wppwebManager.get>
        messageId = await wppInst!.sendMedia(
          data.phone, data.sendType as any,
          { ...resolved, filename: data.filename },
          { caption: data.caption, ptt: data.ptt },
        ) ?? null
      }
    }

    if (data.instanceType === 'baileys') {
      await prisma.baileysMessage.update({ where: { id: data.zapnitId }, data: { status: 'sent', messageId } })
    } else {
      await prisma.wppwebMessage.update({ where: { id: data.zapnitId }, data: { status: 'sent', messageId } })
    }

    // Update lastActivityAt
    if (data.instanceType === 'baileys') {
      prisma.baileysInstance.update({ where: { id: data.instanceId }, data: { lastActivityAt: new Date() } }).catch(() => {})
    } else {
      prisma.wppwebInstance.update({ where: { id: data.instanceId }, data: { lastActivityAt: new Date() } }).catch(() => {})
    }

    incrementUserMessages(data.userId)

  }, { connection: redisConnection, concurrency: 5, removeOnComplete: { count: 100 }, removeOnFail: { count: 100 } })
}

// Register failure handler outside the worker factory so it can update message status
export function attachQrWorkerFailureHandler(worker: ReturnType<typeof startQrMessageWorker>) {
  worker.on('failed', async (job, err) => {
    if (!job) return
    const data = job.data as QrSendJob
    const errMsg = (err as Error).message
    if (data.instanceType === 'baileys') {
      await prisma.baileysMessage.update({ where: { id: data.zapnitId }, data: { status: 'failed', error: errMsg } }).catch(() => {})
    } else {
      await prisma.wppwebMessage.update({ where: { id: data.zapnitId }, data: { status: 'failed', error: errMsg } }).catch(() => {})
    }
    console.error(`[qr-worker] job failed for ${data.instanceId}:`, errMsg)
  })
}
