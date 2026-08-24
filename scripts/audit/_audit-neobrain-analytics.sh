#!/bin/bash
# ЭТАП 3, todo #13: поиск аналитики на neobrain шире (любые счётчики)
UA="Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
BASE="https://neobrain.site"
TMP=/tmp/nb-analytics
rm -rf "$TMP"; mkdir -p "$TMP"

for u in /neobrain /neobrain/plans /neobrain/learn; do
  name=$(echo "$u" | sed 's|/neobrain||; s|/|_|g'); [ -z "$name" ] && name="home"
  curl -s -A "$UA" --max-time 20 "$BASE$u" -o "$TMP/$name.html"
done

echo "=== Поиск любых счётчиков/аналитики ==="
echo "-- паттерны счётчиков --"
for pat in top100 top-counter mc.yandex metrika counter counter.mail analytics gtag googletagmanager plausible umami beget cloudflare insight; do
  hit=$(grep -l "$pat" "$TMP"/*.html 2>/dev/null | wc -l)
  [ "$hit" -gt 0 ] && echo "  НАЙДЕН: $pat (на $hit страницах)" || echo "  нет: $pat"
done

echo ""
echo "-- весь html главной (последние 2000 символов, где обычно счётчики) --"
tail -c 2000 "$TMP/home.html"
