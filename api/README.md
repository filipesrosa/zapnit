# Zapnit API

Gateway WhatsApp Business com chatbot IA para negócios locais.

## Stack

- **Runtime**: Node.js (ESM)
- **Framework**: Fastify
- **Banco de dados**: PostgreSQL via Prisma
- **Filas**: BullMQ + Redis
- **IA**: Claude (Anthropic)
- **Deploy**: Railway

## Setup local

```bash
# 1. Clone e instale dependências
npm install

# 2. Configure variáveis de ambiente
cp .env.example .env
# Edite o .env com suas credenciais

# 3. Sobe o banco e Redis (via Docker)
docker run -d -p 5432:5432 -e POSTGRES_PASSWORD=zapnit postgres
docker run -d -p 6379:6379 redis

# 4. Rode as migrations
npm run db:migrate

# 5. Inicia o servidor
npm run dev
```

## Deploy na Railway

1. Crie um projeto novo na Railway
2. Adicione os serviços: **PostgreSQL** e **Redis**
3. Conecte este repositório GitHub
4. Configure as variáveis de ambiente (copie do `.env.example`)
5. A Railway detecta automaticamente e faz o deploy

## Fluxo OAuth2

O Zion (e outros clientes) se autenticam assim:

```bash
# 1. Obter token
POST /auth/token
{
  "grant_type": "client_credentials",
  "client_id": "zap_xxxx",
  "client_secret": "yyyy"
}

# Resposta
{ "access_token": "eyJ...", "token_type": "Bearer", "expires_in": 86400 }

# 2. Enviar mensagem
POST /api/v1/messages/send
Authorization: Bearer eyJ...
{
  "to": "5511999999999",
  "message": "Olá! Lembrete da sua consulta amanhã às 14h.",
  "phone_number_id": "seu_phone_number_id_meta"
}
```

## Endpoints principais

| Método | Rota | Descrição |
|--------|------|-----------|
| POST | `/auth/token` | Autenticação OAuth2 |
| POST | `/api/v1/messages/send` | Enviar texto |
| POST | `/api/v1/messages/send-template` | Enviar template Meta |
| GET | `/api/v1/messages/:id` | Status da mensagem |
| GET | `/api/v1/tenants/me` | Dados do tenant |
| POST | `/api/v1/tenants` | Criar tenant (admin) |
| POST | `/api/v1/tenants/phone-numbers` | Vincular número WhatsApp |
| GET | `/webhook/:tenantId` | Verificação Meta |
| POST | `/webhook/:tenantId` | Receber mensagens |
| GET | `/health` | Health check |

## Criando o tenant do Zion

```bash
# No servidor (apenas uma vez)
curl -X POST http://localhost:3000/api/v1/tenants \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Zion - Agendamentos",
    "is_internal": true,
    "plan": "PREMIUM"
  }'

# Guarde o client_id e client_secret retornados!
```

## Configurando o Webhook na Meta

Após vincular um número:
1. Acesse Meta for Developers → seu App → WhatsApp → Configuração
2. URL do Webhook: `https://zapnit-api.up.railway.app/webhook/{tenantId}`
3. Token de verificação: use o `webhook_verify_token` retornado
4. Assine o evento: `messages`
