#!/bin/bash
# _media-verify-render2.sh
# Проверка рендера обложек на карточках /games/game/<slug>.
set -e
B="https://5mb2.ru"

for g in pixel-quest neon-racer cube-lab ocean-2048; do
  echo "=== /games/game/$g ==="
  code=$(curl -s -o /dev/null -w "%{http_code}" "$B/games/game/$g")
  echo "status: $code"
  curl -sL "$B/games/game/$g" | grep -o 'src="/uploads/covers/[^"]*"' | sort -u
  curl -sL "$B/games/game/$g" | grep -io 'og:image[^>]*' | head -2
  echo ""
done
