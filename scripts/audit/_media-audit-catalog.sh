#!/bin/bash
# ЭТАП 6, todo #16: как каталог игр рендерит обложки + фоновые картинки в CSS + поля games в БД
W=/opt/ai-helper/neobrain/services/web/src

echo "== 1. Вьюха каталога (обложки) =="
grep -nE "cover|img|image|background|src=|poster|thumbnail|screenshot" "$W/views/games/catalog.ejs" 2>/dev/null | head -30

echo ""
echo "== 2. Вьюха карточки игры (game.ejs) =="
grep -nE "cover|img|image|background|src=|poster|thumbnail|screenshot" "$W/views/games/game.ejs" 2>/dev/null | head -30

echo ""
echo "== 3. Обложки/фоны в CSS игр =="
grep -nE "url\(|background-image|\.cover|img\b" "$W/public/games/css/style.css" 2>/dev/null | head -30

echo ""
echo "== 4. Поля games в схеме Prisma =="
grep -nA 30 "model Games\b\|model Game\b" "$W/../prisma/schema.prisma" 2>/dev/null | head -40
grep -nE "model " "$W/../prisma/schema.prisma" 2>/dev/null | head -20

echo ""
echo "== 5. Данные игр в БД (cover/обложки) =="
docker exec neobrain-web node -e "
const {PrismaClient}=require('@prisma/client');const p=new PrismaClient();
p.games.findMany().then(g=>{g.forEach(x=>console.log(x.slug,'|',x.title,'| cover=',x.coverUrl||x.cover||x.image||'-','| url=',x.url||'-'));}).catch(e=>{console.error('ERR',e.message);process.exit(1)})
" 2>&1 | head -20
