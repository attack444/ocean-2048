#!/bin/bash
# Leads + tickets content via Prisma (ЭТАП 2)
docker exec neobrain-web node -e "
const {PrismaClient}=require('@prisma/client');
const p=new PrismaClient();
(async()=>{
  const leads = await p.lead.findMany({take:20});
  console.log('LEADS:', leads.length);
  console.log(JSON.stringify(leads.map(r=>({id:r.id,name:r.name,email:r.email,msg:(r.message||r.text||'').slice(0,50)})),null,1));
  const ticks = await p.supportTicket.findMany({take:20});
  console.log('TICKETS:', ticks.length);
  console.log(JSON.stringify(ticks.map(r=>({id:r.id,subject:r.subject,msg:(r.message||'').slice(0,50),status:r.status})),null,1));
  process.exit(0);
})().catch(e=>{console.error('ERR',e.message);process.exit(1)});
" 2>/dev/null || echo "(failed)"
