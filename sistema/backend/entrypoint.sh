#!/bin/sh
set -e

mkdir -p "${BACKUP_STORAGE_PATH:-/data/backups}" "${FISCAL_STORAGE_PATH:-/data/fiscal}"

# Atualizações de schema são aplicadas pelo operador via Sys-Init.
# O boot não deve executar migrações nem bloquear a API em uma atualização pendente.
echo "ℹ️ Atualizações de banco disponíveis pelo Sys-Init; iniciando sem migrações automáticas."

echo "🚀 Iniciando servidor de produção PDV Lojista..."
exec node dist/main
