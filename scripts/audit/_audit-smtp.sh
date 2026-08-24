#!/bin/bash
# SMTP check: read mailer + verify config + send real test email via nodemailer
W=/opt/ai-helper/neobrain/services/web/src

echo "=== 1. mailer.js ==="
cat "$W/mailer.js" 2>/dev/null | head -120

echo ""
echo "=== 2. SMTP env (masked) ==="
grep -iE "^SMTP_|^MAIL" /opt/ai-helper/project/.env | sed -E 's/=(.*)/=<set>/'

echo ""
echo "=== 3. nodemailer installed? ==="
docker exec neobrain-web sh -c 'ls node_modules/nodemailer/package.json >/dev/null 2>&1 && echo yes || echo no'

echo ""
echo "=== 4. Send real test email to OWNER_EMAIL ==="
OWNER=$(grep -E '^OWNER_EMAIL=' /opt/ai-helper/project/.env | cut -d= -f2-)
echo "to: $OWNER"
docker exec -w /app neobrain-web node -e "
const mailer = require('./src/mailer');
(async () => {
  const r = await mailer.sendMail({
    to: '$OWNER',
    subject: 'Тест SMTP — NeoBrain (аудит ' + new Date().toISOString() + ')',
    html: '<p>Здравствуйте!</p><p>Это автоматическое тестовое письмо. Если вы его видите — SMTP hello@5mb2.ru полностью настроен и работает.</p><p>— Roo (pre-launch audit)</p>',
  });
  console.log('sendMail result:', JSON.stringify(r));
})();
" 2>&1
