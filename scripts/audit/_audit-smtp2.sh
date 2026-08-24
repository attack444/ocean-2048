#!/bin/bash
# SMTP config details (mask secrets) + direct connection test
echo "=== 1. SMTP config details ==="
echo "HOST: $(grep -E '^SMTP_HOST=' /opt/ai-helper/project/.env | cut -d= -f2-)"
echo "PORT: $(grep -E '^SMTP_PORT=' /opt/ai-helper/project/.env | cut -d= -f2-)"
echo "USER: $(grep -E '^SMTP_USER=' /opt/ai-helper/project/.env | cut -d= -f2-)"
echo "FROM: $(grep -E '^SMTP_FROM=' /opt/ai-helper/project/.env | cut -d= -f2-)"
PASS=$(grep -E '^SMTP_PASS=' /opt/ai-helper/project/.env | cut -d= -f2-)
echo "PASS length: ${#PASS} (Яндекс пароль приложения = 16 символов, без пробелов)"

echo ""
echo "=== 2. Direct SMTP connection + AUTH test (no secrets logged) ==="
docker exec -w /app neobrain-web node -e "
const nodemailer = require('nodemailer');
const t = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 465),
  secure: Number(process.env.SMTP_PORT) === 465,
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  tls: { rejectUnauthorized: false },
});
t.verify().then(ok => {
  console.log('transport.verify():', ok ? 'OK' : 'FAILED');
  return t.close();
}).catch(e => {
  console.log('transport.verify() error:', e.message);
  process.exit(0);
});
" 2>&1

echo ""
echo "=== 3. Does SMTP_USER match SMTP_FROM / LEGAL_EMAIL / OWNER? ==="
grep -E "^(SMTP_USER|SMTP_FROM|LEGAL_EMAIL|OWNER_EMAIL)=" /opt/ai-helper/project/.env | sed -E 's/=(.*)/=<set>/'
