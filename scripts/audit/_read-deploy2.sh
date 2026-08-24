#!/bin/bash
# Read deploy.sh + neobrain git status (ЭТАП 1, todo #5 - final)
echo "=== 1. deploy.sh ==="
cat /opt/ai-helper/project/deploy/deploy.sh 2>/dev/null || echo "NOT FOUND"
echo ""
echo "=== 2. update.sh (head 60) ==="
head -60 /opt/ai-helper/project/deploy/update.sh 2>/dev/null || echo "NOT FOUND"
echo ""
echo "=== 3. neobrain repo: remote + branch + last commit ==="
cd /opt/ai-helper/neobrain 2>/dev/null && git remote -v | head -4
cd /opt/ai-helper/neobrain 2>/dev/null && git branch --show-current
cd /opt/ai-helper/neobrain 2>/dev/null && git log -1 --format="%h %ad %s" --date=short
echo ""
echo "=== 4. neobrain git status (short, first 40) ==="
cd /opt/ai-helper/neobrain 2>/dev/null && git status --short | head -40
echo ""
echo "=== 5. watchdog alert state (last notifications) ==="
tail -15 /var/log/ai-helper/watchdog-alert.log 2>/dev/null || echo "(no alert log)"
echo ""
echo "=== 6. watchdog health log (last 10) ==="
tail -10 /var/log/ai-helper/watchdog.log 2>/dev/null || echo "(no watchdog log)"
echo ""
echo "=== 7. backup cron line present? ==="
crontab -l 2>/dev/null | grep -E "backup|watchdog" || echo "NONE in root crontab"
