#!/bin/bash
# ЭТАП 2, todo #8: реальные href документов в футере + полный sitemap
UA="Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
BASE="https://5mb2.ru"

echo "=== 1. Футер: ссылки с текстом Оферта/Конфиденциальность/Возврат/Документы ==="
curl -s -A "$UA" "$BASE/" -o /tmp/f.html
python3 - /tmp/f.html <<'PYEOF'
import re, sys, html
t = open(sys.argv[1], encoding='utf-8', errors='replace').read()
# ищем <a ...>текст</a> где текст содержит ключевые слова
for m in re.finditer(r'<a\s+[^>]*href="([^"]+)"[^>]*>(.*?)</a>', t, re.S):
    href, txt = m.group(1), re.sub(r'<[^>]+>', '', m.group(2)).strip()
    if any(k in txt.lower() for k in ('оферт', 'конфиденц', 'возврат', 'документ', 'реквизит')):
        print(f"  href={href!r:60} text={txt!r}")
PYEOF

echo ""
echo "=== 2. Проверка найденных URL ==="
for u in $(python3 - /tmp/f.html <<'PYEOF'
import re, sys
t = open(sys.argv[1], encoding='utf-8', errors='replace').read()
for m in re.finditer(r'<a\s+[^>]*href="([^"]+)"[^>]*>(.*?)</a>', t, re.S):
    href, txt = m.group(1), re.sub(r'<[^>]+>', '', m.group(2)).strip()
    if any(k in txt.lower() for k in ('оферт', 'конфиденц', 'возврат', 'документ', 'реквизит')):
        print(href)
PYEOF
); do
  case "$u" in
    http*) full="$u" ;;
    /*) full="$BASE$u" ;;
    *) continue ;;
  esac
  c=$(curl -s -o /dev/null -w "%{http_code}" -L -A "$UA" --max-time 15 "$full")
  echo "  $c  $u"
done

echo ""
echo "=== 3. Полный sitemap (все loc) ==="
curl -s -A "$UA" --max-time 15 "$BASE/sitemap.xml" | grep -oE '<loc>[^<]+' | sed 's/<loc>//'

echo ""
echo "=== 4. Проверка каждого loc из sitemap ==="
for u in $(curl -s -A "$UA" --max-time 15 "$BASE/sitemap.xml" | grep -oE '<loc>[^<]+' | sed 's/<loc>//'); do
  c=$(curl -s -o /dev/null -w "%{http_code}" -A "$UA" --max-time 15 "$u")
  echo "  $c  $u"
done
