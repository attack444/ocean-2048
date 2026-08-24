#!/bin/bash
# _media-neobrain-apply.sh
# Правки контента neobrain: логотип/OG/иллюстрации. Вызывается ПОСЛЕ загрузки ассетов в src/public.
set -e
SRC=/opt/ai-helper/neobrain/services/web/src
IMG=$SRC/public/neobrain/img

echo "=== 0. Копируем ассеты из /tmp в src/public/neobrain/img ==="
cp -v /tmp/og-neobrain.png /tmp/ill-home.png /tmp/ill-uslugi.png /tmp/ill-plans.png /tmp/logo-neobrain.svg $IMG/ 2>&1 | sed 's/^/  /'

echo ""
echo "=== 1. Проверка ассетов на месте ==="
ls -la $IMG/og-neobrain.png $IMG/ill-home.png $IMG/ill-uslugi.png $IMG/ill-plans.png $IMG/logo-neobrain.svg 2>&1 | sed 's/^/  /'

echo ""
echo "=== 2. head.ejs: дефолтный og:image для neobrain -> og-neobrain.png ==="
HEAD=$SRC/views/partials/head.ejs
python3 - "$HEAD" <<'PY'
import sys, re
p = sys.argv[1]
s = open(p, encoding="utf-8").read()
old = "var _ogImage = (typeof ogImage !== 'undefined' && ogImage) ? ogImage : '/static/' + _site + '/img/og-default.jpg';"
new = "var _ogImage = (typeof ogImage !== 'undefined' && ogImage) ? ogImage : ((_site === 'neobrain') ? '/static/neobrain/img/og-neobrain.png' : '/static/' + _site + '/img/og-default.jpg');"
if old in s:
    s = s.replace(old, new)
    print("  og:image default -> og-neobrain.png (neobrain)")
else:
    print("  !!! строка og:image не найдена")
open(p, "w", encoding="utf-8").write(s)
PY

echo ""
echo "=== 3. head.ejs: логотип SVG в шапке вместо эмодзи ==="
python3 - "$HEAD" <<'PY'
import sys
p = sys.argv[1]
s = open(p, encoding="utf-8").read()
old = """    <a class="brand brand-animated" href="<%= _site === 'games' ? '/games' : '/neobrain' %>">
      <span class="brand-emoji"><%= _site === 'games' ? '🎮' : '🧠' %></span><span class="brand-text"><%= _site === 'games' ? '5mb2' : 'NeoBrain' %></span>
    </a>"""
new = """    <a class="brand brand-animated" href="<%= _site === 'games' ? '/games' : '/neobrain' %>">
      <% if (_site === 'neobrain') { %>
        <img src="/static/neobrain/img/logo-neobrain.svg" alt="NeoBrain" class="brand-logo" width="150" height="37">
      <% } else { %>
        <span class="brand-emoji">🎮</span><span class="brand-text">5mb2</span>
      <% } %>
    </a>"""
if old in s:
    s = s.replace(old, new)
    print("  шапка: логотип SVG для neobrain")
else:
    print("  !!! блок шапки не найден")
open(p, "w", encoding="utf-8").write(s)
PY

echo ""
echo "=== 4. foot.ejs: логотип SVG в футере neobrain ==="
FOOT=$SRC/views/partials/foot.ejs
python3 - "$FOOT" <<'PY'
import sys
p = sys.argv[1]
s = open(p, encoding="utf-8").read()
old = '<div class="footer-logo"><span class="brand-emoji">🧠</span> NeoBrain</div>'
new = '<div class="footer-logo"><img src="/static/neobrain/img/logo-neobrain.svg" alt="NeoBrain" width="150" height="37"></div>'
if old in s:
    s = s.replace(old, new)
    print("  футер: логотип SVG")
else:
    print("  !!! логотип футера не найден")
open(p, "w", encoding="utf-8").write(s)
PY

