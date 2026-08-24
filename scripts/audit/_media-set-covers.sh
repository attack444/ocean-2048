#!/bin/bash
# _media-set-covers.sh
# Прописываем coverUrl для 4 игр 5mb2 (Prisma p.game.update).
set -e
docker exec neobrain-web node -e "
const {PrismaClient}=require('@prisma/client');
const p=new PrismaClient();
const map={
  'pixel-quest':'/uploads/covers/pixel-quest.png',
  'neon-racer':'/uploads/covers/neon-racer.png',
  'cube-lab':'/uploads/covers/cube-lab.png',
  'ocean-2048':'/uploads/covers/ocean-2048.png'
};
(async()=>{
  for(const [slug,url] of Object.entries(map)){
    await p.game.update({where:{slug},data:{coverUrl:url}});
    console.log('updated', slug, '->', url);
  }
  const games=await p.game.findMany({orderBy:{createdAt:'asc'}});
  console.log('=== CHECK ===');
  games.forEach(g=>console.log(g.slug,'| cover=',g.coverUrl||'-'));
  await p.\$disconnect();
})().catch(e=>{console.error('ERR',e.message);process.exit(1)});
"
