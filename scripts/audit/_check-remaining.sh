#!/bin/bash
# Check remaining gameRelease rows + why releases/updates pages look empty (ЭТАП 2)
echo "=== 1. ALL remaining gameRelease rows ==="
docker exec neobrain-web node -e "
const {PrismaClient}=require('@prisma/client');
const p=new PrismaClient();
p.gameRelease.findMany({select:{kind:true,title:true,gameSlug:true,version:true,publishedAt:true}}).then(rows=>{
  console.log(JSON.stringify(rows,null,1)); process.exit(0);
}).catch(e=>{console.error('ERR',e.message);process.exit(1)});
" 2>/dev/null || echo "(failed)"
echo ""
echo "=== 2. releases page raw (did it render empty due to route logic?) ==="
curl -s -A "Mozilla/5.0" https://5mb2.ru/games/releases -o /tmp/rel.html
grep -oE '(Релизов пока нет|Патчей пока нет|feed-card)' /tmp/rel.html | sort | uniq -c
echo ""
echo "=== 3. updates page raw ==="
curl -s -A "Mozilla/5.0" https://5mb2.ru/games/updates -o /tmp/upd.html
grep -oE '(Обновлений пока нет|feed-card)' /tmp/upd.html | sort | uniq -c
echo ""
echo "=== 4. how releases/updates controllers fetch data ==="
grep -rn "releases\|updates\|byKind" /opt/ai-helper/neobrain/services/web/src/routes/games.js 2>/dev/null | head -20
