#!/bin/bash
# Find source of js-basics link + verify learn routes + prisma migrate status
W=/opt/ai-helper/neobrain/services/web/src

echo "=== 1. grep js-basics across whole src (non-binary) ==="
grep -rn "js-basics" "$W" 2>/dev/null || echo "NOT FOUND in src"

echo ""
echo "=== 2. grep js-basics across whole project dir (top 20) ==="
grep -rn "js-basics" /opt/ai-helper/neobrain 2>/dev/null | grep -v node_modules | grep -v ".git/" | head -20 || echo "NOT FOUND outside node_modules"

echo ""
echo "=== 3. Learn routes in neobrain.js ==="
grep -n "learn" "$W/routes/neobrain.js" | head -40

echo ""
echo "=== 4. Prisma migrate status from /app/prisma ==="
docker exec -w /app/prisma neobrain-web sh -c 'node ../node_modules/.bin/prisma migrate status 2>&1 | grep -v "^warn" | head -30'

echo ""
echo "=== 5. Check learn_profiles + lesson_progress ==="
docker exec ai-helper-db psql -U aihelper -d neobrain -c 'SELECT count(*) FROM learn_profiles;' -c 'SELECT count(*) FROM lesson_progress;'

echo ""
echo "=== 6. sessions / password_reset_tokens counts ==="
docker exec ai-helper-db psql -U aihelper -d neobrain -c 'SELECT count(*) FROM sessions;' -c 'SELECT count(*) FROM password_reset_tokens;'
