#!/usr/bin/env bash
# Portal Neoguard — teste de fumaça da pilha completa (usado no CI e na máquina do dev).
# Sobe o compose num projeto DESCARTÁVEL (portal-neoguard-teste, porta 18090, volumes próprios),
# testa /, /api/saude e /propostas/ e derruba tudo com "down -v". Rode da raiz do repositório:
#
#   bash portal/deploy/smoke.sh
#
# Precisa de Docker com Compose v2 e do curl. Não toca no projeto "portal-neoguard" real.
set -euo pipefail

PROJETO="portal-neoguard-teste"
PORTA="${SMOKE_PORTA:-18090}"
COMPOSE_FILE="portal/deploy/docker-compose.yml"

tmp="$(mktemp -d)"
env_file="${tmp}/.env"
cat > "$env_file" <<ENV
POSTGRES_USER=portal
POSTGRES_PASSWORD=senhadeteste123
POSTGRES_DB=portal
PORTAL_URL=http://localhost:${PORTA}
PORTAL_PORTA=${PORTA}
ENV

dc() { docker compose -p "$PROJETO" -f "$COMPOSE_FILE" --env-file "$env_file" "$@"; }

limpar() {
  local codigo=$?
  if [ "$codigo" -ne 0 ]; then
    echo "==> FALHOU (código ${codigo}). Últimos logs:" >&2
    dc logs --tail=60 >&2 || true
  fi
  dc down -v --remove-orphans >/dev/null 2>&1 || true
  rm -rf "$tmp"
  exit "$codigo"
}
trap limpar EXIT

export GIT_SHA="${GIT_SHA:-$(git rev-parse HEAD 2>/dev/null || echo teste)}"

echo "==> Subindo ${PROJETO} na porta ${PORTA}"
dc up -d --build --wait --wait-timeout 240

base="http://127.0.0.1:${PORTA}"
conferir() { # conferir <descrição> <caminho> <texto esperado na resposta>
  local corpo
  corpo="$(curl -fsS "${base}$2")" || { echo "FALHOU: $1 (${base}$2)" >&2; return 1; }
  case "$corpo" in *"$3"*) echo "ok  $1" ;; *) echo "FALHOU: $1 não contém '$3'" >&2; return 1 ;; esac
}

conferir "SPA em /"                 "/"                       "<div id=\"root\""
conferir "API em /api/saude"        "/api/saude"              "\"ok\":true"
conferir "Versão do commit na API"  "/api/saude"              "\"versao\":\"${GIT_SHA}\""
conferir "Gerador em /propostas/"   "/propostas/"             "Proposta"
conferir "version.json do Gerador"  "/propostas/version.json" "portal-"
conferir "Cadastro vazio servido"   "/propostas/data/site.json" "contato_cadastro_cct"

# Banco de ponta a ponta: cria uma ficha por POST (passa pelo Nginx, pela API e pelo PostgreSQL)
# e lê de volta. O volume do projeto de teste é apagado no fim (down -v).
resposta="$(curl -sS --fail-with-body -X POST -H 'Content-Type: application/json' \
  -d '{"autor":{"nome":"Teste de fumaca","email":"teste@example.com"}}' "${base}/api/fichas")" \
  || { echo "FALHOU: POST /api/fichas: ${resposta}" >&2; exit 1; }
id="$(printf '%s' "$resposta" | grep -o '"id":[0-9]*' | head -n1 | cut -d: -f2)"
[ -n "$id" ] || { echo "FALHOU: POST /api/fichas não devolveu id: ${resposta}" >&2; exit 1; }
echo "ok  ficha criada por POST (id ${id})"
conferir "Ficha lida de volta"      "/api/fichas/${id}"       "\"codigo\":\"FI-"
conferir "Ficha na listagem"        "/api/fichas"             "\"id\":${id},"

# Isolamento do cadastro: só os 4 arquivos conhecidos são servidos.
codigo="$(curl -s -o /dev/null -w '%{http_code}' "${base}/propostas/data/outro.json")"
[ "$codigo" = "404" ] && echo "ok  arquivo fora da lista do cadastro -> 404" || { echo "FALHOU: esperava 404, veio ${codigo}" >&2; exit 1; }

echo "==> Tudo certo."
