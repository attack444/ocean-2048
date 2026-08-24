#!/bin/bash
# Inspect 5mb2 views structure + template sizes (ЭТАП 2)
echo "=== 1. games views ==="
ls -la /opt/ai-helper/neobrain/services/web/src/views/games/ 2>/dev/null
echo ""
echo "=== 2. games public assets (css/js/img) ==="
find /opt/ai-helper/neobrain/services/web/src/public/games/ -maxdepth 2 -type f 2>/dev/null | head -40
echo ""
echo "=== 3. Blog: are there any post routes? ==="
grep -rE "games/blog|/blog/" /opt/ai-helper/neobrain/services/web/src/routes/games.js 2>/dev/null | head -10
echo ""
echo "=== 4. Blog data source ==="
grep -rn "blog" /opt/ai-helper/neobrain/services/web/src/controllers/*.js 2>/dev/null | head -10
echo ""
echo "=== 5. Games data (4 games) from DB ==="
docker exec neobrain-web node -e "const {PrismaClient}=require('@prisma/client');const p=new PrismaClient();p.games.findMany({select:{slug:true,title:true,status:true}}).then(r=>{console.log(JSON.stringify(r,null,1));process.exit(0)}).catch(e=>{console.error('ERR',e.message);process.exit(1)})" 2>/dev/null || echo "(db query skipped)"
echo ""
echo "=== 6. Template sizes (rough, lines) ==="
for f in /opt/ai-helper/neobrain/services/web/src/views/games/*.ejs; do
  echo "$(wc -l < "$f") lines | $f"
done
