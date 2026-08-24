# AGENTS.md — Сборки и скрипты (scripts/)

Детальная карта сборок и утилит. Общий контекст — в корневом `AGENTS.md`.

## Сборки (генерируемые артефакты — не редактировать руками)

| Команда | Скрипт | Результат | Назначение |
|---------|--------|-----------|------------|
| `npm run build:www` | `build-www.js` | `www/` | Веб-сборка для Capacitor (iOS/Android): копирует статику, бандлит `native-entry.js` через esbuild, помечает HTML как нативный (`body.is-native` без деревянной рамки) |
| `npm run build:vk` | `build-vk.js` | `build/vk/` | VK Mini Apps (платформенный SDK) |
| `npm run build:yandex` | `build-yandex.js` | `build/yandex/` | Яндекс Игры (SDK по `/sdk.js`, загрузка архивом) |

Важные нюансы сборок:
- `index.html` — единый исходник для всех платформ; нативные различия задаются `?platform=...` и `body.is-native`.
- `native-html.js` — маркировка HTML под натив; у него есть тест `native-html.test.js`.
- Бандл собирается esbuild: `js/native-entry.js` → `www/js/app.js` (minify, es2020).
- `www/` и `build/` в gitignore; правки вносить только в исходники.

## Генерация графики и промо (mjs)

| Команда | Скрипт | Что делает |
|---------|--------|-----------|
| `npm run make:shots` | `make-store-shots.mjs` | Скриншоты для магазинов (Playwright) |
| `npm run make:trailer` | `make-trailer.mjs` | Трейлер |
| `npm run make:banners` | `make-banners.mjs` | Баннеры |
| `npm run make:reels` | `make-reels.mjs` | Reels |
| `npm run make:promo` | `make-promo.mjs` | Промо-материалы |
| `npm run make:cover` | `make-yandex-cover.mjs` | Обложка для Яндекс Игр |
| `npm run make:icons` | `gen-icons.mjs` | Генерация иконок всех размеров |
| `npm run make:vk` | `make-vk-assets.mjs` | Ассеты VK |
| `npm run make:community` | `make-community-assets.mjs` | Ассеты сообщества |
| `npm run vk:community` | `vk-community.mjs` | Работа с сообществом VK |
| `npm run vk:bot` | `vk-bot.mjs` | Бот VK |

## Чекеры и тесты

- `check-png.ps1`, `verify-yandex-zip.ps1` — проверка ассетов/архива (PowerShell, Windows).
- `check-texts.mjs` — проверка текстов.
- `ui-check.mjs`, `analyze-dom.mjs`, `probe.html`, `test-driver.html` (в `store/`) — UI-проверки через Playwright/браузер.
- Тесты Node: `*.test.js` — запускаются через `npm test`.

## Структура вспомогательных каталогов

- `scripts/archive/` — старые скрипты (архив, не использовать).
- `scripts/audit/` — аудиты/отчёты.
- `scripts/lib/` — общие утилиты для скриптов.
- `store/_vk-docs/` — документация VK API.

## Правила

- Скрипты — ES-модули (`.mjs`/`.js` с `"type": "module"`), Node 18+.
- Не добавляй зависимостей без нужды; тяжёлые инструменты (Playwright) — в devDependencies.
- Генерация графики идемпотентна: повторный запуск не должен «ломать» предыдущие артефакты.
- После изменения сборки обнови соответствующий артефакт вручную только через `npm run ...`, не правь `www/`/`build/` руками.
