#!/bin/bash
# Реальные <link>/<script>/обложки + form action на страницах 5mb2 (todo #7)
UA="Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
TMP=/tmp/5mb2-links

echo "=== 1. Все <script src=...> ==="
grep -ohE '<script[^>]*src="[^"]+"' "$TMP"/_.html 2>/dev/null
grep -ohE '<script[^>]*src="[^"]+"' "$TMP"/_games_catalog.html 2>/dev/null
echo ""
echo "=== 2. Все <link ...> (css/icons) ==="
grep -ohE '<link[^>]*>' "$TMP"/_games_catalog.html 2>/dev/null | head -12
echo ""
echo "=== 3. Обложки игр (src в карточках) ==="
grep -ohE 'src="[^"]+"' "$TMP"/_games_catalog.html 2>/dev/null | grep -viE '\.(js|css|svg|ico)' | sort -u | head -20
echo ""
echo "=== 4. Проверка статусов JS/CSS ==="
grep -ohE '(src|href)="/[^"]+\.(js|css)"' "$TMP"/_games_catalog.html 2>/dev/null \
  | sed -E 's/^(src|href)="//; s/"$//' | sort -u | while read -r a; do
  c=$(curl -s -o /dev/null -w "%{http_code}" -A "$UA" "https://5mb2.ru$a")
  echo "  $c  $a"
done
echo ""
echo "=== 5. Куда отправляют формы (JS: fetch/action из скриптов) ==="
grep -ohE '(fetch|axios|post|action)[^;]{0,80}(/api/[a-z0-9/_-]+)' "$TMP"/_games_about.html 2>/dev/null | head -10
echo "-- inline script на about --"
grep -ohE '(/api/[a-z0-9/_-]+)' "$TMP"/_games_about.html 2>/dev/null | sort -u | head -20
echo ""
echo "=== 6. data-action / data-endpoint атрибуты форм ==="
grep -ohE 'data-[a-z-]+="[^"]*"' "$TMP"/_games_assets.html "$TMP"/_games_about.html 2>/dev/null | grep -iE 'action|endpoint|url|api' | sort -u | head -20
