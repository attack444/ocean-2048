#!/bin/bash
# _media-neobrain-dump.sh
# Дамп структуры вьюх neobrain для вставки иллюстраций + палитра CSS.
SRC=/opt/ai-helper/neobrain/services/web/src

echo "=== head.ejs: строки 95-200 (шапка/бренд) ==="
sed -n '95,200p' $SRC/views/partials/head.ejs

echo ""
echo "=== foot.ejs: строки 1-60 (футер) ==="
sed -n '1,60p' $SRC/views/partials/foot.ejs

echo ""
echo "=== neobrain CSS: цвета/переменные ==="
find $SRC/public -path '*neobrain*' -name '*.css' -o -path '*neobrain*' -name '*.scss' 2>/dev/null | head
echo "--- цвета в neobrain css ---"
grep -rho "#[0-9a-fA-F]\{3,6\}\b" $SRC/public/neobrain/ 2>/dev/null | sort | uniq -c | sort -rn | head -25

echo ""
echo "=== home.ejs: первые 90 строк ==="
sed -n '1,90p' $SRC/views/neobrain/home.ejs

echo ""
echo "=== uslugi.ejs: первые 90 строк ==="
sed -n '1,90p' $SRC/views/neobrain/uslugi.ejs

echo ""
echo "=== plans.ejs: первые 90 строк ==="
sed -n '1,90p' $SRC/views/neobrain/plans.ejs
