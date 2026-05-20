#!/usr/bin/env bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "==> Atualizando branch homolog..."
git pull origin homolog

echo "==> Build e subindo containers QAS..."
docker compose -f docker-compose.qas.yml build --no-cache
docker compose -f docker-compose.qas.yml up -d

echo "==> Aguardando API ficar saudável..."
for i in $(seq 1 15); do
  if curl -sf http://localhost:3110/health > /dev/null 2>&1; then
    echo "==> API QAS está saudável."
    break
  fi
  echo "    tentativa $i/15..."
  sleep 5
done

echo "==> Deploy QAS concluído."
echo "    App:  https://qas.zapnit.frsolutions.pro"
echo "    API:  https://api.qas.zapnit.frsolutions.pro"
