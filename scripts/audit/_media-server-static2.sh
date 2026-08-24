#!/bin/bash
# _media-server-static2.sh
# Реальная структура статики + контракты coverUrl.
set -e
SRC=/opt/ai-helper/neobrain/services/web/src

echo "=== src/public tree (dirs+files, имена) ==="
find $SRC/public -maxdepth 4 -type f 2>/dev/null | sed "s|$SRC/public/||" | head -80
echo "--- dirs ---"
find $SRC/public -maxdepth 4 -type d 2>/dev/null | sed "s|$SRC/public||" | head -40

echo ""
echo "=== где живут play-файлы игр ==="
find $SRC/public/games -maxdepth 3 2>/dev/null | head -40

echo ""
echo "=== uploadController.js ==="
cat $SRC/controllers/uploadController.js 2>/dev/null | head -80

echo ""
echo "=== как coverUrl задаётся в admin.js (валидация/сохранение) ==="
grep -n "coverUrl\|/static/games/img\|uploads" $SRC/routes/admin.js

echo ""
echo "=== coverUrl в шаблонах ==="
grep -rn "coverUrl\|static/games/img" $SRC/views/games/ $SRC/views/partials/ 2>/dev/null | head -40

echo ""
echo "=== /data/uploads ==="
ls -la /data/uploads 2>/dev/null | head -20 || echo "нет /data/uploads"
