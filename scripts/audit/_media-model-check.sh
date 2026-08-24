#!/bin/bash
# ЭТАП 6, todo #16: точная модель Prisma для games + её поля
R=/opt/ai-helper/neobrain
S="$R/services/web/prisma/schema.prisma"
[ -f "$S" ] || S="$R/prisma/schema.prisma"

echo "== 1. Где схема =="
ls -1 "$S" 2>/dev/null && echo "---" || find "$R" -name schema.prisma -not -path "*/node_modules/*" 2>/dev/null

echo ""
echo "== 2. Имена моделей =="
grep -nE "^model [A-Za-z]+" "$S" 2>/dev/null

echo ""
echo "== 3. Модель игры (полностью) =="
grep -nA 40 "model .*[Gg]ame" "$S" 2>/dev/null | head -80
