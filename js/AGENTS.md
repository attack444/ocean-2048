# AGENTS.md — Модули js/

Детальная карта модулей игровой логики. Общий контекст — в корневом `AGENTS.md`.

## Архитектура

- **`main.js`** — единственный «толстый» слой: DOM, UI, игровой цикл, модалки, рекламные показы.
  Всю чистую логику делегирует в модули ниже. Не дублировать логику в main.js.
- Остальные модули — чистые ES-модули без DOM (кроме `platform*.js` и `sound.js`), легко тестируются.

## Модули (краткое описание)

| Файл | Назначение | Ключевые экспорты |
|------|-----------|-------------------|
| `game.js` | Класс `Game`: движение, слияния, прилив 🌊, ходы-как-ресурс 🧮, undo, сеянный RNG | `Game` |
| `levels.js` | Данные 7 уровней (4×4 → 6×6) | `LEVELS`, `levelById`, `isLastLevel`, `tideConfigForLevel`, `movesConfigForLevel` |
| `progress.js` | Разблокировки уровней, рекорды, нормализация сохранения | `applyLevelWin`, `applyLevelGameOver`, `isLevelUnlocked` |
| `achievements.js` | Достижения | `ACHIEVEMENTS`, `evaluateAchievements` |
| `daily.js` | Ежедневные задания | `DAILY_TASKS`, `ensureDaily`, `dailyMetric`, `checkDaily` |
| `daily-login.js` | Серия наград за ежедневный вход | `claimDailyLogin`, `dailyLoginInfo` |
| `daily-puzzle.js` | Ежедневная головоломка (общий сид на дату) | `puzzleStartBoard`, `ensureDailyPuzzle`, `recordPuzzleResult`, `puzzleInfo`, `makeRng`, `seedFromDate` |
| `rewards.js` | Наградная реклама (rewarded revive) | `canRevive` |
| `combo.js` | Серии/комбо | `comboReward`, `STREAK_THRESHOLD` |
| `shop.js` | Магазин: бусты/перки/скины/темы, экономика | `getShopItem`, `buyItem`, `useBoost`, `ownsPerk`, `applyCoinReward`, `effectiveUndoLimit`, `appearanceScoreMultiplier` |
| `chest.js` | Сундук, обмен очков, донат-паки | `openChest`, `exchangePointsForDoubloons`, `DONATE_PACKS`, `todayKey` |
| `depths-map.js` | Карта глубин | `DEPTH_NODES`, `depthRewardFor`, `depthStatus`, `claimDepthReward`, `pendingDepthRewards` |
| `missions.js` | Сюжетные миссии | `missionForLevel`, `missionProgress`, `isMissionComplete`, `claimMissionReward` |
| `cloud-sync.js` | Облачные/локальные сохранения, конфликты | `resolveConflict`, `mergeBoardSaves` |
| `platform.js` | Определение платформы и нативных хаков | `applyPlatform`, `hapticLight` |
| `platform-sdk.js` | Единый адаптер VK / Яндекс / Web: соцмеханики, лидерборд, облако, реклама | `sdk` (default) |
| `sound.js` | Web Audio звуки | `playMove`, `playMerge`, `playWin`, `playGameOver`, `suspendSound`, `resumeSound` |
| `native-entry.js` | Точка входа для Capacitor-бандла (`build:www`) | — |
| `native-plugins.js` | Haptics / StatusBar / SplashScreen для нативных сборок | — |

## Состояние и сохранение

- Ключи `localStorage`: `ocean2048_v1` (основной state), `ocean2048_saves` (снимки для undo/слейвов).
- **Правило:** любое новое поле добавляется в `loadState()` (`main.js`) с дефолтом и в нормализацию в `progress.js`, чтобы старые сохранения не ломались.
- Валидация и защита от битых данных — приоритет: игра не должна падать из-за старого/повреждённого сохранения.

## Тестирование

- Тесты рядом: `*.test.js` (node:test, без DOM).
- Стиль: чистые функции, сеянный RNG (`makeRng`) для детерминизма, подмена `Math.random` в тестах работает (см. `game.js` `_rng`).
- Запуск: `npm test` из корня.

## Конвенции

- Документация модуля — короткий блок вверху файла.
- Имена переменных/функций на английском, комментарии и UI-тексты на русском.
- Платформенный SDK трогается ТОЛЬКО через `platform-sdk.js`.
- `reduce-motion` — анимации/частицы отключаются (доступность + модерация).
