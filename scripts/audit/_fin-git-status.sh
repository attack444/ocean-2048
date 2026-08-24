#!/bin/bash
# ЭТАП 5, todo #15: git-состояние серверного репозитория (незакоммиченные правки)
R=/opt/ai-helper/neobrain

echo "== 1. Текущая ветка и статус =="
cd "$R" && git rev-parse --abbrev-ref HEAD 2>/dev/null
git status --short 2>/dev/null | head -60

echo ""
echo "== 2. Кол-во незакоммиченных изменений =="
git status --short 2>/dev/null | wc -l

echo ""
echo "== 3. Последний коммит =="
git log -1 --oneline 2>/dev/null

echo ""
echo "== 4. Отличие от origin (незапушенные коммиты) =="
git status -sb 2>/dev/null | head -3
