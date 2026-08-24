#!/bin/bash
# ЭТАП 5, todo #15: продакшн-деплой (пересборка + рестарт neobrain-web) и проверка здоровья
R=/opt/ai-helper/neobrain
cd "$R" || exit 1

echo "== 1. Перед деплоем: git status и pull (должен быть 'Already up to date') =="
git status --short | head -5
git pull origin main 2>&1 | tail -5

echo ""
echo "== 2. Пересборка и рестарт контейнера =="
docker compose up -d --build neobrain-web 2>&1 | tail -15

echo ""
echo "== 3. Статус контейнера =="
sleep 5
docker compose ps neobrain-web 2>/dev/null
