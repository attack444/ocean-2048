#!/bin/bash
# ЭТАП 5, todo #15: найти compose-файл и понять, как запускается деплой
R=/opt/ai-helper/neobrain

echo "== 1. Где compose-файлы =="
find /opt/ai-helper -maxdepth 4 -iname "docker-compose*.yml" 2>/dev/null | head -10

echo ""
echo "== 2. Как deploy.sh вызывает docker compose =="
cat "$R/project/deploy/deploy.sh" 2>/dev/null | grep -nE "compose|COMPOSE_FILE|cd |up -d|pull" | head -20

echo ""
echo "== 3. Есть ли COMPOSE_FILE в окружении/файлах =="
grep -rn "COMPOSE_FILE" "$R" /opt/ai-helper/project/.env 2>/dev/null | head -5
