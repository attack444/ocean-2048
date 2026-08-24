#!/bin/bash
# Deeper audit: responsive CSS content + blog/releases content + footer + assets (ЭТАП 2, todo #6/8)
UA="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36"

echo "=== 1. Responsive media query CONTENT (5mb2 style.css) ==="
grep -A30 '@media (max-width: 880px)' /opt/ai-helper/neobrain/services/web/src/public/games/css/style.css | head -40
echo "--- 480px ---"
grep -A20 '@media (max-width:480px)' /opt/ai-helper/neobrain/services/web/src/public/games/css/style.css | head -25

echo ""
echo "=== 2. Blog content (posts?) ==="
curl -s -A "$UA" https://5mb2.ru/games/blog -o /tmp/5mb2_blog.html
grep -oE 'href="/games/blog/[^"]+"' /tmp/5mb2_blog.html | sort -u | head -20
echo "--- blog text (h1/h2/p preview) ---"
grep -oE '<h[12][^>]*>[^<]+</h[12]>' /tmp/5mb2_blog.html | sed 's/<[^>]*>//g' | head -10

echo ""
echo "=== 3. Releases/updates content ==="
curl -s -A "$UA" https://5mb2.ru/games/releases -o /tmp/5mb2_rel.html
grep -oE '<h[123][^>]*>[^<]+</h[123]>' /tmp/5mb2_rel.html | sed 's/<[^>]*>//g' | head -12
echo "--- updates ---"
curl -s -A "$UA" https://5mb2.ru/games/updates -o /tmp/5mb2_upd.html
grep -oE '<h[123][^>]*>[^<]+</h[123]>' /tmp/5mb2_upd.html | sed 's/<[^>]*>//g' | head -12

echo ""
echo "=== 4. Footer + contact presence (home) ==="
grep -oiE '<footer[^>]*>.*</footer>' /tmp/5mb2_home.html 2>/dev/null | head -c 500 || echo "(footer not found in one line)"
echo ""
echo "--- VK / telegram / email in home ---"
grep -oiE '(vk\.com/[a-zA-Z0-9_]+|t\.me/[a-zA-Z0-9_]+|mailto:[a-zA-Z0-9@._-]+)' /tmp/5mb2_home.html | sort -u

echo ""
echo "=== 5. Assets page: what's for sale ==="
curl -s -A "$UA" https://5mb2.ru/games/assets -o /tmp/5mb2_assets.html
grep -oE '<h[123][^>]*>[^<]+</h[123]>' /tmp/5mb2_assets.html | sed 's/<[^>]*>//g' | head -12
echo "--- asset prices ---"
grep -oiE '[0-9]+ ?₽|price' /tmp/5mb2_assets.html | sort | uniq -c | head

echo ""
echo "=== 6. Catalog: how many games + cards ==="
curl -s -A "$UA" https://5mb2.ru/games/catalog -o /tmp/5mb2_cat.html
grep -oE 'href="/games/game/[a-z0-9-]+"' /tmp/5mb2_cat.html | sort -u
echo "--- catalog h2/h3 ---"
grep -oE '<h[23][^>]*>[^<]+</h[23]>' /tmp/5mb2_cat.html | sed 's/<[^>]*>//g' | head -12

echo ""
echo "=== 7. Game pages: playable embed / CTA ==="
for g in neon-racer cube-lab ocean-2048 pixel-quest; do
  curl -s -A "$UA" "https://5mb2.ru/games/game/$g" -o /tmp/5mb2_game.html
  PLAY=$(grep -ciE '(play|играть|iframe|canvas|<video)' /tmp/5mb2_game.html)
  echo "$g: play-cta/iframe/canvas hints=$PLAY"
done

echo ""
echo "=== 8. Requisites page (should exist for 5mb2) ==="
curl -s -o /dev/null -w "requisites -> %{http_code}\n" -A "$UA" https://5mb2.ru/games/requisites
curl -s -A "$UA" https://5mb2.ru/games/requisites -o /tmp/5mb2_req.html
grep -oE '<h1[^>]*>[^<]+</h1>' /tmp/5mb2_req.html | sed 's/<[^>]*>//g' | head -3
