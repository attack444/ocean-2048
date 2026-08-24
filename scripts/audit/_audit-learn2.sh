#!/bin/bash
# Inspect learn-curriculum.json + find import mechanism + correct prisma migrate status
W=/opt/ai-helper/neobrain/services/web/src

echo "=== 1. learn-curriculum.json: total courses + their slugs ==="
node -e '
const fs=require("fs");
const p="/opt/ai-helper/neobrain/scripts/data/learn-curriculum.json";
const d=JSON.parse(fs.readFileSync(p,"utf8"));
const arr = Array.isArray(d) ? d : (d.courses || []);
console.log("type:", Array.isArray(d) ? "array" : "object", "keys:", Object.keys(d).join(","));
console.log("courses count:", arr.length);
arr.forEach(c=>console.log(" -", c.slug, "|", c.title));
'

echo ""
echo "=== 2. Context around js-basics in curriculum (line 234) ==="
sed -n '225,245p' /opt/ai-helper/neobrain/scripts/data/learn-curriculum.json

echo ""
echo "=== 3. Find import/seed scripts for courses ==="
grep -rn "learn-curriculum\|curriculum" /opt/ai-helper/neobrain/scripts 2>/dev/null | grep -v node_modules | head -20
echo "--- scripts dir listing ---"
ls -la /opt/ai-helper/neobrain/scripts 2>/dev/null | head -40

echo ""
echo "=== 4. Prisma migrate status (correct --schema) ==="
docker exec -w /app neobrain-web sh -c 'node node_modules/.bin/prisma migrate status --schema /app/prisma/schema.prisma 2>&1 | grep -v "^warn" | head -30'

echo ""
echo "=== 5. DB courses vs curriculum diff ==="
node -e '
const fs=require("fs");
const {execSync}=require("child_process");
const p="/opt/ai-helper/neobrain/scripts/data/learn-curriculum.json";
const d=JSON.parse(fs.readFileSync(p,"utf8"));
const arr = Array.isArray(d) ? d : (d.courses||[]);
const jsonSlugs = arr.map(c=>c.slug).sort();
const out=execSync("docker exec ai-helper-db psql -U aihelper -d neobrain -t -c \"SELECT slug FROM courses ORDER BY slug;\"").toString();
const dbSlugs=out.split("\n").map(s=>s.trim()).filter(Boolean).sort();
console.log("JSON only (not in DB):", jsonSlugs.filter(s=>!dbSlugs.includes(s)).join(", ") || "(none)");
console.log("DB only (not in JSON):", dbSlugs.filter(s=>!jsonSlugs.includes(s)).join(", ") || "(none)");
'
