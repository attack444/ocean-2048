#!/bin/bash
# _media-verify-http.sh
# Проверка доступности обложек по HTTP (изнутри сервера).
set -e
for slug in pixel-quest neon-racer cube-lab ocean-2048; do
  code=$(curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1/uploads/covers/${slug}.png")
  size=$(curl -s -o /dev/null -w "%{size_download}" "http://127.0.0.1/uploads/covers/${slug}.png")
  echo "$slug.png -> HTTP $code, ${size} bytes"
done
echo ""
echo "=== content-type ==="
curl -sI "http://127.0.0.1/uploads/covers/pixel-quest.png" | grep -i "content-type\|HTTP/"
