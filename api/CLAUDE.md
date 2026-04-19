# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Start dev server with hot reload (tsx watch)
npm run build        # Compile TypeScript to dist/
npm run start        # Run production build

npm run db:migrate   # Run Prisma migrations
npm run db:generate  # Regenerate Prisma client after schema changes
npm run db:studio    # Open Prisma Studio (database GUI)
```

No test or lint scripts are configured.

## Architecture

**Zapnit** is a multi-tenant WhatsApp Business API gateway with Claude AI chatbot support, built on Fastify + Prisma + BullMQ.

### Request Flow

**Inbound (WhatsApp → Zapnit):**
1. Meta sends webhook to `POST /webhook/:tenantId`
2. Handler upserts Contact, Conversation, and Message in DB
3. If conversation is in `BOT` status, `handleInboundMessage()` in `src/services/chatbot.ts` calls Claude with full conversation history
4. Response is queued via BullMQ → worker calls Meta Graph API

**Outbound (Client → WhatsApp):**
1. Client authenticates via `POST /auth/token` (OAuth2 client credentials, returns 24h JWT)
2. `POST /api/v1/messages/send` with `Authorization: Bearer <token>`
3. `authenticate()` middleware validates JWT; `checkQuota()` enforces monthly tenant limit
4. Message saved as `QUEUED`, job sent to BullMQ
5. `src/jobs/messageWorker.ts` processes job and calls Meta Graph API
6. Meta sends status webhooks (sent/delivered/read) → DB updated

### Layer Overview

| Layer | Location | Responsibility |
|---|---|---|
| Routes | `src/routes/` | HTTP handlers (auth, messages, tenants, plans, webhook) |
| Middleware | `src/middleware/auth.ts` | JWT auth, quota enforcement, admin guard |
| Services | `src/services/` | Claude AI (`chatbot.ts`), Meta API (`whatsapp.ts`) |
| Jobs | `src/jobs/messageWorker.ts` | BullMQ worker for async message sending |
| DB | `prisma/schema.prisma` | Prisma schema (Plan, Tenant, PhoneNumber, Contact, Conversation, Message) |

### Multi-Tenancy

All DB queries must be scoped by `tenantId`. The authenticated tenant is injected into `request.tenant` via the `authenticate` middleware (see `src/types/fastify.d.ts`).

Admin endpoints (tenants, plans) require an `x-admin-secret` header matching the `ADMIN_SECRET` env var.

### Conversation States

- `OPEN` — human agent handling
- `RESOLVED` — closed
- `BOT` — Claude AI responds automatically to inbound messages

### Key Environment Variables

```
DATABASE_URL          # PostgreSQL
REDIS_URL             # Redis (BullMQ queues)
JWT_SECRET            # JWT signing key
ANTHROPIC_API_KEY     # Claude AI
META_APP_SECRET       # Webhook signature verification
META_GRAPH_API_VERSION # e.g. v25.0
ADMIN_SECRET          # Admin route protection
API_BASE_URL          # Public URL for webhook registration
```

### Deployment

Deployed on Railway via NIXPACKS. `railway.json` runs `prisma migrate deploy && node dist/index.js` on start. Health check at `/health`.
