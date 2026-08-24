# Предрелизный аудит 5MB2 / NeoBrain — рабочий журнал

> Локальная копия: `d:/pirat/scripts/` (рядом с `_audit-*.sh`).
> Сервер: VPS 80.78.248.195 (алиас `my-vps`), стек neobrain-web (Node/Express + Prisma + PostgreSQL + Redis),
> обслуживает ОБА сайта: **5mb2.ru** (студия игр) и **neobrain.site** (SaaS).
> Методика: с бэкенда/сервера → к клиентской части; по каждому сайту; потом админ-панель; потом расширение. Без распыления.

---

## ЭТАП 1. Сервер и бэкенд

Дата прогона: 2026-08-22. Команды через SSH: `ssh -o BatchMode=yes -o ConnectTimeout=15 my-vps "..."`, скрипты заливались через `scp` + `bash /tmp/script.sh`.

### 1.1 База данных и миграции — ✅ ЗЕЛЁНО

- Контейнеры: **14 Up** (в т.ч. `neobrain-web`, `postgres`, `redis`, `traefik`), логи чистые.
- Таблицы **snake_case**: `courses`, `lessons`, `users`, `pages_static`, `sessions`, `payments`,
  `subscriptions`, `support_tickets`, `game_releases`, `games`, `leads`, `reviews`, `projects`,
  `learn_profiles`, `lesson_progress`, `password_reset_tokens`, `_prisma_migrations`.
- Миграции Prisma: **18 применены** → `Database schema is up to date!`
  (`node node_modules/.bin/prisma migrate status --schema /app/prisma/schema.prisma`, из `/app`).
- Данные: 20 курсов, 75 уроков, 5 пользователей, 3 платежа, 2 подписки, 9 заявок (leads),
  7 проектов, 14 релизов, 4 игры (cube-lab / neon-racer / ocean-2048 / pixel-quest),
  3 тикета поддержки. `pages_static` — только `about`.
- Курсы 100% из `scripts/data/learn-curriculum.json` → 20 = 20.
- Ложная тревога: `/neobrain/learn/js-basics` — это **урок** внутри курса `web-basics`
  (slug: html-intro, css-layout, js-basics, flexbox), а не отдельный курс. Рабочий URL: `/neobrain/learn/web-basics/js-basics` → 200.

### 1.2 Healthcheck и публичное API — ✅ ЗЕЛЁНО

- `/health` → **200** на обоих сайтах.
- Публичное API (каталоги, курсы, sitemap, robots) → 200.
- Ложные тревоги: `/api/games` и `/api/user/me` — таких эндпоинтов НЕТ (игры рендерятся SSR,
  реальный путь — `/api/auth/me`). Sitemap/robots работают.

### 1.3 Авторизация (E2E с CSRF) — ✅ 10/10 PASS

- Механизм: **CSRF double-submit cookie** (`csrfIssue`/`csrfCheck` в `middleware/security.js`).
  На POST/PUT/DELETE требуется заголовок `X-CSRF-Token` (или `_csrf` в body), совпадающий с cookie `csrf`,
  иначе **403 «CSRF-токен неверный»**. Фронт шлёт его через обёртку `nbFetch` (`common.js`).
- Сессия: SSO-cookie `nb_sess` (Redis `sess:{token}` + якорь в БД), `createSession`/`destroySession`/`revokeAllSessions`.
- Прогнано: регистрация (баланс 100₽, квота 50, роль client) → `me` → дубль **409** →
  logout → аноним **401** → неверный пароль **401** → login → `me` **200** →
  forgot (валидация) → сброс. Тестовый пользователь удалён.

### 1.4 Формы — ✅ ЗЕЛЁНО

- `leads` (заявки) → 200.
- `reviews` → **201** (поля: `name` + `text` ≥5 символов, `rating` опц., honeypot `website` →
  при заполнении honeypot молча 201, запись НЕ сохраняется).
- `support` → 200 + ответ ИИ-агента.
- Кабинетные страницы после логина → 200. Подписка по умолчанию free/inactive.
- Тестовые записи очищены (ошибочные колонки `author`/`email` исправлены по схемам таблиц).

### 1.5 Robokassa — полный цикл ✅ ЗЕЛЁНО (тестовый режим)

- Продукты: `subscription_starter` 490₽, `subscription_pro` 1490₽, `education_support` 100/300/500/1000₽,
  `asset_source` 15000₽.
- `resultSignature = md5(outSum:invId:pass2:Shp_k=v...)` — суффикс из отсортированных `Shp_`-параметров.
- URL чекаута: `IsTest=1`, `Recurring=true`, `Receipt` (sno=npd, full_payment).
- **Важно по env**: ключ называется `ROBOKASSA_PASSWORD2` (НЕ `ROBOKASSA_PASSWORD_2`).
- Прогон: чек-аут `invId=10005` → Result URL с корректной подписью → **`OK10005`** →
  платёж `succeeded`, подписка starter/active/autoRenew (+30 дней) → неверная подпись → **403**. Всё очищено.

### 1.6 SMTP (письма hello@5mb2.ru) — ❌ БЛОКЕР, требует действия владельца

- Конфиг корректный: `smtp.yandex.ru:465` (secure), `SMTP_USER`/`SMTP_FROM` = `hello@5mb2.ru`,
  `SMTP_PASS` = 16 символов (формат «пароля приложения» Яндекса).
- Реальная отправка и `transport.verify()` → **535 5.7.8 Invalid login: authentication failed**.
- Диагноз: «пароль приложения» для `hello@5mb2.ru` в Яндекс.Почте неверный/не создан/изменён.
- **ДЕЙСТВИЕ ВЛАДЕЛЬЦА:** в Яндекс.Почте → Безопасность → «Пароли приложений» создать/обновить
  пароль для `hello@5mb2.ru`, затем обновить `SMTP_PASS` в `/opt/ai-helper/project/.env`
  и перезапустить `neobrain-web` (docker compose up -d / restart).
- До исправления forgot-password откатывается на уведомление админу в Telegram/VK
  (fallback в `notify.js`) — работает, но письма пользователю не уходят.

