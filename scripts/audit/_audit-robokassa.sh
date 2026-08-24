#!/bin/bash
# Robokassa full cycle test (test mode): checkout -> simulate Result URL -> verify activation
BASE="https://neobrain.site"
JAR=/tmp/audit-cookies.txt
TS=$(date +%s)
EMAIL="auditpay${TS}@example.com"
PASS="AuditPay123!"
rm -f "$JAR"

# Read Pass2 from env on server (needed to compute Result URL signature)
P2=$(grep -E '^ROBOKASSA_PASSWORD2=' /opt/ai-helper/project/.env | cut -d= -f2-)
echo "Pass2 present: $([ -n "$P2" ] && echo yes || echo NO)"

curl -s -c "$JAR" -o /dev/null "$BASE/neobrain/login"
CSRF=$(grep -i csrf "$JAR" | tail -1 | awk '{print $NF}')

echo "=== 1. Register payer ==="
curl -s -c "$JAR" -b "$JAR" -X POST "$BASE/api/auth/register" -H "Content-Type: application/json" -H "X-CSRF-Token: $CSRF" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASS\"}" >/dev/null
echo "registered: $EMAIL"

echo ""
echo "=== 2. Checkout starter subscription (expect 200 + paymentUrl) ==="
CHK=$(curl -s -b "$JAR" -X POST "$BASE/api/payments/checkout" -H "Content-Type: application/json" -H "X-CSRF-Token: $CSRF" \
  -d "{\"product\":\"subscription_starter\",\"site\":\"neobrain\"}")
echo "$CHK" | head -c 600
echo ""
INVID=$(echo "$CHK" | sed -n 's/.*"invId":\([0-9]*\).*/\1/p')
echo "invId=$INVID"

echo ""
echo "=== 3. payment status endpoint (public) ==="
curl -s "$BASE/api/payments/status" | head -c 400
echo ""

echo ""
echo "=== 4. Check payment row is pending in DB ==="
docker exec ai-helper-db psql -U aihelper -d neobrain -c "SELECT \"invId\", \"amountRub\", status, \"productType\" FROM payments WHERE \"invId\"=$INVID;"

echo ""
echo "=== 5. Simulate Robokassa Result URL (success) ==="
OUTSUM=$(docker exec ai-helper-db psql -U aihelper -d neobrain -t -A -c "SELECT \"amountRub\" FROM payments WHERE \"invId\"=$INVID;")
PAYID=$(docker exec ai-helper-db psql -U aihelper -d neobrain -t -A -c "SELECT id FROM payments WHERE \"invId\"=$INVID;")
USERID=$(docker exec ai-helper-db psql -U aihelper -d neobrain -t -A -c "SELECT \"userId\" FROM sessions WHERE token IN (SELECT token FROM sessions WHERE \"userId\"=(SELECT id FROM users WHERE email='$EMAIL') LIMIT 1) LIMIT 1;")
[ -z "$USERID" ] && USERID=$(docker exec ai-helper-db psql -U aihelper -d neobrain -t -A -c "SELECT id FROM users WHERE email='$EMAIL';")
echo "outSum=$OUTSUM paymentId=$PAYID userId=$USERID"
# Result URL signature: md5(OutSum:InvId:Pass2:Shp_paymentId=..:Shp_userId=..)
SIG=$(node -e "const c=require('crypto');const s='$OUTSUM:$INVID:$P2:Shp_paymentId=$PAYID:Shp_userId=$USERID';console.log(c.createHash('md5').update(s,'utf8').digest('hex'));")
RESULT=$(curl -s -X POST "$BASE/api/payments/robokassa/result" \
  --data-urlencode "OutSum=$OUTSUM" \
  --data-urlencode "InvId=$INVID" \
  --data-urlencode "SignatureValue=$SIG" \
  --data-urlencode "Shp_paymentId=$PAYID" \
  --data-urlencode "Shp_userId=$USERID")
echo "result response: $RESULT"
echo "$RESULT" | grep -q "OK$INVID" && echo "RESULT-URL: PASS" || echo "RESULT-URL: FAIL"

echo ""
echo "=== 6. Verify payment succeeded + subscription activated ==="
docker exec ai-helper-db psql -U aihelper -d neobrain -c "SELECT \"invId\", \"amountRub\", status, \"confirmedAt\" FROM payments WHERE \"invId\"=$INVID;"
docker exec ai-helper-db psql -U aihelper -d neobrain -c "SELECT s.plan, s.status, s.\"autoRenew\", s.\"expiresAt\" FROM subscriptions s JOIN users u ON s.\"userId\"=u.id WHERE u.email='$EMAIL';"

echo ""
echo "=== 7. Bad signature test (expect 403) ==="
BAD=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/api/payments/robokassa/result" \
  --data-urlencode "OutSum=$OUTSUM" --data-urlencode "InvId=$INVID" \
  --data-urlencode "SignatureValue=deadbeef" \
  --data-urlencode "Shp_paymentId=$PAYID" --data-urlencode "Shp_userId=$USERID")
echo "bad signature -> $BAD (expect 403)"
[ "$BAD" = "403" ] && echo "BAD-SIG: PASS" || echo "BAD-SIG: FAIL"

echo ""
echo "=== CLEANUP ==="
docker exec ai-helper-db psql -U aihelper -d neobrain -c "DELETE FROM payments WHERE id='$PAYID';"
docker exec ai-helper-db psql -U aihelper -d neobrain -c "DELETE FROM sessions WHERE \"userId\" IN (SELECT id FROM users WHERE email='$EMAIL');"
docker exec ai-helper-db psql -U aihelper -d neobrain -c "DELETE FROM subscriptions WHERE \"userId\" IN (SELECT id FROM users WHERE email='$EMAIL');"
docker exec ai-helper-db psql -U aihelper -d neobrain -c "DELETE FROM users WHERE email='$EMAIL';"
echo "cleanup done"
