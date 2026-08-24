#!/bin/bash
# ЭТАП 5, todo #15: готовность к коммиту (идентичность git + синхронизация с origin)
R=/opt/ai-helper/neobrain
cd "$R" || exit 1

echo "== 1. git user (идентичность для коммита) =="
echo "  name : $(git config user.name)"
echo "  email: $(git config user.email)"

echo ""
echo "== 2. fetch origin и расхождение =="
git fetch origin 2>&1 | head -5
echo "  ahead/behind: $(git rev-list --left-right --count origin/main...HEAD 2>/dev/null)"

echo ""
echo "== 3. Локальные коммиты, которых нет в origin =="
git log --oneline origin/main..HEAD 2>/dev/null | head -10

echo ""
echo "== 4. Отслеживаемые ли .env / secrets =="
git ls-files | grep -iE "(^|/)(\.env|.*\.(pem|key|p12))$" | head
echo "  (пусто = ок)"

echo ""
echo "== 5. Последние 5 коммитов в origin/main =="
git log --oneline -5 origin/main 2>/dev/null
