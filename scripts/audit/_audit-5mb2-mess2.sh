#!/bin/bash
# Find E2E/test junk in gameRelease (correct model name) + other tables
echo "=== 1. gameRelease rows + junk ==="
docker exec neobrain-web node -e "
const {PrismaClient}=require('@prisma/client');
const p=new PrismaClient();
p.gameRelease.findMany({select:{id:true,kind:true,title:true,body:true,publishedAt:true}}).then(rows=>{
  const junk = rows.filter(r=>/E2E|test|Test|тест|Тест/i.test((r.title||'')+' '+(r.body||'')));
  console.log('total rows:', rows.length);
  console.log('junk rows:', junk.length);
  console.log(JSON.stringify(junk.map(r=>({id:r.id,kind:r.kind,title:r.title,body:(r.body||'').slice(0,50)})),null,1));
  process.exit(0);
}).catch(e=>{console.error('ERR',e.message);process.exit(1)});
" 2>/dev/null || echo "(db query failed)"
echo ""
echo "=== 2. All distinct kinds + counts ==="
docker exec neobrain-web node -e "
const {PrismaClient}=require('@prisma/client');
const p=new PrismaClient();
p.gameRelease.groupBy({by:['kind'],_count:{_all:true}}).then(r=>{console.log(JSON.stringify(r,null,1));process.exit(0)}).catch(e=>{console.error('ERR',e.message);process.exit(1)});
" 2>/dev/null || echo "(skip)"
echo ""
echo "=== 3. Counts in reviews / leads / tickets ==="
docker exec neobrain-web node -e "
const {PrismaClient}=require('@prisma/client');
const p=new PrismaClient();
Promise.all([
  p.review.count(), p.lead.count(), p.supportTicket.count()
]).then(([rev,lead,tick])=>{console.log(JSON.stringify({reviews:rev,leads:lead,tickets:tick}));process.exit(0)}).catch(e=>{console.error('ERR',e.message);process.exit(1)});
" 2>/dev/null || echo "(skip)"
echo ""
echo "=== 4. Junk in reviews/leads ==="
docker exec neobrain-web node -e "
const {PrismaClient}=require('@prisma/client');
const p=new PrismaClient();
Promise.all([
  p.review.findMany({select:{id:true,name:true,text:true}}),
  p.lead.findMany({select:{id:true,name:true,email:true,message:true}})
]).then(([rev,lead])=>{
  const rj=rev.filter(r=>/E2E|test|тест/i.test((r.name||'')+' '+(r.text||'')));
  const lj=lead.filter(l=>/E2E|test|тест/i.test((l.name||'')+' '+(l.email||'')+' '+(l.message||'')));
  console.log('review junk:', rj.length, JSON.stringify(rj.slice(0,5).map(x=>({id:x.id,name:x.name}))));
  console.log('lead junk:', lj.length, JSON.stringify(lj.slice(0,5).map(x=>({id:x.id,name:x.name,email:x.email}))));
  process.exit(0);
}).catch(e=>{console.error('ERR',e.message);process.exit(1)});
" 2>/dev/null || echo "(skip)"
