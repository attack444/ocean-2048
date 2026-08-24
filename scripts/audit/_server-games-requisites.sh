#!/usr/bin/env bash
# Применяет отдельную страницу реквизитов для 5mb2 (games):
# 1) копирует шаблон games/legal-requisites.ejs в хост-исходник;
# 2) добавляет роуты GET /requisites и /games/requisites в routes/games.js (идемпотентно);
# 3) в views/partials/foot.ejs для games-ветки меняет ссылку на /games/requisites (идемпотентно).
set -euo pipefail
W=/opt/ai-helper/neobrain/services/web/src

echo "=== 1. Шаблон games/legal-requisites.ejs ==="
mkdir -p "$W/views/games"
if [ -f /tmp/games-legal-requisites.ejs ]; then
  cp /tmp/games-legal-requisites.ejs "$W/views/games/legal-requisites.ejs"
  echo "copied"
else
  echo "SKIP: /tmp/games-legal-requisites.ejs not found"
fi

echo ""
echo "=== 2. Роут /requisites в games.js (пишем в исходник, идемпотентно) ==="
python3 - "$W/routes/games.js" <<'PY'
import sys
p = sys.argv[1]
s = open(p, encoding="utf-8").read()
# Признак уже добавленного роута: вызов res.render("games/legal-requisites" ...)
if "games/legal-requisites" in s:
    print("already present")
else:
    route = '''// Страница «Реквизиты» — отдельная, в стиле 5mb2 (games), а не neobrain.
// Доступна и по явному /games/requisites, и по корню /requisites (на 5mb2.ru
// корень диспетчеризуется на gamesRoutes по Host — см. app.js).
router.get(
  "/requisites",
  (req, res) => res.render("games/legal-requisites", {
    title: "Реквизиты продавца — 5MB2 GAMES",
    description: "Реквизиты продавца (самозанятый) 5MB2 GAMES: ИНН, адрес, банковские реквизиты для выплат.",
    user: req.user, legal: config.legal,
  })
);

'''
    marker = 'router.get(\n  "/api/updates"'
    assert marker in s, "marker not found"
    s = s.replace(marker, route + marker, 1)
    open(p, "w", encoding="utf-8").write(s)
    print("route inserted")
PY

echo ""
echo "=== 3. Ссылка в футере games-ветки (только games-блок, идемпотентно) ==="
python3 - "$W/views/partials/foot.ejs" <<'PY'
import sys, re
p = sys.argv[1]
s = open(p, encoding="utf-8").read()
old = '<a href="/neobrain/requisites">Реквизиты</a>'
new = '<a href="/games/requisites">Реквизиты</a>'
m = re.search(r"if \(_footSite === 'games'\) \{(.*?)\} else \{", s, re.S)
if not m:
    print("SKIP: games block not found")
else:
    block = m.group(1)
    if new in block:
        print("games link already ok")
    elif old in block:
        fixed = block.replace(old, new, 1)
        s = s[:m.start(1)] + fixed + s[m.end(1):]
        open(p, "w", encoding="utf-8").write(s)
        print("games footer link -> /games/requisites")
    else:
        print("SKIP: /neobrain/requisites not in games block")
PY

echo ""
echo "=== Проверка ==="
echo "games.js /requisites: $(grep -c 'requisites' "$W/routes/games.js")"
echo "games template exists: $(test -f "$W/views/games/legal-requisites.ejs" && echo yes || echo no)"
echo "foot /games/requisites: $(grep -c 'href=\"/games/requisites\"' "$W/views/partials/foot.ejs")"
echo "foot /neobrain/requisites: $(grep -c 'href=\"/neobrain/requisites\"' "$W/views/partials/foot.ejs")"
echo "=== DONE ==="
