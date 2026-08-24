#!/bin/bash
# ЭТАП 5, todo #15: проверка .gitignore и размера deploy-backups
R=/opt/ai-helper/neobrain
cd "$R" || exit 1

echo "== 1. Статус после коммита =="
git status --short | head -10
echo "  (пусто = чисто)"

echo ""
echo "== 2. .gitignore: есть ли deploy-backups =="
grep -n "deploy-backups" .gitignore 2>/dev/null || echo "  НЕ в .gitignore"

echo ""
echo "== 3. Размер deploy-backups =="
du -sh deploy-backups 2>/dev/null

echo ""
echo "== 4. Трекается ли deploy-backups сейчас =="
git ls-files deploy-backups | head -5
echo "  всего файлов в индексе: $(git ls-files deploy-backups | wc -l)"
