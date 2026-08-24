#!/bin/bash
# Forms test v2: correct review payload + proper cleanup
BASE="https://neobrain.site"
JAR=/tmp/audit-cookies.txt
TS=$(date +%s)
rm -f "$JAR"

curl -s -c "$JAR" -o /dev/null "$BASE/neobrain/login"
CSRF=$(grep -i csrf "$JAR" | tail -1 | awk '{print $NF}')

echo "=== 1. Review POST /api/reviews with correct payload (expect 201) ==="
REV=$(curl -s -b "$JAR" -X POST "$BASE/api/reviews" -H "Content-Type: application/json" -H "X-CSRF-Token: $CSRF" \
  -d "{\"name\":\"Audit\",\"rating\":5,\"text\":\"Автотест отзыва — можно удалить\",\"source\":\"uslugi\"}")
echo "$REV" | head -c 300
echo ""

echo "=== 2. Honeypot: review with website field (expect 201 silent ok, NOT saved) ==="
HP=$(curl -s -b "$JAR" -X POST "$BASE/api/reviews" -H "Content-Type: application/json" -H "X-CSRF-Token: $CSRF" \
  -d "{\"name\":\"Bot\",\"rating\":5,\"text\":\"spam spam spam spam\",\"website\":\"http://spam.example\"}")
echo "$HP" | head -c 200
echo ""

echo "=== 3. GET approved reviews (public) ==="
curl -s "$BASE/api/reviews?source=uslugi" | head -c 300
echo ""

echo "=== CLEANUP: remove test reviews (pending, name Audit) ==="
docker exec ai-helper-db psql -U aihelper -d neobrain -c "DELETE FROM reviews WHERE name = 'Audit' AND status='pending';"
echo "cleanup done"
