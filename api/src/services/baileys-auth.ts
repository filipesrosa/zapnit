import {
  initAuthCreds,
  BufferJSON,
  proto,
  type AuthenticationState,
  type SignalDataTypeMap,
} from '@whiskeysockets/baileys'
import type { Prisma } from '@prisma/client'
import { prisma } from '../db.js'

/**
 * Postgres-backed Signal auth state for Baileys.
 *
 * Drop-in replacement for `useMultiFileAuthState`. Each credential and signal
 * key lives in its own row in `baileys_auth_state`, written via an atomic
 * upsert. This removes the non-atomic file writes of the multi-file store,
 * which under concurrency corrupt the libsignal session state and cause the
 * recipient's permanent "Waiting for this message".
 *
 * Serialization mirrors the reference implementation exactly: values are
 * `JSON.stringify`'d with `BufferJSON.replacer` and parsed back with
 * `BufferJSON.reviver`, with the same special-casing for `app-state-sync-key`.
 */
const CREDS_CATEGORY = 'creds'
const CREDS_KEY_ID = 'creds'

export async function useDbAuthState(instanceId: string): Promise<{
  state: AuthenticationState
  saveCreds: () => Promise<void>
}> {
  // Build (don't execute) Prisma operations so a whole key batch can be
  // committed in a single transaction — avoids partial writes on crash.
  const upsertOp = (category: string, keyId: string, value: unknown): Prisma.PrismaPromise<unknown> => {
    const data = JSON.stringify(value, BufferJSON.replacer)
    return prisma.baileysAuthState.upsert({
      where: { instanceId_category_keyId: { instanceId, category, keyId } },
      create: { instanceId, category, keyId, data },
      update: { data },
    })
  }

  // deleteMany (not delete) so removing a non-existent key doesn't throw and
  // abort the transaction.
  const deleteOp = (category: string, keyId: string): Prisma.PrismaPromise<unknown> =>
    prisma.baileysAuthState.deleteMany({ where: { instanceId, category, keyId } })

  const readData = async (category: string, keyId: string): Promise<any> => {
    const row = await prisma.baileysAuthState.findUnique({
      where: { instanceId_category_keyId: { instanceId, category, keyId } },
    })
    if (!row) return null
    return JSON.parse(row.data, BufferJSON.reviver)
  }

  const creds = (await readData(CREDS_CATEGORY, CREDS_KEY_ID)) || initAuthCreds()

  return {
    state: {
      creds,
      keys: {
        get: async (type, ids) => {
          const data: { [id: string]: SignalDataTypeMap[typeof type] } = {}
          await Promise.all(
            ids.map(async (id) => {
              let value = await readData(type, id)
              if (type === 'app-state-sync-key' && value) {
                value = proto.Message.AppStateSyncKeyData.fromObject(value)
              }
              data[id] = value
            }),
          )
          return data
        },
        set: async (data) => {
          const ops: Prisma.PrismaPromise<unknown>[] = []
          for (const category in data) {
            for (const id in data[category as keyof typeof data]) {
              const value = data[category as keyof typeof data]![id]
              ops.push(value ? upsertOp(category, id, value) : deleteOp(category, id))
            }
          }
          if (ops.length) await prisma.$transaction(ops)
        },
      },
    },
    saveCreds: async () => {
      await upsertOp(CREDS_CATEGORY, CREDS_KEY_ID, creds)
    },
  }
}
