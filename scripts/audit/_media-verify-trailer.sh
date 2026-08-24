#!/bin/bash
# _media-verify-trailer.sh
# Проверка рендера трейлера на карточке ocean-2048.
set -e
B="https://5mb2.ru"

echo "=== <video> на карточке ==="
curl -sL "$B/games/game/ocean-2048" | grep -o '<video[^>]*>' | head

echo ""
echo "=== source mp4 ==="
curl -sL "$B/games/game/ocean-2048" | grep -o 'src="/uploads/trailers/[^"]*"' | sort -u

echo ""
echo "=== трейлер по https ==="
curl -s -o /dev/null -w "https trailer -> %{http_code} (%{content_type})\n" "$B/uploads/trailers/ocean-2048.mp4"

echo ""
echo "=== карточки остальных игр НЕ сломались ==="
for g in pixel-quest neon-racer cube-lab; do
  code=$(curl -s -o /dev/null -w "%{http_code}" "$B/games/game/$g")
  echo "$g -> $code"
done
