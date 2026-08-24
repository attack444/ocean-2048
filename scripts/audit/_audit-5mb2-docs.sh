#!/bin/bash
# ЭТАП 2, todo #8: документы (оферта/конфиденциальность/возврат) + отзывы + sitemap
UA="Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
BASE="https://5mb2.ru"

echo "=== 1. Документные страницы (футер) ==="
for p in /games/offer /games/privacy /games/refund /games/documents /games/oferta /games/confidentiality /games/return; do
  c=$(curl -s -o /dev/null -w "%{http_code}" -A "$UA" --max-time 15 "$BASE$p")
  echo "  $c  $p"
done

echo ""
echo "=== 2. Реальные ссылки документов из футера главной ==="
curl -s -A "$UA" "$BASE/" -o /tmp/f.html
grep -oE 'href="/games/[a-z0-9-]+"' /tmp/f.html | sort -u

echo ""
echo "=== 3. Отзывы на странице «О студии» (сколько) ==="
# /api/reviews — GET возвращает 200 (список)
curl -s -A "$UA" --max-time 15 "$BASE/api/reviews" | head -c 800
echo ""

echo ""
echo "=== 4. sitemap.xml ==="
curl -s -A "$UA" --max-time 15 "$BASE/sitemap.xml" | head -c 1500
echo ""

echo ""
echo "=== 5. robots.txt ==="
curl -s -A "$UA" --max-time 15 "$BASE/robots.txt"
