#!/bin/bash
# Проверка ресурсов (JS/CSS/обложки/API-эндпоинты) страниц 5mb2 (todo #7) — самодостаточный
UA="Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
BASE="https://5mb2.ru"
TMP=/tmp/5mb2-res
rm -rf "$TMP"; mkdir -p "$TMP"

PAGES=(
  "/"
  "/games/catalog"
  "/games/blog"
  "/games/releases"
  "/games/updates"
  "/games/assets"
  "/games/about"
  "/games/requisites"
  "/games/game/cube-lab"
  "/games/game/neon-racer"
  "/games/game/ocean-2048"
  "/games/game/pixel-quest"
)

echo "=== 1. Скачиваем страницы ==="
for p in "${PAGES[@]}"; do
  f="$TMP/$(echo "$p" | sed 's|^/||; s|/|_|g')" 
  [ "$p" = "/" ] && f="$TMP/home"
  curl -s -A "$UA" "$BASE$p" -o "$f.html"
done
echo "скачано: $(ls "$TMP" | wc -l)"

echo ""
echo "=== 2. JS-файлы (script src) ==="
grep -ohE '<script[^>]*src="[^"]+"' "$TMP"/*.html 2>/dev/null \
  | sed -E 's/.*src="//; s/"$//' | sort -u > "$TMP/js.txt"
cat "$TMP/js.txt"
echo "-- статусы --"
while read -r a; do
  [ -z "$a" ] && continue
  c=$(curl -s -o /dev/null -w "%{http_code}" -A "$UA" --max-time 15 "$BASE$a")
  echo "  $c  $a"
done < "$TMP/js.txt"

echo ""
echo "=== 3. CSS-файлы (link stylesheet) ==="
grep -ohE '<link[^>]*rel="stylesheet"[^>]*>' "$TMP"/*.html 2>/dev/null \
  | grep -oE 'href="[^"]+"' | sed 's/href="//; s/"$//' | sort -u > "$TMP/css.txt"
cat "$TMP/css.txt"
echo "-- статусы --"
while read -r a; do
  [ -z "$a" ] && continue
  # внешний URL или внутренний
  full="$a"
  case "$a" in http*) ;; *) full="$BASE$a";; esac
  c=$(curl -s -o /dev/null -w "%{http_code}" -A "$UA" --max-time 15 "$full")
  echo "  $c  $a"
done < "$TMP/css.txt"

echo ""
echo "=== 4. Изображения/обложки (img src, кроме data:) ==="
grep -ohE '<img[^>]*src="[^"]+"' "$TMP"/*.html 2>/dev/null \
  | sed -E 's/.*src="//; s/"$//' | grep -v '^data:' | sort -u > "$TMP/img.txt"
cat "$TMP/img.txt"
echo "-- статусы --"
while read -r a; do
  [ -z "$a" ] && continue
  full="$a"
  case "$a" in http*) ;; *) full="$BASE$a";; esac
  c=$(curl -s -o /dev/null -w "%{http_code}" -A "$UA" --max-time 15 "$full")
  echo "  $c  $a"
done < "$TMP/img.txt"

echo ""
echo "=== 5. API-эндпоинты, используемые формами (из inline JS) ==="
grep -ohE '/api/[a-z0-9/_-]+' "$TMP"/*.html 2>/dev/null | sort -u > "$TMP/api.txt"
cat "$TMP/api.txt"
echo "-- статусы (GET) --"
while read -r a; do
  [ -z "$a" ] && continue
  c=$(curl -s -o /dev/null -w "%{http_code}" -A "$UA" --max-time 15 "$BASE$a")
  echo "  $c  $a"
done < "$TMP/api.txt"
