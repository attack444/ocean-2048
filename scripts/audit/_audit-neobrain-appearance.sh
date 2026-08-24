#!/bin/bash
# ЭТАП 3, todo #10: внешний вид + адаптивность страниц neobrain (мета-база, h1, alt, @media)
# Самодостаточный: скачивает sitemap, все публичные URL, проверяет метрики.
UA="Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
BASE="https://neobrain.site"
TMP=/tmp/nb-appearance
rm -rf "$TMP"; mkdir -p "$TMP"

echo "=== 1. Sitemap neobrain.site ==="
curl -s -A "$UA" --max-time 20 "$BASE/sitemap.xml" -o "$TMP/sitemap.xml"
if [ ! -s "$TMP/sitemap.xml" ]; then
  echo "  sitemap.xml пуст/недоступен — пробуем /neobrain/sitemap.xml"
  curl -s -A "$UA" --max-time 20 "$BASE/neobrain/sitemap.xml" -o "$TMP/sitemap.xml"
fi
grep -oE '<loc>[^<]+</loc>' "$TMP/sitemap.xml" 2>/dev/null | sed -E 's#</?loc>##g' > "$TMP/urls.txt"
total=$(wc -l < "$TMP/urls.txt" 2>/dev/null || echo 0)
echo "  URL в sitemap: $total"
cat "$TMP/urls.txt"

echo ""
echo "=== 2. Скачиваем страницы + базовый статус ==="
: > "$TMP/pages.txt"
: > "$TMP/bad.txt"
while read -r u; do
  [ -z "$u" ] && continue
  name=$(echo "$u" | sed -E "s#$BASE##; s#^/##; s#/#_#g; s#\$#.html#")
  [ -z "$name" ] && name="home.html"
  code=$(curl -s -o "$TMP/$name" -w "%{http_code}" -A "$UA" --max-time 20 "$u")
  echo "  $code  $u"
  echo "$code  $u" >> "$TMP/pages.txt"
  if [ "$code" != "200" ]; then
    echo "$code  $u" >> "$TMP/bad.txt"
  fi
done < "$TMP/urls.txt"

echo ""
echo "=== 3. Мета-база и структура страниц ==="
python3 - "$TMP" <<'PYEOF'
import os, re, sys
d = sys.argv[1]
order = []
for ln in open(os.path.join(d, "urls.txt"), encoding='utf-8', errors='replace'):
    u = ln.strip()
    if u:
        name = u.replace("https://neobrain.site", "").strip("/").replace("/", "_") or "home"
        order.append((name + ".html", u))
if not order:
    print("Нет URL — стоп"); sys.exit(0)

def grab(t, pat, g=1):
    m = re.search(pat, t, re.I)
    return m.group(g).strip() if m else ''

for fn, u in order:
    f = os.path.join(d, fn)
    if not os.path.exists(f):
        print("==== %s: ФАЙЛ ОТСУТСТВУЕТ ====" % u); continue
    t = open(f, encoding='utf-8', errors='replace').read()
    title = grab(t, r'<title[^>]*>(.*?)</title>')
    desc = grab(t, r'<meta[^>]+name=["\']description["\'][^>]+content=["\']([^"\']+)')
    if not desc:
        desc = grab(t, r'<meta[^>]+content=["\']([^"\']+)["\'][^>]+name=["\']description["\']')
    viewport = 'yes' if 'viewport' in t.lower() else 'no'
    h1 = len(re.findall(r'<h1[ >]', t, re.I))
    img_total = len(re.findall(r'<img[ >]', t, re.I))
    img_noalt = len(re.findall(r'<img\b(?![^>]*\balt=)[^>]*>', t, re.I))
    og = len(re.findall(r'property=["\']og:', t, re.I))
    jsonld = 'JSON-LD' if 'application/ld+json' in t else '-'
    forms = len(re.findall(r'<form\b', t, re.I))
    print("==== %s ====" % u)
    print("  TITLE   : %s" % (title or '-'))
    print("  DESC    : %s" % (desc[:90] or '-'))
    print("  VIEWPORT: %s  H1: %d  IMG: %d (без alt: %d)  OG: %d  JSON-LD: %s  FORMS: %d"
          % (viewport, h1, img_total, img_noalt, og, jsonld, forms))
    print()
PYEOF

echo "=== 4. Адаптивность (CSS @media) ==="
# собираем все ссылки на CSS
grep -ohE '<link[^>]*rel="stylesheet"[^>]*>' "$TMP"/*.html 2>/dev/null \
  | grep -oE 'href="[^"]+"' | sed 's/href="//; s/"$//' | sort -u > "$TMP/css.txt"
cat "$TMP/css.txt"
echo "-- проверка @media в CSS --"
while read -r a; do
  [ -z "$a" ] && continue
  full="$a"; case "$a" in http*) ;; *) full="$BASE$a";; esac
  c=$(curl -s -o /dev/null -w "%{http_code}" -A "$UA" --max-time 20 "$full")
  media=$(curl -s -A "$UA" --max-time 20 "$full" | grep -c '@media' || echo 0)
  echo "  $c  $a  (@media: $media)"
done < "$TMP/css.txt"

echo ""
echo "=== 5. Итог ==="
bad=$(wc -l < "$TMP/bad.txt" 2>/dev/null || echo 0)
echo "Не-200 страниц из sitemap: $bad"
cat "$TMP/bad.txt" 2>/dev/null
