#!/bin/bash
# ЭТАП 4, todo #14: точный инвентарь admin-роутов (routes/admin.js) + маршрут pages
W=/opt/ai-helper/neobrain/services/web/src
F="$W/routes/admin.js"

echo "== 1. Все router.get / router.post в admin.js =="
grep -nE "router\.(get|post)\(" "$F" 2>/dev/null | sed 's/^[[:space:]]*//'

echo ""
echo "== 2. Маршруты 'pages' где-либо ещё =="
grep -rn "admin/pages\|api/admin/pages\|'pages'\|/pages" "$W/routes" 2>/dev/null | grep -i "get\|post" | head -10

echo ""
echo "== 3. Гварды в admin.js (onlyAdmin / csrfCheck) =="
grep -nE "onlyAdmin|csrfCheck|requireAuth|isAdmin" "$F" 2>/dev/null | head -20

echo ""
echo "== 4. Какие admin-роуты смонтированы в app.js =="
grep -nE "admin" "$W/app.js" 2>/dev/null | head -10
