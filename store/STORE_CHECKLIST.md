# ✅ Мастер-чеклист публикации «Океан 2048»

Единый отслеживаемый чеклист перед отправкой в магазины.
Обновлён: 2026-08-18.

Легенда: **`[x]`** — готово в репозитории / подтверждено; **`[ ]`** — ручной шаг в консоли
магазина или на устройстве.

Детальные гайды: [`GOOGLE_PLAY.md`](./GOOGLE_PLAY.md), [`APP_STORE.md`](./APP_STORE.md).

---

## 1. Идентичность и версионирование

- [x] Package / Bundle ID: `com.ocean2048.game`
  (`capacitor.config.json`, `android/app/build.gradle`, `strings.xml`)
- [x] App name: «Океан 2048» (`strings.xml`, `manifest.json`)
- [x] versionCode `1` / versionName `1.0` (`android/app/build.gradle`)
- [x] compileSdk / targetSdk `35`, minSdk `23` (`android/variables.gradle`) — соответствует
  требованиям Google Play 2025–2026 (34+)
- [x] Категория: Games → Puzzle
- [x] Модель: Free, без рекламы, без встроенных покупок

## 2. Приватность

- [x] `privacy-policy.html` — полная политика (RU): сбор данных отсутствует,
  локальное хранение, удаление, дети, разрешения, контакты
- [x] `privacy-policy.html` не попадает в PWA-кэш (network-first в `sw.js`)
- [x] Задеплоить `privacy-policy.html` на HTTPS (5mb2.ru) — доступен:
  `https://5mb2.ru/static/games/ocean-2048/privacy-policy.html`
- [ ] Play Console → Data safety: **«No data collected»** (все ответы из GOOGLE_PLAY.md)
- [ ] App Store Connect → App Privacy: **«Data Not Collected»** (все пункты No)
- [ ] Указать URL политики в обеих консолях

## 3. Листинг (метаданные)

- [x] Краткое описание ≤80 симв. — в [`GOOGLE_PLAY.md`](./GOOGLE_PLAY.md)
- [x] Полное описание RU — в [`GOOGLE_PLAY.md`](./GOOGLE_PLAY.md)
- [x] Subtitle / Keywords / Promotional text — в [`APP_STORE.md`](./APP_STORE.md)
- [x] App Review notes (RU) — в [`APP_STORE.md`](./APP_STORE.md)
- [ ] Перенести тексты в консоли магазинов (вручную)

## 4. Возрастной рейтинг

- [x] IARC / App Store questionnaire: все ответы «None» / «No»
  (без насилия, азартных игр, 18+ контента)
- [ ] Play Console: пройти IARC (ожидаемо **PEGI 3 / Everyone**)
- [ ] App Store: Age Rating questionnaire → **4+**

## 5. Графика

- [x] App Store иконка 1024×1024 без альфы — [`store/assets/app-store-icon-1024.png`](./assets/app-store-icon-1024.png)
- [x] Google Play иконка 512×512 — [`icons/icon-512.png`](../icons/icon-512.png)
- [x] Feature graphic 1024×500 — [`store/assets/feature-graphic.png`](./assets/feature-graphic.png)
- [x] Splash 2732×2732 — [`store/assets/splash-2732.png`](./assets/splash-2732.png)
- [x] Android launcher icon + round icon (`mipmap-*` / `ic_launcher.xml`)
- [x] Android splash (`drawable/splash.png`, цвет `#0a1a2e`)
- [x] Скриншоты Google Play сгенерированы (Playwright, headless Chromium):
  `store/shots/android-home.png`, `android-moves.png`, `android-shop.png`,
  `android-shop-skin.png` — 824×1830
- [x] Скриншоты App Store сгенерированы: `store/shots/iphone-home.png`,
  `iphone-moves.png`, `iphone-shop.png`, `iphone-shop-skin.png` — 1179×2556
- [ ] (опционально) Заменить сгенерированные скриншоты на реальные с
  эмулятора/устройства (со статус-баром); планшет — опционально.
  Генератор: `node scripts/make-store-shots.mjs` (нужны Playwright + сервер :4173)

## 6. Технические требования

