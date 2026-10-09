#!/usr/bin/env bash
# Portal Neoguard — backup do PostgreSQL (pg_dump compactado), mantendo 14 dias.
#
#   bash /opt/portal-neoguard/repo/portal/deploy/backup-db.sh
#
# Cron sugerido (todo dia às 02:30, como o usuário que roda o Docker):
#   30 2 * * * bash /opt/portal-neoguard/repo/portal/deploy/backup-db.sh >> /opt/portal-neoguard/backups/backup.log 2>&1
#
# Restaurar: veja portal/deploy/README.md.
set -euo pipefail

# O cron roda com PATH mínimo.
export PATH="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:${PATH:-}"

BASE="${PORTAL_BASE:-/opt/portal-neoguard}"
REPO="${BASE}/repo"
ENV_FILE="${BASE}/.env"
BACKUPS="${PORTAL_BACKUPS:-${BASE}/backups}"
RETENCAO_DIAS="${PORTAL_RETENCAO_DIAS:-14}"
PROJETO="portal-neoguard"

umask 077
mkdir -p "$BACKUPS"

destino="${BACKUPS}/portal-$(date +%Y%m%d-%H%M%S).sql.gz"
parcial="${destino}.parcial"
trap 'rm -f "$parcial"' EXIT

cd "$REPO"
# O pg_dump roda dentro do contêiner "db" e lê o usuário e o banco das variáveis dele mesmo.
# --clean --if-exists deixa o dump restaurável por cima de um banco já existente.
docker compose -p "$PROJETO" -f portal/deploy/docker-compose.yml --env-file "$ENV_FILE" \
  exec -T db sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists --no-owner' \
  | gzip -9 > "$parcial"

# Só vira backup se o gzip estiver íntegro e não for vazio.
gzip -t "$parcial"
[ "$(gzip -dc "$parcial" | wc -c)" -gt 0 ] || { echo "ERRO: backup vazio" >&2; exit 1; }
mv "$parcial" "$destino"
echo "$(date '+%F %T') backup ok: ${destino} ($(du -h "$destino" | cut -f1))"

# Retenção: apaga os backups deste projeto com mais de N dias.
find "$BACKUPS" -maxdepth 1 -type f -name 'portal-*.sql.gz' -mtime "+${RETENCAO_DIAS}" -print -delete
