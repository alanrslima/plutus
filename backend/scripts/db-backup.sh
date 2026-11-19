#!/usr/bin/env bash
#
# Backup do banco PostgreSQL do Plutos.
#
# Uso:
#   ./scripts/db-backup.sh            # gera backups/plutos_YYYYmmdd_HHMMSS.dump
#   KEEP=10 ./scripts/db-backup.sh    # mantém apenas os 10 backups mais recentes
#   BACKUP_DIR=/caminho ./scripts/db-backup.sh
#
# Estratégia:
#   1. Se o container `plutos-postgres` estiver rodando, usa o pg_dump dentro dele
#      (não precisa ter o client do Postgres instalado na máquina).
#   2. Caso contrário, usa o pg_dump local com o DATABASE_URL do backend/.env.
#
# Formato: custom (-Fc), comprimido. Restaurar com:
#   docker exec -i plutos-postgres pg_restore -U postgres -d plutos --clean --if-exists < backups/<arquivo>.dump

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(dirname "$SCRIPT_DIR")"

CONTAINER="${CONTAINER:-plutos-postgres}"
BACKUP_DIR="${BACKUP_DIR:-$BACKEND_DIR/backups}"
KEEP="${KEEP:-0}"   # 0 = não apaga backups antigos

TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
mkdir -p "$BACKUP_DIR"

# Lê DATABASE_URL do .env (se não vier do ambiente)
if [[ -z "${DATABASE_URL:-}" && -f "$BACKEND_DIR/.env" ]]; then
  DATABASE_URL="$(grep -E '^DATABASE_URL=' "$BACKEND_DIR/.env" | head -1 | cut -d= -f2- | sed -e 's/^"//' -e 's/"$//')"
fi

# Remove parâmetros de query (ex.: ?schema=public), que o pg_dump não aceita
PG_URL="${DATABASE_URL%%\?*}"
DB_NAME="${PG_URL##*/}"
DB_NAME="${DB_NAME:-plutos}"

OUT_FILE="$BACKUP_DIR/${DB_NAME}_${TIMESTAMP}.dump"
TMP_FILE="$OUT_FILE.partial"
trap 'rm -f "$TMP_FILE"' EXIT

if command -v docker >/dev/null 2>&1 && \
   [[ "$(docker inspect -f '{{.State.Running}}' "$CONTAINER" 2>/dev/null)" == "true" ]]; then
  echo "→ Fazendo backup via container '$CONTAINER' (banco: $DB_NAME)..."
  docker exec "$CONTAINER" sh -c 'pg_dump -U "$POSTGRES_USER" -d "$1" -Fc --no-owner --no-privileges' _ "$DB_NAME" > "$TMP_FILE"
elif command -v pg_dump >/dev/null 2>&1 && [[ -n "$PG_URL" ]]; then
  echo "→ Container '$CONTAINER' não está rodando; usando pg_dump local (banco: $DB_NAME)..."
  pg_dump "$PG_URL" -Fc --no-owner --no-privileges > "$TMP_FILE"
else
  echo "✗ Não foi possível fazer o backup: suba o banco (docker-compose up -d) ou instale o pg_dump e defina DATABASE_URL." >&2
  exit 1
fi

if [[ ! -s "$TMP_FILE" ]]; then
  echo "✗ Backup vazio — algo deu errado." >&2
  exit 1
fi

mv "$TMP_FILE" "$OUT_FILE"
echo "✓ Backup salvo em: $OUT_FILE ($(du -h "$OUT_FILE" | cut -f1))"

# Rotação: mantém apenas os KEEP mais recentes
if [[ "$KEEP" =~ ^[0-9]+$ && "$KEEP" -gt 0 ]]; then
  ls -1t "$BACKUP_DIR"/"${DB_NAME}"_*.dump 2>/dev/null | tail -n +"$((KEEP + 1))" | while read -r old; do
    rm -f "$old"
    echo "  removido backup antigo: $(basename "$old")"
  done
fi
