#!/usr/bin/env bash
# =============================================================================
#  Применяет правки «Реквизиты» на сервере:
#   1) .env         — добавляет блок LEGAL_* (+ банковские LEGAL_BANK_*)
#   2) config.js    — добавляет банковские поля в объект legal
#   3) neobrain.js  — добавляет роут GET /requisites
#   4) foot.ejs     — добавляет ссылку «Реквизиты» в блок «Документы»
#                     для обоих сайтов (games и neobrain)
#  Идемпотентно: повторный запуск не дублирует изменения.
# =============================================================================
set -euo pipefail

ENV_FILE="/opt/ai-helper/project/.env"
CONFIG_FILE="/opt/ai-helper/neobrain/services/web/src/config.js"
ROUTES_FILE="/opt/ai-helper/neobrain/services/web/src/routes/neobrain.js"
FOOT_FILE="/opt/ai-helper/neobrain/services/web/src/views/partials/foot.ejs"

echo "== 1) .env: добавляем LEGAL_* (если ещё нет) =="
if grep -q "^LEGAL_FULL_NAME=" "$ENV_FILE"; then
  echo "LEGAL_* уже есть — пропускаем"
else
  cat >> "$ENV_FILE" <<'LEGAL_EOF'

# --- Юридические реквизиты продавца (оферта, Robokassa, страница «Реквизиты») ---
LEGAL_FULL_NAME=Сундуков Вячеслав Алексеевич
LEGAL_STATUS=Самозанятый, налог на профессиональный доход (НПД)
LEGAL_INN=522402377462
LEGAL_ADDRESS=г. Первомайск, Нижегородская обл., ул. Мира, д. 2
LEGAL_PHONE=
LEGAL_EMAIL=hello@5mb2.ru

# Банковские реквизиты для выплат (страница «Реквизиты»)
LEGAL_BANK_NAME=ПАО Сбербанк
LEGAL_BANK_BIK=042202603
LEGAL_BANK_CORR=30101810900000000603
LEGAL_BANK_ACCOUNT=40817810442000555115
LEGAL_EOF
  echo "Добавлено."
fi

echo "== 2) config.js: добавляем банковские поля в legal =="
python3 - "$CONFIG_FILE" <<'PY_EOF'
import sys
p = sys.argv[1]
s = open(p, encoding="utf-8").read()
if "bankName" in s:
    print("bankName уже есть — пропускаем")
else:
    anchor = "    email: process.env.LEGAL_EMAIL || process.env.OWNER_EMAIL || \"hello@5mb2.ru\",\n    phone: process.env.LEGAL_PHONE || \"\",\n  },"
    addition = """    email: process.env.LEGAL_EMAIL || process.env.OWNER_EMAIL || "hello@5mb2.ru",
    phone: process.env.LEGAL_PHONE || "",
    // Банковские реквизиты для страницы «Реквизиты» (LEGAL_BANK_* в .env).
    bankName: process.env.LEGAL_BANK_NAME || "",
    bankBik: process.env.LEGAL_BANK_BIK || "",
    bankCorr: process.env.LEGAL_BANK_CORR || "",
    bankAccount: process.env.LEGAL_BANK_ACCOUNT || "",
  },"""
    if anchor in s:
        s = s.replace(anchor, addition, 1)
        open(p, "w", encoding="utf-8").write(s)
        print("config.js обновлён")
    else:
        print("!!! якорь в config.js не найден — правка НЕ применена")
        sys.exit(1)
PY_EOF

echo "== 3) neobrain.js: добавляем роут /requisites (если ещё нет) =="
if grep -q '"/requisites"' "$ROUTES_FILE"; then
  echo "роут уже есть — пропускаем"
else
  python3 - "$ROUTES_FILE" <<'PY_EOF'
import sys
p = sys.argv[1]
s = open(p, encoding="utf-8").read()
anchor = 'router.get("/refund", (req, res) => res.render("neobrain/legal-refund", {\n  title: "Условия возврата средств", user: req.user, legal: config.legal,\n  description: "Условия и порядок возврата средств за услуги NeoBrain и 5MB2 GAMES.",\n}));'
addition = '\nrouter.get("/requisites", (req, res) => res.render("neobrain/legal-requisites", {\n  title: "Реквизиты продавца", user: req.user, legal: config.legal, site: "neobrain",\n  description: "Реквизиты продавца (самозанятый) NeoBrain и 5MB2 GAMES: ИНН, адрес, банковские реквизиты для выплат.",\n}));'
if anchor in s:
    s = s.replace(anchor, anchor + addition, 1)
    open(p, "w", encoding="utf-8").write(s)
    print("роут добавлен")
else:
    print("!!! якорь refund не найден — правка НЕ применена")
    sys.exit(1)
PY_EOF
fi

echo "== 4) foot.ejs: добавляем ссылку «Реквизиты» в Документы (games + neobrain) =="
python3 - "$FOOT_FILE" <<'PY_EOF'
import sys
p = sys.argv[1]
s = open(p, encoding="utf-8").read()
if "requisites" in s:
    print("ссылки уже есть — пропускаем")
else:
    old = '<a href="/neobrain/refund">Возврат средств</a>'
    new = ('<a href="/neobrain/refund">Возврат средств</a>\n'
           '          <a href="/neobrain/requisites">Реквизиты</a>')
    cnt = s.count(old)
    if cnt >= 2:
        s = s.replace(old, new)  # заменит обе (games и neobrain)
        open(p, "w", encoding="utf-8").write(s)
        print(f"заменено вхождений: {cnt}")
    else:
        print(f"!!! найдено {cnt} вхождений якоря — ожидалось 2. Правка НЕ применена")
        sys.exit(1)
PY_EOF

echo "== Готово =="
echo "Проверка .env:"
grep -E "^(LEGAL_|ROBOKASSA_TEST_MODE)" "$ENV_FILE" | sed 's/\(PASSWORD[12]\)=.*/\1=<redacted>/'
echo "Проверка config.js:"
grep -n 'bank' "$CONFIG_FILE" || true
echo "Проверка роута:"
grep -n 'requisites' "$ROUTES_FILE"
echo "Проверка футера:"
grep -n 'requisites' "$FOOT_FILE"
