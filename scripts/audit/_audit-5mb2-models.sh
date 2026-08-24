#!/bin/bash
# Discover exact Prisma model names + junk in leads/tickets (ЭТАП 2)
echo "=== 1. Model names containing lead/ticket/review ==="
docker exec neobrain-web node -e "
const {PrismaClient}=require('@prisma/client');
const p=new PrismaClient();
const names=Object.keys(p).filter(k=>/lead|ticket|review|sub/i.test(k));
console.log(JSON.stringify(names));
process.exit(0);
" 2>/dev/null || echo "(failed)"
echo ""
echo "=== 2. Leads + tickets raw (via known snake tables with SQL) ==="
docker exec neobrain-web node -e "
const {PrismaClient}=require('@prisma/client');
const p=new PrismaClient();
(async()=>{
  const leadTable = await p.\$queryRawUnsafe('SELECT id,name,email,message,created_at FROM leads LIMIT 20');
  const tickTable = await p.\$queryRawUnsafe('SELECT id,subject,message,status,created_at FROM support_tickets LIMIT 20');
  console.log('LEADS:'); console.log(JSON.stringify(leadTable.map(r=>({id:r.id,name:r.name,email:r.email,msg:(r.message||'').slice(0,50),at:r.created_at})),null,1));
  console.log('TICKETS:'); console.log(JSON.stringify(tickTable.map(r=>({id:r.id,subject:r.subject,msg:(r.message||'').slice(0,50),status:r.status,at:r.created_at})),null,1));
  process.exit(0);
})().catch(e=>{console.error('ERR',e.message);process.exit(1)});
" 2>/dev/null || echo "(failed)"
