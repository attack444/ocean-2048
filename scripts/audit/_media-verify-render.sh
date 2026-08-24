#!/bin/bash
# _media-verify-render.sh
# Проверка рендера обложек на страницах 5mb2 (каталог/карточки/главная).
set -e
B="https://5mb2.ru"

echo "=== каталог: /games (cover img) ==="
curl -sL "$B/games" | grep -o 'src="/uploads/covers/[^"]*"' | sort -u

echo ""
echo "=== главная: / (cover img) ==="
curl -sL "$B/" | grep -o 'src="/uploads/covers/[^"]*"' | sort -u

echo ""
echo "=== карточка pixel-quest ==="
curl -sL "$B/games/pixel-quest" | grep -o 'src="/uploads/covers/[^"]*"' | sort -u

echo ""
echo "=== og:image на карточке pixel-quest ==="
curl -sL "$B/games/pixel-quest" | grep -io 'og:image[^>]*' | head

echo ""
echo "=== HTTP-статусы карточек ==="
for g in pixel-quest neon-racer cube-lab ocean-2048; do
  code=$(curl -s -o /dev/null -w "%{http_code}" "$B/games/$g")
  echo "$g -> $code"
done
