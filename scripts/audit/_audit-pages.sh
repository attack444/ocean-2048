#!/usr/bin/env bash
# Аудит всех публичных страниц обоих сайтов + сервисных URL.
set -u
N=https://neobrain.site
G=https://5mb2.ru

check() {
  local url="$1"
  local code
  code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 20 "$url")
  local flag="  "
  [ "$code" = "200" ] && flag="OK"
  [ "$code" = "301" ] || [ "$code" = "302" ] && flag="RD"
  [ "$code" = "404" ] && flag="!!"
  [ "$code" = "500" ] && flag="XX"
  printf '%-4s %s\n' "$code" "$url"
}

echo "==================== NEOBRAIN.SITE ===================="
check "$N/"
check "$N/health"
check "$N/neobrain"
check "$N/neobrain/plans"
check "$N/neobrain/uslugi"
check "$N/neobrain/examples"
check "$N/neobrain/login"
check "$N/neobrain/forgot-password"
check "$N/neobrain/chat"
check "$N/neobrain/cabinet"
check "$N/neobrain/projects"
check "$N/neobrain/seo"
check "$N/neobrain/seo-tools"
check "$N/neobrain/guides/first-apk"
check "$N/neobrain/faq"
check "$N/neobrain/vk-app"
check "$N/neobrain/learn"
check "$N/neobrain/learn/js-basics"
check "$N/neobrain/oferta"
check "$N/neobrain/privacy"
check "$N/neobrain/refund"
check "$N/neobrain/requisites"
check "$N/neobrain/reports"
check "$N/sitemap.xml"
check "$N/robots.txt"
check "$N/static/neobrain/css/style.css"
check "$N/static/neobrain/js/common.js"
check "$N/static/neobrain/img/favicon.ico"

echo ""
echo "==================== 5MB2.RU ===================="
check "$G/"
check "$G/health"
check "$G/games"
check "$G/games/catalog"
check "$G/games/releases"
check "$G/games/updates"
check "$G/games/blog"
check "$G/games/assets"
check "$G/games/about"
check "$G/games/game/ocean-2048"
check "$G/neobrain/oferta"
check "$G/neobrain/privacy"
check "$G/neobrain/refund"
check "$G/neobrain/requisites"
check "$G/games/requisites"
check "$G/static/games/ocean-2048/index.html"
check "$G/static/games/css/style.css"
check "$G/static/games/js/anim.js"
check "$G/static/games/img/favicon.ico"
check "$G/sitemap.xml"
check "$G/robots.txt"

echo ""
echo "==================== РЕДИРЕКТЫ (проверка target) ===================="
echo "gallery -> $(curl -s -o /dev/null -w '%{http_code} %{redirect_url}' --max-time 20 "$G/games/gallery")"
echo "fun     -> $(curl -s -o /dev/null -w '%{http_code} %{redirect_url}' --max-time 20 "$G/games/fun")"

echo ""
echo "==================== SEO-ФАЙЛЫ (содержимое) ===================="
echo "--- neobrain robots.txt ---"; curl -s --max-time 20 "$N/robots.txt"
echo "--- 5mb2 robots.txt ---"; curl -s --max-time 20 "$G/robots.txt"
echo "--- neobrain sitemap (первые 5 строк) ---"; curl -s --max-time 20 "$N/sitemap.xml" | head -5
echo "--- 5mb2 sitemap (первые 5 строк) ---"; curl -s --max-time 20 "$G/sitemap.xml" | head -5
