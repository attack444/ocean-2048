#!/bin/bash
W=/opt/ai-helper/neobrain/services/web/src

echo "=== 1. review schema (controller) ==="
grep -rn "createSchema" "$W/controllers/" 2>/dev/null | head
echo "--- review controller ---"
cat "$W/controllers/reviewController.js" 2>/dev/null | head -80

echo ""
echo "=== 2. reviews table columns ==="
docker exec ai-helper-db psql -U aihelper -d neobrain -c '\d reviews'

echo ""
echo "=== 3. support_tickets table columns ==="
docker exec ai-helper-db psql -U aihelper -d neobrain -c '\d support_tickets'

echo ""
echo "=== 4. leads table columns ==="
docker exec ai-helper-db psql -U aihelper -d neobrain -c '\d leads'
