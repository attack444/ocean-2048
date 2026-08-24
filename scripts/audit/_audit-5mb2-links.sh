#!/bin/bash
# ЭТАП 2, todo #7: проверка всех кнопок/ссылок сайта 5mb2 (битые ссылки, 404)
# Методика: краулим все страницы (SSR), извлекаем href + form action,
# нормализуем (без якорей/query/дублей), проверяем статус каждой внутренней ссылки.
BASE="https://5mb2.ru"
UA="Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
TMP=/tmp/5mb2-links
rm -rf "$TMP"; mkdir -p "$TMP"

SEED=(
  "$BASE/"
  "$BASE/games/catalog"
  "$BASE/games/blog"
  "$BASE/games/releases"
  "$BASE/games/updates"
  "$BASE/games/assets"
  "$BASE/games/about"
  "$BASE/games/requisites"
  "$BASE/games/game/cube-lab"
  "$BASE/games/game/neon-racer"
  "$BASE/games/game/ocean-2048"
  "$BASE/games/game/pixel-quest"
)

echo "=== 1. Скачиваем страницы ==="
: > "$TMP/urls_raw.txt"
for u in "${SEED[@]}"; do
  f="$TMP/$(echo "$u" | sed 's|https://5mb2.ru/||; s|/|_|g').html"
  curl -s -A "$UA" "$u" -o "$f"
  code=$(curl -s -o /dev/null -w "%{http_code}" -A "$UA" "$u")
  echo "  $code  $u"
  # извлекаем ссылки
  grep -oE 'href="[^"]+"' "$f" | sed 's/^href="//; s/"$//' >> "$TMP/urls_raw.txt"
  grep -oE "href='[^']+'" "$f" | sed "s/^href='//; s/'$//" >> "$TMP/urls_raw.txt"
  grep -oE 'action="[^"]+"' "$f" | sed 's/^action="//; s/"$//' >> "$TMP/urls_raw.txt"
done

echo ""
echo "=== 2. Нормализуем ссылки ==="
# убираем якоря и query, сортируем, уникалим
sed -E 's/#.*$//; s/\?.*$//' "$TMP/urls_raw.txt" | sort -u > "$TMP/urls_norm.txt"
total=$(wc -l < "$TMP/urls_norm.txt")
echo "Уникальных ссылок после нормализации: $total"
echo ""

echo "=== 3. Классификация ==="
grep -E '^https?://' "$TMP/urls_norm.txt" | grep -v "$BASE" > "$TMP/ext.txt" || true
grep -E '^https?://' "$TMP/urls_norm.txt" | grep "$BASE" > "$TMP/int_abs.txt" || true
grep -E '^/' "$TMP/urls_norm.txt" > "$TMP/int_rel.txt" || true
grep -vE '^(https?://|/|#|mailto:|tel:|javascript:|data:)' "$TMP/urls_norm.txt" > "$TMP/other.txt" || true

echo "Внешних (не 5mb2.ru): $(wc -l < "$TMP/ext.txt" 2>/dev/null || echo 0)"
echo "Внутренних абсолютных:  $(wc -l < "$TMP/int_abs.txt" 2>/dev/null || echo 0)"
echo "Внутренних относительных: $(wc -l < "$TMP/int_rel.txt" 2>/dev/null || echo 0)"
echo "Прочих (не http):        $(wc -l < "$TMP/other.txt" 2>/dev/null || echo 0)"
echo ""
echo "--- Прочие (mailto/tel/#) ---"
cat "$TMP/other.txt" 2>/dev/null

echo ""
echo "=== 4. Проверка внутренних ссылок (статус-коды) ==="
: > "$TMP/status.txt"
# объединяем абсолютные и относительные
cat "$TMP/int_rel.txt" | while read -r p; do echo "$BASE$p"; done > "$TMP/check.txt"
cat "$TMP/int_abs.txt" >> "$TMP/check.txt"
# уникалим ещё раз
sort -u "$TMP/check.txt" -o "$TMP/check.txt"
while read -r u; do
  [ -z "$u" ] && continue
  code=$(curl -s -o /dev/null -w "%{http_code}" -L -A "$UA" --max-time 15 "$u")
  echo "$code  $u"
done < "$TMP/check.txt" | sort > "$TMP/status.txt"

echo ""
echo "=== 5. Итог: битые/проблемные ссылки (не 200/301/302) ==="
bad=0
while read -r line; do
  code=$(echo "$line" | awk '{print $1}')
  case "$code" in
    200|301|302) ;;
    *)
      echo "  !!! $line"
      bad=$((bad+1))
      ;;
  esac
done < "$TMP/status.txt"
echo ""
echo "Проблемных ссылок: $bad из $(wc -l < "$TMP/check.txt")"

echo ""
echo "=== 6. Внешние ссылки (для справки) ==="
cat "$TMP/ext.txt" 2>/dev/null

echo ""
echo "=== 7. Проверка кнопок/форм (input submit / button) по страницам ==="
for u in "${SEED[@]}"; do
  f="$TMP/$(echo "$u" | sed 's|https://5mb2.ru/||; s|/|_|g').html"
  n=$(grep -cE '<(button|input[^>]*type="submit"|input[^>]*type="button")' "$f" 2>/dev/null || echo 0)
  echo "  $u -> кнопок/сабмитов: $n"
done
