#!/usr/bin/env bash
# Portal Neoguard — deploy no servidor (VM 172.16.100.35).
#
#   bash /opt/portal-neoguard/repo/portal/deploy/deploy.sh              # atualiza a main e sobe
#   bash /opt/portal-neoguard/repo/portal/deploy/deploy.sh --ref <tag|sha> # volta/vai para um commit (rollback)
#
# Mexe SOMENTE no projeto Docker "portal-neoguard". Nunca use "docker system prune" nem
# "docker compose" sem -p/-f neste servidor: ele também roda o Access-Control.
set -euo pipefail

BASE="${PORTAL_BASE:-/opt/portal-neoguard}"
REPO="${BASE}/repo"
ENV_FILE="${BASE}/.env"
BRANCH="${PORTAL_BRANCH:-main}"
PROJETO="portal-neoguard"
COMPOSE_FILE="portal/deploy/docker-compose.yml"

REF=""
while [ $# -gt 0 ]; do
  case "$1" in
    --ref) REF="${2:?uso: deploy.sh --ref <tag|sha>}"; shift 2 ;;
    -h|--help) sed -n '2,9p' "$0"; exit 0 ;;
    *) echo "Argumento desconhecido: $1 (veja --help)" >&2; exit 2 ;;
  esac
done

# Tudo dentro de uma função: o bash lê o script aos poucos, e o "git pull" pode trocar este
# arquivo no meio da execução. Com a função, o bash já leu o script inteiro antes do pull.
main() {
  [ -f "$ENV_FILE" ] || { echo "ERRO: ${ENV_FILE} não existe. Copie portal/deploy/.env.example e preencha." >&2; exit 1; }
  cd "$REPO"

  if [ -n "$REF" ]; then
    echo "==> Indo para ${REF} (sem pull)"
    git fetch --tags --prune origin
    git checkout --detach "$REF"
  else
    echo "==> Atualizando ${BRANCH} (git pull --ff-only)"
    git fetch --tags --prune origin
    git switch "$BRANCH"
    git pull --ff-only
  fi

  GIT_SHA="$(git rev-parse HEAD)"
  export GIT_SHA
  echo "==> Commit em uso: ${GIT_SHA}"

  dc() { docker compose -p "$PROJETO" -f "$COMPOSE_FILE" --env-file "$ENV_FILE" "$@"; }

  echo "==> Construindo e subindo (projeto ${PROJETO})"
  dc up -d --build --remove-orphans

  # Remove só as imagens órfãs (sem tag) DESTE projeto; não toca nas de outros sistemas.
  docker image prune -f --filter "label=com.neoguard.projeto=${PROJETO}" >/dev/null || true

  echo "==> Status"
  dc ps

  # A porta publicada vem do .env (sem "source": a senha do SMTP pode ter caracteres especiais).
  local porta
  porta="$(grep -E '^PORTAL_PORTA=' "$ENV_FILE" | tail -n1 | cut -d= -f2- | tr -d '[:space:]"'"'" || true)"
  porta="${porta:-8090}"
  local url="http://127.0.0.1:${porta}/api/saude"

  echo "==> Testando ${url}"
  local i
  for i in $(seq 1 30); do
    if curl -fsS "$url"; then
      echo
      echo "==> Deploy concluído: http://127.0.0.1:${porta}/ (commit ${GIT_SHA:0:7})"
      return 0
    fi
    sleep 2
  done

  echo >&2
  echo "ERRO: ${url} não respondeu em 60 s. Últimos logs:" >&2
  dc logs --tail=50 api web >&2 || true
  exit 1
}

main
exit $?
