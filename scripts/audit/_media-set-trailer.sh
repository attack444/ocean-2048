#!/bin/bash
# _media-set-trailer.sh
# 1) Добавляем trailerUrl в model Game (schema.prisma) если ещё нет.
# 2) Загружаем трейлер ocean-2048 в volume uploads/trailers.
set -e
SRC=/opt/ai-helper/neobrain/prisma/schema.prisma
SCHEMA=/opt/ai-helper/neobrain/services/web/prisma/schema.prisma

echo "=== есть ли trailerUrl в schema ==="
grep -n "trailerUrl" $SRC $SCHEMA 2>/dev/null || echo "НЕТ trailerUrl в схемах"

echo ""
echo "=== загружаем trailer.mp4 (из store) на сервер ==="
# trailer будет передан локально через scp отдельно; здесь готовим каталог
mkdir -p /var/lib/docker/volumes/deploy_neobrain_uploads/_data/trailers
ls -la /var/lib/docker/volumes/deploy_neobrain_uploads/_data/trailers/ 2>/dev/null || true
