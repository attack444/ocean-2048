#!/bin/bash
# ЭТАП 6, todo #16: медиа-аудит сайтов 5mb2 и neobrain (изображения/видео/иконки на страницах + файлы на сервере)
UA="Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
W=/opt/ai-helper/neobrain/services/web/src

echo "=========== ЧАСТЬ 1. ФАЙЛЫ НА СЕРВЕРЕ (public) ==========="
echo "== 1.1 Статика игр (5mb2) =="
find "$W/public/games" -maxdepth 3 -type f \( -iname "*.png" -o -iname "*.jpg" -o -iname "*.jpeg" -o -iname "*.webp" -o -iname "*.gif" -o -iname "*.svg" -o -iname "*.ico" -o -iname "*.mp4" -o -iname "*.webm" \) 2>/dev/null | sed "s|$W/public/||" | sort | head -80

echo ""
echo "== 1.2 Статика neobrain (медиа) =="
find "$W/public/neobrain" -maxdepth 3 -type f \( -iname "*.png" -o -iname "*.jpg" -o -iname "*.jpeg" -o -iname "*.webp" -o -iname "*.gif" -o -iname "*.svg" -o -iname "*.ico" -o -iname "*.mp4" -o -iname "*.webm" \) 2>/dev/null | sed "s|$W/public/||" | sort | head -80

echo ""
echo "== 1.3 Размеры ключевых файлов (обложки игр, og-default) =="
find "$W/public/games" -maxdepth 3 -type f \( -iname "*.png" -o -iname "*.jpg" \) -exec du -h {} \; 2>/dev/null | sort -rh | head -20

echo ""
echo "=========== ЧАСТЬ 2. ИЗОБРАЖЕНИЯ НА СТРАНИЦАХ (сетка) ==========="
echo "== 2.1 Соберём все <img src> и CSS url(...) с 5mb2 =="
for p in / /games/catalog /games/blog /games/releases /games/updates /games/assets /games/about /games/requisites; do
  echo "  --- $p"
  curl -s -A "$UA" --max-time 15 "https://5mb2.ru$p" | grep -oiE '(src|href|content)="[^"]*\.(png|jpe?g|webp|gif|svg|ico|mp4|webm)"' | sed 's/.*="//;s/"$//' | sort -u | head -15
done

echo ""
echo "== 2.2 Изображения на ключевых страницах neobrain =="
for p in /neobrain /neobrain/uslugi /neobrain/plans /neobrain/learn /neobrain/chat /neobrain/faq; do
  echo "  --- $p"
  curl -s -A "$UA" --max-time 15 "https://neobrain.site$p" | grep -oiE '(src|href|content)="[^"]*\.(png|jpe?g|webp|gif|svg|ico|mp4|webm)"' | sed 's/.*="//;s/"$//' | sort -u | head -15
done

echo ""
echo "=========== ЧАСТЬ 3. ПРОВЕРКА СТАТУСОВ МЕДИА ==========="
echo "== 3.1 Проверка ключевых медиа-ресурсов =="
for u in \
  "https://5mb2.ru/static/games/img/og-default.jpg" \
  "https://5mb2.ru/static/games/css/style.css" \
  "https://5mb2.ru/favicon.ico" \
  "https://neobrain.site/static/neobrain/img/logo.png" \
  "https://neobrain.site/static/neobrain/css/style.css" ; do
  c=$(curl -s -o /dev/null -w "%{http_code}" -A "$UA" --max-time 15 "$u")
  echo "  $c  $u"
done

echo ""
echo "== 3.2 Размер/тип og-default.jpg и обложек игр =="
for u in \
  "https://5mb2.ru/static/games/img/og-default.jpg" \
  "https://5mb2.ru/static/games/img/cube-lab.jpg" \
  "https://5mb2.ru/static/games/img/neon-racer.jpg" \
  "https://5mb2.ru/static/games/img/ocean-2048.jpg" \
  "https://5mb2.ru/static/games/img/pixel-quest.jpg" ; do
  r=$(curl -s -o /dev/null -w "%{http_code} %{content_type} %{size_download}B" -A "$UA" --max-time 15 "$u")
  echo "  $r  $u"
done
