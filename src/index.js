const { connectToWhatsApp } = require('./bot')
const { startServer } = require('./server')

startServer(3000)

connectToWhatsApp().catch((err) => {
  console.error('[zapnit] erro fatal ao inicializar bot:', err)
  process.exit(1)
})
