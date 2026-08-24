#!/bin/bash
# Inspect 5mb2 templates content + blog/releases DB data (ЭТАП 2)
echo "=== 1. blog.ejs (full) ==="
cat /opt/ai-helper/neobrain/services/web/src/views/games/blog.ejs
echo ""
echo "=== 2. releases.ejs (full) ==="
cat /opt/ai-helper/neobrain/services/web/src/views/games/releases.ejs
echo ""
echo "=== 3. updates.ejs (full) ==="
cat /opt/ai-helper/neobrain/services/web/src/views/games/updates.ejs
echo ""
echo "=== 4. home.ejs (full) ==="
cat /opt/ai-helper/neobrain/services/web/src/views/games/home.ejs
echo ""
echo "=== 5. games DB: kinds + count (news/release/update/blog) ==="
docker exec neobrain-web node -e "
const {PrismaClient}=require('@prisma/client');
const p=new PrismaClient();
p.game_releases.groupBy({by:['kind'],_count:{_all:true}}).then(r=>{
  console.log(JSON.stringify(r,null,1));
  return p.game_releases.findMany({take:5,orderBy:{createdAt:'desc'},select:{slug:true,kind:true,title:true,createdAt:true}});
}).then(r=>{
  console.log('--- latest 5 ---'); console.log(JSON.stringify(r,null,1));
  process.exit(0);
}).catch(e=>{console.error('ERR',e.message);process.exit(1)});
" 2>/dev/null || echo "(db query skipped)"
echo ""
echo "=== 6. blog render (current posts shown) ==="
curl -s -A "Mozilla/5.0" https://5mb2.ru/games/blog | grep -oE '<article[^>]*>|<h[23][^>]*>[^<]+</h[23]>|href="/games/blog/[^"]+"' | head -20
