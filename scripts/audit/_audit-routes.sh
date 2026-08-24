#!/bin/bash
# Dump all API route definitions from route files
W=/opt/ai-helper/neobrain/services/web/src

echo "=== 1. neobrain.js: all router/api route defs ==="
grep -nE '\.(get|post|put|delete|patch)\(' "$W/routes/neobrain.js" | grep -vE '^\s*//' | head -120

echo ""
echo "=== 2. games.js: all router/api route defs ==="
grep -nE '\.(get|post|put|delete|patch)\(' "$W/routes/games.js" | grep -vE '^\s*//' | head -80

echo ""
echo "=== 3. app.js: API mounting (games) ==="
grep -n "api\|/api\|games" "$W/app.js" | grep -iE "use|api" | head -40
