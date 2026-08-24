#!/bin/bash
# _media-cover-usage.sh
# Точное использование coverUrl в шаблонах и CSS (размеры/пропорции обложек).
set -e
SRC=/opt/ai-helper/neobrain/services/web/src

echo "=== catalog.ejs (cover) ==="
grep -n "cover\|hero\|img" $SRC/views/games/catalog.ejs | head -30

echo ""
echo "=== game.ejs (cover/og) ==="
grep -n "cover\|og:\|img\|hero" $SRC/views/games/game.ejs | head -40

echo ""
echo "=== CSS: cover-правила ==="
grep -n "\.cover\|hero-cover\|game-card\|object-fit" $SRC/public/games/css/style.css | head -40
