import { prisma } from '../db.js'

let cache: { value: string; expiresAt: number } | null = null

export async function getTrialWatermark(): Promise<string> {
  if (cache && Date.now() < cache.expiresAt) return cache.value
  const config = await prisma.systemConfig.upsert({
    where: { id: 'default' },
    create: { id: 'default' },
    update: {},
  })
  cache = { value: config.trialWatermark, expiresAt: Date.now() + 60_000 }
  return cache.value
}

export function invalidateConfigCache(): void {
  cache = null
}
