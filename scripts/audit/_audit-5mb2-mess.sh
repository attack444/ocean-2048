#!/bin/bash
# Find E2E/test junk in game_releases + inspect schema (ЭТАП 2)
echo "=== 1. Find test/junk rows in game_releases ==="
docker exec neobrain-web node -e "
const {PrismaClient}=require('@prisma/client');
const p=new PrismaClient();
// discover model name
console.log('models:', Object.keys(p).filter(k=>/release|game/i.test(k)).join(', '));
p.game_releases.findMany({select:{id:true,kind:true,title:true,body:true,publishedAt:true}}).then(rows=>{
  const junk = rows.filter(r=>/E2E|test|Test|тест|Тест/i.test((r.title||'')+' '+(r.body||'')));
  console.log('total rows:', rows.length);
  console.log('junk rows:', junk.length);
  console.log(JSON.stringify(junk.map(r=>({id:r.id,kind:r.kind,title:r.title,body:(r.body||'').slice(0,60)})),null,1));
  process.exit(0);
}).catch(e=>{console.error('ERR',e.message);process.exit(1)});
" 2>/dev/null || echo "(db query failed)"
echo ""
echo "=== 2. releases page (visible junk?) ==="
curl -s -A "Mozilla/5.0" https://5mb2.ru/games/releases | grep -oE '<h3[^>]*>[^<]+</h3>' | sed 's/<[^>]*>//g' | head -20
echo ""
echo "=== 3. updates page (visible junk?) ==="
curl -s -A "Mozilla/5.0" https://5mb2.ru/games/updates | grep -oE '<h3[^>]*>[^<]+</h3>' | sed 's/<[^>]*>//g' | head -20
echo ""
echo "=== 4. All distinct kinds ==="
docker exec neobrain-web node -e "
const {PrismaClient}=require('@prisma/client');
const p=new PrismaClient();
p.game_releases.groupBy({by:['kind'],_count:{_all:true}}).then(r=>{console.log(JSON.stringify(r,null,1));process.exit(0)}).catch(e=>{console.error('ERR',e.message);process.exit(1)});
" 2>/dev/null || echo "(skip)"
echo ""
echo "=== 5. Reviews / leads junk check (other tables) ==="
docker exec neobrain-web node -e "
const {PrismaClient}=require('@prisma/client');
const p=new PrismaClient();
Promise.all([
  p.reviews.count(),
  p.leads.count(),
  p.support_tickets.count(),
]).then(([rev,lead,tick])=>{console.log(JSON.stringify({reviews:rev,leads:lead,tickets:tick}));process.exit(0)}).catch(e=>{console.error('ERR',e.message);process.exit(1)});
" 2>/dev/null || echo "(skip)"
