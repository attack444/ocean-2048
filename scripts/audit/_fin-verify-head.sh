#!/bin/bash
# ЭТАП 5, todo #15: финальная проверка чистоты HEAD-дерева после пуша
R=/opt/ai-helper/neobrain
cd "$R" || exit 1

echo "== 1. deploy-backups в HEAD? =="
n=$(git ls-tree -r HEAD --name-only | grep -c 'deploy-backups' || true)
echo "  count: $n"

echo ""
echo "== 2. Полный список файлов HEAD (первые пути по каталогам) =="
git ls-tree -r HEAD --name-only | awk -F/ '{print $1"/"$2"/"$3}' | sort | uniq -c | sort -rn | head -25

echo ""
echo "== 3. Синхронизация с origin после пуша =="
git fetch origin 2>/dev/null
echo "  ahead/behind vs origin/main: $(git rev-list --left-right --count origin/main...HEAD 2>/dev/null)"

echo ""
echo "== 4. Рабочее дерево чисто? =="
git status --short | head -5
echo "  count: $(git status --short | wc -l)"

echo ""
echo "== 5. Служебные/временные файлы в HEAD? =="
git ls-tree -r HEAD --name-only | grep -iE "\.(log|jsonl|pem|key)$|/tmp/|\.bak$|\.orig$" | head -15
