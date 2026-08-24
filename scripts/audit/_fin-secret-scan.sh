#!/bin/bash
# ЭТАП 5, todo #15: проверка diff на секреты/чувствительные данные перед коммитом
R=/opt/ai-helper/neobrain
cd "$R" || exit 1

echo "== 1. Сводка изменений (diffstat) =="
git diff --stat | tail -30

echo ""
echo "== 2. Поиск чувствительных паттернов в diff =="
# Исключаем ложные: ключи в схемах/примерах, слова в комментариях
git diff | grep -inE "^\+\s*(const|let|var)?\s*[A-Za-z0-9_]*?(PASS|PASSWORD|SECRET|TOKEN|API_KEY|PRIVATE|CLIENT_SECRET|SK-|AK-|BEGIN.*PRIVATE KEY|ROBOKASSA_PASSWORD|SMTP_PASS)\s*[=:]\s*['\"][^'\"]{6,}" | head -30

echo ""
echo "== 3. Выборочно: какие строки добавлены в config.js =="
git diff services/web/src/config.js | grep "^+" | head -40

echo ""
echo "== 4. Проверка, что .env не в трекинге =="
git ls-files --error-unmatch .env 2>/dev/null && echo "ВНИМАНИЕ: .env в трекинге!" || echo ".env НЕ в трекинге (ok)"
git ls-files | grep -iE "\.env($|\.)" | head
