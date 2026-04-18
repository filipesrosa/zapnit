const { connectToWhatsApp } = require('./bot')
const { startServer } = require('./server')

startServer(3000)
connectToWhatsApp()
