#!/bin/bash
# ЭТАП 4, todo #14: уточнить структуру вьюх admin/vps (Express views dir + контейнер)
W=/opt/ai-helper/neobrain/services/web/src

echo "== 1. views root (host) =="
ls -1 "$W/views" 2>/dev/null

echo ""
echo "== 2. views/admin (host) =="
ls -1 "$W/views/admin" 2>/dev/null

echo ""
echo "== 3. find vps/admin (host) =="
find "$W" -iname "vps*" 2>/dev/null | head
find "$W" -type d -iname "admin" 2>/dev/null | head

echo ""
echo "== 4. app.set('views', ...) в коде =="
grep -rn "set('views'" "$W/app.js" "$W/server.js" "$W/index.js" 2>/dev/null | head -5
grep -rn "views" "$W/app.js" 2>/dev/null | head -10

echo ""
echo "== 5. вьюхи admin в контейнере =="
docker exec neobrain-web ls -1 /app/src/views/admin 2>/dev/null
