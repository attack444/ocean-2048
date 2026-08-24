#!/bin/bash
# ЭТАП 4, todo #14: защита admin-API без авторизации (401) и CSRF на POST
UA="Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
B="https://neobrain.site"

echo "=== 1. GET /api/admin/* без авторизации -> ожидаем 401 ==="
for p in \
  /api/admin/billing \
  /api/admin/resources \
  /api/admin/games \
  /api/admin/releases \
  /api/admin/pages \
  /api/admin/leads \
  /api/admin/reviews \
  /api/admin/subscriptions \
  /api/admin/support/tickets \
  /api/admin/llm-settings ; do
  c=$(curl -s -o /dev/null -w "%{http_code}" -A "$UA" --max-time 15 "$B$p")
  echo "  $c  GET $p"
done

echo ""
echo "=== 2. POST /api/admin/* без токена -> ожидаем 401 или 403 (CSRF) ==="
for p in \
  /api/admin/games \
  /api/admin/releases \
  /api/admin/pages \
  /api/admin/leads \
  /api/admin/reviews \
  /api/admin/llm-settings ; do
  c=$(curl -s -o /dev/null -w "%{http_code}" -A "$UA" --max-time 15 -X POST -H "Content-Type: application/json" -d '{}' "$B$p")
  echo "  $c  POST $p"
done

echo ""
echo "=== 3. Панель сервера: поиск маршрутов/вьюх system-health / server ==="
W=/opt/ai-helper/neobrain/services/web/src
echo "  -- роуты:"
grep -rniE "system.?health|server.?panel|admin/server|/vps" "$W/routes" 2>/dev/null | head -10
echo "  -- вьюхи:"
ls -1 "$W/views" 2>/dev/null | grep -iE "server|system|health|vps" 
ls -1 "$W/views/neobrain" 2>/dev/null | grep -iE "server|system|health|vps"
echo "  -- ссылки /neobrain/admin/vps на страницах:"
grep -rhoE 'href="[^"]*vps[^"]*"' "$W/views" 2>/dev/null | sort -u | head -5
