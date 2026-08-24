#!/bin/bash
# _media-neobrain-head.sh
# Аудит head/og/логотипа neobrain: как задаётся og:image, есть ли логотип.
set -e
SRC=/opt/ai-helper/neobrain/services/web/src

echo "=== head.ejs neobrain (og:image / logo) ==="
grep -n "og:\|ogImage\|logo\|/static/neobrain/img\|favicon" $SRC/views/partials/head.ejs | head -40

echo ""
echo "=== какие страницы передают ogImage ==="
grep -rn "ogImage" $SRC/views/ $SRC/routes/ 2>/dev/null | head -20

echo ""
echo "=== img/ neobrain (логотип? иконки) ==="
ls -la $SRC/public/neobrain/img/

echo ""
echo "=== логотип в шапке/футере ==="
grep -rn "logo\|<svg\|<img" $SRC/views/partials/*.ejs $SRC/views/neobrain/*.ejs 2>/dev/null | head -30
