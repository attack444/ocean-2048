#!/bin/bash
# ЭТАП 3, todo #12: реальная работа POST-функций neobrain с CSRF-флоу (double-submit cookie)
# (без CSRF-токена все POST отдают 403 — это защита; здесь проверяем, что С токеном они работают)
UA="Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
BASE="https://neobrain.site"
TMP=/tmp/nb-csrf
rm -rf "$TMP"; mkdir -p "$TMP"

# 1. Берём страницу, чтобы получить csrf-cookie
curl -s -c "$TMP/cookies.txt" -A "$UA" --max-time 20 "$BASE/neobrain" -o /dev/null
TOKEN=$(grep -E '\scsrf\s' "$TMP/cookies.txt" | awk '{print $NF}')
echo "csrf-cookie: ${TOKEN:0:12}... (len ${#TOKEN})"
if [ -z "$TOKEN" ]; then
  echo "  !!! csrf-cookie не получена"
fi

post() { # $1=path $2=json
  curl -s -b "$TMP/cookies.txt" -c "$TMP/cookies.txt" -A "$UA" --max-time 40 \
    -X POST "$BASE$1" -H "Content-Type: application/json" \
    -H "X-CSRF-Token: $TOKEN" -d "$2" -o "$TMP/out.txt" -w "  %{http_code}"
}

echo ""
echo "=== 1. SEO-инструменты ==="
echo -n "  /api/seo/quick-check -> "; post "/api/seo/quick-check" '{"url":"https://5mb2.ru/"}'
echo ""; head -c 700 "$TMP/out.txt"; echo ""; echo ""
echo -n "  /api/seo/meta -> "; post "/api/seo/meta" '{"title":"Тест SEO","description":"Описание для теста"}'
echo ""; head -c 700 "$TMP/out.txt"; echo ""

echo ""
echo "=== 2. ИИ-агент: quote ==="
echo -n "  /api/agent/quote -> "; post "/api/agent/quote" '{"task":"Проверка quote для аудита"}'
echo ""; head -c 700 "$TMP/out.txt"; echo ""

echo ""
echo "=== 3. Формы (уже в ЭТАПЕ 1, контроль) ==="
echo -n "  /api/leads -> "; post "/api/leads" '{"name":"Аудит","phone":"+79990000000","message":"тест csrf"}'
echo ""
echo -n "  /api/support/ask -> "; post "/api/support/ask" '{"question":"Тест поддержки csrf"}'
echo ""
