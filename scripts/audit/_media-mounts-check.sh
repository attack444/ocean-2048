#!/bin/bash
# _media-mounts-check.sh
# Как neobrain-web видит исходники: volume-монтирование src или нет.
set -e
echo "=== mounts neobrain-web (Source:Destination) ==="
docker inspect neobrain-web --format '{{range .Mounts}}{{.Source}} -> {{.Destination}} ({{.Type}}){{println}}{{end}}'

echo ""
echo "=== создаём каталог covers ==="
mkdir -p /opt/ai-helper/neobrain/services/web/src/public/games/img/covers
ls -la /opt/ai-helper/neobrain/services/web/src/public/games/img/covers/
