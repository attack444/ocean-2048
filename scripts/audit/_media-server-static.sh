#!/bin/bash
# _media-server-static.sh
# Как устроен статик-контент 5mb2/neobrain: куда класть обложки, как работает upload.
set -e
SRC=/opt/ai-helper/neobrain/services/web/src

echo "=== static mount (app.js) ==="
grep -n "express.static\|/static\|public" $SRC/app.js || echo "not found in app.js"

echo ""
echo "=== upload/static in admin.js ==="
grep -n "upload\|multer\|coverUrl\|static/games\|static/" $SRC/routes/admin.js || echo "none"

echo ""
echo "=== public dir structure ==="
find /opt/ai-helper/neobrain/services/web -maxdepth 3 -type d -name "public" 2>/dev/null
ls -la /opt/ai-helper/neobrain/services/web/public 2>/dev/null || echo "no /public"

echo ""
echo "=== static/games content ==="
ls -laR /opt/ai-helper/neobrain/services/web/public/static/games 2>/dev/null | head -60 || echo "no static/games"

echo ""
echo "=== any cover/og images anywhere ==="
find /opt/ai-helper/neobrain/services/web/public -type f \( -name "*.png" -o -name "*.jpg" -o -name "*.jpeg" -o -name "*.webp" -o -name "*.svg" \) 2>/dev/null | head -60
