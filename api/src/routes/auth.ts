import type { FastifyInstance } from 'fastify'
import { prisma } from '../db.js'
import bcrypt from 'bcryptjs'

interface TokenBody {
  client_id: string
  client_secret: string
  grant_type: 'client_credentials'
}

interface RegisterBody {
  name: string
  email: string
  password: string
}

interface LoginBody {
  email: string
  password: string
}

export default async function authRoutes(app: FastifyInstance): Promise<void> {
  // POST /auth/token — OAuth2 client credentials (para integrações externas via Tenant)
  app.post<{ Body: TokenBody }>('/token', {
    schema: {
      body: {
        type: 'object',
        required: ['client_id', 'client_secret', 'grant_type'],
        properties: {
          client_id:     { type: 'string' },
          client_secret: { type: 'string' },
          grant_type:    { type: 'string', enum: ['client_credentials'] }
        }
      }
    }
  }, async (req, reply) => {
    const { client_id, client_secret } = req.body

    const tenant = await prisma.tenant.findUnique({ where: { clientId: client_id } })
    if (!tenant) {
      return reply.status(401).send({ error: 'invalid_client', message: 'Client not found' })
    }

    const valid = await bcrypt.compare(client_secret, tenant.clientSecret)
    if (!valid) {
      return reply.status(401).send({ error: 'invalid_client', message: 'Invalid credentials' })
    }

    const token = app.jwt.sign(
      { tenantId: tenant.id, planId: tenant.planId },
      { expiresIn: '24h' }
    )

    return reply.send({ access_token: token, token_type: 'Bearer', expires_in: 86400 })
  })

  // POST /auth/register — criar conta de usuário
  app.post<{ Body: RegisterBody }>('/register', {
    schema: {
      body: {
        type: 'object',
        required: ['name', 'email', 'password'],
        properties: {
          name:     { type: 'string', minLength: 1 },
          email:    { type: 'string', format: 'email' },
          password: { type: 'string', minLength: 6 }
        }
      }
    }
  }, async (req, reply) => {
    const { name, email, password } = req.body

    const exists = await prisma.user.findUnique({ where: { email } })
    if (exists) {
      return reply.status(409).send({ error: 'E-mail já cadastrado' })
    }

    const passwordHash = await bcrypt.hash(password, 10)
    const user = await prisma.user.create({
      data: { name, email, passwordHash }
    })

    const token = app.jwt.sign({ userId: user.id }, { expiresIn: '7d' })

    return reply.status(201).send({
      token,
      user: { id: user.id, name: user.name, email: user.email }
    })
  })

  // POST /auth/login — login com email + senha
  app.post<{ Body: LoginBody }>('/login', {
    schema: {
      body: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email:    { type: 'string', format: 'email' },
          password: { type: 'string' }
        }
      }
    }
  }, async (req, reply) => {
    const { email, password } = req.body

    const user = await prisma.user.findUnique({ where: { email } })
    if (!user) {
      return reply.status(401).send({ error: 'Credenciais inválidas' })
    }

    const valid = await bcrypt.compare(password, user.passwordHash)
    if (!valid) {
      return reply.status(401).send({ error: 'Credenciais inválidas' })
    }

    const token = app.jwt.sign({ userId: user.id }, { expiresIn: '7d' })

    return reply.send({
      token,
      user: { id: user.id, name: user.name, email: user.email }
    })
  })
}
