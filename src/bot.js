const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
} = require('@whiskeysockets/baileys')
const qrcode = require('qrcode-terminal')
const pino = require('pino')
const EventEmitter = require('events')

const logger = pino({ level: 'silent' })

const botEvents = new EventEmitter()
let currentSock = null
let connectionStatus = 'disconnected' // disconnected | qr | connected

function getStatus() {
  return connectionStatus
}

function getSock() {
  return currentSock
}

async function connectToWhatsApp() {
  const { state, saveCreds } = await useMultiFileAuthState('auth_info')
  const { version } = await fetchLatestBaileysVersion()

  const sock = makeWASocket({
    version,
    logger,
    auth: state,
    printQRInTerminal: false,
  })

  currentSock = sock

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect, qr } = update

    if (qr) {
      connectionStatus = 'qr'
      console.clear()
      console.log('=== ZAPNIT - Escaneie o QR Code ===\n')
      qrcode.generate(qr, { small: true })
      botEvents.emit('qr', qr)
    }

    if (connection === 'close') {
      connectionStatus = 'disconnected'
      botEvents.emit('status', 'disconnected')

      const shouldReconnect =
        lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut

      console.log('Conexão encerrada. Reconectando:', shouldReconnect)

      if (shouldReconnect) {
        connectToWhatsApp()
      }
    }

    if (connection === 'open') {
      connectionStatus = 'connected'
      console.log('\n=== Conectado ao WhatsApp! ===\n')
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

      console.log(`[${from}] ${text}`)
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
