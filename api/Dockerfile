FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@9 --activate
WORKDIR /app
# whatsapp-web.js (Puppeteer) uses the system Chromium instead of downloading its own.
ENV PUPPETEER_SKIP_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

FROM base AS deps
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

FROM deps AS build
COPY . .
RUN pnpm run db:generate
RUN pnpm run build

FROM base AS runner
ENV NODE_ENV=production
# Chromium + fonts/libs required by Puppeteer to run headless WhatsApp Web.
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont
COPY package.json pnpm-lock.yaml ./
COPY prisma ./prisma
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist

EXPOSE 3100
CMD ["sh", "-c", "./node_modules/.bin/prisma migrate deploy && node dist/index.js"]