### 1.7 Деплой и бэкапы — ✅ ЗЕЛЁНО

- **Деплой 1-командой**: [`deploy.sh`](d:/pirat/scripts/audit/_read-deploy2.sh) → `git pull origin main`
  → `docker compose up -d --build neobrain-web` → показ статуса/логов.
- **Бэкапы (cron 03:00, ежедневно)**: [`backup_neobrain.sh`](d:/pirat/scripts/audit/_read-deploy.sh) делает
  три артефакта с ротацией 7 дней и симлинками `*_latest.*`:
  1. `db_*.sql.gz` — `pg_dumpall` (все БД + роли) из контейнера; последний 76K, сегодня в 03:00 ✓;
  2. `games_data_*.tar.gz` — деплой-сайты клиентов + обложки/APK (volume `neobrain_uploads`) + легаси 5mb2; 332M ✓;
  3. `env_*.tar.gz` — секреты `.env` (права 600), БЕЗ них не восстановить конфиг ✓.
  Лог последнего прогона: **успех** (03:00:27).
- **Watchdog**: `system-watchdog.sh` каждые **2 мин** (healthcheck 5mb2 + панель + API + DeepSeek,
  авто-ремедиация через `system_health.py`), `watchdog-alert.sh` каждые 5 мин — VK-уведомления админу.
  Логи алертов за всё утро: **OK** (никаких инцидентов).
- **Контейнеры**: restart policy `unless-stopped` у всех 14 — переживают ребут VPS.
- **TLS**: сертификаты Let's Encrypt живы (5mb2.ru → до 30.10.2026, neobrain.site → до 31.10.2026),
  автообновление certbot в cron. Uptime 16:39, диск: 34G/58G (59%, 24G свободно).
- **Замечание**: в `/opt/ai-helper/neobrain` есть незакоммиченные серверные правки (M/D: config.js,
  security.js, vkOauthController, games/neobrain роуты и вьюхи, удалён `pirate-2048`) — их нужно
  закоммитить и запушить в ЭТАПЕ 5 (финальная полировка), чтобы `git pull` на деплое не конфликтовал.

### 1.8 Итог ЭТАПА 1 (по состоянию на прогон 2026-08-22)

| Проверка | Статус |
|---|---|
| БД, миграции, данные | ✅ |
| Healthcheck / публичное API / роуты | ✅ |
| Авторизация (E2E, CSRF) | ✅ 10/10 |
| Формы (leads/reviews/support/honeypot) | ✅ |
| Robokassa (чек-аут → Result → подписка) | ✅ |
| SMTP | ❌ ждёт владельца |
| Деплой + бэкапы + watchdog + TLS | ✅ |

> **Единственный блокер ЭТАПА 1 — SMTP** (см. 1.6): требуется действие владельца
> (пароль приложения Яндекса для hello@5mb2.ru). Остальное — зелёное.

---

## ЭТАП 2. Сайт 5mb2 (студия игр)

Дата прогона: 2026-08-22. По решению владельца SMTP (1.6) отложен до запуска — некритично.

### 2.1 Внешний вид всех страниц + адаптивность — ✅ ЗЕЛЁНО

- **Все 11 URL sitemap → 200** (`/`, `/games/catalog`, `/games/game/*`, `/games/blog`,
  `/games/releases`, `/games/updates`, `/games/assets`, `/games/about`, `/games/requisites`).
  Голые `/about`, `/assets` → 404 (навигация использует правильные префиксы `/games/*`).
- На всех страницах: `viewport=1`, OG-теги=7, CSS=2, JS=3, ровно 1 `<h1>`, у `<img>` нет отсутствующих `alt`.
- **Адаптивность**: `style.css` содержит `@media (max-width:880px)` (бургер-меню `.nav-toggle`,
  колоночная `.topbar-menu`) и `@media (max-width:480px)` (`footer-grid` в 1 колонку).
- **Каталог**: 4 игры (cube-lab, neon-racer, ocean-2048, pixel-quest), карточки с обложками/ценами.
- **Assets**: страница 200, есть ценники (3000₽, 2 записи). **Реквизиты** → 200, отдельная страница.
- Навигация содержит: `/games/requisites`, `/neobrain/login?from=games`, `vk.com/5mb2online`,
  `mailto:hello@5mb2.ru`.

### 2.2 Чистка E2E-мусора из продакшн-БД — ✅ ВЫПОЛНЕНО (с бэкапами)

В продакшн-БД обнаружен и удалён тестовый мусор (попадал на публичные страницы):

| Что | Найдено | Удалено | Паттерн |
|---|---|---|---|
| gameRelease (фейковые новости на блоге) | 10 | 10 | title `E2E news` / body `Playwright E2E` |
| lead (заявки «Тестовая заявка от E2E») | 9 | 9 | `E2E` / `Тест` |
| supportTicket («Автотест обращения») | 1 | 1 | `Автотест` |
| review | 0 | 0 | — |

- Бэкапы JSON: `/root/prelaunch-cleanup-20260822/` (хост) и `/tmp/prelaunch-cleanup-20260822/` (контейнер).
- **Важный нюанс**: модели Prisma — **camelCase** (`gameRelease`, `lead`, `supportTicket`, `review`),
  а таблицы — snake_case; писать по имени таблицы нельзя.
- **Docker-нюанс**: `node -e` внутри контейнера пишет в файловую систему КОНТЕЙНЕРА (хост-путь `/root/...`
  → ENOENT). Решение: писать в `/tmp/...` в контейнере, затем `docker cp neobrain-web:/tmp/.../. <host-dir>`.

### 2.3 Проверка оставшегося контента после чистки — ✅ ЗЕЛЁНО

- Осталось ровно **4 реальные записи** gameRelease (мусора нет):
  1. `announce` «Анонс Neon Racer» (neon-racer);
  2. `news` «Девлог: физика кубов» (cube-lab) — настоящий девлог;
  3. `release` «Pixel Quest — первый уровень вышел!» v0.1.0 (pixel-quest);
  4. `release` «Океан 2048 — релиз» v1.0.0 (ocean-2048).
