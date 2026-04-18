const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
} = require('@whiskeysockets/baileys')
const pino = require('pino')
const EventEmitter = require('events')

const logger = pino({ level: 'silent' })

const botEvents = new EventEmitter()
let currentSock = null
let connectionStatus = 'disconnected'

function getStatus() {
  return connectionStatus
}

function getSock() {
  return currentSock
}

async function getVersion() {
  try {
    const { version } = await fetchLatestBaileysVersion()
    console.log('[bot] versão Baileys:', version)
    return version
  } catch {
    // fallback se não tiver acesso à rede para buscar a versão mais recente
    console.warn('[bot] fetchLatestBaileysVersion falhou, usando versão fallback')
    return [2, 3000, 1015901307]
  }
}

async function connectToWhatsApp() {
  const { state, saveCreds } = await useMultiFileAuthState('auth_info')
  const version = await getVersion()

  console.log('[bot] inicializando socket...')

  const sock = makeWASocket({
    version,
    logger,
    auth: state,
    printQRInTerminal: true,
  })

  currentSock = sock

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect, qr } = update

    if (qr) {
      connectionStatus = 'qr'
      console.log('[bot] QR gerado, emitindo evento...')
      botEvents.emit('qr', qr)
    }

    if (connection === 'close') {
      connectionStatus = 'disconnected'
      botEvents.emit('status', 'disconnected')

      const shouldReconnect =
        lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut

      console.log('[bot] conexão encerrada. Reconectando:', shouldReconnect)

      if (shouldReconnect) {
        connectToWhatsApp().catch(console.error)
      }
    }

    if (connection === 'open') {
      connectionStatus = 'connected'
      console.log('[bot] conectado ao WhatsApp!')
      botEvents.emit('status', 'connected')
    }
  })

  sock.ev.on('creds.update', saveCreds)

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return

    for (const msg of messages) {
      if (!msg.message || msg.key.fromMe) continue

      const from = msg.key.remoteJid
      const text =
        msg.message?.conversation ||
        msg.message?.extendedTextMessage?.text ||
        ''

      if (!text) continue

      console.log(`[bot] mensagem de ${from}: ${text}`)
      await handleMessage(sock, from, text)
    }
  })

  return sock
}

async function handleMessage(sock, from, text) {
  const lower = text.toLowerCase().trim()

  if (lower === 'ping') {
    await sendText(sock, from, 'pong')
    return
  }

  if (lower === 'oi' || lower === 'olá' || lower === 'ola') {
    await sendText(sock, from, 'Olá! Eu sou o Zapnit. Digite *ping* para testar.')
    return
  }

  await sendText(sock, from, `Você disse: ${text}`)
}

async function sendText(sock, to, text) {
  await sock.sendMessage(to, { text })
}

module.exports = { connectToWhatsApp, sendText, botEvents, getStatus, getSock }
