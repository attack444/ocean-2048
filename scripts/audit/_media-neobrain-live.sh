#!/bin/bash
# _media-neobrain-live.sh
# Live-проверка контента neobrain после деплоя.
echo "=== 1. og:image на главной ==="
curl -s https://neobrain.site/ | grep -o '<meta property="og:image"[^>]*>' | head -3
curl -s https://neobrain.site/ | grep -o '<meta name="twitter:image"[^>]*>' | head -3

echo ""
echo "=== 2. Логотип в шапке ==="
curl -s https://neobrain.site/ | grep -o '<img src="/static/neobrain/img/logo-neobrain.svg"[^>]*>' | head -3

echo ""
echo "=== 3. Логотип в футере ==="
curl -s https://neobrain.site/ | grep -o '<div class="footer-logo"><img src="/static/neobrain/img/logo-neobrain.svg"[^>]*>' | head -3

echo ""
echo "=== 4. Иллюстрации на страницах ==="
for page in /neobrain /neobrain/uslugi /neobrain/plans; do
  echo "--- $page ---"
  curl -s "https://neobrain.site$page" | grep -o '<img src="/static/neobrain/img/ill-[a-z]*\.png"[^>]*>' | head -3
done

echo ""
echo "=== 5. Доступность ассетов (http + тип) ==="
for a in og-neobrain.png ill-home.png ill-uslugi.png ill-plans.png logo-neobrain.svg; do
  curl -s -o /dev/null -w "  /static/neobrain/img/$a -> %{http_code} %{content_type} %{size_download}B\n" "https://neobrain.site/static/neobrain/img/$a"
done

echo ""
echo "=== 6. Схема Organization logo ==="
curl -s https://neobrain.site/ | grep -o '"logo":"[^"]*"' | head -3

echo ""
echo "=== 7. Healthcheck + ошибки в логах ==="
curl -s -o /dev/null -w "  health -> %{http_code}\n" https://neobrain.site/health
docker logs neobrain-web --since 2m 2>&1 | grep -iE "error|exception|Cannot find|ejs" | head -10 || echo "  ошибок в логах нет"

echo "DONE"