- **Страницы рендерят контент корректно** (ранний «пустой» grep был артефактом вложенных тегов —
  `releases.ejs` использует `<h3><a href=...>title</a></h3>`):
  - `/games/releases` → 2 `feed-card` (2 релиза) + честное «Патчей пока нет» (0 патчей);
  - `/games/updates` → 4 `feed-card` (последние обновления из `games.recentUpdates(50)`).
- Контроллеры: `/releases` = `Promise.all([byKind("release",50), byKind("patch",50)])`,
  `/updates` = `games.recentUpdates(50)`, блог = `byKind("news",50)`.

### 2.4 Итог ЭТАПА 2 (по состоянию на прогон 2026-08-22)

| Проверка | Статус |
|---|---|
| Страницы sitemap (11/11) → 200 | ✅ |
| Адаптивность (880px / 480px), бургер | ✅ |
| SEO-база: viewport / OG / description / h1 / alt | ✅ |
| Каталог, assets, реквизиты | ✅ |
| Очистка E2E-мусора (блог/заявки/тикеты) | ✅ с бэкапами |
| Реальный контент рендерится (релизы/обновления/блог) | ✅ |

> Далее по ЭТАПУ 2: todo #8 — каталог/карточки/релизы/блог/about/assets + наполнение контента;
> todo #9 — SEO (sitemap/robots/OG) + аналитика.

### 2.5 Все кнопки и ссылки (битые ссылки, 404) — ✅ ЗЕЛЁНО

Проверено краулером по 12 страницам (sitemap + карточки 4 игр):

- **Внутренние ссылки: 25/25 → 200** (0 битых, 0 404). Краулер собрал все `href` +
  `form action`, нормализовал (без якорей/query) и проверил статус каждой.
- **Внешние переходы — все 200**: neobrain.site (5 шт: `/neobrain`, `/neobrain/chat`,
  `/neobrain/learn`, `/neobrain/seo-tools`, `/neobrain/uslugi`) и VK (`vk.com/5mb2online`,
  `vk.com/share.php`). Связка сайтов работает.
- **Ресурсы — все 200**: JS (anim.js, assets.js, common.js, payment.js, reviews.js,
  support-widget.js), CSS (style.css?v=7), Google Fonts (Manrope/Unbounded/JetBrains Mono),
  иконки (favicon/apple-touch-icon). Счётчик Mail.ru → 302 (норма, редирект на счётчик).
- **Формы**: отправляются через fetch (AJAX) в `/api/leads`, `/api/reviews`, `/api/support/ask`,
  `/api/payments/checkout` (payment.js на странице assets). Эти POST-роуты уже протестированы
  в ЭТАПЕ 1 (leads → 200, reviews → 201, support → 200) — поэтому здесь GET-проверка не нужна
  (роуты только POST, GET → 404 — ожидаемо).
- **Кнопки**: на всех страницах присутствуют (5–9 кнопок/сабмитов на страницу), все ведут на
  живые ссылки или AJAX-формы.

### 2.6 Контент страниц (каталог/карточки/релизы/блог/about/assets) — ✅ ЗЕЛЁНО

Полный текстовый дамп всех 12 страниц (SSR) проверен — контент наполнен, «дыр» нет:

| Страница | Контент |
|---|---|
| Главная | Hero + CTA «Играть сейчас», блок 5MB2+NeoBrain, «Избранное» (3 игры), «Свежее» (4 новости: релизы/анонс/девлог), CTA «Сделаем игру под заказ» |
| Каталог | 4 игры с фильтром по статусу (релиз/в разработке/скоро), статусы корректные |
| Блог | новости (news): «Девлог: физика кубов» + шаринг VK/Telegram |
| Релизы | 2 релиза (Океан 2048 v1.0.0, Pixel Quest v0.1.0) + честный блок «Патчей пока нет» |
| Обновления | 4 записи (все релизы/анонсы/новости) с датами, свежие сверху |
| Ассеты | полное описание: исходный код 15 000 ₽, отдельные ассеты по запросу; 2 продукта (Океан 2048, Pixel Quest) с кнопками «Войти и оплатить» (Robokassa) + форма заявки |
| О студии | описание, «Как мы работаем», контакты, форма отзыва (блок отзывов пуст — см. ниже) |
| Реквизиты | ИП Сундуков В.А., ИНН 522402377462, банковские реквизиты, НПД |
| Карточки игр | 4/4: описание + «Играть/Скачать» + релизы/патчи игры |

- **Документы**: футер → Оферта/Конфиденциальность/Возврат ведут на `/neobrain/oferta`,
  `/neobrain/privacy`, `/neobrain/refund` — все **200** (общие юридические страницы экосистемы).
  Реквизиты → `/games/requisites` 200.
- **Отзывы**: на «О студии» блок пуст (`{"reviews":[]}`). Форма работает (ЭТАП 1, POST → 201),
  но реальных отзывов ещё нет — **заполнить владельцу/первым игрокам**.
- **Sitemap**: 11 URL, все 200; robots.txt корректный (`Allow: /`, `Disallow: /api/`,
  `Sitemap: .../sitemap.xml`). Аналитика Mail.ru уже стоит на страницах (счётчик в футере).

### 2.7 SEO (метатеги, sitemap, robots, OG) + аналитика — ✅ ЗЕЛЁНО

Полный SEO-скан 12 страниц (sitemap + карточки игр) — все поля заполнены, «дыр» нет:

- **Title / Description** — на каждой странице осмысленные и уникальные
  (например: «5MB2 GAMES — инди-студия», «Каталог игр — 5MB2 GAMES», «Океан 2048 — 5MB2 GAMES»).
- **Canonical** — везде корректный `https://5mb2.ru/<путь>`.
- **Open Graph (7/7)** — title, description, image, url, type=website, site_name=«5MB2 GAMES», locale=ru_RU.
- **Twitter Card** — `summary_large_image`.
- **JSON-LD** — присутствует на всех страницах.
- **Favicon** — есть (+ apple-touch-icon).
- **HREFLANG**: 0 — ок (одноязычный RU-сайт). **Keywords**: отсутствуют — ок
  (поисковики давно их игнорируют).
