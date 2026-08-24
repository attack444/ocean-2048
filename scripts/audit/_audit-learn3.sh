#!/bin/bash
# Confirm js-basics is a lesson inside web-basics + test correct URLs
echo "=== 1. Find parent course of js-basics in curriculum JSON ==="
node -e '
const fs=require("fs");
const p="/opt/ai-helper/neobrain/scripts/data/learn-curriculum.json";
const d=JSON.parse(fs.readFileSync(p,"utf8"));
for (const c of d) {
  const flat = JSON.stringify(c);
  if (flat.includes("js-basics")) {
    console.log("course:", c.slug, "|", c.title);
    console.log("top-level keys:", Object.keys(c).join(", "));
    for (const k of Object.keys(c)) {
      if (Array.isArray(c[k])) {
        const has = c[k].some(x=>x && x.slug==="js-basics");
        console.log("  array", k, "len", c[k].length, has ? "  <-- js-basics HERE (slug "+k+" element)" : "");
      }
    }
    // print slugs of the array containing js-basics
    for (const k of Object.keys(c)) {
      if (Array.isArray(c[k])) {
        const idx=c[k].findIndex(x=>x && x.slug==="js-basics");
        if (idx>=0) {
          console.log("  full list of that array (slugs):");
          c[k].forEach((x,i)=>console.log("   ", i, x.slug));
        }
      }
    }
  }
}
'

echo ""
echo "=== 2. HTTP test correct URL /neobrain/learn/web-basics/js-basics ==="
curl -s -o /dev/null -w "web-basics/js-basics -> %{http_code}\n" https://neobrain.site/neobrain/learn/web-basics/js-basics
curl -s -o /dev/null -w "web-basics (course)      -> %{http_code}\n" https://neobrain.site/neobrain/learn/web-basics
curl -s -o /dev/null -w "learn (home)             -> %{http_code}\n" https://neobrain.site/neobrain/learn

echo ""
echo "=== 3. HTTP test a few real course pages ==="
for slug in python-start project-todo production-capacitor; do
  curl -s -o /dev/null -w "learn/$slug -> %{http_code}\n" "https://neobrain.site/neobrain/learn/$slug"
done

echo ""
echo "=== 4. API: list courses ==="
curl -s https://neobrain.site/api/learn/courses | head -c 600
echo ""
