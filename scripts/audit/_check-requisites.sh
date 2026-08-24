#!/usr/bin/env bash
# Проверка отдельных страниц реквизитов: neobrain (SaaS) и 5mb2 (games).
set -u

echo "=== HTTP status ==="
echo "neobrain /neobrain/requisites -> $(curl -s -o /dev/null -w '%{http_code}' https://neobrain.site/neobrain/requisites)"
echo "5mb2     /games/requisites    -> $(curl -s -o /dev/null -w '%{http_code}' https://5mb2.ru/games/requisites)"
echo "5mb2     /neobrain/requisites -> $(curl -s -o /dev/null -w '%{http_code}' https://5mb2.ru/neobrain/requisites)"
echo "5mb2     /requisites          -> $(curl -s -o /dev/null -w '%{http_code}' https://5mb2.ru/requisites)"

echo ""
echo "=== Данные на странице 5mb2 /games/requisites ==="
curl -s https://5mb2.ru/games/requisites -o /tmp/req-g.html
for s in "Сундуков Вячеслав Алексеевич" "522402377462" "ПАО Сбербанк" "042202603" "30101810900000000603" "40817810442000555115" "hello@5mb2.ru" "г. Первомайск"; do
  if grep -qF "$s" /tmp/req-g.html; then echo "OK   : $s"; else echo "MISS : $s"; fi
done

echo ""
echo "=== Стиль 5mb2 (games) ==="
echo "body class:      $(grep -o '<body class="[^"]*"' /tmp/req-g.html | head -1)"
echo "theme color:     $(grep -o 'name="theme-color" content="[^"]*"' /tmp/req-g.html | head -1)"
echo "games CSS:       $(grep -c '/static/games/css/style.css' /tmp/req-g.html)"
echo "Manrope font:    $(grep -c 'Manrope' /tmp/req-g.html)"
echo "anim.js:         $(grep -c '/static/games/js/anim.js' /tmp/req-g.html)"
echo "brand 5mb2:      $(grep -c '5mb2' /tmp/req-g.html)"
echo "footer 5MB2:     $(grep -c '5MB2 GAMES' /tmp/req-g.html)"
echo "footer link games/requisites: $(grep -c 'href=\"/games/requisites\"' /tmp/req-g.html)"
echo "footer link neobrain/requisites: $(grep -c 'href=\"/neobrain/requisites\"' /tmp/req-g.html)"

echo ""
echo "=== Стиль neobrain (SaaS) ==="
curl -s https://neobrain.site/neobrain/requisites -o /tmp/req-n.html
echo "body class:      $(grep -o '<body class="[^"]*"' /tmp/req-n.html | head -1)"
echo "theme color:     $(grep -o 'name="theme-color" content="[^"]*"' /tmp/req-n.html | head -1)"
echo "neobrain CSS:    $(grep -c '/static/neobrain/css/style.css' /tmp/req-n.html)"
echo "Inter font:      $(grep -c 'Inter' /tmp/req-n.html)"
echo "brand NeoBrain:  $(grep -c 'NeoBrain' /tmp/req-n.html)"
echo "footer link neobrain/requisites: $(grep -c 'href=\"/neobrain/requisites\"' /tmp/req-n.html)"
for s in "Сундуков Вячеслав Алексеевич" "522402377462" "ПАО Сбербанк" "40817810442000555115"; do
  if grep -qF "$s" /tmp/req-n.html; then echo "OK   : $s"; else echo "MISS : $s"; fi
done

echo ""
echo "=== Заголовки страниц ==="
echo "5mb2:    $(grep -o '<h1>[^<]*</h1>' /tmp/req-g.html | head -1)"
echo "neobrain: $(grep -o '<h1>[^<]*</h1>' /tmp/req-n.html | head -1)"
echo "5mb2 title tag: $(grep -o '<title>[^<]*</title>' /tmp/req-g.html | head -1)"
echo "neobrain title tag: $(grep -o '<title>[^<]*</title>' /tmp/req-n.html | head -1)"
