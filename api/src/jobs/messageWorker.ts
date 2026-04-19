import { prisma } from '../db.js'
import { sendTemplateMessage, sendTextMessage } from '../services/whatsapp.js'
import { Job, Queue, Worker } from 'bullmq'
import { Redis } from 'ioredis'

const connection = new Redis(process.env.REDIS_URL!, {
  maxRetriesPerRequest: null
})

export const messageQueue = new Queue('messages', { connection })

interface SendMessageJobData {
  messageId?: string
  phoneNumberId: string
  accessToken: string
  to: string
  message: string
  preview_url?: boolean
  tenantId?: string
  conversationId?: string
  saveToDb?: boolean
}

interface SendTemplateJobData {
  messageId?: string
  phoneNumberId: string
  accessToken: string
  to: string
  template_name: string
  language: string
  components: unknown[]
}

export function startMessageWorker(): Worker {
  const worker = new Worker('messages', async (job: Job) => {
    if (job.name === 'send-message') {
      await processSendMessage(job.data as SendMessageJobData)
    } else if (job.name === 'send-template') {
      await processSendTemplate(job.data as SendTemplateJobData)
    }
  }, {
    connection,
    concurrency: 10
  })

  worker.on('completed', (job: Job) => {
    console.log(`✅ Job ${job.id} completed`)
  })

  worker.on('failed', async (job: Job | undefined, err: Error) => {
    console.error(`❌ Job ${job?.id} failed:`, err.message)
    if (job?.data?.messageId) {
      await prisma.message.update({
        where: { id: job.data.messageId },
        data: { status: 'FAILED', errorMessage: err.message }
      }).catch(() => {})
    }
  })

  console.log('📨 Message worker started')
  return worker
}

async function processSendMessage(data: SendMessageJobData): Promise<void> {
  const {
    messageId, phoneNumberId, accessToken, to, message, preview_url,
    tenantId, conversationId, saveToDb
  } = data

  const result = await sendTextMessage({ phoneNumberId, accessToken, to, message, preview_url })
  const waMessageId = result.messages?.[0]?.id

  if (messageId) {
    await prisma.message.update({
      where: { id: messageId },
      data: { waMessageId, status: 'SENT', sentAt: new Date() }
    })
  } else if (saveToDb && tenantId) {
    const phoneNumber = await prisma.phoneNumber.findFirst({ where: { phoneNumberId } })
    const contact = await prisma.contact.findFirst({ where: { tenantId, waId: to } })

    if (phoneNumber && contact) {
      await prisma.message.create({
        data: {
          tenantId,
          phoneNumberId: phoneNumber.id,
          contactId: contact.id,
          conversationId,
          waMessageId,
          direction: 'OUTBOUND',
          type: 'TEXT',
          content: message,
          status: 'SENT',
          sentAt: new Date()
        }
      })
    }
  }
}

async function processSendTemplate(data: SendTemplateJobData): Promise<void> {
  const { messageId, phoneNumberId, accessToken, to, template_name, language, components } = data

  const result = await sendTemplateMessage({ phoneNumberId, accessToken, to, template_name, language, components })
  const waMessageId = result.messages?.[0]?.id

  if (messageId) {
    await prisma.message.update({
      where: { id: messageId },
      data: { waMessageId, status: 'SENT', sentAt: new Date() }
    })
  }
}
