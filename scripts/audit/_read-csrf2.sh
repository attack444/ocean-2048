#!/bin/bash
W=/opt/ai-helper/neobrain/services/web/src

echo "=== 1. middleware/security.js ==="
cat "$W/middleware/security.js" 2>/dev/null | head -220

echo ""
echo "=== 2. how common.js gets csrf ==="
grep -n "csrf\|CSRF" "$W/public/neobrain/js/common.js" 2>/dev/null | head -30
echo "--- common.js head ---"
head -40 "$W/public/neobrain/js/common.js" 2>/dev/null
