#!/bin/bash
echo "=== ROBOKASSA env keys (names only, values masked) ==="
grep -iE "robokassa" /opt/ai-helper/project/.env | sed -E 's/=(.*)/=<set>/' 
echo ""
echo "=== config.js robokassa section (full) ==="
W=/opt/ai-helper/neobrain/services/web/src
sed -n '40,80p' "$W/config.js"
echo ""
echo "=== isRobokassaConfigured ==="
sed -n '115,135p' "$W/config.js"