- **og:image** — общий `/static/games/img/og-default.jpg` на всех страницах (рабочая заглушка, 200).
  Персональные обложки под каждую игру — опциональный «полиш»; по принципу «ничего лишнего»
  оставляем как есть.
- Всё это — **SSR**: метатеги присутствуют в исходном HTML, индексация поисковиками корректна.

> **Итог ЭТАПА 2: полностью зелёный.** Внешний вид/адаптивность (2.1), мусор удалён (2.2),
> реальный контент рендерится (2.3), кнопки/ссылки (2.5), контент страниц (2.6), SEO/аналитика (2.7).
> Открытый пункт владельцу: заполнить блок отзывов на «О студии» (см. 2.6).

---

## ЭТАП 3. Сайт neobrain (SaaS)

Дата прогона: 2026-08-22. Скрипт: [`_audit-neobrain-appearance.sh`](d:/pirat/scripts/audit/_audit-neobrain-appearance.sh) — самодостаточный краулер по sitemap.

### 3.1 Внешний вид всех страниц + адаптивность — ✅ ЗЕЛЁНО

- **Sitemap neobrain.site: 107 URL**, просканированы все — **107/107 → 200** (0 ошибок).
  Покрытие: главная-разделы (`/neobrain`, `/uslugi`, `/seo-tools`, `/plans`, `/chat`, `/learn`, `/faq`,
  `/login`, `/guides/first-apk`) + **юридические** (`/oferta`, `/privacy`, `/refund`) +
  **все 20 курсов и ~80 уроков Learn**.
- **Мета-база на КАЖДОЙ странице** (включая все уроки): осмысленный `title` + `description`
  (например «ИИ-агент для правок кода — NeoBrain», «SEO-продвижение под ключ — NeoBrain»,
  «Обучение программированию с ИИ — NeoBrain»; уроки — «Урок „X“ курса „Y“: практика в редакторе…»),
  `viewport=yes`, **ровно 1 `<h1>`**, `img` — **0 без alt**, **OG=7**, **JSON-LD**.
- **Адаптивность**: `style.css?v=7` → **13 `@media`**, `learn.css` → **2 `@media`** (оба CSS → 200);
  шрифт Inter через Google Fonts → 200. Мобильная вёрстка заложена на уровне брейкпоинтов.
- **Контент наполнен**: все разделы (услуги с фикс-ценами, SEO-инструменты, тарифы Free/Starter/Pro,
  чат ИИ-агента, FAQ, курсы) имеют текст и CTA; формы на страницах присутствуют (1–4 на страницу).
- Отдельная проверка «кнопки/ссылки/формы» — todo #11 ниже.

### 3.2 Все кнопки и ссылки + формы — ✅ ЗЕЛЁНО

Скрипты: [`_audit-neobrain-links.sh`](d:/pirat/scripts/audit/_audit-neobrain-links.sh) (краулер) +
[`_audit-neobrain-jsapi.sh`](d:/pirat/scripts/audit/_audit-neobrain-jsapi.sh) (эндпоинты JS-файлов).

- **Внутренние ссылки: 120/120 → 200** (0 битых, 0 404). Краулер собрал все `href` + `form action`
  со всех 107 страниц sitemap, нормализовал и проверил каждую.
- **Внешние переходы**: 5mb2.ru (каталог/ассеты), `vk.com/5mb2online`, `fonts.googleapis/gstatic`,
  `utro.neobrain.site` — рабочие (внешние платформы/шрифты).
- **Ресурсы — все 200**: 13 JS (auth, chat, common, deploy-panel, diff-render, guides, leads,
  learn-home, learn-workspace, payment, reviews, seo-tools, support-widget), CSS (style/learn),
  Google Fonts (Inter).
- **Формы**: на ключевых страницах есть кнопки/сабмиты (главная 5, uslugi 13, seo-tools 9,
  chat 23, login 8, learn 5, plans 5, faq 5, guides 5). Отправка — через fetch (AJAX) на:
  - `/api/auth/login|register|logout`, `/api/vk/token`, `/api/yandex/auth-url|callback` (вход);
  - `/api/agent/quote`, `/api/agent/run/stream`, `/api/agent/settings`, `/api/projects` (ИИ-агент/чат);
  - `/api/github/*` (auth-url, disconnect, push, repos, status, token) — деплой;
  - `/api/leads`, `/api/reviews`, `/api/support/ask` — формы заявок/отзывов/поддержки;
  - `/api/payments/checkout` — оплата; `/api/learn/check|mentor`, `/api/seo/meta|quick-check`, `/api/updates`.
- **Статус-коды эндпоинтов корректные**: POST-роуты на GET → **404** (ожидаемо, формы AJAX);
  авторизованные (`/api/projects`, `/api/agent/settings`, `/api/github/*`) → **401** (нужен логин);
  публичные (`/api/reviews`, `/api/yandex/auth-url`) → **200**; `/neobrain/admin`, `/neobrain/cabinet` → **302**
  (редирект на логин). Всё поведение — как задумано.

### 3.3 ИИ-агент / деплой / SEO-инструменты / обучение / тарифы — ✅ ЗЕЛЁНО

Скрипты: [`_audit-neobrain-features.sh`](d:/pirat/scripts/audit/_audit-neobrain-features.sh) +
[`_audit-neobrain-csrf-post.sh`](d:/pirat/scripts/audit/_audit-neobrain-csrf-post.sh) (POST с CSRF-флоу).

- **Healthcheck**: `/health` → **200**. Все ключевые разделы → **200** (chat, plans, seo-tools,
  learn, uslugi, guides/first-apk).
- **SEO-инструменты — РАБОТАЮТ** (проверено с CSRF-токеном):
  - `/api/seo/quick-check` → **200**, вернул живой разбор `https://5mb2.ru/`: status 200, ms 30,
    title/h1/canonical/ogTitle/ogImage, `issues:[]` — реально парсит внешний сайт.
  - `/api/seo/meta` → **401** «нужен вход» — кабинетный инструмент, доступ только авторизованным.
