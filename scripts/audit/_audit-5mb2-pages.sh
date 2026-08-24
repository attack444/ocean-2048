#!/bin/bash
# Audit 5mb2.ru pages: status + viewport + SEO meta + assets (ЭТАП 2, todo #6)
UA="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36"

echo "=== 0. Sitemap URL list ==="
SITEMAP_URLS=$(curl -s -A "$UA" https://5mb2.ru/sitemap.xml | grep -oE '<loc>[^<]+</loc>' | sed 's/<\/\?loc>//g')
echo "$SITEMAP_URLS" | head -40
echo "count: $(echo "$SITEMAP_URLS" | grep -c . )"

echo ""
echo "=== 1. Page-by-page audit ==="
# base pages to audit (from sitemap + key routes)
PAGES=$(echo "$SITEMAP_URLS"; echo "https://5mb2.ru/"; echo "https://5mb2.ru/about"; echo "https://5mb2.ru/assets"; echo "https://5mb2.ru/games")
PAGES=$(echo "$PAGES" | grep -v '^$' | sort -u)

for u in $PAGES; do
  CODE=$(curl -s -o /tmp/5mb2_page.html -w "%{http_code}" -L -A "$UA" "$u")
  TITLE=$(grep -oiE '<title[^>]*>[^<]*</title>' /tmp/5mb2_page.html | head -1 | sed 's/<[^>]*>//g' | tr -s ' ' | head -c 60)
  DESC=$(grep -oiE '<meta[^>]*name=["'"'"']description["'"'"'][^>]*>' /tmp/5mb2_page.html | head -1 | sed 's/.*content=["'"'"']\([^"'"'"']*\)["'"'"'].*/\1/' | head -c 60)
  VIEWPORT=$(grep -c 'name=["'"'"']viewport["'"'"']' /tmp/5mb2_page.html)
  OG=$(grep -ciE 'property=["'"'"']og:' /tmp/5mb2_page.html)
  CSS=$(grep -ciE '<link[^>]*rel=["'"'"']stylesheet["'"'"']' /tmp/5mb2_page.html)
  JS=$(grep -ciE '<script[^>]*src=' /tmp/5mb2_page.html)
  echo "$CODE | vp=$VIEWPORT og=$OG css=$CSS js=$JS | $u | T:$TITLE | D:$DESC"
done

echo ""
echo "=== 2. Key page elements (home) ==="
curl -s -A "$UA" https://5mb2.ru/ -o /tmp/5mb2_home.html
echo "-- nav links on home --"
grep -oE 'href="[^"]+"' /tmp/5mb2_home.html | grep -vE '\.(css|js|png|jpg|svg|ico|woff|webp)' | sort -u | head -50
echo "-- images missing alt? --"
grep -oiE '<img[^>]*>' /tmp/5mb2_home.html | grep -viE 'alt=' | head -10
echo "-- h1 count --"
grep -oiE '<h1[^>]*>' /tmp/5mb2_home.html | wc -l

echo ""
echo "=== 3. Media queries (responsive CSS) ==="
grep -rE '@media' /opt/ai-helper/neobrain/services/web/src/public/games/css/ 2>/dev/null | head -20 || echo "(no local css dir on this host view)"

echo ""
echo "=== 4. Page size + load (home) ==="
curl -s -o /dev/null -w "home total bytes: %{size_download}\ntime_total: %{time_total}s\n" -A "$UA" https://5mb2.ru/
