#!/usr/bin/env bash
#
# verify-baileys.sh — roteiro de verificação do fix "Waiting for this message".
#
# Reproduz o cenário de concorrência que corrompia o estado Signal (rajada de
# mensagens bidirecionais + restart da API no meio) e checa, de forma
# automatizada, tudo que dá para checar por software:
#   1. migration aplicada (tabela baileys_auth_state existe e popula)
#   2. instância conectada
#   3. rajada concorrente de envios (estressa o keys.set/keys.get)
#   4. restart da API no meio da rajada
#   5. reconexão automática SEM novo QR (creds preservadas no DB)
#   6. nova rajada após o restart continua funcionando
#
# A confirmação final de que o destinatário NÃO vê "Waiting for this message"
# é necessariamente VISUAL — olhe o celular que recebe. O script te diz quando.
#
# Uso:
#   API_URL=https://api.qas.zapnit.frsolutions.pro \
#   INSTANCE_ID=<id> \
#   CLIENT_TOKEN=<uuid> \
#   TEST_PHONE=5511999999999 \
#   API_CONTAINER=zapnit-qas-api \
#   PG_CONTAINER=zapnit-qas-db \
#   ./scripts/verify-baileys.sh
#
set -euo pipefail

API_URL="${API_URL:?defina API_URL (ex: https://api.qas.zapnit.frsolutions.pro)}"
INSTANCE_ID="${INSTANCE_ID:?defina INSTANCE_ID}"
CLIENT_TOKEN="${CLIENT_TOKEN:?defina CLIENT_TOKEN}"
TEST_PHONE="${TEST_PHONE:?defina TEST_PHONE (número que vai RECEBER, com DDI+DDD)}"
API_CONTAINER="${API_CONTAINER:-zapnit-qas-api}"
PG_CONTAINER="${PG_CONTAINER:-zapnit-qas-db}"
PG_USER="${PG_USER:-zapnit}"
PG_DB="${PG_DB:-zapnit}"
BURST="${BURST:-20}"   # mensagens por rajada

hr()   { printf '\n────────────────────────────────────────────────────────\n'; }
say()  { printf '\033[1;36m▶ %s\033[0m\n' "$*"; }
ok()   { printf '\033[1;32m✓ %s\033[0m\n' "$*"; }
warn() { printf '\033[1;33m! %s\033[0m\n' "$*"; }

status() {
  curl -fsS -H "X-Client-Token: $CLIENT_TOKEN" \
    "$API_URL/instances/$INSTANCE_ID/status" 2>/dev/null || true
}

send_one() {
  local n="$1"
  curl -fsS -X POST "$API_URL/instances/$INSTANCE_ID/send-text" \
    -H "X-Client-Token: $CLIENT_TOKEN" \
    -H 'Content-Type: application/json' \
    -d "{\"phone\":\"$TEST_PHONE\",\"message\":\"[verify-baileys] msg $n — $(date +%H:%M:%S)\"}" \
    >/dev/null 2>&1 && printf '.' || printf 'x'
}

burst() {
  local label="$1"
  say "Rajada concorrente ($BURST envios) — $label"
  for i in $(seq 1 "$BURST"); do send_one "$label-$i" & done
  wait
  printf '\n'
}

# Conta linhas de auth state no DB (creds + sessões). Requer acesso ao container.
auth_rows() {
  docker exec "$PG_CONTAINER" psql -U "$PG_USER" -d "$PG_DB" -tAc \
    "SELECT category, count(*) FROM baileys_auth_state WHERE instance_id='$INSTANCE_ID' GROUP BY category ORDER BY category;" 2>/dev/null || echo "ERR"
}

hr; say "0) Pré-checagem: status atual da instância"
ST="$(status)"
echo "  status: $ST"
echo "$ST" | grep -q '"connected"' \
  && ok "Instância conectada" \
  || { warn "Instância NÃO conectada. Conecte (escaneie o QR) antes de rodar."; exit 1; }

hr; say "1) Estado de auth no Postgres ANTES (deve ter 'creds' + sessões)"
echo "  $(auth_rows | tr '\n' ' ')"

hr
warn "OLHE AGORA o celular destinatário ($TEST_PHONE)."
warn "As próximas mensagens NÃO podem aparecer como 'Aguardando esta mensagem'."
read -r -p "Pressione ENTER para começar a 1ª rajada..." _

burst "antes-do-restart"
ok "1ª rajada enviada. Confira no celular: todas legíveis?"

hr; say "2) Restart da API NO MEIO do tráfego (simula deploy/queda)"
say "    reiniciando container: $API_CONTAINER"
( sleep 1; docker restart "$API_CONTAINER" >/dev/null 2>&1 && ok "container reiniciado" || warn "falha ao reiniciar — reinicie manualmente" ) &
burst "durante-o-restart"   # dispara em paralelo ao restart de propósito
wait

hr; say "3) Aguardando reconexão automática (sem novo QR)..."
for i in $(seq 1 30); do
  sleep 2
  ST="$(status)"
  if echo "$ST" | grep -q '"connected"'; then ok "Reconectou em ~$((i*2))s — status connected"; break; fi
  if echo "$ST" | grep -q '"qr"'; then warn "Voltou para QR! As credenciais NÃO sobreviveram — investigar."; break; fi
  printf '.'
done
[ -z "${ST:-}" ] || echo "  status final: $ST"

hr; say "4) Estado de auth no Postgres DEPOIS (mesmas ou mais sessões, sem reset)"
echo "  $(auth_rows | tr '\n' ' ')"

hr; say "5) Rajada pós-restart (a sessão restaurada continua cifrando OK?)"
read -r -p "Pressione ENTER para a rajada final..." _
burst "depois-do-restart"

hr
ok "Automação concluída."
cat <<EOF

CRITÉRIOS DE APROVAÇÃO (checagem final é VISUAL no celular $TEST_PHONE):
  [ ] Todas as 3 rajadas chegaram LEGÍVEIS (nenhuma 'Aguardando esta mensagem').
  [ ] Após o restart, status voltou a 'connected' SEM pedir novo QR.
  [ ] baileys_auth_state manteve 'creds' e as sessões (não zerou).
  [ ] (Opcional) Responda do celular durante o teste e confirme que o bot/IA
      recebeu e respondeu — valida a descriptografia INBOUND sob concorrência.

Se algum item falhar, colete os logs:
  docker logs --since 10m $API_CONTAINER
EOF