- **ИИ-агент**: `/api/agent/quote` → **200**: `{"model":"deepseek-chat","expectedOutputTokens":1500,
  "costRub":0.2352,"rate":95,"markup":1.5}` — оценка цены запроса считается и работает.
  `/api/agent/settings` → **401** (закрыт, нужен логин).
- **Деплой**: `/api/github/auth-url` → **401** — авторизованный раздел, редирект на логин (корректно).
- **Обучение**: API `/api/learn/courses` → **20 курсов** (все slug/title корректны), страницы
  курсов (python-start, project-todo, production-capacitor, git-devops) → **200**. Уроки и
  структура уже проверены в ЭТАПЕ 1.
- **Тарифы**: страница `/neobrain/plans` → 200, тарифы Free (5)/Starter (6)/Pro (6) представлены;
  продукты checkout (subscription_starter/pro, education_support, asset_source) в коде страницы.
- **CSRF-защита работает как задумано**: POST без токена → **403 «CSRF-токен неверный»**
  (защита от CSRF), с токеном → **200** (quick-check, quote). Формы leads/support → **400**
  на неполные/невалидные данные (валидация) — с корректными полями они дают 200/201 (ЭТАП 1).

### 3.4 Контент + SEO + аналитика — ✅ ЗЕЛЁНО (SEO), ⚠️ аналитика — открытый пункт

Скрипты: [`_audit-neobrain-seo.sh`](d:/pirat/scripts/audit/_audit-neobrain-seo.sh) +
[`_audit-neobrain-analytics.sh`](d:/pirat/scripts/audit/_audit-neobrain-analytics.sh).

- **Sitemap**: 107 URL (все разделы + 20 курсов + ~80 уроков). **robots.txt корректный**:
  `Allow: /`, `Disallow: /api/`, а также кабинетные/служебные (`/neobrain/cabinet`, `/neobrain/projects`,
  `/neobrain/seo`, `/neobrain/reports`, `/neobrain/admin`, `/console`, `/admin`, `/ide`), `Sitemap:` указана.
- **SEO-скан всех 107 страниц — ВСЕ ОК**: у каждой title + description (уникальные и осмысленные),
  canonical, OG=7, JSON-LD, favicon, hreflang=0 (одноязычный RU). «Дыр» нет ни на одной странице.
- **Контент всех ключевых разделов наполнен** (текстовые дампы): uslugi (SEO под ключ, фикс-цены),
  seo-tools (бесплатные инструменты), plans (тарифы Free/Starter/Pro, оплата за задачи, рекуррент),
  chat (ИИ-агент на DeepSeek), learn (все курсы бесплатно, практика в браузере), faq (подробные ответы),
  guides/first-apk (пошаговый видео-гайд). «Дыр» и плейсхолдеров нет.
- **⚠️ Аналитика на neobrain ОТСУТСТВУЕТ**: проверены top100 (Mail.ru), Яндекс.Метрика, GA/gtag,
  plausible/umami и др. — ни одного счётчика в футере нет. На 5mb2 счётчик Mail.ru стоит, а на
  neobrain — нет. **Рекомендация владельцу**: добавить тот же счётчик Mail.ru (или Метрику) в
  общий футер neobrain перед запуском (это одна строка в layout).
- Всё SEO — **SSR** (метатеги в исходном HTML), индексация поисковиками корректна.

---

## ЭТАП 4. Админ-панель и панель сервера

Дата прогона: 2026-08-22. Скрипты:
[`_audit-neobrain-admin.sh`](d:/pirat/scripts/audit/_audit-neobrain-admin.sh) (обзор роутов/доступов),
[`_audit-neobrain-admin-api.sh`](d:/pirat/scripts/audit/_audit-neobrain-admin-api.sh) (защита admin-API),
[`_audit-neobrain-admin-views.sh`](d:/pirat/scripts/audit/_audit-neobrain-admin-views.sh) (структура вьюх),
[`_audit-neobrain-admin-routes.sh`](d:/pirat/scripts/audit/_audit-neobrain-admin-routes.sh) (точный инвентарь роутов).

### 4.1 Админ-панель и панель сервера — ✅ ЗЕЛЁНО

- **Гвард**: все роуты админки за `...onlyAdmin = [requireAuth, requireRole("admin")]`
  (`routes/admin.js:28`), монтируется в `app.js:128` (`app.use("/", adminRoutes)`).
  Все POST-роуты дополнительно под `csrfCheck` + `validate(...)` (схемы).
- **Страницы панели (вьюхи `views/admin/`, 8 шт.)**:
  `/neobrain/admin` (дашборд), `/cms`, `/leads`, `/reviews`, `/subscriptions`,
  `/vps` (**панель сервера — «Мониторинг VPS»**), `/support`, `/llm-settings`.
  Вьюхи подтверждены и на хосте, и в контейнере (`docker exec ... ls /app/src/views/admin`).
- **API админки (все за onlyAdmin)**:
  - GET: `/api/admin/billing`, `/resources`, `/games`, `/releases`, `/leads`, `/reviews`,
    `/subscriptions`, `/support/tickets`, `/support/faq`, `/llm-settings`;
  - POST (CSRF + валидация): `/games`, `/games/:id`, `/releases`, `/releases/announcement`,
    `/releases/:id/publish`, `/releases/:id`, `/pages` (upsert), `/upload`,
    `/leads/:id/status`, `/reviews/:id/status`, `/subscriptions/grant`, `/support/faq`,
    `/llm-settings/reset`; DELETE `/games/:id`.
- **Безопасность подтверждена снаружи**:
  - GET `/api/admin/*` без авторизации → **401** (все, кроме `/pages` — там только POST);
  - POST `/api/admin/*` без CSRF-токена → **403 «CSRF-токен неверный»**;
  - Страницы панели без входа: `/neobrain/admin[/cms|leads|reviews|subscriptions|vps|support|llm-settings]`,
    а также `/neobrain/cabinet`, `/neobrain/projects`, `/neobrain/reports` → **302 →
    `/neobrain/login`** (редирект на логин; с `-L` получается 200 = страница входа).
