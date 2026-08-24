#!/bin/bash
# _media-verify-http2.sh
# Проверка с -L (follow) и по внешнему домену.
set -e
echo "=== http://127.0.0.1 -L ==="
curl -sL -o /dev/null -w "pixel-quest -> %{http_code} (%{content_type})\n" "http://127.0.0.1/uploads/covers/pixel-quest.png"

echo "=== куда ведёт 302 ==="
curl -sI "http://127.0.0.1/uploads/covers/pixel-quest.png" | grep -i "location\|HTTP/"

echo ""
echo "=== внешний https 5mb2.ru ==="
for slug in pixel-quest neon-racer cube-lab ocean-2048; do
  code=$(curl -sL -o /dev/null -w "%{http_code}" "https://5mb2.ru/uploads/covers/${slug}.png")
  echo "$slug.png -> $code"
done
