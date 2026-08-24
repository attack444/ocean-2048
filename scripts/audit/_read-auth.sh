#!/bin/bash
W=/opt/ai-helper/neobrain/services/web/src
echo "=== authController.js ==="
cat "$W/controllers/authController.js" 2>/dev/null | head -200
echo ""
echo "=== mail/smtp util (if exists) ==="
ls "$W/lib" 2>/dev/null
find "$W" -name "*mail*" -o -name "*email*" 2>/dev/null | grep -v node_modules | head
