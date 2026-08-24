#!/bin/bash
# Verify real auth + status API endpoints (anonymous = expect 401)
echo "=== 1. Correct auth API paths (anon) ==="
curl -s -o /dev/null -w "/api/auth/me (anon) -> %{http_code}\n" https://neobrain.site/api/auth/me
curl -s -o /dev/null -w "/api/subscription/me (anon) -> %{http_code}\n" https://neobrain.site/api/subscription/me
curl -s -o /dev/null -w "/api/reports/me (anon) -> %{http_code}\n" https://neobrain.site/api/reports/me
curl -s -o /dev/null -w "/api/learn/progress (anon) -> %{http_code}\n" https://neobrain.site/api/learn/progress
curl -s -o /dev/null -w "/api/github/status (anon) -> %{http_code}\n" https://neobrain.site/api/github/status

echo ""
echo "=== 2. Public GET endpoints ==="
curl -s -o /dev/null -w "/api/track (public) -> %{http_code}\n" https://neobrain.site/api/track
curl -s -o /dev/null -w "/api/payments/status (public) -> %{http_code}\n" "https://neobrain.site/api/payments/status"
curl -s -o /dev/null -w "/api/faq (public) -> %{http_code}\n" https://neobrain.site/api/faq
curl -s -o /dev/null -w "/api/reviews (public) -> %{http_code}\n" https://neobrain.site/api/reviews
curl -s -o /dev/null -w "/api/learn/courses (public) -> %{http_code}\n" https://neobrain.site/api/learn/courses

echo ""
echo "=== 3. auth/me body (anon) ==="
curl -s https://neobrain.site/api/auth/me | head -c 200
echo ""

echo ""
echo "=== 4. login page + oauth callback endpoints (GET) ==="
curl -s -o /dev/null -w "/neobrain/login -> %{http_code}\n" https://neobrain.site/neobrain/login
curl -s -o /dev/null -w "/neobrain/forgot-password -> %{http_code}\n" https://neobrain.site/neobrain/forgot-password
curl -s -o /dev/null -w "/api/github/callback (no code) -> %{http_code}\n" "https://neobrain.site/api/github/callback"
curl -s -o /dev/null -w "/api/yandex/auth-url (public) -> %{http_code}\n" https://neobrain.site/api/yandex/auth-url

echo ""
echo "=== 5. VK mini app / vk-app page ==="
curl -s -o /dev/null -w "/neobrain/vk-app -> %{http_code}\n" https://neobrain.site/neobrain/vk-app
