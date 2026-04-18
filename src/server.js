const express = require('express')
const path = require('path')
const QRCode = require('qrcode')
const { botEvents, getStatus, getSock, sendText } = require('./bot')

const app = express()
app.use(express.json())
app.use(express.static(path.join(__dirname, 'public')))

// SSE clients
const sseClients = new Set()
let lastQrDataUrl = null  // cache do último QR para novos clientes que conectam tarde

function broadcast(event, data) {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
  for (const res of sseClients) {
    res.write(payload)
  }
}

botEvents.on('qr', async (qrString) => {
  lastQrDataUrl = await QRCode.toDataURL(qrString)
  broadcast('qr', { qr: lastQrDataUrl })
})

botEvents.on('status', (status) => {
  if (status === 'connected') lastQrDataUrl = null
  broadcast('status', { status })
})

// SSE endpoint — frontend se conecta aqui para receber QR e status em tempo real
app.get('/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.flushHeaders()

  // Manda status atual imediatamente
  res.write(`event: status\ndata: ${JSON.stringify({ status: getStatus() })}\n\n`)

  // Se já havia QR gerado antes do cliente conectar, envia agora
  if (lastQrDataUrl && getStatus() === 'qr') {
    res.write(`event: qr\ndata: ${JSON.stringify({ qr: lastQrDataUrl })}\n\n`)
  }

  sseClients.add(res)
  req.on('close', () => sseClients.delete(res))
})

// Debug — acessar no browser para ver estado atual
app.get('/debug', (req, res) => {
  res.json({
    status: getStatus(),
    sseClients: sseClients.size,
    hasQrCached: !!lastQrDataUrl,
  })
})

// Envio de mensagem
app.post('/send', async (req, res) => {
  const { phone, message } = req.body

  if (!phone || !message) {
    return res.status(400).json({ error: 'phone e message são obrigatórios' })
  }

  if (getStatus() !== 'connected') {
    return res.status(503).json({ error: 'WhatsApp não está conectado' })
  }

  const jid = phone.replace(/\D/g, '') + '@s.whatsapp.net'

  try {
    await sendText(getSock(), jid, message)
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

function startServer(port = 3000) {
  app.listen(port, () => {
    console.log(`Zapnit rodando em http://localhost:${port}`)
  })
}

module.exports = { startServer }
