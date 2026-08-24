#!/bin/bash
# ЭТАП 3, todo #11: эндпоинты форм/кнопок из внешних JS-файлов neobrain + кнопки по ключевым страницам
UA="Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
BASE="https://neobrain.site"
TMP=/tmp/nb-jsapi
rm -rf "$TMP"; mkdir -p "$TMP"

JS=(
  "/static/neobrain/js/auth.js"
  "/static/neobrain/js/chat.js"
  "/static/neobrain/js/common.js?v=7"
  "/static/neobrain/js/deploy-panel.js"
  "/static/neobrain/js/diff-render.js"
  "/static/neobrain/js/guides.js"
  "/static/neobrain/js/leads.js"
  "/static/neobrain/js/learn-home.js"
  "/static/neobrain/js/learn-workspace.js"
  "/static/neobrain/js/payment.js"
  "/static/neobrain/js/reviews.js"
  "/static/neobrain/js/seo-tools.js"
  "/static/neobrain/js/support-widget.js"
)

echo "=== fetch/axios/URL эндпоинты в JS-файлах ==="
: > "$TMP/eps.txt"
for j in "${JS[@]}"; do
  f="$TMP/$(basename "$j" | sed 's/?.*//').js"
  curl -s -A "$UA" --max-time 20 "$BASE$j" -o "$f"
  echo ""
  echo "-- $j"
  grep -oE '(/api/[a-zA-Z0-9/_-]+|/neobrain/[a-zA-Z0-9/_-]+|/auth/[a-zA-Z0-9/_-]+)' "$f" 2>/dev/null | sort -u | tee -a "$TMP/eps.txt"
done

echo ""
echo "=== Проверка POST-эндпоинтов форм (GET — живой ли роут; POST-роуты на GET отдают 404 — ожидаемо) ==="
sort -u "$TMP/eps.txt" > "$TMP/eps_u.txt"
while read -r ep; do
  [ -z "$ep" ] && continue
  c=$(curl -s -o /dev/null -w "%{http_code}" -A "$UA" --max-time 15 "$BASE$ep")
  echo "  $c  $ep"
done < "$TMP/eps_u.txt"

echo ""
echo "=== Кнопки/сабмиты по ключевым страницам ==="
declare -A PAGES=(
  ["/neobrain"]="home"
  ["/neobrain/uslugi"]="neobrain_uslugi"
  ["/neobrain/seo-tools"]="neobrain_seo-tools"
  ["/neobrain/plans"]="neobrain_plans"
  ["/neobrain/chat"]="neobrain_chat"
  ["/neobrain/learn"]="neobrain_learn"
  ["/neobrain/login"]="neobrain_login"
  ["/neobrain/faq"]="neobrain_faq"
  ["/neobrain/guides/first-apk"]="neobrain_guides_first-apk"
)
for u in "${!PAGES[@]}"; do
  name="${PAGES[$u]}"
  curl -s -A "$UA" --max-time 20 "$BASE$u" -o "$TMP/$name.html"
  n=$(grep -cE '<(button|input[^>]*type="submit"|input[^>]*type="button")' "$TMP/$name.html" 2>/dev/null || echo 0)
  echo "  $u -> кнопок/сабмитов: $n"
done
