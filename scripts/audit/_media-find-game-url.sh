#!/bin/bash
# _media-find-game-url.sh
# Находим реальный URL карточек игр (по ссылкам из каталога) и проверяем статус.
set -e
B="https://5mb2.ru"

echo "=== ссылки на игры в каталоге ==="
curl -sL "$B/games" | grep -oE 'href="[^"]*"[^>]*>[^<]*(Pixel Quest|Neon Racer|Cube Lab|Океан|Океан 2048|pixel-quest|neon-racer|cube-lab|ocean-2048)' | head -20
echo "--- просто все href с game ---"
curl -sL "$B/games" | grep -oE 'href="[^"]*game[^"]*"' | sort -u

echo ""
echo "=== пробуем альтернативные URL ==="
for u in "/game/pixel-quest" "/games/pixel-quest" "/g/pixel-quest" "/play/pixel-quest" "/game/neon-racer" "/game/cube-lab" "/game/ocean-2048"; do
  code=$(curl -s -o /dev/null -w "%{http_code}" "$B$u")
  echo "$u -> $code"
done
