#!/bin/bash
# _media-neobrain-og.sh
# Проверка: что реально отдаёт neobrain.site в og:image + метаданные og-default.jpg + логотип в шапке/футере.
SRC=/opt/ai-helper/neobrain/services/web/src

echo "=== live og:image на главной neobrain.site ==="
curl -s https://neobrain.site/ | grep -o '<meta property="og:image"[^>]*>' | head -5 || echo "(нет og:image)"

echo ""
echo "=== live twitter:image ==="
curl -s https://neobrain.site/ | grep -o '<meta name="twitter:image"[^>]*>' | head -5 || echo "(нет twitter:image)"

echo ""
echo "=== img/neobrain содержимое (метаданные) ==="
ls -la $SRC/public/neobrain/img/

echo ""
echo "=== live og-default.jpg http ==="
curl -s -o /dev/null -w "static/neobrain/img/og-default.jpg -> %{http_code} %{content_type} %{size_download} bytes\n" https://neobrain.site/static/neobrain/img/og-default.jpg || echo "(ошибка)"

echo ""
echo "=== структура views: partials / neobrain ==="
ls $SRC/views/partials/ 2>/dev/null || true
echo "---"
ls $SRC/views/neobrain/ 2>/dev/null || true

echo ""
echo "=== футер/шапка neobrain: логотип/брендинг ==="
grep -rn "NeoBrain\|5MB2\|logo" $SRC/views/partials/ 2>/dev/null | head -30 || true
