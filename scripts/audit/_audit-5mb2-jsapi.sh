#!/bin/bash
# Эндпоинты форм/кнопок из внешних JS-файлов 5mb2 (todo #7)
UA="Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
BASE="https://5mb2.ru"
TMP=/tmp/5mb2-jsapi
rm -rf "$TMP"; mkdir -p "$TMP"

JS=(
  "/static/games/js/anim.js?v=7"
  "/static/games/js/assets.js"
  "/static/neobrain/js/common.js?v=7"
  "/static/neobrain/js/payment.js"
  "/static/neobrain/js/reviews.js"
  "/static/neobrain/js/support-widget.js"
)

echo "=== fetch/axios/URL эндпоинты в JS-файлах ==="
for j in "${JS[@]}"; do
  f="$TMP/$(basename "$j" | sed 's/?.*//; s/\..*//').js"
  curl -s -A "$UA" "$BASE$j" -o "$f"
  echo ""
  echo "-- $j"
  grep -oE '(/api/[a-zA-Z0-9/_-]+|/games/[a-zA-Z0-9/_-]+)' "$f" 2>/dev/null | sort -u
done

echo ""
echo "=== Проверка эндпоинтов форм (GET — живой ли роут) ==="
for ep in /api/leads /api/reviews /api/support /api/support-tickets /api/games/leads /api/games/support; do
  c=$(curl -s -o /dev/null -w "%{http_code}" -A "$UA" --max-time 15 "$BASE$ep")
  echo "  $c  $ep"
done
