import 'dotenv/config'

import Fastify, { type FastifyError } from 'fastify'
import fastifyJwt from '@fastify/jwt'
import fastifyCors from '@fastify/cors'
import fastifyRateLimit from '@fastify/rate-limit'

import authRoutes from './routes/auth.js'
import companyRoutes from './routes/company.js'
import phonesRoutes from './routes/phones.js'
import webhookRoutes from './routes/webhook.js'
import messagesRoutes from './routes/messages.js'
import tenantsRoutes from './routes/tenants.js'
import plansRoutes from './routes/plans.js'
import baileysRoutes from './routes/baileys.js'
import wppwebRoutes from './routes/wppweb.js'
import billingRoutes from './routes/billing.js'
import { baileysManager } from './services/baileys.js'
import { wppwebManager } from './services/wppweb.js'

const app = Fastify({
  logger: {
    transport: process.env.NODE_ENV !== 'production'
      ? { target: 'pino-pretty', options: { colorize: true } }
      : undefined
  },
  bodyLimit: 20 * 1024 * 1024, // 20 MB para suportar envio de mídia em base64
})

// OpenAPI docs — registrado somente se os pacotes estiverem instalados
try {
  const swagger = await import('@fastify/swagger')
  const swaggerUi = await import('@fastify/swagger-ui')
  await app.register(swagger.default, {
    openapi: {
      info: { title: 'Zapnit API', version: '1.0.0', description: 'WhatsApp messaging gateway com automação por IA' },
      servers: [{ url: process.env.API_BASE_URL ?? 'http://localhost:3001', description: 'API Server' }],
      components: {
        securitySchemes: {
          bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }
        }
      }
    }
  })
  await app.register(swaggerUi.default, {
    routePrefix: '/docs',
    uiConfig: { docExpansion: 'list', deepLinking: false },
    staticCSP: true
  })
  app.log.info('OpenAPI docs available at /docs')
} catch {
  app.log.info('Swagger packages not installed — skipping /docs')
}

// Plugins
await app.register(fastifyCors, {
  origin: true,
  credentials: true
})

await app.register(fastifyJwt, {
  secret: process.env.JWT_SECRET!
})

await app.register(fastifyRateLimit, {
  max: 60,
  timeWindow: '1 minute',
  errorResponseBuilder: () => ({
    error: 'rate_limit_exceeded',
    message: 'Muitas requisições. Tente novamente em instantes.'
  })
})

// Routes
await app.register(authRoutes,    { prefix: '/auth' })
await app.register(companyRoutes, { prefix: '/company' })
await app.register(phonesRoutes,  { prefix: '/phones' })
await app.register(webhookRoutes, { prefix: '/webhook' })
await app.register(messagesRoutes, { prefix: '/api/v1/messages' })
await app.register(tenantsRoutes, { prefix: '/api/v1/tenants' })
await app.register(plansRoutes,   { prefix: '/api/v1/plans' })
await app.register(baileysRoutes,  { prefix: '' })
await app.register(wppwebRoutes,    { prefix: '' })
await app.register(billingRoutes,  { prefix: '/billing' })

// Health check
app.get('/health', async () => ({
  status: 'ok',
  service: 'zapnit-api',
  version: '1.0.0',
  timestamp: new Date().toISOString()
}))

// Recarrega instâncias Baileys persistidas no banco
baileysManager.init().catch(err => app.log.error(err, 'baileys init error'))

// Recarrega instâncias WPP Web (whatsapp-web.js) persistidas no banco
wppwebManager.init().catch(err => app.log.error(err, 'wppweb init error'))

// Handler global de erros de validação
app.setErrorHandler((err: FastifyError, _req, reply) => {
  if (err.validation) {
    return reply.status(400).send({
      error: 'validation_error',
      message: 'Dados inválidos na requisição',
      details: err.validation
    })
  }

  app.log.error(err)
  reply.status(err.statusCode ?? 500).send({
    error: err.code ?? 'internal_error',
    message: err.message ?? 'Erro interno do servidor'
  })
})

const PORT = Number(process.env.PORT) || 3001

try {
  await app.listen({ port: PORT, host: '0.0.0.0' })
  console.log(`🚀 Zapnit API rodando na porta ${PORT}`)
} catch (err) {
  app.log.error(err)
  process.exit(1)
}
