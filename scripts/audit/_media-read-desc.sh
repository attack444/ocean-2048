#!/bin/bash
# _media-read-desc.sh
# Читаем текущее описание ocean-2048 (для вставки трейлера).
set -e
docker exec neobrain-web node -e "
const {PrismaClient}=require('@prisma/client');
const p=new PrismaClient();
(async()=>{
  const g=await p.game.findUnique({where:{slug:'ocean-2048'}});
  console.log('=== DESCRIPTION START ===');
  console.log(g.description || '(пусто)');
  console.log('=== DESCRIPTION END ===');
  await p.\$disconnect();
})().catch(e=>{console.error('ERR',e.message);process.exit(1)});
"
