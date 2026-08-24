#!/bin/bash
# Read deploy/backup scripts to assess coverage (ЭТАП 1, todo #5)
echo "=== 1. backup_neobrain.sh ==="
cat /opt/ai-helper/project/deploy/backup_neobrain.sh 2>/dev/null || echo "NOT FOUND"
echo ""
echo "=== 2. system-watchdog.sh (head) ==="
head -80 /opt/ai-helper/project/deploy/system-watchdog.sh 2>/dev/null || echo "NOT FOUND"
echo ""
echo "=== 3. watchdog-alert.sh (head) ==="
head -60 /opt/ai-helper/project/deploy/watchdog-alert.sh 2>/dev/null || echo "NOT FOUND"
echo ""
echo "=== 4. deploy/ dir listing ==="
ls -la /opt/ai-helper/project/deploy/ 2>/dev/null
echo ""
echo "=== 5. Deploy mechanism (deployProxy?) ==="
grep -rIl "deployProxy\|deploy_proxy\|deployproxy" /opt/ai-helper/project/ 2>/dev/null | grep -v node_modules | head -20
echo "--- public_deploy.py head ---"
head -50 /opt/ai-helper/project/public_deploy.py 2>/dev/null
echo ""
echo "=== 6. Latest backup sizes + ages ==="
ls -lah /var/backups/neobrain/ 2>/dev/null | tail -15
echo "--- does backup include uploads? check backup log ---"
tail -30 /var/log/ai-helper/backup_neobrain.log 2>/dev/null
echo ""
echo "=== 7. Restore test? (quick sanity: pg_dump works) ==="
docker exec neobrain-web node -e "require('/app/src/lib/db').$0" 2>/dev/null || true
cd /opt/ai-helper && docker compose -f docker-compose.yml exec -T neobrain-web node -e "console.log('web container ok')" 2>/dev/null || echo "(compose exec check skipped)"
echo ""
echo "=== 8. Redis persistence + uploads volume ==="
docker exec ai-helper-redis redis-cli CONFIG GET save 2>/dev/null || echo "(redis config read skipped)"
echo ""
echo "=== 9. Deployed sites (nginx sites) ==="
ls -la /opt/neobrain/deployed-sites/ 2>/dev/null | head -20
echo ""
echo "=== 10. Traefik/cert + TLS expiry check ==="
for d in /etc/letsencrypt/live/*/; do
  echo "$d"
  openssl x509 -enddate -noout -in "$d/fullchain.pem" 2>/dev/null
done
