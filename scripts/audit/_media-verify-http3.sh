#!/bin/bash
# _media-verify-http3.sh
# Проверка доступа к /uploads/covers по домену 5mb2.ru и изнутри контейнера.
set -e
echo "=== с хоста: http://5mb2.ru (по /etc/hosts) ==="
for slug in pixel-quest neon-racer cube-lab ocean-2048; do
  code=$(curl -s -o /dev/null -w "%{http_code}" "http://5mb2.ru/uploads/covers/${slug}.png")
  echo "$slug.png -> $code"
done

echo ""
echo "=== с хоста: https://5mb2.ru -L ==="
curl -sL -o /dev/null -w "pixel-quest https -> %{http_code} (%{content_type})\n" "https://5mb2.ru/uploads/covers/pixel-quest.png"

echo ""
echo "=== изнутри контейнера (127.0.0.1:8080) ==="
docker exec neobrain-web sh -c "wget -q -S -O /dev/null http://127.0.0.1:8080/uploads/covers/pixel-quest.png 2>&1 | grep -i 'HTTP/' || echo 'wget не смог (нет wget?)'"

echo ""
echo "=== какой nginx server_name обслуживает 5mb2.ru ==="
grep -rn "server_name.*5mb2" /etc/nginx/sites-available/*.conf 2>/dev/null | head

echo ""
echo "=== location для /uploads в конфиге 5mb2 ==="
grep -rn "location.*uploads\|/uploads" /etc/nginx/sites-available/5mb2.ru.conf 2>/dev/null | head -20