echo ""
echo "=== 5. home.ejs: иллюстрация после 'Что умеет NeoBrain' ==="
HOME=$SRC/views/neobrain/home.ejs
python3 - "$HOME" <<'PY'
import sys
p = sys.argv[1]
s = open(p, encoding="utf-8").read()
anchor = '</section>\n\n<!-- Витрина: живой пример «товар лицом» — сайт, созданный ИИ на NeoBrain. -->'
insert = '</section>\n\n<!-- Иллюстрация: SEO-дашборд (контент-наполнение ЭТАП 6). -->\n<figure class="hero-visual" data-reveal>\n  <img src="/static/neobrain/img/ill-home.png" alt="SEO-аудит и аналитика в NeoBrain: проверка title, description, UTM и Open Graph" width="720" height="480" loading="lazy">\n</figure>\n\n<!-- Витрина: живой пример «товар лицом» — сайт, созданный ИИ на NeoBrain. -->'
if anchor in s:
    s = s.replace(anchor, insert, 1)
    print("  home: ill-home вставлена")
else:
    print("  !!! якорь home не найден")
open(p, "w", encoding="utf-8").write(s)
PY

echo ""
echo "=== 6. uslugi.ejs: иллюстрация после hero ==="
USL=$SRC/views/neobrain/uslugi.ejs
python3 - "$USL" <<'PY'
import sys
p = sys.argv[1]
s = open(p, encoding="utf-8").read()
# Ищем закрытие hero: секция hero заканчивается на ближайшем </section> после первого <section class="hero">
import re
m = re.search(r'(<section class="hero">.*?</section>)', s, re.S)
if m:
    hero = m.group(1)
    repl = hero + '\n\n<!-- Иллюстрация: рост трафика (контент-наполнение ЭТАП 6). -->\n<figure class="hero-visual" data-reveal>\n  <img src="/static/neobrain/img/ill-uslugi.png" alt="Рост трафика и позиций сайта при продвижении NeoBrain" width="720" height="480" loading="lazy">\n</figure>'
    s = s.replace(hero, repl, 1)
    print("  uslugi: ill-uslugi вставлена после hero")
else:
    print("  !!! hero uslugi не найден")
open(p, "w", encoding="utf-8").write(s)
PY

echo ""
echo "=== 7. plans.ejs: иллюстрация после intro ==="
PLANS=$SRC/views/neobrain/plans.ejs
python3 - "$PLANS" <<'PY'
import sys
p = sys.argv[1]
s = open(p, encoding="utf-8").read()
anchor = '<p class="hint">Это тарифы для <a href="/neobrain/chat">ИИ-агента</a> (правки кода, деплой из Studio) —\n   не путать с ручным <a href="/neobrain/uslugi">SEO-продвижением</a>: у него отдельное ценообразование по брифу.</p>'
insert = anchor + '\n\n<!-- Иллюстрация: три тарифа (контент-наполнение ЭТАП 6). -->\n<figure class="hero-visual" data-reveal>\n  <img src="/static/neobrain/img/ill-plans.png" alt="Тарифы NeoBrain: Free, Starter и Pro для ИИ-агента" width="720" height="480" loading="lazy">\n</figure>'
if anchor in s:
    s = s.replace(anchor, insert, 1)
    print("  plans: ill-plans вставлена")
else:
    print("  !!! якорь plans не найден")
open(p, "w", encoding="utf-8").write(s)
PY

echo ""
echo "=== 8. CSS: стили brand-logo и hero-visual ==="
CSS=$SRC/public/neobrain/css/style.css
python3 - "$CSS" <<'PY'
import sys
p = sys.argv[1]
s = open(p, encoding="utf-8").read()
extra = """
/* ===== Контент-наполнение ЭТАП 6: логотип в шапке/футере и иллюстрации страниц ===== */
.brand-logo{display:inline-block;height:34px;width:auto;vertical-align:middle}
.footer-logo img{display:inline-block;height:30px;width:auto;vertical-align:middle}
.hero-visual{margin:34px auto 10px;max-width:760px;text-align:center}
.hero-visual img{width:100%;height:auto;border-radius:18px;border:1px solid var(--line);
  box-shadow:0 24px 70px var(--glow-1);display:block}
"""
marker = "/* ===== Контент-наполнение ЭТАП 6"
if marker in s:
    print("  !!! CSS уже дополнен, пропуск")
else:
    s = s + "\n" + extra
    open(p, "w", encoding="utf-8").write(s)
    print("  CSS: brand-logo + hero-visual добавлены")
PY

echo ""
echo "=== 9. Проверка git статуса ==="
cd /opt/ai-helper/neobrain
git status --short | head -30

echo ""
echo "DONE"
