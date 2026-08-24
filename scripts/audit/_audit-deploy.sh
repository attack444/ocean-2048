#!/bin/bash
# Audit deploy system + backups (ЭТАП 1, todo #5)
echo "=== 1. Project location & git status ==="
ls -la /opt/ai-helper/project/ 2>/dev/null | head -40
echo "--- git remote ---"
cd /opt/ai-helper/project/ 2>/dev/null && git remote -v 2>/dev/null | head -10
echo "--- git status (short) ---"
cd /opt/ai-helper/project/ 2>/dev/null && git status --short 2>/dev/null | head -20
echo "--- git branch + last commit ---"
cd /opt/ai-helper/project/ 2>/dev/null && git branch --show-current 2>/dev/null
cd /opt/ai-helper/project/ 2>/dev/null && git log -1 --format="%h %ad %s" --date=short 2>/dev/null

echo ""
echo "=== 2. Deploy mechanism (deployProxy / scripts) ==="
ls -la /opt/ai-helper/ 2>/dev/null | head -40
echo "--- deploy scripts anywhere on /opt ---"
find /opt -maxdepth 3 -iname "*deploy*" -o -iname "*backup*" 2>/dev/null | grep -v node_modules | head -30

echo ""
echo "=== 3. Cron jobs (backups / deploy / health) ==="
crontab -l 2>/dev/null || echo "(no crontab for current user)"
echo "--- /etc/cron.d ---"
ls -la /etc/cron.d/ 2>/dev/null
echo "--- /etc/crontab ---"
cat /etc/crontab 2>/dev/null | grep -v "^#" | grep -v "^$"

echo ""
echo "=== 4. Docker volumes (backup targets) ==="
docker volume ls 2>/dev/null
echo "--- compose project containers (with compose project name) ---"
docker ps --format "table {{.Names}}\t{{.Image}}\t{{.Status}}" 2>/dev/null | head -25

echo ""
echo "=== 5. Backups: find existing dump/backup files ==="
find / -maxdepth 4 \( -iname "*.dump" -o -iname "*.sql.gz" -o -iname "*.bak" -o -iname "*backup*" -o -iname "*.sql" \) 2>/dev/null \
  | grep -vE "node_modules|/proc/|/sys/|/usr/|/var/lib/apt|\.sqlite|postgresql.conf|/opt/ai-helper/project/src|/app/node_modules" \
  | head -30

echo ""
echo "=== 6. Disk space (for backups) ==="
df -h / /opt /var/lib/docker 2>/dev/null | head -10

echo ""
echo "=== 7. Backup of .env / config? ==="
ls -la /opt/ai-helper/project/.env* 2>/dev/null
find /opt/ai-helper -maxdepth 2 -iname "*.env*" 2>/dev/null | head -10

echo ""
echo "=== 8. Restart policy (containers survive reboot) ==="
docker inspect --format '{{.Name}}: {{.HostConfig.RestartPolicy.Name}}' $(docker ps -q) 2>/dev/null

echo ""
echo "=== 9. Uptime + reboot check (did server reboot recently?) ==="
uptime
echo "--- last reboot ---"
last reboot 2>/dev/null | head -3
