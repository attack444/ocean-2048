#!/bin/bash
# ЭТАП 3, todo #13: контент + SEO + аналитика neobrain
# SEO всех 107 страниц sitemap + текстовые дампы ключевых разделов + sitemap/robots/аналитика
UA="Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
BASE="https://neobrain.site"
TMP=/tmp/nb-seo
rm -rf "$TMP"; mkdir -p "$TMP"

echo "=== 1. Sitemap + robots ==="
curl -s -A "$UA" --max-time 20 "$BASE/sitemap.xml" -o "$TMP/sitemap.xml"
nloc=$(grep -c '<loc>' "$TMP/sitemap.xml")
echo "  loc в sitemap.xml: $nloc"
curl -s -A "$UA" --max-time 20 "$BASE/robots.txt" -o "$TMP/robots.txt"
echo "-- robots.txt --"
cat "$TMP/robots.txt"
echo ""

echo "=== 2. Скачиваем все страницы sitemap ==="
grep -oE '<loc>[^<]+</loc>' "$TMP/sitemap.xml" | sed -E 's#</?loc>##g' > "$TMP/urls.txt"
while read -r u; do
  [ -z "$u" ] && continue
  name=$(echo "$u" | sed -E "s#$BASE##; s#^/##; s#/#_#g")
  [ -z "$name" ] && name="home"
  curl -s -A "$UA" --max-time 20 "$u" -o "$TMP/$name.html"
done < "$TMP/urls.txt"
echo "  скачано: $(ls "$TMP"/*.html | wc -l)"

echo ""
echo "=== 3. SEO-скан всех страниц ==="
python3 - "$TMP" <<'PYEOF'
import os, re, sys
d = sys.argv[1]
files = sorted(f for f in os.listdir(d) if f.endswith(".html"))
def grab(t, pat, g=1):
    m = re.search(pat, t, re.I)
    return m.group(g).strip() if m else ''
issues = []
n = 0
for fn in files:
    t = open(os.path.join(d, fn), encoding='utf-8', errors='replace').read()
    n += 1
    title = grab(t, r'<title[^>]*>(.*?)</title>')
    desc = grab(t, r'<meta[^>]+name=["\']description["\'][^>]+content=["\']([^"\']+)')
    if not desc:
        desc = grab(t, r'<meta[^>]+content=["\']([^"\']+)["\'][^>]+name=["\']description["\']')
    canon = grab(t, r'<link[^>]+rel=["\']canonical["\'][^>]+href=["\']([^"\']+)')
    og_n = len(re.findall(r'property=["\']og:', t, re.I))
    jsonld = 'application/ld+json' in t
    fav = re.search(r'<link[^>]+rel=["\'](?:shortcut )?icon["\']', t, re.I) is not None
    hreflang = len(re.findall(r'hreflang=', t, re.I))
    if not title: issues.append("%s: нет title" % fn)
    if not desc: issues.append("%s: нет description" % fn)
    if not canon: issues.append("%s: нет canonical" % fn)
    if og_n < 7: issues.append("%s: OG=%d<7" % (fn, og_n))
    if not jsonld: issues.append("%s: нет JSON-LD" % fn)
    if not fav: issues.append("%s: нет favicon" % fn)
    if hreflang: issues.append("%s: hreflang=%d" % (fn, hreflang))
print("  Проверено страниц: %d" % n)
print("  Title/desc/canonical/OG>=7/JSON-LD/favicon/hreflang=0: %s" % ("ВСЕ ОК" if not issues else "ЕСТЬ ПРОБЛЕМЫ"))
for i in issues:
    print("    !!!", i)
PYEOF

echo ""
echo "=== 4. Текстовые дампы ключевых разделов ==="
for name in home neobrain_uslugi neobrain_seo-tools neobrain_plans neobrain_chat neobrain_learn neobrain_faq neobrain_guides_first-apk; do
  f="$TMP/$name.html"
  [ -f "$f" ] || { echo "  (нет $name)"; continue; }
  echo ""
  echo "-- $name --"
  python3 - "$f" <<'PYEOF'
import html, re, sys
t = open(sys.argv[1], encoding='utf-8', errors='replace').read()
t = re.sub(r'<(script|style)[^>]*>.*?</\1>', ' ', t, flags=re.S | re.I)
t = re.sub(r'<[^>]+>', ' ', t)
t = html.unescape(t)
t = re.sub(r'\s+', ' ', t).strip()
print("   chars:", len(t))
print("   " + t[:400])
PYEOF
done

echo ""
echo "=== 5. Аналитика (счётчик Mail.ru / Яндекс) в футере ==="
grep -l 'top100' "$TMP"/*.html > /dev/null 2>&1 && echo "  top100 (Mail.ru) найден на $(grep -l 'top100' "$TMP"/*.html | wc -l) страницах" || echo "  top100 не найден"
grep -l 'mc.yandex' "$TMP"/*.html > /dev/null 2>&1 && echo "  Яндекс.Метрика найдена" || echo "  Яндекс.Метрика не найдена"
echo "-- фрагмент счётчика (главная) --"
grep -oE 'top100[^<]{0,120}' "$TMP/home.html" 2>/dev/null | head -3
