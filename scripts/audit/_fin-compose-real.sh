#!/bin/bash
# ЭТАП 5, todo #15: определить реальный compose-файл контейнера neobrain-web и как его пересобрать
echo "== 1. Реальный compose-проект контейнера neobrain-web =="
docker inspect neobrain-web --format 'project={{ index .Config.Labels "com.docker.compose.project" }}
config_files={{ index .Config.Labels "com.docker.compose.project.config_files" }}
working_dir={{ index .Config.Labels "com.docker.compose.project.working_dir" }}
service={{ index .Config.Labels "com.docker.compose.service" }}' 2>/dev/null

echo ""
echo "== 2. Список compose-проектов в /opt/ai-helper =="
for d in /opt/ai-helper/neobrain /opt/ai-helper/project/deploy; do
  echo "  -- $d"
  ls -1 "$d"/docker-compose*.yml 2>/dev/null
done

echo ""
echo "== 3. Корневой docker-compose.yml (neobrain): сервисы =="
grep -nE "^  [a-zA-Z0-9_-]+:|neobrain-web" /opt/ai-helper/neobrain/docker-compose.yml 2>/dev/null | head -20

echo ""
echo "== 4. docker-compose.prod.yml: сервисы =="
grep -nE "^  [a-zA-Z0-9_-]+:|neobrain-web|build:" /opt/ai-helper/project/deploy/docker-compose.prod.yml 2>/dev/null | head -25
