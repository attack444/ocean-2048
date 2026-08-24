#!/bin/bash
# ЭТАП 4, todo #14: обзор админ-панели и панели сервера (роуты, доступы, эндпоинты)
W=/opt/ai-helper/neobrain/services/web/src

echo "=== 1. Роуты admin/панели в routes ==="
grep -rn "admin" "$W/routes" 2>/dev/null | grep -iE "get\(|post\(|use\(|router\.(get|post|use)" | head -40

echo ""
echo "=== 2. Страницы/вьюхи панели (views) ==="
ls -1 "$W/views" 2>/dev/null | grep -iE "admin|panel|dashboard|server" 
ls -1 "$W/views/neobrain" 2>/dev/null | grep -iE "admin|panel|dashboard" 

echo ""
echo "=== 3. Панель сервера / system_health / watchdog ==="
grep -rn "system_health\|system-health\|server-panel\|/server" "$W/routes" 2>/dev/null | head -20

echo ""
echo "=== 4. Ссылки на админку снаружи (страницы neobrain) ==="
grep -rhoE 'href="[^"]*(admin|panel|dashboard|server)[^"]*"' "$W/views" 2>/dev/null | sort -u | head -20

echo ""
echo "=== 5. HTTP-доступ снаружи ==="
UA="Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
for p in /neobrain/admin /admin /neobrain/cabinet /neobrain/projects /neobrain/reports; do
  c=$(curl -s -o /dev/null -w "%{http_code}" -L -A "$UA" --max-time 15 "https://neobrain.site$p")
  echo "  $c  $p (с редиректом)"
done

echo ""
echo "=== 6. Куда редиректит /neobrain/admin ==="
curl -s -o /dev/null -w "  /neobrain/admin -> %{redirect_url}\n" -A "$UA" --max-time 15 "https://neobrain.site/neobrain/admin"
