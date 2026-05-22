import { GoogleGenerativeAI, type Part } from '@google/generative-ai'
import { GoogleAIFileManager } from '@google/generative-ai/server'

const DEFAULT_SYSTEM_PROMPT =
  'Você é um assistente virtual. Responda de forma clara e concisa em português.'

// Gemini inline data limit is ~20MB total. Use File API above 4MB to stay safe.
const INLINE_SIZE_LIMIT = 4 * 1024 * 1024

export interface MediaInput {
  data: Buffer
  mimeType: string
  filename?: string
}

let _genAI: GoogleGenerativeAI | null = null
let _fileManager: GoogleAIFileManager | null = null

function clients() {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw new Error('GEMINI_API_KEY não configurada')
  if (!_genAI) _genAI = new GoogleGenerativeAI(apiKey)
  if (!_fileManager) _fileManager = new GoogleAIFileManager(apiKey)
  return {
    model: _genAI.getGenerativeModel({ model: 'gemini-2.0-flash' }),
    fileManager: _fileManager,
  }
}

async function uploadViaFileApi(fileManager: GoogleAIFileManager, media: MediaInput & { mimeType: string }): Promise<Part> {
  const uploaded = await fileManager.uploadFile(media.data, {
    mimeType: media.mimeType,
    displayName: media.filename ?? 'attachment',
  })
  let file = uploaded.file
  while (file.state === 'PROCESSING') {
    await new Promise(r => setTimeout(r, 1500))
    file = await fileManager.getFile(file.name)
  }
  if (file.state === 'FAILED') throw new Error('Gemini File API: falha no processamento do arquivo')
  return { fileData: { mimeType: media.mimeType, fileUri: file.uri } }
}

export async function askGemini(
  systemPrompt: string | null | undefined,
  text: string | undefined,
  media?: MediaInput,
): Promise<string> {
  const { model, fileManager } = clients()
  const parts: Part[] = []

  if (media) {
    const mimeType = media.mimeType.split(';')[0].trim()
    if (media.data.length > INLINE_SIZE_LIMIT) {
      parts.push(await uploadViaFileApi(fileManager, { ...media, mimeType }))
    } else {
      parts.push({ inlineData: { data: media.data.toString('base64'), mimeType } })
    }
  }

  parts.push({ text: text || (media ? 'Analise este conteúdo.' : '') })

  const result = await model.generateContent({
    systemInstruction: systemPrompt || DEFAULT_SYSTEM_PROMPT,
    contents: [{ role: 'user', parts }],
  })

  return result.response.text()
}
