#!/bin/bash
# Full auth flow test v2: with CSRF (double-submit cookie)
BASE="https://neobrain.site"
JAR=/tmp/audit-cookies.txt
TS=$(date +%s)
EMAIL="audit${TS}@example.com"
PASS="AuditTest123!"
rm -f "$JAR"

# Obtain CSRF token from cookie jar (curl issues it on first response)
get_csrf() {
  grep -i csrf "$JAR" | tail -1 | awk '{print $NF}'
}

echo "=== 0. Prime cookies (GET login) ==="
curl -s -c "$JAR" -o /dev/null "$BASE/neobrain/login"
CSRF=$(get_csrf)
echo "csrf token length: ${#CSRF}"
[ -n "$CSRF" ] && echo "CSRF-ISSUE: PASS" || echo "CSRF-ISSUE: FAIL"

echo ""
echo "=== 1. Register (expect 200 + ok) ==="
REG=$(curl -s -c "$JAR" -b "$JAR" -X POST "$BASE/api/auth/register" -H "Content-Type: application/json" -H "X-CSRF-Token: $CSRF" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASS\",\"displayName\":\"Audit Test\"}")
echo "$REG" | head -c 300
echo ""
echo "$REG" | grep -q '"ok":true' && echo "REGISTER: PASS" || echo "REGISTER: FAIL"

echo ""
echo "=== 2. me with cookie (expect 200, email matches) ==="
ME=$(curl -s -b "$JAR" "$BASE/api/auth/me")
echo "$ME" | head -c 300
echo ""
echo "$ME" | grep -q "$EMAIL" && echo "ME-AUTH: PASS" || echo "ME-AUTH: FAIL"

echo ""
echo "=== 3. duplicate register (expect 409) ==="
DUP=$(curl -s -o /dev/null -w "%{http_code}" -b "$JAR" -X POST "$BASE/api/auth/register" -H "Content-Type: application/json" -H "X-CSRF-Token: $CSRF" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASS\"}")
echo "dup register -> $DUP (expect 409)"
[ "$DUP" = "409" ] && echo "DUP: PASS" || echo "DUP: FAIL"

echo ""
echo "=== 4. logout (expect 200) ==="
LO=$(curl -s -b "$JAR" -c "$JAR" -X POST "$BASE/api/auth/logout" -H "X-CSRF-Token: $CSRF")
echo "$LO"
echo "$LO" | grep -q '"ok":true' && echo "LOGOUT: PASS" || echo "LOGOUT: FAIL"

echo ""
echo "=== 5. me after logout (expect 401) ==="
ME2=$(curl -s -b "$JAR" -o /dev/null -w "%{http_code}" "$BASE/api/auth/me")
echo "me after logout -> $ME2 (expect 401)"
[ "$ME2" = "401" ] && echo "ME-AFTER-LOGOUT: PASS" || echo "ME-AFTER-LOGOUT: FAIL"

echo ""
echo "=== 6. login wrong password (expect 401) ==="
LW=$(curl -s -o /dev/null -w "%{http_code}" -b "$JAR" -X POST "$BASE/api/auth/login" -H "Content-Type: application/json" -H "X-CSRF-Token: $CSRF" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"WrongPass\"}")
echo "wrong login -> $LW (expect 401)"
[ "$LW" = "401" ] && echo "WRONG-LOGIN: PASS" || echo "WRONG-LOGIN: FAIL"

echo ""
echo "=== 7. login correct (expect 200 + new cookie) ==="
LC=$(curl -s -c "$JAR" -b "$JAR" -X POST "$BASE/api/auth/login" -H "Content-Type: application/json" -H "X-CSRF-Token: $CSRF" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASS\"}")
echo "$LC" | head -c 200
echo ""
echo "$LC" | grep -q '"ok":true' && echo "LOGIN: PASS" || echo "LOGIN: FAIL"

echo ""
echo "=== 8. me after re-login (expect 200) ==="
ME3=$(curl -s -b "$JAR" -o /dev/null -w "%{http_code}" "$BASE/api/auth/me")
echo "me after login -> $ME3 (expect 200)"
[ "$ME3" = "200" ] && echo "ME-RELOGIN: PASS" || echo "ME-RELOGIN: FAIL"

echo ""
echo "=== 9. forgot-password (expect 200, generic message) ==="
FP=$(curl -s -b "$JAR" -X POST "$BASE/api/auth/forgot-password" -H "Content-Type: application/json" -H "X-CSRF-Token: $CSRF" -d "{\"email\":\"$EMAIL\"}")
echo "$FP" | head -c 300
echo ""
echo "$FP" | grep -q '"ok":true' && echo "FORGOT: PASS" || echo "FORGOT: FAIL"

echo ""
echo "=== 10. invalid email register (expect 400) ==="
IV=$(curl -s -o /dev/null -w "%{http_code}" -b "$JAR" -X POST "$BASE/api/auth/register" -H "Content-Type: application/json" -H "X-CSRF-Token: $CSRF" \
  -d "{\"email\":\"not-an-email\",\"password\":\"$PASS\"}")
echo "invalid email -> $IV (expect 400)"
[ "$IV" = "400" ] && echo "VALIDATION: PASS" || echo "VALIDATION: FAIL"

echo ""
echo "=== CLEANUP: remove test user + its sessions from DB ==="
docker exec ai-helper-db psql -U aihelper -d neobrain -c "DELETE FROM sessions WHERE \"userId\" IN (SELECT id FROM users WHERE email LIKE 'audit%@example.com');"
docker exec ai-helper-db psql -U aihelper -d neobrain -c "DELETE FROM users WHERE email LIKE 'audit%@example.com';"
echo "cleanup done"
