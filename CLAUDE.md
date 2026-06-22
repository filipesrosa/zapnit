# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Structure

This is a monorepo with two packages and a shared `docker-compose.yml`:

- `api/` — Fastify + Prisma + BullMQ backend (Node.js/TypeScript)
- `app/` — Next.js 15 frontend dashboard + landing page

## Commands

### API (`api/`)

```bash
npm run dev          # Start API server with hot reload (tsx watch src/index.ts)
npm run worker:dev   # Start BullMQ worker with hot reload (tsx watch src/worker.ts)
npm run build        # Compile TypeScript to dist/
npm run start        # Run compiled API (dist/index.js)
npm run worker       # Run compiled worker (dist/worker.js)

npm run db:migrate   # Run Prisma migrations (dev)
npm run db:generate  # Regenerate Prisma client after schema changes
npm run db:studio    # Open Prisma Studio GUI
```

No test or lint scripts are configured.

### App (`app/`)

```bash
pnpm dev     # Start Next.js dev server
pnpm build   # Production build
pnpm start   # Serve production build
```

### Docker (root)

```bash
docker compose up -d           # Start all services (db, redis, api, worker, app)
docker compose up -d db redis  # Start only infrastructure
```

## Architecture

**Zapnit** is a multi-tenant WhatsApp messaging gateway with three integration paths and a dashboard frontend.

### Three WhatsApp Integration Paths

**1. Meta Cloud API (WABA)** — Official Meta Business API, for production/SaaS tenants.
- Requires a Meta WhatsApp Business Account, phone number ID, and access token per `PhoneNumber` record.
- Inbound: Meta sends webhooks to `POST /webhook/:tenantId`; outbound goes through Meta Graph API via `src/services/whatsapp.ts`.
- Messages are queued async via BullMQ (`src/jobs/messageWorker.ts`) before being sent.

**2. Baileys (QR Code)** — Unofficial WhatsApp protocol via `@whiskeysockets/baileys`, for personal/developer use.
- `BaileysManager` in `src/services/baileys.ts` manages socket lifecycle per instance (QR → connected → disconnected/reconnect).
- Auth state is persisted to `sessions/<instanceId>/` on disk (volume-mounted in Docker).
- Each instance can fire webhooks on configurable events (see `WEBHOOK_EVENTS` in `src/services/baileys.ts`).
- Status updates stream to the frontend via SSE at `GET /instances/:id/events`.

**3. WPP Web (whatsapp-web.js)** — Unofficial WhatsApp Web automation via Puppeteer (`whatsapp-web.js`), parallel to Baileys.
- `WppwebManager` in `src/services/wppweb.ts` manages one headless Chromium client per instance (QR → connected → disconnected/reconnect). Mirrors the Baileys manager/route/SSE shape.
- Connect by **QR Code or pairing code** (`POST /wpp-instances/:id/pairing-code`). Instance ids are fixed 32-char strings (uppercase A–Z + digits).
- Routes live under the `/wpp-instances` prefix (`src/routes/wppweb.ts`); send endpoints use the same `X-Client-Token` auth as Baileys.
- Session auth state is persisted on disk by LocalAuth under `WWEBJS_AUTH_PATH` (Docker volume `wppweb_sessions:/app/wwebjs_auth`), **not** in Postgres. Requires system Chromium (installed in the Dockerfile runner stage; `PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser`).
- Frontend: "WPP Web" tab in the dashboard `phones` section, alongside "Meta API" and "QR Code".

### API Process Split

The API runs as **two separate processes** (both built from the same `api/` codebase):

| Process | Entry | Role |
|---|---|---|
| `api` | `src/index.ts` | HTTP server (Fastify), Baileys manager, webhook receiver |
| `worker` | `src/worker.ts` | BullMQ worker — processes `send-message` and `send-template` jobs |

The worker runs at concurrency 10 and updates `Message.status` in the DB on completion/failure.

### Request Flow