- [x] 64-bit ARM (`arm64-v8a`) — стандартная сборка Capacitor 7
- [x] Портретная ориентация (`screenOrientation="portrait"`)
- [x] Только разрешение `INTERNET`; опасных разрешений нет
- [x] `usesCleartextTraffic="false"` (запрещён незащищённый трафик)
- [x] Локальный `webDir` (`www/`) — контент не грузится только с удалённого сервера
  (Guideline 4.2 Minimum Functionality)
- [x] Обработка системной кнопки «назад» на Android (`native-entry.js`)
- [x] PWA: манифест, иконки, offline-кэш всех JS-модулей (`sw.js` v2)

## 7. Экспортные нормы (только App Store)

- [ ] App Store Connect → Encryption: **Yes** (HTTPS) / Exempt under category **5B**
  (только стандартное шифрование)

## 8. Сборка и релиз

- [x] `npm run sync` выполнена (2026-08-17): `www/` пересобран со всеми улучшениями
  (онбординг, модалка рестарта, лимит undo, reduce-motion) и синхронизирован
  в `android/app/src/main/assets/public`. Веб-ассеты gitignored — перед сборкой
  в Android Studio заново выполняй `npm run sync`.
- [x] **Пересборка после экономики (2026-08-18)**: `npm run sync` выполнена —
  `www/` и нативные ассеты (`android/app/src/main/assets/public`,
  `ios/App/App/public`) получили модули `js/shop.js`, `js/daily-login.js`
  и новый UI (лавка, бусты, ежедневный вход, скины/темы). Тесты 177/177.
- [ ] Собрать подписанный **AAB** (Android Studio → Generate Signed Bundle)
- [ ] iOS: собрать на macOS (Xcode → Archive → Distribute)
- [ ] Проверить, что название/скриншоты соответствуют игре (Guideline 2.3.7)
- [ ] Указать App Review notes перед отправкой (текст в APP_STORE.md)

## 9. Яндекс Игры (браузерная платформа)

- [x] SDK-адаптер (init / LoadingAPI / player / лидерборд / реклама / share) — `js/platform-sdk.js`
- [x] Загрузочный экран с прогрессом (LoadingAPI)
- [x] Облачные сохранения (`player.setData/getData`, ключ `ocean2048`)
- [x] Service Worker на площадке отключён (не регистрируется в iframe)
- [x] Сборка веб-версии: `npm run build:yandex` → `build/yandex/` (14 модулей)
- [x] ZIP готов: `build/yandex.zip` (≈275 КБ), иконка в океанском стиле
- [x] Гайд: [`YANDEX_GAMES.md`](./YANDEX_GAMES.md)
- [x] Скриншоты 1280×720 готовы (перегенерированы 20.08.2026): `store/shots/yandex-home.png`, `yandex-moves.png`,
  `yandex-shop.png`, `yandex-shop-skin.png`
- [ ] Загрузить ZIP в кабинет Яндекс Игр, заполнить метаданные, загрузить скриншоты 1280×720 и иконку
- [ ] Создать лидерборд `ocean2048_top` в кабинете
- [ ] Включить монетизацию (реклама interstitial + rewarded) → модерация

---

## ⚠️ Рекомендации (не блокеры)

1. ✅ `<title>` согласован с именем приложения: `Океан 2048 — головоломка 2048`
   (ранее была старая тема) — избегает претензий по бренду «2048»
   (Guideline 2.3.7). Сделано 2026-08-17.
2. **`docs/DEPLOY-NOTES.md` не коммитить** — содержит SSH-доступ и секреты (уже в `.gitignore`).
3. **Отозвать старый GitHub-токен** `ghp_…` (см. `docs/PROGRESS-NOTES.md`) после восстановления
   доступа к GitHub.
4. Перед релизом прогонить `npm test` и `npm run lint` (на 2026-08-18: 177/177, чисто).
   После интеграции экономики тестов стало больше (shop.js / daily-login.js).

## Ключевые ссылки

- Политика приватности: `https://5mb2.ru/static/games/ocean-2048/privacy-policy.html`
  (URL зависит от финального `slug` игры на 5mb2.ru)
- Контакт: `slavasundukov887@gmail.com`
- Репозиторий: `attack444/ocean-2048`
