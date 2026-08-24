#!/bin/bash
W=/opt/ai-helper/neobrain/services/web/src
echo "=== robokassa.js ==="
cat "$W/robokassa.js" 2>/dev/null
echo ""
echo "=== config.js: payments + robokassa section ==="
grep -n "robokassa\|Robokassa\|payments\|TEST_MODE\|isRobokassaConfigured\|educationAmountsRub\|assetSourcePriceRub" "$W/config.js" 2>/dev/null | head -40
