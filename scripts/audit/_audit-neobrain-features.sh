#!/bin/bash
# ЭТАП 3, todo #12: функциональность ключевых разделов neobrain
# ИИ-агент / деплой / SEO-инструменты / обучение / тарифы (публичные + лёгкие POST-проверки)
UA="Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
BASE="https://neobrain.site"
TMP=/tmp/nb-features
rm -rf "$TMP"; mkdir -p "$TMP"

echo "=== 1. Healthcheck ==="
curl -s -o /dev/null -w "  /health -> %{http_code}\n" "$BASE/health"
curl -s -o /dev/null -w "  /neobrain/health -> %{http_code}\n" "$BASE/neobrain/health"

echo ""
echo "=== 2. Ключевые разделы (страницы 200) ==="
for u in /neobrain/chat /neobrain/plans /neobrain/seo-tools /neobrain/learn /neobrain/uslugi /neobrain/guides/first-apk; do
  c=$(curl -s -o /dev/null -w "%{http_code}" -A "$UA" --max-time 20 "$BASE$u")
  echo "  $c  $u"
done

echo ""
echo "=== 3. Обучение: API списка курсов + выборочные страницы ==="
curl -s -A "$UA" --max-time 20 "$BASE/api/learn/courses" -o "$TMP/courses.json"
python3 - "$TMP/courses.json" <<'PYEOF'
import json, sys
try:
    d = json.load(open(sys.argv[1], encoding='utf-8'))
except Exception as e:
    print("  НЕ JSON:", e); sys.exit(0)
if isinstance(d, dict):
    d = d.get("courses", d.get("data", []))
print("  Курсов в API: %d" % len(d))
for c in d[:20]:
    print("   -", c.get("slug"), "|", c.get("title"))
PYEOF
for slug in python-start project-todo production-capacitor git-devops; do
  c=$(curl -s -o /dev/null -w "%{http_code}" -A "$UA" --max-time 20 "$BASE/neobrain/learn/$slug")
  echo "  $c  /neobrain/learn/$slug"
done

echo ""
echo "=== 4. Тарифы: страница + публичные данные ==="
curl -s -A "$UA" --max-time 20 "$BASE/neobrain/plans" -o "$TMP/plans.html"
for name in "Free" "Starter" "Pro"; do
  n=$(grep -c "$name" "$TMP/plans.html")
  echo "  тариф '$name' упоминаний на странице: $n"
done
# продукты из checkout (без реальной оплаты — только описание доступных продуктов)
grep -oE 'subscription_(starter|pro)|education_support|asset_source' "$TMP/plans.html" 2>/dev/null | sort -u

echo ""
echo "=== 5. SEO-инструменты: POST-проверка (реальная работа) ==="
echo "-- /api/seo/quick-check (POST) --"
curl -s -A "$UA" --max-time 30 -X POST "$BASE/api/seo/quick-check" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://5mb2.ru/"}' -o "$TMP/quick.json" -w "  HTTP %{http_code}\n"
head -c 600 "$TMP/quick.json"; echo ""
echo ""
echo "-- /api/seo/meta (POST) --"
curl -s -A "$UA" --max-time 30 -X POST "$BASE/api/seo/meta" \
  -H "Content-Type: application/json" \
  -d '{"title":"Тест SEO","description":"Описание для теста"}' -o "$TMP/meta.json" -w "  HTTP %{http_code}\n"
head -c 600 "$TMP/meta.json"; echo ""

echo ""
echo "=== 6. ИИ-агент: quote (цена запроса) ==="
curl -s -A "$UA" --max-time 30 -X POST "$BASE/api/agent/quote" \
  -H "Content-Type: application/json" \
  -d '{"task":"Проверка quote"}' -o "$TMP/quote.json" -w "  HTTP %{http_code}\n"
head -c 500 "$TMP/quote.json"; echo ""
echo "-- /api/agent/settings (GET) — требуется логин (ожидаем 401) --"
curl -s -o /dev/null -w "  HTTP %{http_code}\n" -A "$UA" --max-time 20 "$BASE/api/agent/settings"

echo ""
echo "=== 7. Деплой: /api/github/auth-url (GET) ==="
curl -s -o /dev/null -w "  HTTP %{http_code}\n" -A "$UA" --max-time 20 "$BASE/api/github/auth-url"

echo ""
echo "=== 8. Формы (POST уже покрыты в ЭТАПЕ 1): leads/reviews/support ==="
for ep in /api/leads /api/reviews /api/support/ask; do
  c=$(curl -s -o /dev/null -w "%{http_code}" -X POST -A "$UA" --max-time 20 -H "Content-Type: application/json" \
    -d '{"name":"t","email":"t@t.ru","text":"тест аудита","message":"тест аудита"}' "$BASE$ep")
  echo "  $c  $ep (POST)"
done
