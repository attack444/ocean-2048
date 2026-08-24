#!/bin/bash
# Inspect real (non-junk) gameRelease rows + leads/tickets junk (ЭТАП 2)
echo "=== 1. Real release/announce rows ==="
docker exec neobrain-web node -e "
const {PrismaClient}=require('@prisma/client');
const p=new PrismaClient();
p.gameRelease.findMany({where:{NOT:{kind:'news'}},select:{kind:true,title:true,body:true,gameSlug:true,version:true,publishedAt:true}}).then(rows=>{
  console.log(JSON.stringify(rows,null,1)); process.exit(0);
}).catch(e=>{console.error('ERR',e.message);process.exit(1)});
" 2>/dev/null || echo "(failed)"
echo ""
echo "=== 2. Leads (9) — junk? ==="
docker exec neobrain-web node -e "
const {PrismaClient}=require('@prisma/client');
const p=new PrismaClient();
p.lead.findMany({select:{id:true,name:true,email:true,message:true,createdAt:true}}).then(rows=>{
  console.log(JSON.stringify(rows.map(r=>({id:r.id,name:r.name,email:r.email,msg:(r.message||'').slice(0,60),at:r.createdAt})),null,1));
  process.exit(0);
}).catch(e=>{console.error('ERR',e.message);process.exit(1)});
" 2>/dev/null || echo "(failed)"
echo ""
echo "=== 3. Tickets (4) — junk? ==="
docker exec neobrain-web node -e "
const {PrismaClient}=require('@prisma/client');
const p=new PrismaClient();
p.supportTicket.findMany({select:{id:true,subject:true,message:true,status:true,createdAt:true}}).then(rows=>{
  console.log(JSON.stringify(rows.map(r=>({id:r.id,subject:r.subject,msg:(r.message||'').slice(0,60),status:r.status,at:r.createdAt})),null,1));
  process.exit(0);
}).catch(e=>{console.error('ERR',e.message);process.exit(1)});
" 2>/dev/null || echo "(failed)"
echo ""
echo "=== 4. Do reviews/leads appear anywhere public? (5mb2) ==="
grep -rE "leads|reviews" /opt/ai-helper/neobrain/services/web/src/routes/games.js 2>/dev/null | head -10