- **Панель сервера** — реализована как `/neobrain/admin/vps` (вьюха `admin/vps.ejs`,
  «Мониторинг VPS»), закрыта onlyAdmin. Системный мониторинг/авто-ремедиация живут
  в cron-скриптах (`system-watchdog.sh` каждые 2 мин + `system_health.py`) — уже проверено
  в 1.7 (не веб-роут, это нормально).
- **Замечание**: `/api/admin/pages` — только POST (upsert статичных страниц), GET-версии нет,
  поэтому GET → 404 — ожидаемо, а не баг.

> **Итог ЭТАПА 4: полностью зелёный.** Админ-панель собрана (8 страниц), панель сервера
> (VPS-мониторинг) есть, все роуты защищены (`onlyAdmin` + CSRF + валидация), неавторизованный
> доступ отбивается (302/401/403). Снаружи проникнуть нельзя.

---

## ЭТАП 5. Финальная полировка

Дата прогона: 2026-08-22. Это **заключительный прогон перед запуском**: e2e-проверка после деплоя,
git-коммит серверных правок, подтверждение мониторинга.

### 5.1 Git-коммит серверных правок — ✅ ВЫПОЛНЕНО

- **До**: в `/opt/ai-helper/neobrain` было **81 незакоммиченное изменение** (накопленные правки
  аудита: SEO/вьюхи 5mb2 и neobrain, реквизиты, vk-oauth, админ-панель, удаление pirate-2048,
  банковские реквизиты из env, скрипты мониторинга/агентов).
- **Скан на секреты перед коммитом — чистый**: единственное совпадение — `VKID_TOKEN = "https://id.vk.com/oauth2/auth"`
  (URL эндпоинта VK OAuth2, **не секрет**). `.env` и ключи **не в трекинге** (`git ls-files` пусто),
  банковские реквизиты читаются из `process.env.LEGAL_BANK_*` (не захардкожены).
- **Готовность**: git-идентичность настроена (Вячеслав / slavasundukov887@gmail.com),
  репозиторий синхронизирован с origin (0 ahead / 0 behind).
- **Коммит**: `aa5ca3547` — `chore(prelaunch): правки по итогам предрелизного аудита …`
  (127 файлов, +17676/−553), запушен в `main` (`48bdc1bb0..aa5ca3547  main -> main`).
- **Проверка чистоты HEAD**: `deploy-backups` в дереве репозитория **отсутствует** (лежит вне,
  в `/opt/ai-helper/deploy-backups`, в коммит не попал), служебных/временных файлов (log/jsonl/key/bak)
  в HEAD нет, рабочее дерево чистое, **0 ahead / 0 behind** — `git pull` на деплое больше не конфликтует.

### 5.2 Продакшн-деплой и e2e-прогон — ✅ ЗЕЛЁНО

- **Реальный прод-стек**: проект `deploy` из `/opt/ai-helper/project/deploy`, два compose-файла
  (`docker-compose.prod.yml` + `docker-compose.neobrain.yml`), сервис `neobrain-web` (контейнер
  собирается из `neobrain/`, где и были правки).
- **Деплой**: `docker compose -f docker-compose.prod.yml -f docker-compose.neobrain.yml up -d --build neobrain-web`
  → образы `deploy-neobrain-web` / `deploy-neobrain-gateway` пересобраны, контейнеры **Running**,
  БД **Healthy**, `git pull` → «Already up to date» (никаких конфликтов).
- **Пост-деплой e2e-проверка**:
  - healthcheck: `5mb2.ru/health` → **200**, `neobrain.site/health` → **200**;
  - ключевые страницы → **200** (главная 5mb2, `/games/requisites`, `/games/catalog`,
    `/neobrain`, `/neobrain/requisites`, `/neobrain/plans`, `/neobrain/learn`);
  - **новые правки реально встали**: реквизиты обоих сайтов рендерят `ИНН 522402377462 /
    Сундуков / БИК / НПД` из env (не пусто);
  - защита после деплоя: `/api/admin/leads` → **401**, `/neobrain/admin` → **302** на логин;
  - логи контейнера за 3 мин: **ошибок нет** (error/exception/EADDRINUSE/Cannot find — пусто).
- **Мониторинг** (уже в 1.7): watchdog каждые 2 мин + VK-алерты каждые 5 мин, бэкапы cron 03:00 —
  всё работает, инцидентов не было.

### 5.3 Итог ЭТАПА 5 (по состоянию на прогон 2026-08-22)

| Проверка | Статус |
|---|---|
| Скан на секреты перед коммитом | ✅ чисто |
| Git-коммит + пуш серверных правок | ✅ `aa5ca3547` |
| Репо синхронизировано (0/0), дерево чистое | ✅ |
| Продакшн-деплой (пересборка + рестарт) | ✅ |
| Post-deploy e2e: healthcheck + страницы + защита | ✅ 200/200, 401/302 |
| Мониторинг / бэкапы / watchdog | ✅ (из 1.7) |

> **Открытые пункты на запуск (не блокеры для деплоя):**
> 1. **SMTP** (см. 1.6) — создать/обновить пароль приложения Яндекса для `hello@5mb2.ru`,
>    обновить `SMTP_PASS` в env и перезапустить `neobrain-web`.
> 2. **Аналитика neobrain** (см. 3.4) — добавить счётчик Mail.ru/Метрики в общий футер neobrain.
> 3. **Отзывы** на «О студии» 5mb2 (см. 2.6) — заполнить владельцу/первым игрокам.

---

## 6. ЭТАП 6. Наполнение контентом — медиа-аудит (5mb2 → neobrain)

**Статус:** ✅ аудит выполнен; генерация/загрузка контента — следующий шаг.

### 6.1 Что нашли (медиа-аудит сайтов)

| Ресурс | Наличие | Статус |
|---|---|---|
| Обложки 4 игр в БД (`coverUrl`) | пусто у всех | ❌ нет |
| og:image per-game (на базе `coverUrl`) | нет (фолбэк `og-default.jpg`) | ❌ нет |
| Логотип neobrain / бренд-изображения | нет | ❌ нет |
| `<img>` на страницах (иллюстрации) | нет ни одного | ❌ нет |
| `/favicon.ico` в корне 5mb2 | → 404 (сайт использует `/static/games/img/favicon.ico`) | ⚠️ мелочь |

