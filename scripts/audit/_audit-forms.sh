#!/bin/bash
# Public forms + cabinet access test
BASE="https://neobrain.site"
JAR=/tmp/audit-cookies.txt
TS=$(date +%s)
EMAIL="audit${TS}@example.com"
PASS="AuditTest123!"
rm -f "$JAR"

curl -s -c "$JAR" -o /dev/null "$BASE/neobrain/login"
CSRF=$(grep -i csrf "$JAR" | tail -1 | awk '{print $NF}')

echo "=== 1. Lead form POST /api/leads (public, expect 200) ==="
LEAD=$(curl -s -b "$JAR" -X POST "$BASE/api/leads" -H "Content-Type: application/json" -H "X-CSRF-Token: $CSRF" \
  -d "{\"name\":\"Audit Lead\",\"contact\":\"audit-lead@example.com\",\"message\":\"Автотест формы заявки\"}")
echo "$LEAD" | head -c 300
echo ""

echo ""
echo "=== 2. Review form POST /api/reviews (public, expect 200) ==="
REV=$(curl -s -b "$JAR" -X POST "$BASE/api/reviews" -H "Content-Type: application/json" -H "X-CSRF-Token: $CSRF" \
  -d "{\"author\":\"Audit\",\"rating\":5,\"text\":\"Автотест отзыва\"}")
echo "$REV" | head -c 300
echo ""

echo ""
echo "=== 3. Support form POST /api/support/ask (public, expect 200) ==="
SUP=$(curl -s -b "$JAR" -X POST "$BASE/api/support/ask" -H "Content-Type: application/json" -H "X-CSRF-Token: $CSRF" \
  -d "{\"email\":\"audit-support@example.com\",\"topic\":\"question\",\"message\":\"Автотест обращения в поддержку\"}")
echo "$SUP" | head -c 300
echo ""

echo ""
echo "=== 4. Register + login for cabinet test ==="
curl -s -c "$JAR" -b "$JAR" -X POST "$BASE/api/auth/register" -H "Content-Type: application/json" -H "X-CSRF-Token: $CSRF" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASS\"}" >/dev/null

echo "cabinet (auth) -> $(curl -s -b "$JAR" -o /dev/null -w "%{http_code}" "$BASE/neobrain/cabinet")  (expect 200)"
echo "projects (auth) -> $(curl -s -b "$JAR" -o /dev/null -w "%{http_code}" "$BASE/neobrain/projects")  (expect 200)"
echo "seo (auth)      -> $(curl -s -b "$JAR" -o /dev/null -w "%{http_code}" "$BASE/neobrain/seo")  (expect 200)"
echo "reports (auth)  -> $(curl -s -b "$JAR" -o /dev/null -w "%{http_code}" "$BASE/neobrain/reports")  (expect 200)"
echo "agent settings  -> $(curl -s -b "$JAR" -o /dev/null -w "%{http_code}" "$BASE/api/agent/settings")  (expect 200)"

echo ""
echo "=== 5. subscription status (auth, expect 200) ==="
curl -s -b "$JAR" "$BASE/api/subscription/me" | head -c 300
echo ""

echo ""
echo "=== CLEANUP: remove test data ==="
docker exec ai-helper-db psql -U aihelper -d neobrain -c "DELETE FROM sessions WHERE \"userId\" IN (SELECT id FROM users WHERE email LIKE 'audit%@example.com');"
docker exec ai-helper-db psql -U aihelper -d neobrain -c "DELETE FROM users WHERE email LIKE 'audit%@example.com';"
docker exec ai-helper-db psql -U aihelper -d neobrain -c "DELETE FROM leads WHERE contact LIKE 'audit-lead%' OR contact LIKE 'audit%@example.com';"
docker exec ai-helper-db psql -U aihelper -d neobrain -c "DELETE FROM reviews WHERE author = 'Audit';"
docker exec ai-helper-db psql -U aihelper -d neobrain -c "DELETE FROM support_tickets WHERE email LIKE 'audit-support%';"
echo "cleanup done"
