#!/bin/bash
# Audit neobrain DB v2: correct snake_case table names + find prisma schema
echo "=== 1. Course slugs ==="
docker exec ai-helper-db psql -U aihelper -d neobrain -c 'SELECT slug, title FROM courses ORDER BY slug;'

echo ""
echo "=== 2. Row counts ==="
docker exec ai-helper-db psql -U aihelper -d neobrain -c 'SELECT (SELECT count(*) FROM users) AS users, (SELECT count(*) FROM courses) AS courses, (SELECT count(*) FROM lessons) AS lessons, (SELECT count(*) FROM payments) AS payments, (SELECT count(*) FROM subscriptions) AS subs, (SELECT count(*) FROM leads) AS leads, (SELECT count(*) FROM projects) AS projects, (SELECT count(*) FROM game_releases) AS releases, (SELECT count(*) FROM games) AS games, (SELECT count(*) FROM support_tickets) AS tickets;'

echo ""
echo "=== 3. Static pages (pages_static) ==="
docker exec ai-helper-db psql -U aihelper -d neobrain -c 'SELECT slug FROM pages_static ORDER BY slug;'

echo ""
echo "=== 4. Find prisma schema inside web container ==="
docker exec neobrain-web sh -c 'find /app -name "schema.prisma" 2>/dev/null | head; echo "---"; ls /app/node_modules/.prisma 2>/dev/null | head; echo "--- prisma dir ---"; ls /app/prisma 2>/dev/null || echo "no /app/prisma"'

echo ""
echo "=== 5. Lessons: sample slugs ==="
docker exec ai-helper-db psql -U aihelper -d neobrain -c 'SELECT course_id, count(*) FROM lessons GROUP BY course_id ORDER BY course_id;'

echo ""
echo "=== 6. Games catalog ==="
docker exec ai-helper-db psql -U aihelper -d neobrain -c 'SELECT slug, title FROM games ORDER BY slug;'

echo ""
echo "=== 7. Game releases ==="
docker exec ai-helper-db psql -U aihelper -d neobrain -c 'SELECT slug, title, status FROM game_releases ORDER BY slug;'
