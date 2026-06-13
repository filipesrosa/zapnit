import type { FastifyInstance } from 'fastify'
import { prisma } from '../db.js'
import { authenticateUser } from '../middleware/auth.js'
import bcrypt from 'bcryptjs'
import { nanoid } from 'nanoid'

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
      tags: ['Autenticação'],
      summary: 'Obter token de acesso (OAuth2 client credentials)',
      description: 'Use client_id e client_secret para obter um Bearer token de 24h para chamar a API de mensagens.',
      body: {
        type: 'object',
        required: ['client_id', 'client_secret', 'grant_type'],
        properties: {
          client_id:     { type: 'string' },
          client_secret: { type: 'string' },
          grant_type:    { type: 'string', enum: ['client_credentials'] }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            access_token: { type: 'string' },
            token_type: { type: 'string' },
            expires_in: { type: 'number' }
          }
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

  // POST /auth/register — criar conta de usuário + tenant gratuito
  app.post<{ Body: RegisterBody }>('/register', {
    schema: {
      tags: ['Autenticação'],
      summary: 'Criar conta e tenant gratuito',
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

    const freePlan = await prisma.plan.upsert({
      where: { slug: 'free' },
      update: {},
      create: {
        name: 'Gratuito',
        slug: 'free',
        monthlyQuota: 100,
        price: 0,
        features: ['100 mensagens/mês', '1 número WhatsApp', 'Suporte por e-mail'],
        isActive: true
      }
    })

    const passwordHash = await bcrypt.hash(password, 10)
    const clientId = `zap_${nanoid(16)}`
    const rawSecret = nanoid(32)
    const hashedSecret = await bcrypt.hash(rawSecret, 10)

    const user = await prisma.user.create({
      data: {
        name,
        email,
        passwordHash,
        tenant: {
          create: {
            name,
            clientId,
            clientSecret: hashedSecret,
            planId: freePlan.id,
            monthlyQuota: freePlan.monthlyQuota,
            quotaResetAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
          }
        }
      },
      include: {
        tenant: { include: { plan: true } }
      }
    })

    const token = app.jwt.sign({ userId: user.id }, { expiresIn: '7d' })

    return reply.status(201).send({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        clientToken: user.clientToken,
        tenant: user.tenant ? {
          id: user.tenant.id,
          name: user.tenant.name,
          client_id: user.tenant.clientId,
          client_secret: rawSecret,
          plan: { id: user.tenant.plan.id, name: user.tenant.plan.name, slug: user.tenant.plan.slug },
          quota: { used: 0, limit: user.tenant.monthlyQuota, resets_at: user.tenant.quotaResetAt }
        } : null
      }
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
      user: { id: user.id, name: user.name, email: user.email, clientToken: user.clientToken }
    })
  })

  // GET /auth/me — retorna perfil do usuário autenticado
  await app.register(async (auth) => {
    auth.addHook('preHandler', authenticateUser)

    auth.get('/me', async (req) => {
      const user = await prisma.user.findUniqueOrThrow({
        where: { id: req.authUser.id },
        include: {
          tenant: {
            include: {
              plan: true,
              _count: { select: { phoneNumbers: true } }
            }
          }
        }
      })
      return {
        id: user.id,
        name: user.name,
        email: user.email,
        clientToken: user.clientToken,
        tenant: user.tenant ? {
          id: user.tenant.id,
          name: user.tenant.name,
          client_id: user.tenant.clientId,
          plan: {
            id: user.tenant.plan.id,
            name: user.tenant.plan.name,
            slug: user.tenant.plan.slug,
            price: user.tenant.plan.price
          },
          quota: {
            used: user.tenant.usedMessages,
            limit: user.tenant.monthlyQuota,
            resets_at: user.tenant.quotaResetAt
          },
          billing: {
            payment_status: user.tenant.paymentStatus,
            billing_cycle_end: user.tenant.billingCycleEnd
          },
          phone_numbers_count: user.tenant._count.phoneNumbers
        } : null
      }
    })

    auth.patch<{ Body: { name: string } }>('/me', {
      schema: {
        body: {
          type: 'object',
          required: ['name'],
          properties: { name: { type: 'string', minLength: 1 } }
        }
      }
    }, async (req) => {
      const updated = await prisma.user.update({
        where: { id: req.authUser.id },
        data: { name: req.body.name },
        include: { tenant: { include: { plan: true } } }
      })
      if (updated.tenant) {
        await prisma.tenant.update({
          where: { id: updated.tenant.id },
          data: { name: req.body.name }
        })
      }
      return { id: updated.id, name: updated.name, email: updated.email }
    })
  })
}
