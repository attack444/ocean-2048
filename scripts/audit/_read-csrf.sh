#!/bin/bash
W=/opt/ai-helper/neobrain/services/web/src

echo "=== 1. grep csrf in src (files) ==="
grep -rln "csrf" "$W" --include=*.js --include=*.ejs 2>/dev/null | grep -v node_modules

echo ""
echo "=== 2. middleware/auth.js ==="
cat "$W/middleware/auth.js" 2>/dev/null | head -160

echo ""
echo "=== 3. grep csrf in app.js ==="
grep -n "csrf" "$W/app.js" 2>/dev/null
