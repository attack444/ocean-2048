#!/bin/bash
# ЭТАП 2, todo #8: текущее состояние контента страниц 5mb2 (что наполнить/дополнить)
UA="Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
BASE="https://5mb2.ru"
TMP=/tmp/5mb2-content
rm -rf "$TMP"; mkdir -p "$TMP"

PAGES=(
  "/" "home"
  "/games/catalog" "catalog"
  "/games/blog" "blog"
  "/games/releases" "releases"
  "/games/updates" "updates"
  "/games/assets" "assets"
  "/games/about" "about"
  "/games/requisites" "requisites"
  "/games/game/cube-lab" "game-cube-lab"
  "/games/game/neon-racer" "game-neon-racer"
  "/games/game/ocean-2048" "game-ocean-2048"
  "/games/game/pixel-quest" "game-pixel-quest"
)

for i in $(seq 0 2 $((${#PAGES[@]}-1))); do
  url="${PAGES[$i]}"; name="${PAGES[$((i+1))]}"
  curl -s -A "$UA" "$BASE$url" -o "$TMP/$name.html"
done

strip() {
  # убираем теги, схлопываем пробелы/пустые строки (через python — без проблем с кавычками)
  python3 - "$1" <<'PYEOF'
import re, sys, html
f = sys.argv[1]
t = open(f, encoding='utf-8', errors='replace').read()
t = re.sub(r'<script.*?</script>', ' ', t, flags=re.S)
t = re.sub(r'<style.*?</style>', ' ', t, flags=re.S)
t = re.sub(r'<[^>]+>', ' ', t)
t = html.unescape(t)
t = re.sub(r'\s+', ' ', t)
lines = [l.strip() for l in t.split('\n') if l.strip()]
print('\n'.join(lines[:80]))
PYEOF
}

echo "================ HOME ================"
strip "$TMP/home.html"
echo ""
echo "================ CATALOG ================"
strip "$TMP/catalog.html"
echo ""
echo "================ BLOG ================"
strip "$TMP/blog.html"
echo ""
echo "================ RELEASES ================"
strip "$TMP/releases.html"
echo ""
echo "================ UPDATES ================"
strip "$TMP/updates.html"
echo ""
echo "================ ASSETS ================"
strip "$TMP/assets.html"
echo ""
echo "================ ABOUT ================"
strip "$TMP/about.html"
echo ""
echo "================ REQUISITES ================"
strip "$TMP/requisites.html"
echo ""
echo "================ GAME: ocean-2048 ================"
strip "$TMP/game-ocean-2048.html"
echo ""
echo "================ GAME: neon-racer ================"
strip "$TMP/game-neon-racer.html"
echo ""
echo "================ GAME: pixel-quest ================"
strip "$TMP/game-pixel-quest.html"
echo ""
echo "================ GAME: cube-lab ================"
strip "$TMP/game-cube-lab.html"