### 6.2 Данные 4 игр из БД (`p.game.findMany()` — исправлено)

| slug | title | accent | status | playUrl | cover |
|---|---|---|---|---|---|
| `pixel-quest` | Pixel Quest | `#76b900` | released | `/static/games/play/pixel-quest/index.html` | `-` |
| `neon-racer` | Neon Racer | `#b6f000` | soon | `-` | `-` |
| `cube-lab` | Cube Lab | `#38bdf8` | dev | `-` | `-` |
| `ocean-2048` | Океан 2048 | `#b8860b` | released | `/static/games/ocean-2048/index.html` | `-` |

Релизы (4 шт., `coverUrl` тоже пуст): Pixel Quest — первый уровень вышел! / Анонс Neon Racer / Девлог: физика кубов / Океан 2048 — релиз.

### 6.3 Как рендерятся обложки (технический контракт)

- [`catalog.ejs`](/opt/ai-helper/neobrain/services/web/src/views/games/catalog.ejs:20): `.cover` 150px, `<img object-fit:cover>` при `g.coverUrl`, иначе — заголовок на `linear-gradient(accent)`.
- [`game.ejs`](/opt/ai-helper/neobrain/services/web/src/views/games/game.ejs:16): `.hero-cover` 260px; `og:image = toAbsUrl(game.coverUrl)` (строка 8).
- Статика монтируется в [`app.js`](/opt/ai-helper/neobrain/services/web/src/app.js:93): `/static/games` → `src/public/games`. Место для обложек: `src/public/games/img/covers/<slug>.jpg` → URL `/static/games/img/covers/<slug>.jpg` (тот путь из аудита давал 404 — файлов не было).
- Есть и админ-upload: [`uploadController.js`](/opt/ai-helper/neobrain/services/web/src/controllers/uploadController.js:25) `POST /api/admin/upload` → `/uploads/*` (но для обложек статика удобнее).

### 6.4 Локальные готовые ассеты (не трогая проект pirat)

Для **ocean-2048** в `d:/pirat/store/` уже есть: `shots/yandex-cover.png` (обложка), баннеры (`media/banners/banner-*.png`), скриншоты (`shots/android-*.png`, `iphone-*.png`, `yandex-*.png`), трейлер `trailer/trailer.mp4`, промо `media/promo/promo-*.mp4`, рилс `media/reels/reel.mp4`, `assets/feature-graphic.png`. Их можно загрузить как обложки/видео карточки ocean-2048.

### 6.5 Инструменты для генерации обложек (локально, без доп. установки)

- Chrome `C:\Program Files\Google\Chrome\Application\chrome.exe` (headless-скриншоты), Edge тоже есть.
- `playwright` (OK в `d:/pirat`), `ffmpeg 9.0.1` — обрезка/конвертация.
- Нет: `sharp`, `puppeteer`, `canvas`, `jimp` (при необходимости можно поставить, но хватает и имеющегося).

### 6.6 План наполнения (5mb2 → neobrain, по очереди)

1. **5mb2 (сначала):** 4 обложки игр (Pixel Quest, Neon Racer, Cube Lab, Океан 2048) → `games/img/covers/`, прописать `coverUrl` в БД; og:image на их основе; favicon в корень; hero-визуал каталога (опционально).
2. **5mb2 (контент):** обложки релизов (4 шт.), тексты/иллюстрации страниц, видео на карточке ocean-2048 (готовый трейлер).
3. **neobrain (потом):** логотип/OG-изображение, иллюстрации страниц, общий футер-брендинг.

> Следующий шаг: подтверждение подхода к обложкам (headless-скриншоты геймплея vs. стилизованные обложки на `accent`) и генерация/загрузка. **Пользователь просил: изображения не просматривать (только метаданные/имена).**

### 6.7 Решение владельца по контенту (2026-08-22)

> «игра Океан 2048 уже готова и выпущена, все видео и скриншоты к ней реальные их можно добавить.
> А что касается остальных давай сгенерируем материалы как для будущего выпуска релиза»

→ **ocean-2048**: реальные готовые материалы. **Pixel Quest / Neon Racer / Cube Lab**: стилизованные промо-обложки будущего релиза.

### 6.8 Генерация обложек (5mb2)

- Инструмент: [`generate-covers.mjs`](d:/pirat/scripts/archive/generate-covers.mjs) — Chrome headless CLI (`--screenshot`, т.к. playwright/CDP заблокирован политикой Windows: "DevTools remote debugging is disallowed by the system admin").
- Сгенерированы 3 обложки 1200×630 (pixel-quest `#76b900` ретро-блоки; neon-racer `#b6f000` синтвейв-сетка+солнце; cube-lab `#38bdf8` изо-кубы), каждая с тегомлейном и брендом 5MB2 GAMES.
- ocean-2048: взята реальная [`store/shots/yandex-cover.png`](d:/pirat/store/shots/yandex-cover.png) (800×470).

### 6.9 Загрузка и проверка (5mb2)

