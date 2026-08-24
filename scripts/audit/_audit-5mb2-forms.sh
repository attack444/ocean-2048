#!/bin/bash
# Детальная проверка: реальный URL CSS шрифтов + формы/кнопки на страницах 5mb2 (todo #7)
UA="Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
TMP=/tmp/5mb2-links
echo "=== 1. Реальный URL шрифтов (из <link>) ==="
grep -oE '<link[^>]*fonts[^>]*>' "$TMP/_games_requisites.html" 2>/dev/null | head -3
# с главной
for f in "$TMP"/_.html "$TMP"/_games_catalog.html "$TMP"/_games_about.html; do
  if [ -f "$f" ]; then
    echo "-- $f"
    grep -oE 'https://fonts[^"'"'"']+' "$f" | sort -u | head -3
  fi
done
echo ""
echo "=== 2. Статус реального CSS Google Fonts ==="
FONT_CSS=$(grep -ohE 'https://fonts\.googleapis\.com/css2[^"'"'"']*' "$TMP"/*.html 2>/dev/null | head -1)
echo "URL: $FONT_CSS"
if [ -n "$FONT_CSS" ]; then
  curl -s -o /dev/null -w "  status=%{http_code} size=%{size_download}\n" -A "$UA" --max-time 25 "$FONT_CSS"
fi
echo ""
echo "=== 3. Формы на страницах (method+action) ==="
for f in "$TMP"/*.html; do
  forms=$(grep -oE '<form[^>]*>' "$f" 2>/dev/null)
  if [ -n "$forms" ]; then
    echo "-- $f"
    echo "$forms" | sed 's/^/    /'
  fi
done
echo ""
echo "=== 4. Кнопки-ссылки без href (class/onclick) ==="
for f in "$TMP"/_games_assets.html "$TMP"/_.html "$TMP"/_games_catalog.html; do
  if [ -f "$f" ]; then
    echo "-- $f"
    grep -oE '<button[^>]*>' "$f" 2>/dev/null | sed 's/^/    /' | head -8
  fi
done
echo ""
echo "=== 5. JS-хендлеры onclick / data-атрибуты ==="
grep -ohE 'onclick="[^"]*"' "$TMP"/*.html 2>/dev/null | sort | uniq -c | sort -rn | head -10
echo ""
echo "=== 6. Проверка JS-файлов (200?) ==="
grep -ohE 'src="/[^"]+\.js"' "$TMP"/_games_assets.html 2>/dev/null | sed 's/src="//; s/"//' | sort -u | while read -r js; do
  c=$(curl -s -o /dev/null -w "%{http_code}" -A "$UA" "https://5mb2.ru$js")
  echo "  $c  $js"
done
echo ""
echo "=== 7. Проверка CSS-файлов (200?) ==="
grep -ohE 'href="/[^"]+\.css"' "$TMP"/*.html 2>/dev/null | sed 's/href="//; s/"//' | sort -u | while read -r css; do
  c=$(curl -s -o /dev/null -w "%{http_code}" -A "$UA" "https://5mb2.ru$css")
  echo "  $c  $css"
done
echo ""
echo "=== 8. Картинки/обложки (200?) ==="
grep -ohE '(src|href)="(/[^"]+\.(png|jpg|jpeg|webp|svg|ico|apk))"' "$TMP"/*.html 2>/dev/null \
  | sed -E 's/^(src|href)="//; s/"$//' | sort -u | while read -r img; do
  c=$(curl -s -o /dev/null -w "%{http_code}" -A "$UA" "https://5mb2.ru$img")
  echo "  $c  $img"
done
