#!/bin/bash
# ЭТАП 3, todo #11: кнопки/ссылки/формы сайта neobrain (битые ссылки, 404, ресурсы, AJAX-эндпоинты)
# Самодостаточный: скачивает sitemap, краулит все URL, извлекает href + form action,
# нормализует, проверяет статус каждой внутренней ссылки, JS/CSS и /api/* из форм.
UA="Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
BASE="https://neobrain.site"
TMP=/tmp/nb-links
rm -rf "$TMP"; mkdir -p "$TMP"

echo "=== 1. Sitemap ==="
curl -s -A "$UA" --max-time 20 "$BASE/sitemap.xml" -o "$TMP/sitemap.xml"
grep -oE '<loc>[^<]+</loc>' "$TMP/sitemap.xml" 2>/dev/null | sed -E 's#</?loc>##g' > "$TMP/urls.txt"
echo "URL: $(wc -l < "$TMP/urls.txt")"

echo ""
echo "=== 2. Скачиваем страницы + извлекаем ссылки ==="
: > "$TMP/urls_raw.txt"
: > "$TMP/status_pages.txt"
while read -r u; do
  [ -z "$u" ] && continue
  name=$(echo "$u" | sed -E "s#$BASE##; s#^/##; s#/#_#g")
  [ -z "$name" ] && name="home"
  code=$(curl -s -o "$TMP/$name.html" -w "%{http_code}" -A "$UA" --max-time 20 "$u")
  echo "$code  $u" >> "$TMP/status_pages.txt"
  f="$TMP/$name.html"
  grep -oE 'href="[^"]+"' "$f" | sed 's/^href="//; s/"$//' >> "$TMP/urls_raw.txt"
  grep -oE "href='[^']+'" "$f" | sed "s/^href='//; s/'$//" >> "$TMP/urls_raw.txt"
  grep -oE 'action="[^"]+"' "$f" | sed 's/^action="//; s/"$//' >> "$TMP/urls_raw.txt"
done < "$TMP/urls.txt"
echo "страниц скачано: $(ls "$TMP"/*.html | wc -l)"

echo ""
echo "=== 3. Нормализация ссылок ==="
sed -E 's/#.*$//; s/\?.*$//' "$TMP/urls_raw.txt" | sort -u > "$TMP/urls_norm.txt"
echo "Уникальных после нормализации: $(wc -l < "$TMP/urls_norm.txt")"

grep -E '^https?://' "$TMP/urls_norm.txt" | grep -v "$BASE" > "$TMP/ext.txt" || true
grep -E '^https?://' "$TMP/urls_norm.txt" | grep "$BASE" > "$TMP/int_abs.txt" || true
grep -E '^/' "$TMP/urls_norm.txt" > "$TMP/int_rel.txt" || true
grep -vE '^(https?://|/|#|mailto:|tel:|javascript:|data:)' "$TMP/urls_norm.txt" > "$TMP/other.txt" || true

echo "Внешних (не neobrain.site): $(wc -l < "$TMP/ext.txt" 2>/dev/null || echo 0)"
echo "Внутренних абс.: $(wc -l < "$TMP/int_abs.txt" 2>/dev/null || echo 0)"
echo "Внутренних отн.:  $(wc -l < "$TMP/int_rel.txt" 2>/dev/null || echo 0)"
echo "Прочих (mailto/tel/..): $(wc -l < "$TMP/other.txt" 2>/dev/null || echo 0)"
echo "--- Прочие ---"
cat "$TMP/other.txt" 2>/dev/null

echo ""
echo "=== 4. Проверка внутренних ссылок ==="
cat "$TMP/int_rel.txt" | while read -r p; do echo "$BASE$p"; done > "$TMP/check.txt"
cat "$TMP/int_abs.txt" >> "$TMP/check.txt"
sort -u "$TMP/check.txt" -o "$TMP/check.txt"
echo "внутренних URL к проверке: $(wc -l < "$TMP/check.txt")"
: > "$TMP/status_int.txt"
while read -r u; do
  [ -z "$u" ] && continue
  code=$(curl -s -o /dev/null -w "%{http_code}" -L -A "$UA" --max-time 15 "$u")
  echo "$code  $u"
done < "$TMP/check.txt" | sort > "$TMP/status_int.txt"

echo "--- Проблемные (не 200/301/302) ---"
bad=0
while read -r line; do
  code=$(echo "$line" | awk '{print $1}')
  case "$code" in
    200|301|302) ;;
    *) echo "  !!! $line"; bad=$((bad+1));;
  esac
done < "$TMP/status_int.txt"
echo "Проблемных внутренних: $bad из $(wc -l < "$TMP/check.txt")"

echo ""
echo "=== 5. Внешние ссылки (для справки) ==="
cat "$TMP/ext.txt" 2>/dev/null

echo ""
echo "=== 6. JS/CSS ресурсы ==="
grep -ohE '<script[^>]*src="[^"]+"' "$TMP"/*.html 2>/dev/null \
  | sed -E 's/.*src="//; s/"$//' | sort -u > "$TMP/js.txt"
grep -ohE '<link[^>]*rel="stylesheet"[^>]*>' "$TMP"/*.html 2>/dev/null \
  | grep -oE 'href="[^"]+"' | sed 's/href="//; s/"$//' | sort -u > "$TMP/css.txt"
echo "-- JS --"
while read -r a; do
  [ -z "$a" ] && continue
  full="$a"; case "$a" in http*) ;; *) full="$BASE$a";; esac
  c=$(curl -s -o /dev/null -w "%{http_code}" -A "$UA" --max-time 15 "$full")
  echo "  $c  $a"
done < "$TMP/js.txt"
echo "-- CSS --"
while read -r a; do
  [ -z "$a" ] && continue
  full="$a"; case "$a" in http*) ;; *) full="$BASE$a";; esac
  c=$(curl -s -o /dev/null -w "%{http_code}" -A "$UA" --max-time 15 "$full")
  echo "  $c  $a"
done < "$TMP/css.txt"

echo ""
echo "=== 7. API-эндпоинты (из форм/inline JS) ==="
grep -ohE '/api/[a-z0-9/_-]+' "$TMP"/*.html 2>/dev/null | sort -u > "$TMP/api.txt"
cat "$TMP/api.txt" 2>/dev/null

echo ""
echo "=== 8. Кнопки/сабмиты по ключевым страницам ==="
for name in home neobrain uslugi seo-tools plans chat learn login faq; do
  f="$TMP/$name.html"
  [ -f "$f" ] || continue
  n=$(grep -cE '<(button|input[^>]*type="submit"|input[^>]*type="button")' "$f" 2>/dev/null || echo 0)
  echo "  /neobrain$([ "$name" = "home" ] && echo "" || echo "/$name") -> кнопок: $n"
done

echo ""
echo "=== 9. Итог ==="
np=$(wc -l < "$TMP/status_pages.txt")
nbad=$(awk '$1!=200 {c++} END{print c+0}' "$TMP/status_pages.txt")
echo "Страниц sitemap проверено: $np, не-200: $nbad"
awk '$1!=200' "$TMP/status_pages.txt"
