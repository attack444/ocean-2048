#!/bin/bash
# _media-games-data.sh
# Чтение актуальных данных 4 игр (5mb2) + релизов из БД neobrain.
# Исправление: p.game.findMany() (делегат Prisma = camelCase имя модели), а НЕ p.games.
set -e

docker exec neobrain-web node -e "
const {PrismaClient}=require('@prisma/client');
const p=new PrismaClient();
(async()=>{
  const games=await p.game.findMany({orderBy:{createdAt:'asc'}});
  console.log('=== GAMES_COUNT='+games.length+' ===');
  games.forEach(g=>console.log(
    'slug='+g.slug+
    ' | title='+g.title+
    ' | tagline='+(g.tagline||'-')+
    ' | cover='+(g.coverUrl||'-')+
    ' | play='+(g.playUrl||'-')+
    ' | accent='+(g.accent||'-')+
    ' | status='+g.status+
    ' | featured='+g.featured
  ));

  const releases=await p.gameRelease.findMany({orderBy:{createdAt:'asc'}});
  console.log('=== RELEASES_COUNT='+releases.length+' ===');
  releases.forEach(r=>console.log(
    'release slug='+r.slug+
    ' | title='+r.title+
    ' | cover='+(r.coverUrl||'-')+
    ' | status='+r.status
  ));
  await p.\$disconnect();
})().catch(e=>{console.error('ERR',e.message);process.exit(1)});
"
