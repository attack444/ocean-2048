#!/bin/bash
# _media-neobrain-css.sh
# Фирменные цвета и стили brand/hero/hero-demo для генерации ассетов neobrain.
SRC=/opt/ai-helper/neobrain/services/web/src
CSS=$SRC/public/neobrain/css/style.css

echo "=== :root переменные ==="
grep -n ":root" -A 25 $CSS | head -40

echo ""
echo "=== .brand / brand-emoji / brand-text ==="
grep -n "\.brand\|brand-emoji\|brand-text" $CSS | head -20

echo ""
echo "=== .hero / .hero-demo / .demo- (основные цвета/фон) ==="
grep -n "\.hero\b\|\.hero-demo\|\.demo-bar\|\.demo-msg\|\.demo-status" $CSS | head -20

echo ""
echo "=== sections стили ==="
grep -n "\.hero {" -A 15 $CSS | head -30

echo ""
echo "=== btn/btn-cta/btn-primary цвета ==="
grep -n "\.btn-cta\|\.btn\.primary\|\.btn {" $CSS | head -10
grep -n "\.btn-cta" -A 10 $CSS | head -20
