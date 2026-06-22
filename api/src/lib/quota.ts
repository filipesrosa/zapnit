import { prisma } from '../db.js'

export function incrementUserMessages(userId: string): void {
  prisma.user
    .findUnique({ where: { id: userId }, select: { tenantId: true } })
    .then(user =>
      user?.tenantId
        ? prisma.tenant.update({ where: { id: user.tenantId }, data: { usedMessages: { increment: 1 } } })
        : null
    )
    .catch(() => {})
}
