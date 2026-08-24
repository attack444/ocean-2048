#!/bin/bash
# _media-check-video.sh
# Поддержка видео/трейлера на странице игры и как рендерятся релизы (coverUrl).
set -e
SRC=/opt/ai-helper/neobrain/services/web/src

echo "=== video/trailer/play в views/games ==="
grep -rn "video\|trailer\|<video\|playUrl\|/play/" $SRC/views/games/*.ejs | head -30

echo ""
echo "=== релизы: где рендерятся и coverUrl ==="
grep -rln "release" $SRC/views/ | head
grep -rn "release.coverUrl\|r.coverUrl\|coverUrl" $SRC/views/partials/*.ejs $SRC/views/games/*.ejs 2>/dev/null | head -20

echo ""
echo "=== как выглядит game.ejs полностью (структура, без содержимого картинок) ==="
wc -l $SRC/views/games/game.ejs
sed -n '1,60p' $SRC/views/games/game.ejs

echo ""
echo "=== есть ли уже covers/media каталоги ==="
ls -la $SRC/public/games/img/ 2>/dev/null
ls -la $SRC/public/games/media 2>/dev/null || echo "нет media/"
