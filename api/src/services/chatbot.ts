import Anthropic from '@anthropic-ai/sdk'
import type { PhoneNumber, Contact } from '@prisma/client'
import { prisma } from '../db.js'
import { messageQueue } from '../jobs/messageWorker.js'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const TONE_INSTRUCTIONS: Record<string, string> = {
  profissional: 'Mantenha um tom profissional e objetivo.',
  amigavel: 'Seja caloroso, amigável e próximo do cliente.',
  formal: 'Use linguagem formal e respeitosa.',
  empatico: 'Demonstre empatia e acolhimento em todas as respostas.',
}

function buildSystemPrompt(phoneNumber: PhoneNumber): string {
  const base = `Você é um assistente virtual de atendimento via WhatsApp.
Responda sempre em português brasileiro de forma clara e concisa.
Mantenha respostas curtas e adequadas para WhatsApp (máximo 3 parágrafos).
Se não souber algo, diga que vai verificar com a equipe responsável.`

  const toneInstruction = phoneNumber.botTone
    ? (TONE_INSTRUCTIONS[phoneNumber.botTone] ?? '')
    : 'Seja cordial e profissional.'

  const contextSection = phoneNumber.botContext
    ? `\n\nCONTEXTO DA EMPRESA E INSTRUÇÕES:\n${phoneNumber.botContext}`
    : ''

  return `${base}\n${toneInstruction}${contextSection}`
}

interface HandleInboundParams {
  tenantId: string
  conversationId: string
  phoneNumber: PhoneNumber
  contact: Contact
  message: string
}

export async function handleInboundMessage({
  tenantId,
  conversationId,
  phoneNumber,
  contact,
  message
}: HandleInboundParams): Promise<void> {
  const history = await prisma.message.findMany({
    where: { conversationId },
    orderBy: { createdAt: 'desc' },
    take: 10
  })

  const messages: Anthropic.MessageParam[] = history
    .reverse()
    .slice(0, -1)
    .map(m => ({
      role: m.direction === 'INBOUND' ? 'user' : 'assistant',
      content: m.content
    }))

  messages.push({ role: 'user', content: message })

  try {
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      system: buildSystemPrompt(phoneNumber),
      messages
    })

    const aiReply = response.content[0].type === 'text' ? response.content[0].text : ''

    await messageQueue.add('send-message', {
      phoneNumberId: phoneNumber.phoneNumberId,
      accessToken: phoneNumber.accessToken,
      to: contact.waId,
      message: aiReply,
      tenantId,
      conversationId,
      saveToDb: true
    }, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 1000 }
    })
  } catch (err) {
    console.error('AI chatbot error:', err)
  }
}