**Inbound (WhatsApp → Zapnit via WABA):**
1. Meta POSTs to `/webhook/:tenantId`
2. Handler upserts `Contact`, `Conversation`, and `Message` records
3. If `Conversation.status === 'BOT'`, `handleInboundMessage()` in `src/services/chatbot.ts` calls Claude AI with full history
4. Claude's response is queued via BullMQ → worker sends via Meta Graph API

**Outbound (Client → WhatsApp via WABA):**
1. Client authenticates via `POST /auth/token` (OAuth2 client_credentials) → 24h JWT with `tenantId`
2. `POST /api/v1/messages/send` with `Authorization: Bearer <token>`
3. `authenticate()` middleware validates JWT and attaches `req.tenant`; `checkQuota()` enforces monthly limit
4. Message saved as `QUEUED`, BullMQ job enqueued, worker calls Meta Graph API
5. Meta status webhooks (sent/delivered/read) update the message in DB

### Authentication — Two Systems

| System | Token | JWT payload | Middleware | Used by |
|---|---|---|---|---|
| **Tenant** | 24h JWT via `/auth/token` | `{ tenantId, planId }` | `authenticate` | External integrations, WABA API |
| **User** | 7d JWT via `/auth/login` or `/auth/register` | `{ userId }` | `authenticateUser` | Next.js dashboard, Baileys instances |

`req.tenant` (`Tenant & { plan: Plan }`) and `req.authUser` (`User`) are declared in `src/types/fastify.d.ts`.

Admin routes (`/api/v1/tenants`, `/api/v1/plans`) require an `x-admin-secret` header matching `ADMIN_SECRET`.

Baileys send endpoint (`POST /instances/:id/send-text`) uses a third auth method: `X-Client-Token` header matching the static `User.clientToken` UUID stored in DB.

### Multi-Tenancy

All DB queries on the WABA side must be scoped by `tenantId`. `isInternal` tenants bypass quota enforcement. The Baileys side is scoped by `userId`.

### Conversation States (WABA)

- `OPEN` — human agent handling
- `RESOLVED` — closed
- `BOT` — Claude AI (`ANTHROPIC_API_KEY`) responds automatically to inbound messages

### Frontend (`app/`)

Next.js 15 app with two sections:
- **Landing page** (`src/app/page.tsx`) — marketing page composed from `src/components/` sections
- **Dashboard** (`src/app/dashboard/`) — authenticated area; root redirects to `/dashboard/company`

Dashboard sections: `company`, `phones`, `automation`, `departments`, `templates`.

`src/lib/api.ts` — `apiFetch<T>()` reads the JWT from `localStorage` and injects it as `Authorization: Bearer`.
`src/lib/auth.ts` — `localStorage`-backed helpers for token and user storage.

`NEXT_PUBLIC_API_URL` must be set at **build time** (baked into the Next.js bundle via Docker `ARG`).

### Key Environment Variables

```
# api/.env
DATABASE_URL            # PostgreSQL connection string
REDIS_URL               # Redis (BullMQ)
JWT_SECRET              # JWT signing key
ANTHROPIC_API_KEY       # Claude AI (BOT conversations)
META_APP_SECRET         # Webhook signature verification
META_GRAPH_API_VERSION  # e.g. v25.0
ADMIN_SECRET            # Admin route protection
API_BASE_URL            # Public URL (used for webhook registration)
PORT                    # Default 3001 (dev), 3100 (Docker)

# app/.env
NEXT_PUBLIC_API_URL     # Must be set at build time
```

### Deployment

Deployed via Docker Compose on a VPS. Production and QAS share the same repo checkout at `/opt/apps/zapnit/zapnit` (branch `homolog`); they differ only by compose file: production uses `docker-compose.yml` (`docker compose -f docker-compose.yml build && up -d`), QAS uses `docker-compose.qas.yml` (`./deploy-qas.sh`). The api Dockerfile runs `prisma migrate deploy` on container start. Health check at `GET /health`. Baileys sessions/auth state are persisted in Postgres (`baileys_auth_state`); the legacy `/app/sessions` volume is no longer authoritative.
