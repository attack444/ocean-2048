#!/bin/bash
# ЭТАП 2, todo #9: детальная SEO-проверка страниц 5mb2 (метатеги, OG, JSON-LD, canonical)
UA="Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
BASE="https://5mb2.ru"
TMP=/tmp/5mb2-seo
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
  "/games/game/cube-lab" "cube-lab"
  "/games/game/neon-racer" "neon-racer"
  "/games/game/ocean-2048" "ocean-2048"
  "/games/game/pixel-quest" "pixel-quest"
)

for i in $(seq 0 2 $((${#PAGES[@]}-1))); do
  url="${PAGES[$i]}"; name="${PAGES[$((i+1))]}"
  curl -s -A "$UA" "$BASE$url" -o "$TMP/$name.html"
done

python3 - "$TMP" <<'PYEOF'
import os, re, sys
d = sys.argv[1]
order = ["home","catalog","blog","releases","updates","assets","about","requisites",
         "cube-lab","neon-racer","ocean-2048","pixel-quest"]
urls = {
 "home":"/", "catalog":"/games/catalog", "blog":"/games/blog", "releases":"/games/releases",
 "updates":"/games/updates", "assets":"/games/assets", "about":"/games/about",
 "requisites":"/games/requisites", "cube-lab":"/games/game/cube-lab",
 "neon-racer":"/games/game/neon-racer", "ocean-2048":"/games/game/ocean-2048",
 "pixel-quest":"/games/game/pixel-quest",
}

def grab(t, pat, g=1):
    m = re.search(pat, t, re.I)
    return m.group(g).strip() if m else ''

for name in order:
    f = os.path.join(d, name + ".html")
    if not os.path.exists(f):
        print("==== %s: ФАЙЛ ОТСУТСТВУЕТ ====\n" % name); continue
    t = open(f, encoding='utf-8', errors='replace').read()
    title = grab(t, r'<title[^>]*>(.*?)</title>')
    desc = grab(t, r'<meta[^>]+name=["\']description["\'][^>]+content=["\']([^"\']+)')
    if not desc:
        desc = grab(t, r'<meta[^>]+content=["\']([^"\']+)["\'][^>]+name=["\']description["\']')
    kw = grab(t, r'<meta[^>]+name=["\']keywords["\'][^>]+content=["\']([^"\']+)')
    canon = grab(t, r'<link[^>]+rel=["\']canonical["\'][^>]+href=["\']([^"\']+)')
    og = {}
    for k in ['title','description','image','url','type','site_name','locale']:
        v = grab(t, r'<meta[^>]+property=["\']og:%s["\'][^>]+content=["\']([^"\']+)' % k)
        if not v:
            v = grab(t, r'<meta[^>]+content=["\']([^"\']+)["\'][^>]+property=["\']og:%s["\']' % k)
        og[k] = v
    twcard = grab(t, r'<meta[^>]+name=["\']twitter:card["\'][^>]+content=["\']([^"\']+)')
    jsonld = 'JSON-LD' if 'application/ld+json' in t else '-'
    hreflang = len(re.findall(r'hreflang=', t, re.I))
    favicon = 'yes' if re.search(r'<link[^>]+rel=["\'](?:shortcut )?icon["\']', t, re.I) else 'no'
    og_n = len(re.findall(r'property=["\']og:', t, re.I))
    print("==== %s (%s) ====" % (name, urls[name]))
    print("  TITLE   : %s" % title)
    print("  DESC    : %s" % (desc[:95] or '-'))
    print("  KEYWORDS: %s" % (kw[:60] or '-'))
    print("  CANON   : %s" % (canon or '-'))
    print("  OG(%d): %s" % (og_n, {k:v for k,v in og.items() if v}))
    print("  TWITTER : %s  |  JSON-LD: %s  |  HREFLANG: %d  |  FAVICON: %s" % (twcard or '-', jsonld, hreflang, favicon))
    print()
PYEOF