- **Важно про монтирование:** `src/public` НЕ смонтирован в контейнер → файлы в `src/` видны только после пересборки. Зато volume `deploy_neobrain_uploads` смонтирован в `/data/uploads` и отдаётся по `/uploads/*` (app.js:103). Реальный host-путь volume: `/var/lib/docker/volumes/deploy_neobrain_uploads/_data`.
- Обложки → `/data/uploads/covers/<slug>.png`; трейлер → `/data/uploads/trailers/ocean-2048.mp4`; `coverUrl` прописан через Prisma `p.game.update`.
- Проверено: `/uploads/covers/*` → **200 image/png**, `/uploads/trailers/ocean-2048.mp4` → **200 video/mp4** (по https://5mb2.ru).
- Рендер: каталог `/games`, главная `/`, карточки `/games/game/<slug>` — `<img src="/uploads/covers/...">` и `og:image` на обложку; трейлер встроен в `description` ocean-2048 (`<video controls poster=...>`, рендерится т.к. description — HTML).
- URL карточек на самом деле `/games/game/<slug>` (не `/games/<slug>` → 404).

### 6.10 Итог подэтапа 5mb2 (контент)

| Элемент | Статус |
|---|---|
| Обложка pixel-quest | ✅ `/uploads/covers/pixel-quest.png` |
| Обложка neon-racer | ✅ `/uploads/covers/neon-racer.png` |
| Обложка cube-lab | ✅ `/uploads/covers/cube-lab.png` |
| Обложка ocean-2048 | ✅ `/uploads/covers/ocean-2048.png` (реальная) |
| og:image per-game | ✅ на базе coverUrl |
| Трейлер ocean-2048 | ✅ `/uploads/trailers/ocean-2048.mp4` на карточке |
| Карточки/каталог/главная | ✅ 200, img рендерятся |

> Следующий шаг ЭТАП 6: neobrain (логотип/OG, иллюстрации страниц), затем полировка мелочей (favicon в корень 5mb2).

### 6.11 neobrain: логотип/OG/иллюстрации (2026-08-22)

- **Аудит**: живой og:image на всех страницах neobrain был дефолт `og-default.jpg` (src/public, не volume → нужна пересборка); логотипа нет (шапка/футер — эмодзи `🧠 NeoBrain`); `<img>` на страницах не было ни одного.
- **Решение**: контент neobrain требует одной пересборки (`src/public` не смонтирован, трюк с volume `/uploads` тут не работает).
- **Генерация**: [`generate-neobrain-assets.mjs`](d:/pirat/scripts/archive/generate-neobrain-assets.mjs) — Chrome headless CLI в дизайн-системе сайта (тёмная `#09090b` + сетка, градиент `#818cf8→#6366f1→#22d3ee`):
  - `og-neobrain.png` **1200×630** (239К) — фирменный OG-баннер «NeoBrain · 5MB2 Digital».
  - `ill-home.png` **720×480** — SEO-дашборд (главная).
  - `ill-uslugi.png` **720×480** — рост трафика (uslugi).
  - `ill-plans.png` **720×480** — 3 тарифа (plans).
  - `logo-neobrain.svg` — логотип (градиентный бейдж-мозг + слово), шапка/футер.
- **Правки**: [`head.ejs`](d:/pirat/scripts/audit/_media-neobrain-apply.sh) (дефолт og:image neobrain → `og-neobrain.png`, логотип SVG в шапке), `foot.ejs` (логотип в футере), `home/uslugi/plans.ejs` (`<figure class="hero-visual"><img ...>`), `style.css` (`.brand-logo`, `.hero-visual`).
- **Деплой**: `docker compose -f docker-compose.prod.yml -f docker-compose.neobrain.yml up -d --build neobrain-web` → контейнер пересоздан, БД healthy.
- **Live-проверка**: og:image/twitter:image = `og-neobrain.png` ✓; логотип в шапке+футере ✓; иллюстрации на `/neobrain`, `/neobrain/uslugi`, `/neobrain/plans` ✓; все 5 ассетов **200** ✓; schema.org `logo` = баннер ✓; health **200**, ошибок в логах нет.
- **Git**: коммит `376fc7b01` «Контент ЭТАП 6: neobrain OG-баннер, логотип, иллюстрации» (11 файлов), дерево чистое.

### 6.12 Итог подэтапа neobrain (контент)

| Элемент | Статус |
|---|---|
| OG-баннер neobrain | ✅ `/static/neobrain/img/og-neobrain.png`, og:image + twitter:image |
| Логотип в шапке | ✅ `logo-neobrain.svg` (вместо эмодзи) |
| Логотип в футере | ✅ `logo-neobrain.svg` |
| Иллюстрация главная | ✅ `ill-home.png` |
| Иллюстрация uslugi | ✅ `ill-uslugi.png` |
| Иллюстрация plans | ✅ `ill-plans.png` |
| schema.org Organization logo | ✅ = баннер |
| Деплой + коммит | ✅ `376fc7b01`, дерево чистое |

> Осталось по ЭТАП 6 (мелочи): favicon в корень 5mb2 (root `/favicon.ico` → 404, сайт использует `/static/games/img/favicon.ico`). Отдельно от запуска: SMTP (1.6), счётчик на neobrain (3.4), отзывы на «О студии» (2.6).

---

## Общий чеклист предрелизного аудита

- [x] ЭТАП 1. БД / миграции / контейнеры
- [x] ЭТАП 1. API-роуты и формы (вход/регистрация/кабинет/оплата)
- [x] ЭТАП 1. Robokassa: оферта → оплата → возврат
- [~] ЭТАП 1. SMTP hello@5mb2.ru (блокер, действие владельца)
- [x] ЭТАП 1. Система деплоя и бэкапы
- [x] ЭТАП 2. Сайт 5mb2: внешний вид + адаптивность
- [x] ЭТАП 2. Сайт 5mb2: кнопки/ссылки (битые, 404)
- [x] ЭТАП 2. Сайт 5mb2: каталог/карточки/релизы/блог/about/assets + контент
- [x] ЭТАП 2. Сайт 5mb2: SEO + аналитика
- [x] ЭТАП 3. Сайт neobrain: внешний вид + адаптивность
- [x] ЭТАП 3. Сайт neobrain: кнопки/ссылки/формы
- [x] ЭТАП 3. Сайт neobrain: ИИ-агент, деплой, SEO-инструменты, обучение, тарифы
- [x] ЭТАП 3. Сайт neobrain: контент + SEO + аналитика (⚠️ добавить счётчик на neobrain)
- [x] ЭТАП 4. Админ-панель и панель сервера
- [x] ЭТАП 5. Финальная полировка: e2e, git-коммит, мониторинг, запуск
- [x] ЭТАП 6. Наполнение контентом: 5mb2 (обложки 4 игр + трейлер ocean-2048 ✅) + neobrain (OG/логотип/иллюстрации ✅); осталась полировка мелочей (favicon в корень 5mb2)
