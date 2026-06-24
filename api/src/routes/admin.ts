import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { prisma } from '../db.js'
import { baileysManager } from '../services/baileys.js'
import { wppwebManager } from '../services/wppweb.js'
import { invalidateConfigCache } from '../services/systemConfig.js'

function adminGuard(req: FastifyRequest, reply: FastifyReply): boolean {
  const key = req.headers['x-admin-key']
  if (!key || key !== process.env.ADMIN_SECRET) {
    reply.status(403).send({ error: 'Forbidden' })
    return true
  }
  return false
}

interface InstanceParams { id: string }

export default async function adminRoutes(app: FastifyInstance): Promise<void> {
  // GET /admin/instances — list all Baileys + WPP Web instances across all users
  app.get('/instances', async (req, reply) => {
    if (adminGuard(req, reply)) return

    const [baileys, wppweb] = await Promise.all([
      prisma.baileysInstance.findMany({
        include: { user: { select: { id: true, name: true, email: true } } },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.wppwebInstance.findMany({
        include: { user: { select: { id: true, name: true, email: true } } },
        orderBy: { createdAt: 'desc' },
      }),
    ])

    return {
      baileys: baileys.map(i => ({
        id: i.id,
        type: 'baileys',
        status: i.status,
        activation_status: i.activationStatus,
        sleeping: i.sleeping,
        wa_number: i.waNumber,
        wa_name: i.waName,
        connected_at: i.connectedAt,
        webhook_url: i.webhookUrl,
        created_at: i.createdAt,
        user: i.user ? { id: i.user.id, name: i.user.name, email: i.user.email } : null,
      })),
      wppweb: wppweb.map(i => ({
        id: i.id,
        type: 'wppweb',
        status: i.status,
        activation_status: i.activationStatus,
        sleeping: i.sleeping,
        wa_number: i.waNumber,
        wa_name: i.waName,
        connected_at: i.connectedAt,
        webhook_url: i.webhookUrl,
        created_at: i.createdAt,
        user: i.user ? { id: i.user.id, name: i.user.name, email: i.user.email } : null,
      })),
      totals: { baileys: baileys.length, wppweb: wppweb.length, total: baileys.length + wppweb.length },
    }
  })

  // GET /admin/instances/memory-report — live memory accounting
  app.get('/instances/memory-report', async (req, reply) => {
    if (adminGuard(req, reply)) return

    const [dbBaileys, dbWppweb] = await Promise.all([
      prisma.baileysInstance.findMany({
        select: { id: true, sleeping: true, webhookUrl: true, activationStatus: true },
      }),
      prisma.wppwebInstance.findMany({
        select: { id: true, sleeping: true, webhookUrl: true, activationStatus: true },
      }),
    ])

    const liveB = baileysManager.allInstances()
    const liveW = wppwebManager.allInstances()

    const bWebhookLocked = dbBaileys.filter(i => i.webhookUrl).length
    const wWebhookLocked = dbWppweb.filter(i => i.webhookUrl).length
    const bSleeping = dbBaileys.filter(i => i.sleeping).length
    const wSleeping = dbWppweb.filter(i => i.sleeping).length

    // RAM estimate: Baileys ~75 MB active, WPP Web ~300 MB active
    const estimatedRamMb = (liveB.length * 75) + (liveW.length * 300)

    return {
      baileys: {
        total: dbBaileys.length,
        active_in_memory: liveB.length,
        sleeping: bSleeping,
        webhook_locked: bWebhookLocked,
      },
      wppweb: {
        total: dbWppweb.length,
        active_in_memory: liveW.length,
        sleeping: wSleeping,
        webhook_locked: wWebhookLocked,
      },
      estimated_ram_mb: estimatedRamMb,
    }
  })

  // GET /admin/instances/baileys/:id — detail a single Baileys instance
  app.get<{ Params: InstanceParams }>('/instances/baileys/:id', async (req, reply) => {
    if (adminGuard(req, reply)) return

    const instance = await prisma.baileysInstance.findUnique({
      where: { id: req.params.id },
      include: {
        user: { select: { id: true, name: true, email: true, tenantId: true } },
        _count: { select: { messages: true, authState: true } },
      },
    })
    if (!instance) return reply.status(404).send({ error: 'Instance not found' })

    const live = baileysManager.getForUser(instance.id, instance.userId ?? '')
    return {
      id: instance.id,
      type: 'baileys',
      status: live?.status ?? instance.status,
      activation_status: instance.activationStatus,
      trial_ends_at: instance.trialEndsAt,
      sleeping: instance.sleeping,
      wa_number: instance.waNumber,
      wa_name: instance.waName,
      connected_at: instance.connectedAt,
      webhook_url: instance.webhookUrl,
      webhook_events: instance.webhookEvents,
      ai_enabled: instance.aiEnabled,
      message_count: instance._count.messages,
      auth_keys: instance._count.authState,
      created_at: instance.createdAt,
      user: instance.user,
    }
  })

  // GET /admin/instances/wppweb/:id — detail a single WPP Web instance
  app.get<{ Params: InstanceParams }>('/instances/wppweb/:id', async (req, reply) => {
    if (adminGuard(req, reply)) return

    const instance = await prisma.wppwebInstance.findUnique({
      where: { id: req.params.id },
      include: {
        user: { select: { id: true, name: true, email: true, tenantId: true } },
        _count: { select: { messages: true } },
      },
    })
    if (!instance) return reply.status(404).send({ error: 'Instance not found' })

    const live = wppwebManager.getForUser(instance.id, instance.userId ?? '')
    return {
      id: instance.id,
      type: 'wppweb',
      status: live?.status ?? instance.status,
      activation_status: instance.activationStatus,
      trial_ends_at: instance.trialEndsAt,
      sleeping: instance.sleeping,
      wa_number: instance.waNumber,
      wa_name: instance.waName,
      connected_at: instance.connectedAt,
      webhook_url: instance.webhookUrl,
      webhook_events: instance.webhookEvents,
      ai_enabled: instance.aiEnabled,
      message_count: instance._count.messages,
      created_at: instance.createdAt,
      user: instance.user,
    }
  })

  // DELETE /admin/instances/baileys/:id — disconnect and delete
  app.delete<{ Params: InstanceParams }>('/instances/baileys/:id', async (req, reply) => {
    if (adminGuard(req, reply)) return

    const instance = await prisma.baileysInstance.findUnique({ where: { id: req.params.id } })
    if (!instance) return reply.status(404).send({ error: 'Instance not found' })

    try {
      const live = baileysManager.getForUser(instance.id, instance.userId ?? '')
      if (live) await live.disconnect()
    } catch { /* best-effort */ }

    await prisma.baileysInstance.delete({ where: { id: req.params.id } })
    return { deleted: true, id: req.params.id }
  })

  // DELETE /admin/instances/wppweb/:id — disconnect and delete
  app.delete<{ Params: InstanceParams }>('/instances/wppweb/:id', async (req, reply) => {
    if (adminGuard(req, reply)) return

    const instance = await prisma.wppwebInstance.findUnique({ where: { id: req.params.id } })
    if (!instance) return reply.status(404).send({ error: 'Instance not found' })

    try {
      const live = wppwebManager.getForUser(instance.id, instance.userId ?? '')
      if (live) await live.logout()
    } catch { /* best-effort */ }

    await prisma.wppwebInstance.delete({ where: { id: req.params.id } })
    return { deleted: true, id: req.params.id }
  })

  // GET /admin/config — read system config (trial watermark, etc.)
  app.get('/config', async (req, reply) => {
    if (adminGuard(req, reply)) return
    const config = await prisma.systemConfig.upsert({
      where: { id: 'default' },
      create: { id: 'default' },
      update: {},
    })
    return { trial_watermark: config.trialWatermark }
  })

  // PATCH /admin/config — update system config
  app.patch<{ Body: { trial_watermark?: string } }>('/config', async (req, reply) => {
    if (adminGuard(req, reply)) return
    const config = await prisma.systemConfig.upsert({
      where: { id: 'default' },
      create: {
        id: 'default',
        trialWatermark: req.body.trial_watermark ?? '_Enviado via Zapnit Trial — zapnit.com_',
      },
      update: {
        ...(req.body.trial_watermark !== undefined && { trialWatermark: req.body.trial_watermark }),
      },
    })
    invalidateConfigCache()
    return { trial_watermark: config.trialWatermark }
  })

  // GET /admin/users — list users with their subscription and instance counts
  app.get('/users', async (req, reply) => {
    if (adminGuard(req, reply)) return

    const users = await prisma.user.findMany({
      include: {
        tenant: { include: { plan: true } },
        _count: { select: { instances: true, wppwebInstances: true } },
      },
      orderBy: { createdAt: 'desc' },
    })

    return users.map(u => ({
      id: u.id,
      name: u.name,
      email: u.email,
      created_at: u.createdAt,
      instances: { baileys: u._count.instances, wppweb: u._count.wppwebInstances },
      subscription: u.tenant ? {
        plan: u.tenant.plan.name,
        plan_slug: u.tenant.plan.slug,
        payment_status: u.tenant.paymentStatus ?? 'free',
        is_internal: u.tenant.isInternal,
        used_messages: u.tenant.usedMessages,
        monthly_quota: u.tenant.monthlyQuota,
      } : null,
    }))
  })
}
