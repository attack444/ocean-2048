# AGENTS.md — Карта проекта «Океан 2048»

Этот файл автоматически добавляется в контекст каждого запроса Roo Code.
Цель — дать модели полную картину проекта: структуру, конвенции, команды и правила,
не перегружая контекст всем исходным кодом.

## Кратко о проекте

Классическая головоломка 2048 в подводном стиле. Одна кодовая база, несколько сборок:
- **Веб / PWA** — `index.html` + ES-модули `js/`
- **VK Mini Apps** — сборка `scripts/build-vk.js`
- **Яндекс Игры** — сборка `scripts/build-yandex.js`
- **iOS / Android** — Capacitor: `npm run sync` → `www/` → нативные папки

Главная цель проекта — **retention** (время в игре + возврат на следующий день).
Каждая новая фича оценивается через удержание. Дорожная карта: [`docs/ROADMAP.md`](docs/ROADMAP.md) и [`store/DEV_PLAN.md`](store/DEV_PLAN.md).

## Структура (что где лежит)

```
/                       # корень
├── index.html          # веб-вход; ?platform=ios|android — предпросмотр нативного UI
├── css/styles.css      # все стили (веб + нативные через body.is-native)
├── js/
│   ├── main.js         # ОРКЕСТРАЦИЯ: DOM, UI, игровой цикл (≈2500 строк) — не дублировать логику
│   ├── game.js         # чистая логика 2048 (движение, слияния, прилив 🌊, ходы 🧮)
│   ├── levels.js       # данные уровней (7 глубин, 4×4 → 6×6, tideConfigForLevel, movesConfigForLevel)
│   ├── progress.js     # разблокировки/рекорды, нормализация state
│   ├── achievements.js # достижения (данные + evaluateAchievements)
│   ├── daily*.js       # ежедневные задания, ежедневный вход, ежедневная головоломка
│   ├── rewards.js      # наградная реклама (rewarded revive)
│   ├── combo.js        # серии/комбо
│   ├── shop.js         # магазин: бусты/перки/скины/темы, экономика
│   ├── chest.js        # сундук, обмен очков, донат
│   ├── cloud-sync.js   # конфликты облачных/локальных сохранений
│   ├── depths-map.js   # карта глубин
│   ├── missions.js     # сюжетные миссии
│   ├── platform.js     # web / ios / android
│   ├── platform-sdk.js # адаптер VK / Яндекс / Web (вкл. соцмеханики и рекламу)
│   ├── sound.js        # Web Audio
│   ├── native-entry.js # точка входа для Capacitor-бандла
│   └── native-plugins.js
├── js/*.test.js        # юнит-тесты (node:test)
├── scripts/            # сборки www/vk/yandex, генерация графики, чекеры
├── android/ ios/       # Capacitor-обёртки (сборка iOS только на Mac)
├── store/              # гайды/чеклисты магазинов, графика, DEV_PLAN
├── docs/               # ROADMAP, PROGRESS-NOTES, гайды
├── plans/              # планы монетизации и VK-автопилота
├── www/                # генерируется build:www (НЕ редактировать руками)
├── build/              # генерируется build:vk / build:yandex (НЕ редактировать руками)
├── manifest.json, sw.js  # PWA (только веб)
├── privacy-policy.html   # обязателен на HTTPS для магазинов
└── capacitor.config.json
```

## Команды (npm run)

- `npm test` — все юнит-тесты: `node --test js/*.test.js scripts/*.test.js`
- `npm run lint` — eslint по `js/` и `scripts/`
- `npm run build:www` — собрать `www/` для Capacitor
- `npm run build:vk` — собрать `build/vk/` (VK Mini Apps)
- `npm run build:yandex` — собрать `build/yandex/` (Яндекс Игры)
- `npm run sync` — `build:www` + `npx cap sync` (обновить нативные проекты)
- `npm run serve` — локальный сервер на :4173 (см. `scripts/` для генерации графики)

## Правила и конвенции

1. **Чистая логика — в `js/*.js` модулях, UI/оркестрация — в `main.js`.** Не растаскивай игровую логику по DOM-коду и наоборот.
2. **Прогресс хранится в `localStorage`** через единый state (ключи `ocean2048_v1`, `ocean2048_saves`). Добавляя поле, предусмотри его дефолт в `loadState()` и нормализацию в `progress.js` — старые сохранения не должны ломаться.
3. **Каждая механика — отдельный модуль + тест.** Юнит-тесты на `node:test`, чистые функции без DOM. После изменения логики запусти `npm test`.
4. **`reduce-motion` / `prefers-reduced-motion`** — анимации и частицы должны отключаться (требование доступности и модерации).
5. **Платформенные SDK** (VK/Яндекс) вызываются только через `platform-sdk.js`, а не напрямую — веб-версия работает без SDK.
6. **Не редактируй** `www/`, `build/`, `android/` и `ios/` руками — это генерируемые артефакты. Правки делаются в исходниках, затем пересборка.
7. **Контент на русском** — интерфейс и тексты игры на русском языке.
8. **PWA/service worker** — `sw.js` и `manifest.json` относятся только к вебу; при изменении кэшируемых ресурсов обнови версии в `sw.js`.
9. **Модерация магазинов** — прежде чем менять что-то, что влияет на приватность/рекламу/внутренние покупки, сверься с `store/` чеклистами (GOOGLE_PLAY.md, APP_STORE.md, YANDEX_GAMES.md).

## Полезные ссылки (читать по теме задачи)

- Дорожная карта и статус фаз: [`docs/ROADMAP.md`](docs/ROADMAP.md), [`store/DEV_PLAN.md`](store/DEV_PLAN.md)
- Текущее состояние / известные проблемы: [`docs/PROGRESS-NOTES.md`](docs/PROGRESS-NOTES.md)
- Заметки по деплою: [`DEPLOY-NOTES.md`](DEPLOY-NOTES.md) и [`docs/DEPLOY-NOTES.md`](docs/DEPLOY-NOTES.md)
- Детали модулей `js/`: см. [`js/AGENTS.md`](js/AGENTS.md)
- Детали сборок и скриптов: см. [`scripts/AGENTS.md`](scripts/AGENTS.md)

## Стиль кода

- ES-модули (`import`/`export`), современный JS, без фреймворков.
- Имена на английском, комментарии и UI-тексты на русском.
- Функции и модули документируются кратко (`// ==== раздел ====` или JSDoc).
- Аккуратная индентация (4 пробела в `index.html`, как в текущих файлах).
