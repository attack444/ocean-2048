# 🗂 Кабинеты и сторы: план настройки

> Отдельный пошаговый план по **настройке кабинетов разработчика и публикации** игры
> «Океан 2048» после осеннего обновления (OST + осенние материалы).
> Обновлено: 2026-09-03.

Контекст: процедурная Web Audio-музыка удалена, в игре звучит **оригинальный
саундтрек** (Grand Dark Waltz — вся игра; Ancient Mystery Waltz — PvP/турнир/дуэль).
Голосование за треки отменено. Подготовлены осенние сезонные материалы
([`store/community/autumn/`](../store/community/autumn/), баннеры
[`store/media/banners/autumn/`](../store/media/banners/autumn/)).

---

## 1. Что уже готово (в репозитории)

| Блок | Статус |
|------|--------|
| Код: OST + осень, тесты 529/529, сборки www/vk/yandex, smoke — PASS | ✅ |
| Осенний комплект сообщества `store/community/autumn/` (14 PNG) | ✅ |
| Осенние баннеры `store/media/banners/autumn/` (5 PNG) | ✅ |
| Тексты постов/описаний под OST + осень (в т.ч. `autumn/post-ost.md`, `vk-community.mjs --season autumn`) | ✅ |
| Мастер-чеклист `store/STORE_CHECKLIST.md` (общий) | ✅ |

## 2. VK Mini App / VK Игры (dev.vk.com → приложение 54731343)

- [ ] Обновить **ZIP/хостинг**: задеплоить свежую сборку (`npm run build:vk` →
      `build/vk/`) на 5mb2.ru (или свой хостинг).
- [ ] В кабинете VK: обновить **URL** (если менялся), проверить, что iframe открывается.
- [ ] Заполнить/обновить **карточку каталога** (название «Океан 2048», короткое и полное
      описание — тексты в [`store/VK_GAMES.md`](../store/VK_GAMES.md)).
- [ ] Загрузить **осенние ассеты кабинета**: иконку каталога, обложку, скриншоты.
      Если хотите осенний сезон в каталоге — использовать осенние материалы
      (`store/community/autumn/`, `store/media/banners/autumn/`).
- [ ] **«Описание основных сценариев»** для модерации — текст в VK_GAMES.md.
- [ ] Соцмеханики (VK): таблица рекордов, истории, репост — проверить/настроить.
- [ ] **IAP/донат** (если включаете): VK Платежи, товары — см.
      [`store/VK_IAP_ACTIVATION.md`](../store/VK_IAP_ACTIVATION.md).
- [ ] Проверить **отключение звука** (модерация): кнопка «Выкл» в настройках музыки работает.
- [ ] Модерация → статус «Включено».

## 3. VK-сообщество (5MB2 Digital)

- [ ] Публикация осенних постов: `npm run vk:community -- --season autumn --posts` (+ `--square`).
      (посты возьмут осенние картинки из `store/community/autumn/`)
- [ ] Смена аватара/обложки на осенние при желании:
      `npm run vk:community -- --season autumn --avatar --cover` (нужен `--app-token`).
- [ ] Пост-анонс про OST: текст в [`store/community/autumn/post-ost.md`](../store/community/autumn/post-ost.md).

## 4. Яндекс Игры

- [ ] Пересобрать и загрузить ZIP: `npm run build:yandex` → `build/yandex.zip`.
- [ ] В кабинете Яндекса обновить **метаданные** (название, описание, теги) — тексты в
      [`store/YANDEX_GAMES.md`](../store/YANDEX_GAMES.md). Не писать «без рекламы»
      (на площадке реклама включена).
- [ ] Загрузить иконку и скриншоты 1280×720 (актуальные, с новым UI/осенью при желании).
- [ ] Лидерборд `ocean2048_top`.
- [ ] Монетизация (interstitial + rewarded) → модерация.

## 5. Google Play / App Store / RuStore (нативные)

- [ ] `npm run sync` (обновить `www/` → нативные ассеты) — **обязательно перед сборкой**.
- [ ] Собрать AAB (Google Play / RuStore) и пересобрать iOS (на Mac).
- [ ] Обновить **метаданные/описания** (см. `store/GOOGLE_PLAY.md`, `APP_STORE.md`, `RUSTORE.md`)
      — тексты уже актуализированы под OST/осень.
- [ ] Иконки/скриншоты/feature graphic — обновить на осенние при желании
      (актуальный UI уже в скриншотах).
- [ ] Data safety / App Privacy: «No data collected».
- [ ] Возрастной рейтинг: IARC / App Store questionnaire (ожидаемо 4+ / PEGI 3).
- [ ] Политика конфиденциальности на HTTPS: `https://5mb2.ru/static/games/ocean-2048/privacy-policy.html`.
- [ ] Мастер-чеклист: [`store/STORE_CHECKLIST.md`](../store/STORE_CHECKLIST.md).

## 6. OK / другие площадки

- [ ] Обновить сборку/ссылку/описание (см. `store/OK_GAMES.md`).
- [ ] Осенние материалы при необходимости — те же, что для VK.

## 7. После публикации

- [ ] Обновить `docs/PROGRESS-NOTES.md` (даты публикаций, статусы).
- [ ] Проверить живую игру на площадках (smoke: `node scripts/smoke-prod.js <URL>`).
- [ ] Вернуться к «океанской» теме после окончания осеннего сезона
      (без `--season autumn`), оригиналы сохранены.

## Ключевые ссылки

- Кабинеты: dev.vk.com (приложение 54731343), console.yandex.ru/games,
  console.rustore.ru, Play Console, App Store Connect.
- Контакт: `slavasundukov887@gmail.com`.
