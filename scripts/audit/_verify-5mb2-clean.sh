#!/bin/bash
# Verify 5mb2 blog/releases/updates clean after cleanup (ЭТАП 2)
echo "=== 1. Blog now ==="
curl -s -A "Mozilla/5.0" https://5mb2.ru/games/blog | grep -oE '<h3[^>]*>[^<]+</h3>' | sed 's/<[^>]*>//g' | head -20
echo "--- any E2E left? ---"
curl -s -A "Mozilla/5.0" https://5mb2.ru/games/blog | grep -ciE 'E2E|Playwright' || echo "0 (clean)"
echo ""
echo "=== 2. Releases now ==="
curl -s -A "Mozilla/5.0" https://5mb2.ru/games/releases | grep -oE '<h3[^>]*>[^<]+</h3>' | sed 's/<[^>]*>//g' | head -20
echo ""
echo "=== 3. Updates now ==="
curl -s -A "Mozilla/5.0" https://5mb2.ru/games/updates | grep -oE '<h3[^>]*>[^<]+</h3>' | sed 's/<[^>]*>//g' | head -20
echo "--- any E2E left in updates? ---"
curl -s -A "Mozilla/5.0" https://5mb2.ru/games/updates | grep -ciE 'E2E|Playwright' || echo "0 (clean)"
echo ""
echo "=== 4. Home 'Свежее' feed ==="
curl -s -A "Mozilla/5.0" https://5mb2.ru/ | grep -oE '<h3[^>]*>[^<]+</h3>' | sed 's/<[^>]*>//g' | head -12
