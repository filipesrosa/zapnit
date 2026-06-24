import { Worker, Queue } from 'bullmq'
import { Redis } from 'ioredis'
import { prisma } from '../db.js'
import { baileysManager } from '../services/baileys.js'
import { wppwebManager } from '../services/wppweb.js'
import {
  sendBillingWarningEmail,
  sendTrialExpiryWarningEmail,
} from '../services/email.js'

const connection = new Redis(process.env.REDIS_URL!, { maxRetriesPerRequest: null })
const billingQueue = new Queue('billing', { connection })
const APP_URL = process.env.APP_BASE_URL ?? 'https://zapnit.com'

async function runBillingWarning() {
  const now = new Date()
  const fiveDaysFromNow = new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000)
  const twentyDaysAgo = new Date(now.getTime() - 20 * 24 * 60 * 60 * 1000)

  const tenants = await prisma.tenant.findMany({
    where: {
      paymentStatus: 'active',
      billingCycleEnd: { gte: now, lte: fiveDaysFromNow },
      OR: [
        { lastBillingWarningAt: null },
        { lastBillingWarningAt: { lt: twentyDaysAgo } },
      ],
    },
    include: { user: true },
  })

  for (const tenant of tenants) {
    if (!tenant.user || !tenant.billingCycleEnd) continue
    const daysLeft = Math.ceil((tenant.billingCycleEnd.getTime() - now.getTime()) / (24 * 60 * 60 * 1000))
    const renewalUrl = `${APP_URL}/dashboard/billing`
    await sendBillingWarningEmail(tenant.user, daysLeft, renewalUrl).catch(() => {})
    await prisma.tenant.update({ where: { id: tenant.id }, data: { lastBillingWarningAt: now } })
  }
}

async function runTrialExpiry() {
  const now = new Date()
  const sixHoursFromNow = new Date(now.getTime() + 6 * 60 * 60 * 1000)
  const upgradeUrl = `${APP_URL}/dashboard/billing`

  // Expire instances past their trial end
  const [expiredBaileys, expiredWppweb] = await Promise.all([
    prisma.baileysInstance.findMany({
      where: { activationStatus: 'trial', trialEndsAt: { lte: now } },
      include: { user: true },
    }),
    prisma.wppwebInstance.findMany({
      where: { activationStatus: 'trial', trialEndsAt: { lte: now } },
      include: { user: true },
    }),
  ])

  for (const inst of expiredBaileys) {
    await baileysManager.setActivationStatus(inst.id, 'trial_expired').catch(() => {})
    if (inst.user) {
      await sendTrialExpiryWarningEmail(inst.user, 0, upgradeUrl).catch(() => {})
    }
  }

  for (const inst of expiredWppweb) {
    await wppwebManager.setActivationStatus(inst.id, 'trial_expired').catch(() => {})
    if (inst.user) {
      await sendTrialExpiryWarningEmail(inst.user, 0, upgradeUrl).catch(() => {})
    }
  }

  // Warn instances expiring within 6 hours (only if warning not yet sent)
  const [warnBaileys, warnWppweb] = await Promise.all([
    prisma.baileysInstance.findMany({
      where: {
        activationStatus: 'trial',
        trialEndsAt: { gt: now, lte: sixHoursFromNow },
        trialWarningSentAt: null,
      },
      include: { user: true },
    }),
    prisma.wppwebInstance.findMany({
      where: {
        activationStatus: 'trial',
        trialEndsAt: { gt: now, lte: sixHoursFromNow },
        trialWarningSentAt: null,
      },
      include: { user: true },
    }),
  ])

  for (const inst of [...warnBaileys, ...warnWppweb]) {
    if (!inst.user) continue
    const hoursLeft = Math.ceil((inst.trialEndsAt.getTime() - now.getTime()) / (60 * 60 * 1000))
    await sendTrialExpiryWarningEmail(inst.user, hoursLeft, upgradeUrl).catch(() => {})
    const model = 'webhookUrl' in inst && inst.id.length === 12
      ? prisma.baileysInstance
      : prisma.wppwebInstance
    await (model as any).update({ where: { id: inst.id }, data: { trialWarningSentAt: now } })
  }
}

async function runInstanceSleep() {
  const threshold = new Date(Date.now() - 72 * 60 * 60 * 1000)

  const [sleepBaileys, sleepWppweb] = await Promise.all([
    prisma.baileysInstance.findMany({
      where: {
        activationStatus: { in: ['active', 'trial'] },
        sleeping: false,
        webhookUrl: null,
        OR: [
          { lastActivityAt: { lt: threshold } },
          { lastActivityAt: null, createdAt: { lt: threshold } },
        ],
      },
    }),
    prisma.wppwebInstance.findMany({
      where: {
        activationStatus: { in: ['active', 'trial'] },
        sleeping: false,
        webhookUrl: null,
        OR: [
          { lastActivityAt: { lt: threshold } },
          { lastActivityAt: null, createdAt: { lt: threshold } },
        ],
      },
    }),
  ])

  for (const inst of sleepBaileys) {
    await baileysManager.sleep(inst.id).catch(err =>
      console.error(`[billing-worker] baileys sleep error ${inst.id}`, err)
    )
  }

  for (const inst of sleepWppweb) {
    await wppwebManager.sleep(inst.id).catch(err =>
      console.error(`[billing-worker] wppweb sleep error ${inst.id}`, err)
    )
  }

  if (sleepBaileys.length + sleepWppweb.length > 0) {
    console.log(`[billing-worker] slept ${sleepBaileys.length} Baileys + ${sleepWppweb.length} WPP Web instances`)
  }
}

export function startBillingWarningWorker(): Worker {
  // Register repeatable jobs once on startup (stable jobIds prevent duplicates on restart)
  billingQueue.add('billing-warning', {}, {
    repeat: { pattern: '0 8 * * *' },
    jobId: 'billing-warning-daily',
  }).catch(() => {})

  billingQueue.add('trial-expiry', {}, {
    repeat: { pattern: '*/30 * * * *' },
    jobId: 'trial-expiry-30min',
  }).catch(() => {})

  billingQueue.add('instance-sleep', {}, {
    repeat: { pattern: '0 * * * *' },
    jobId: 'instance-sleep-hourly',
  }).catch(() => {})

  const worker = new Worker('billing', async (job) => {
    if (job.name === 'billing-warning') await runBillingWarning()
    else if (job.name === 'trial-expiry') await runTrialExpiry()
    else if (job.name === 'instance-sleep') await runInstanceSleep()
  }, { connection, concurrency: 1 })

  worker.on('failed', (job, err) => {
    console.error(`[billing-worker] job ${job?.name} failed:`, err.message)
  })

  console.log('📅 Billing warning worker started')
  return worker
}
