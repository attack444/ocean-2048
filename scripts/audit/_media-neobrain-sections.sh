#!/bin/bash
# _media-neobrain-sections.sh
# Точные фрагменты для правок: шапка/футер + зоны вставки иллюстраций.
SRC=/opt/ai-helper/neobrain/services/web/src

echo "=== head.ejs 1-25 (оглавление + og + logo schema) ==="
sed -n '1,25p' $SRC/views/partials/head.ejs

echo ""
echo "=== head.ejs 108-125 (бренд в шапке) ==="
sed -n '108,125p' $SRC/views/partials/head.ejs

echo ""
echo "=== foot.ejs 45-95 (футер neobrain) ==="
sed -n '45,95p' $SRC/views/partials/foot.ejs

echo ""
echo "=== home.ejs 198-225 (герой главной) ==="
sed -n '198,225p' $SRC/views/neobrain/home.ejs

echo ""
echo "=== uslugi.ejs 290-330 (герой uslugi) ==="
sed -n '290,330p' $SRC/views/neobrain/uslugi.ejs

echo ""
echo "=== plans.ejs начало ==="
sed -n '1,12p' $SRC/views/neobrain/plans.ejs

echo ""
echo "=== CSS: hero-demo/hero::before/hero::after (для вставки картинки) ==="
grep -n "hero::before" -A 8 $SRC/public/neobrain/css/style.css
grep -n "\.hero .hero-visual\|hero-visual" $SRC/public/neobrain/css/style.css || echo "(класса hero-visual нет)"
