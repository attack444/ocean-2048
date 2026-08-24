#!/bin/bash
# ЭТАП 5, todo #15: разобраться с deploy-backups (тип: dir/submodule/symlink)
R=/opt/ai-helper/neobrain
cd "$R" || exit 1

echo "== 1. ls корня репо (тип deploy-backups) =="
ls -la | grep -iE "deploy-backups|total" | head

echo ""
echo "== 2. git ls-files с grep =="
git ls-files | grep -i "deploy-backups" | head -5
echo "  count: $(git ls-files | grep -ci 'deploy-backups')"

echo ""
echo "== 3. git submodule =="
git submodule status 2>/dev/null | head
git config --get-regexp "submodule\..*\.path" 2>/dev/null | head

echo ""
echo "== 4. find по всему /opt/ai-helper =="
find /opt/ai-helper -maxdepth 3 -iname "deploy-backups*" 2>/dev/null | head

echo ""
echo "== 5. Есть ли физически файлы после коммита =="
if [ -d deploy-backups ]; then
  echo "  deploy-backups существует, размер:"
  du -sh deploy-backups 2>/dev/null
  ls -1 deploy-backups 2>/dev/null | head
else
  echo "  deploy-backups НЕ существует как директория в рабочем дереве"
fi

echo ""
echo "== 6. Что говорит git о pathspec deploy-backups =="
git ls-tree -r HEAD --name-only | grep -i "deploy-backups" | head -5
echo "  в HEAD count: $(git ls-tree -r HEAD --name-only | grep -ci 'deploy-backups')"
