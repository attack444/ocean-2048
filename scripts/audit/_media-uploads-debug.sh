#!/bin/bash
# _media-uploads-debug.sh
# Диагностика: почему /uploads/* даёт 302->/console/uploads (кто перехватывает).
set -e
echo "=== кто слушает :80 / :443 ==="
ss -tlnp | grep -E ":80|:443" || netstat -tlnp 2>/dev/null | grep -E ":80|:443"

echo ""
echo "=== nginx конфиги с uploads/console ==="
grep -rn "uploads\|console" /etc/nginx/ /www/server/panel/vhost/nginx/ 2>/dev/null | head -30 || echo "нет nginx/panel"

echo ""
echo "=== внутри контейнера: прямой запрос к статике /uploads ==="
docker exec neobrain-web sh -c "ls -la /data/uploads/ && ls -la /data/uploads/covers/ && wget -q -S -O /dev/null http://127.0.0.1/uploads/covers/pixel-quest.png 2>&1 | grep -i 'HTTP/'"

echo ""
echo "=== как app.js монтирует /uploads (перечитаем) ==="
sed -n '85,105p' /opt/ai-helper/neobrain/services/web/src/app.js
