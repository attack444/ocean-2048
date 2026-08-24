#!/bin/bash
# _media-neobrain-verify.sh
# Проверка корректности правок neobrain до деплоя: EJS-парсинг + логика.
set -e
SRC=/opt/ai-helper/neobrain/services/web/src

echo "=== 1. EJS-файлы: проверка сбалансированности <%/ %> и <%- %> ==="
for f in views/partials/head.ejs views/partials/foot.ejs views/neobrain/home.ejs views/neobrain/uslugi.ejs views/neobrain/plans.ejs; do
  opens=$(grep -o '<%' "$SRC/$f" | wc -l)
  closes=$(grep -o '%>' "$SRC/$f" | wc -l)
  echo "  $f : <% = $opens , %> = $closes $([ "$opens" -eq "$closes" ] && echo 'OK' || echo '!!! MISMATCH')"
done

echo ""
echo "=== 2. Новые вставки на месте ==="
echo "  head: $(grep -c 'logo-neobrain.svg' $SRC/views/partials/head.ejs) раз(а) логотип в шапке"
echo "  head og: $(grep -c 'og-neobrain.png' $SRC/views/partials/head.ejs) раз(а) og"
echo "  foot: $(grep -c 'logo-neobrain.svg' $SRC/views/partials/foot.ejs) раз(а) логотип в футере"
echo "  home: $(grep -c 'ill-home.png' $SRC/views/neobrain/home.ejs) раз(а) ill-home"
echo "  uslugi: $(grep -c 'ill-uslugi.png' $SRC/views/neobrain/uslugi.ejs) раз(а) ill-uslugi"
echo "  plans: $(grep -c 'ill-plans.png' $SRC/views/neobrain/plans.ejs) раз(а) ill-plans"
echo "  css: $(grep -c 'hero-visual' $SRC/public/neobrain/css/style.css) раз(а) hero-visual"

echo ""
echo "=== 3. Быстрый EJS-компилятор (node, ejs из node_modules сервиса) ==="
cd $SRC/../..
if [ -d node_modules/ejs ]; then
  for f in views/neobrain/home.ejs views/neobrain/uslugi.ejs views/neobrain/plans.ejs views/partials/head.ejs views/partials/foot.ejs; do
    node -e "const fs=require('fs');const ejs=require('ejs');const src=fs.readFileSync('services/web/src/$f','utf8');try{ejs.compile(src,{filename:'services/web/src/$f'});console.log('  OK  $f')}catch(e){console.log('  FAIL $f: '+e.message)}"
  done
else
  echo "  (node_modules/ejs нет — пропускаю компиляцию, только статическая проверка)"
fi

echo ""
echo "=== 4. python3 для следующих шагов ==="
python3 --version || echo "нет python3"
echo "DONE"
