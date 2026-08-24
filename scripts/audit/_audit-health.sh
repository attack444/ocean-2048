#!/bin/bash
# Healthcheck + public API audit to close backend audit #1
echo "=== 1. Health endpoints ==="
curl -s -o /dev/null -w "/health -> %{http_code}\n" https://neobrain.site/health
curl -s -o /dev/null -w "/health (5mb2 host) -> %{http_code}\n" -H "Host: 5mb2.ru" https://80.78.248.195/health -k
curl -s https://neobrain.site/health | head -c 300
echo ""

echo "=== 2. Public API endpoints ==="
curl -s -o /dev/null -w "/api/learn/courses -> %{http_code}\n" https://neobrain.site/api/learn/courses
curl -s -o /dev/null -w "/api/games -> %{http_code}\n" https://neobrain.site/api/games
curl -s -o /dev/null -w "/api/games/releases -> %{http_code}\n" https://neobrain.site/api/games/releases
curl -s -o /dev/null -w "/api/faq -> %{http_code}\n" https://neobrain.site/api/faq
curl -s -o /dev/null -w "/api/reviews -> %{http_code}\n" https://neobrain.site/api/reviews

echo ""
echo "=== 3. Auth-required API (expect 401/302) ==="
curl -s -o /dev/null -w "/api/learn/progress (anon) -> %{http_code}\n" https://neobrain.site/api/learn/progress
curl -s -o /dev/null -w "/api/user/me (anon) -> %{http_code}\n" https://neobrain.site/api/user/me

echo ""
echo "=== 4. Sitemap + robots content (neobrain) ==="
curl -s https://neobrain.site/sitemap.xml | head -c 400
echo ""
echo "--- robots ---"
curl -s https://neobrain.site/robots.txt | head -c 300
echo ""

echo "=== 5. Sitemap + robots content (5mb2) ==="
curl -s https://5mb2.ru/sitemap.xml | head -c 300
echo ""
echo "--- robots ---"
curl -s https://5mb2.ru/robots.txt | head -c 300
echo ""
