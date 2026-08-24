#!/bin/bash
# ЭТАП 5, todo #15: проверка после деплоя (healthcheck + ключевые страницы + новые правки)
UA="Mozilla/5.0 (Windows NT 10.0; Win64; x64)"

echo "== 1. Healthcheck обоих сайтов =="
for u in "https://5mb2.ru/health" "https://neobrain.site/health"; do
  c=$(curl -s -o /dev/null -w "%{http_code}" -A "$UA" --max-time 15 "$u")
  echo "  $c  $u"
done

echo ""
echo "== 2. Ключевые страницы =="
for p in \
  "https://5mb2.ru/" \
  "https://5mb2.ru/games/requisites" \
  "https://5mb2.ru/games/catalog" \
  "https://neobrain.site/neobrain" \
  "https://neobrain.site/neobrain/requisites" \
  "https://neobrain.site/neobrain/plans" \
  "https://neobrain.site/neobrain/learn" ; do
  c=$(curl -s -o /dev/null -w "%{http_code}" -A "$UA" --max-time 15 "$p")
  echo "  $c  $p"
done

echo ""
echo "== 3. Проверка что новые правки реально встали =="
echo "  -- реквизиты 5mb2 (банковские данные из env):"
curl -s -A "$UA" --max-time 15 "https://5mb2.ru/games/requisites" | grep -oiE "ИНН [0-9]{10,12}|Сундуков|НПД|БИК" | sort -u | head -5
echo "  -- реквизиты neobrain:"
curl -s -A "$UA" --max-time 15 "https://neobrain.site/neobrain/requisites" | grep -oiE "ИНН [0-9]{10,12}|Сундуков|НПД|БИК" | sort -u | head -5

echo ""
echo "== 4. Админка и защита после деплоя =="
c=$(curl -s -o /dev/null -w "%{http_code}" -A "$UA" --max-time 15 "https://neobrain.site/api/admin/leads")
echo "  $c  GET /api/admin/leads (ожидаем 401)"
c=$(curl -s -o /dev/null -w "%{http_code}" -A "$UA" --max-time 15 "https://neobrain.site/neobrain/admin")
echo "  $c  GET /neobrain/admin (ожидаем 302 -> login)"

echo ""
echo "== 5. Логи контейнера (ошибки после старта) =="
docker logs neobrain-web --since 3m 2>&1 | grep -iE "error|exception|EADDRINUSE|Cannot find" | head -10
echo "  (пусто = ошибок нет)"
