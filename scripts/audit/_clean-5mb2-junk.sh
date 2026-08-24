#!/bin/bash
# PRE-LAUNCH CLEANUP: remove E2E/test junk from prod DB (ЭТАП 2)
# SAFETY: first dump affected rows to container /tmp/prelaunch-cleanup-20260822/, then delete.
set -e
BK=/root/prelaunch-cleanup-20260822
mkdir -p "$BK"
docker exec neobrain-web mkdir -p /tmp/prelaunch-cleanup-20260822

docker exec neobrain-web node -e "
const {PrismaClient}=require('@prisma/client');
const fs=require('fs');
const p=new PrismaClient();
const BK='/tmp/prelaunch-cleanup-20260822';
(async()=>{
  // 1. gameRelease junk: Playwright E2E news
  const rel = await p.gameRelease.findMany({where:{OR:[{title:{contains:'E2E news'}},{body:{contains:'Playwright E2E'}}]}});
  fs.writeFileSync(BK+'/gameRelease-junk.json', JSON.stringify(rel,null,1));
  console.log('gameRelease junk to delete:', rel.length);
  const r1 = await p.gameRelease.deleteMany({where:{OR:[{title:{contains:'E2E news'}},{body:{contains:'Playwright E2E'}}]}});
  console.log('deleted gameRelease:', r1.count);

  // 2. lead junk: E2E Тест
  const leads = await p.lead.findMany({where:{OR:[{name:{contains:'E2E'}},{message:{contains:'E2E'}}]}});
  fs.writeFileSync(BK+'/lead-junk.json', JSON.stringify(leads,null,1));
  console.log('lead junk to delete:', leads.length);
  const r2 = await p.lead.deleteMany({where:{OR:[{name:{contains:'E2E'}},{message:{contains:'E2E'}}]}});
  console.log('deleted leads:', r2.count);

  // 3. supportTicket junk: Автотест
  const tks = await p.supportTicket.findMany({where:{message:{contains:'Автотест'}}});
  fs.writeFileSync(BK+'/supportTicket-junk.json', JSON.stringify(tks,null,1));
  console.log('ticket junk to delete:', tks.length);
  const r3 = await p.supportTicket.deleteMany({where:{message:{contains:'Автотест'}}});
  console.log('deleted tickets:', r3.count);

  // 4. review junk if any
  const revs = await p.review.findMany({where:{OR:[{name:{contains:'E2E'}},{text:{contains:'E2E'}}]}});
  if (revs.length) { fs.writeFileSync(BK+'/review-junk.json', JSON.stringify(revs,null,1)); }
  const r4 = await p.review.deleteMany({where:{OR:[{name:{contains:'E2E'}},{text:{contains:'E2E'}}]}});
  console.log('deleted reviews:', r4.count);

  console.log('CLEANUP DONE');
  process.exit(0);
})().catch(e=>{console.error('ERR',e.message);process.exit(1)});
"
echo ""
echo "=== Verify: remaining counts ==="
docker exec neobrain-web node -e "
const {PrismaClient}=require('@prisma/client');
const p=new PrismaClient();
(async()=>{
  console.log(JSON.stringify({
    gameRelease: await p.gameRelease.count(),
    leads: await p.lead.count(),
    tickets: await p.supportTicket.count(),
    reviews: await p.review.count()
  },null,1));
  process.exit(0);
})().catch(e=>{console.error('ERR',e.message);process.exit(1)});
"
echo ""
echo "=== Backup files saved (on host) ==="
ls -la "$BK"
echo "=== Backup files saved (in container) ==="
docker exec neobrain-web ls -la /tmp/prelaunch-cleanup-20260822
echo "=== Copy container backups to host ==="
docker cp neobrain-web:/tmp/prelaunch-cleanup-20260822/. "$BK/" 2>/dev/null && echo OK
ls -la "$BK"
