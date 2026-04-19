import type { Plan, Tenant, User } from '@prisma/client'

declare module 'fastify' {
  interface FastifyRequest {
    tenant: Tenant & { plan: Plan }
    authUser: User
  }
}
