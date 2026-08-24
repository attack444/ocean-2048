#!/bin/bash
# Проверка внешних ссылок с сайта 5mb2 (todo #7)
UA="Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
URLS=(
  "https://neobrain.site/neobrain"
  "https://neobrain.site/neobrain/chat"
  "https://neobrain.site/neobrain/learn"
  "https://neobrain.site/neobrain/seo-tools"
  "https://neobrain.site/neobrain/uslugi"
  "https://vk.com/5mb2online"
  "https://fonts.googleapis.com"
  "https://fonts.gstatic.com"
  "https://t.me/share/url"
  "https://vk.com/share.php"
)
for u in "${URLS[@]}"; do
  c=$(curl -s -o /dev/null -w "%{http_code}" -L -A "$UA" --max-time 25 "$u")
  echo "$c  $u"
done
