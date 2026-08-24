#!/bin/bash
# _media-add-trailer.sh
# Вставляем трейлер ocean-2048 в description (HTML-блок перед текстом).
set -e
docker exec neobrain-web node -e "
const {PrismaClient}=require('@prisma/client');
const p=new PrismaClient();
const video = '<video controls preload=\"metadata\" poster=\"/uploads/covers/ocean-2048.png\" style=\"width:100%;max-width:640px;border-radius:14px;border:1px solid #2a3d20;margin:10px 0;\"><source src=\"/uploads/trailers/ocean-2048.mp4\" type=\"video/mp4\">Ваш браузер не поддерживает видео.</video>';
(async()=>{
  const g=await p.game.findUnique({where:{slug:'ocean-2048'}});
  const existing=(g.description||'').trim();
  if(existing.indexOf('ocean-2048.mp4')>-1){ console.log('Трейлер уже в описании'); }
  else {
    const updated = video + '\n\n' + existing;
    await p.game.update({where:{slug:'ocean-2048'},data:{description:updated}});
    console.log('Трейлер добавлен в описание ocean-2048');
  }
  const g2=await p.game.findUnique({where:{slug:'ocean-2048'}});
  console.log('=== NEW DESCRIPTION (первые 300 символов) ===');
  console.log((g2.description||'').slice(0,300));
  await p.\$disconnect();
})().catch(e=>{console.error('ERR',e.message);process.exit(1)});
"
