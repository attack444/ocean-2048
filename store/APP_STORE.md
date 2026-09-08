# App Store — чеклист публикации «Океан 2048»

## Идентификаторы
| Поле | Значение |
|------|----------|
| Bundle ID | `com.ocean2048.game` |
| App name | Океан 2048 |
| Subtitle (30) | 7 глубин, прилив и отлив, без рекламы |
| Primary category | Games → Puzzle |
| Secondary | Games → Board (опционально) |
| Price | Free |
| In-App Purchases | **None** |

## Privacy — App Privacy (Nutrition Labels)
В App Store Connect → App Privacy:

| Тип данных | Собирается? |
|------------|-------------|
| Contact Info | No |
| Health & Fitness | No |
| Financial Info | No |
| Location | No |
| Sensitive Info | No |
| Contacts | No |
| User Content | No |
| Browsing History | No |
| Search History | No |
| Identifiers | No |
| Purchases | No |
| Usage Data | No |
| Diagnostics | No |
| Other Data | No |

Выберите: **«Data Not Collected»** (или эквивалент «We do not collect data»).

Privacy Policy URL: HTTPS-страница `privacy-policy.html` (обязательно).

## Age Rating (questionnaire)
- Cartoon / Fantasy Violence — **None**
- Realistic Violence — **None**
- Sexual Content — **None**
- Profanity — **None**
- Alcohol / Tobacco / Drugs — **None**
- Simulated Gambling — **None** (слияние плиток ≠ gambling)
- Unrestricted Web Access — **No**
- Gambling / Contests — **No**

Ожидаемый рейтинг: **4+**.

## Export Compliance
Приложение использует только стандартный HTTPS/ATS системы.
В App Store Connect обычно достаточно:
- Uses encryption: **Yes** (HTTPS)
- Exempt under category 5B (standard encryption only): **Yes**

## Required assets
| Ассет | Требование | Файл |
|-------|------------|------|
| App Icon | 1024×1024, **без альфы**, без скругления | `store/assets/app-store-icon-1024.png` |
| iPhone screenshots | 6.1" (мин. по гайду Apple) | готовы: `store/shots/iphone-*.png` (1179×2556): home, moves, shop, shop-skin |
| iPad screenshots | если поддерживаете iPad | рекомендуется (пока нет) |
| Splash | через Capacitor Splash Screen | цвет `#0a1a2e` |

## App Review notes (вставить в Review Information)
```
Океан 2048 — офлайн-головоломка без аккаунта, рекламы и покупок.
Управление: свайп по полю или кнопки-стрелки.
Прогресс хранится только на устройстве.
Privacy Policy: https://5mb2.ru/static/games/ocean-2048/privacy-policy.html
Демо-аккаунт не требуется.
```

## Сборка (нужен macOS + Xcode)
```bash
npm install
npm run ios:add     # один раз, только на Mac
npm run sync
npx cap open ios    # Xcode → Signing → Archive → Distribute
```

Минимальная версия iOS: задаётся Capacitor (обычно iOS 14+).

## Guideline tips (чтобы не отклонили)
1. **4.2 Minimum Functionality** — у нас полноценная игра с уровнями, не «голый сайт в WebView». Не загружайте контент только с удалённого сервера: `webDir` локальный (`www/`).
2. **5.1.1 Privacy** — обязателен Privacy Policy URL.
3. **2.3.7 Accurate Metadata** — название и скриншоты должны совпадать с игрой.
4. Не используйте слово «Apple» / логотипы в иконке.
5. Поддержка жеста «назад» не критична на iOS; на Android обработан `backButton`.

## Текст для Store (RU)
**Promotional text:**
Живой океан 2048: прилив и отлив, акула-охотник, турнир и дуэль дня. Без рекламы!

**Description:**
то же, что в `GOOGLE_PLAY.md` (полное описание) — актуализировано 2026-09-08
под «Глубину ядра» 6/6 (Прилив и отлив 🌊↔️, Акула-охотник 🦈, плитки-способности ⚡,
случайные события 🎲, дельфин-навигатор 🐬) и соревнование (турнир 🏆, дуэль ⚔️,
ежедневная головоломка 🧩, карта глубин, челленджи).

**Keywords (100 chars):**
2048,головоломка,океан,пазл,числа,без рекламы,офлайн,уровни,прилив,игра
