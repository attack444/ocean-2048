# 🚀 Ранбук публикации «Океан 2048» — пошагово по консолям

> Единый **порядок действий** для ручной публикации игры на всех площадках.
> Это «что нажимать и что загружать» в консолях — без кода.
> Обновлён: 2026-09-08 (после фикса ebbtide, новых механик «Глубины ядра» 6/6,
> ответов модерации VK/RuStore; коммит `51d7968` запушен в `feat/vk-yandex-sdk`).

Детальные гайды по каждой площадке (тексты, лимиты, чек-листы модерации):
[`GOOGLE_PLAY.md`](./GOOGLE_PLAY.md) · [`APP_STORE.md`](./APP_STORE.md) ·
[`RUSTORE.md`](./RUSTORE.md) · [`VK_GAMES.md`](./VK_GAMES.md) ·
[`OK_GAMES.md`](./OK_GAMES.md) · [`YANDEX_GAMES.md`](./YANDEX_GAMES.md).
Мастер-чеклист: [`STORE_CHECKLIST.md`](./STORE_CHECKLIST.md).

---

## 0. Что уже готово в репозитории (проверено 08.09)

- ✅ Тесты **582/582**, lint чистый (0 ошибок).
- ✅ Фикс бага **ebbtide** (счётчик changed).
- ✅ Новые механики «Глубины ядра» 6/6 (Прилив и отлив 🌊↔️, зрелищные эффекты,
  расширенный «живой океан», визуал акулы).
- ✅ Скриншоты всех площадок перегенерированы (08.09).
- ✅ VK-ассеты перегенерированы (08.09).
- ✅ `build/yandex.zip` пересобран (≈11.75 МБ, 29 JS-модулей).
- ✅ `build/vk/` пересобрана.
- ✅ `npm run sync` выполнена — нативные ассеты Android/iOS содержат свежий код.
- ✅ RuStore launcher-иконки заменены на иконку игры (legacy + adaptive full-bleed).
- ✅ **AAB пересобран локально (08.09)** — `app-release.aab` ≈14.2 МБ, подписан
  (CN=Ocean 2048), содержит механики «Глубины ядра» 6/6 + новые иконки. См. шаг 1.1.
- ✅ Всё закоммичено (`51d7968`) и запушено.

---

## 1. Сначала собери артефакты

> ✅ **AAB уже пересобран локально (2026-09-08)** — см. шаг 1.1. Тулчейн (JDK 21 Temurin +
> Android SDK android-35 + build-tools 34/35 + gradle-кэш) **уже есть в `tools/`**,
> установка не требуется. Повторная сборка нужна только после изменения нативного кода
> или веб-ассетов.

### 1.1. Пересобрать AAB (нужно для Google Play и RuStore)
```bash
npm run sync        # обновить www/ → нативные ассеты (уже сделано 08.09, но повторить перед сборкой)
```
Затем из папки `android/` (CLI, работает на пути с кириллицей `D:\Рабочая\pirat`):
```bat
set "JAVA_HOME=d:\Рабочая\pirat\tools\jdk-21.0.12.1+1"
set "GRADLE_USER_HOME=d:\Рабочая\pirat\tools\gradle-cache"
gradlew.bat bundleRelease --no-daemon
:: → android/app/build/outputs/bundle/release/app-release.aab
```
Либо в Android Studio: **Build → Generate Signed Bundle / APK → Android App Bundle**,
выбрать keystore `tools/keystore/rustore-upload.jks` (пароли в `android/keystore.properties`).

> ✅ **Результат 08.09:** `app-release.aab` = **14 841 258 байт (≈14.2 МБ)**, подписан
> keystore `tools/keystore/rustore-upload.jks` (SHA256withRSA, 2048-bit, CN=Ocean 2048 /
> O=NeoBrain, действителен до 2054-01-17) — верифицировано `jarsigner`.

> ⚠️ **Нюансы сборки на пути с кириллицей `D:\Рабочая\pirat`** (уже учтены в репозитории):
> - `android/gradle.properties`: `android.overridePathCheck=true` (иначе AGP падает на
>   не-ASCII пути, b.android.com/95744) и `-Dfile.encoding=UTF-8` в `org.gradle.jvmargs`.
> - `android/keystore.properties`: `storeFile` задан **относительным** путём
>   `../../tools/keystore/rustore-upload.jks`. Абсолютный кириллический путь ломается:
>   `java.util.Properties.load(InputStream)` читает в ISO-8859-1 и портит UTF-8 (mojibake),
>   а `-Dfile.encoding` на это не влияет.
> - `android/local.properties`: `sdk.dir=d:/Рабочая/pirat/tools/android-sdk`.

> Один и тот же AAB подходит и для Google Play, и для RuStore
> (package `com.ocean2048.game`, versionCode 1, versionName 1.0).

### 1.2. iOS (только на macOS)
```bash
npm run sync        # обновить www/ → ios/App/App/public
```
В **Xcode**: открыть `ios/App/App.xcworkspace` → **Archive** → **Distribute App**.

---

## 2. VK Игры (dev.vk.com, приложение 54731343) — повторная подача после модерации

> ⚠️ **Это приоритет №1** — модерация VK вернула 3 замечания, все три закрываются
> действиями в кабинете (код уже готов).

### Шаг 2.1. Задеплоить свежую сборку на HTTPS
```bash
npm run build:vk    # → build/vk/
```
Залить содержимое `build/vk/` в статику сервера (5mb2.ru) по существующей схеме
деплоя. Прямой URL: `https://5mb2.ru/static/games/ocean-2048/index.html`.

### Шаг 2.2. Ответ модерации №1 — сменить тип на «Игра»
1. dev.vk.com → приложение **54731343** → **«Настройки»**.
2. Поле **«Тип приложения»** → выбрать **«Игра» (Game)**, а не «Приложение».
3. Сохранить. Заново заполнить карточку каталога: категория **«Головоломки»**,
   возрастной рейтинг **3+**, описание (тексты в [`VK_GAMES.md`](./VK_GAMES.md)).
4. Проверить, что URL в разделе **«Размещение»** указывает на свежую сборку.

### Шаг 2.3. Ответ модерации №2 — интерфейс без скролла
Код уже готов (компактная адаптивная вёрстка, `overflow: hidden`, доска
масштабируется под `100dvh`). **Проверь визуально** в iframe VK на ПК и телефоне:
главный экран (шапка + статистика + доска + управление) должен помещаться без
прокрутки. Если что-то переполняется — сообщи, поправим медиа-запросы.

### Шаг 2.4. Ответ модерации №3 — тестовые платежи за голоса
Код готов (`VKWebAppGetOrderItems` + `VKWebAppShowOrderBox`). Активировать в кабинете:
1. dev.vk.com → приложение 54731343 → **«Платежи»** → «Товары» → «Создать товар» (4 шт.):
   | id | Название | Цена (голоса) |
   |----|----------|---------------|
   | `donate_small` | Мешок жемчуга | 10 |
   | `donate_medium` | Сундук с жемчугом | 25 |
   | `donate_large` | Королевская шкатулка | 60 |
   | `donate_mega` | Сокровищница глубин | 130 |
2. Включить монетизацию (платежи за голоса; реклама interstitial/rewarded — по желанию).
3. Проверить в **песочнице** (тестовый режим): игра → магазин → «Купить» →
   системное окно `VKWebAppShowOrderBox` → подтвердить → жемчужины зачисляются.
4. В консоли нет ошибок `VKWebAppGetOrderItems` / `VKWebAppShowOrderBox`.

### Шаг 2.5. Подать на модерацию заново
1. Раздел **«Каталог» / «Публикация»**.
2. Заполнить карточку + **«Описание основных сценариев»** (в т.ч. шаг «покупка
   жемчужин за голоса через системное окно VK»).
3. Загрузить ассеты каталога: иконка `store/vk/icon-universal-576.png`,
   обложка `store/vk/snippet-1120x630.png`, скриншоты `store/vk/screenshots/*.png`.
4. Отправить на модерацию.

---

## 3. Одноклассники (OK) — привязка и модерация

> OK — та же платформа VK Games, то же приложение 54731343. Отдельного кода нет.

1. dev.vk.com → приложение 54731343 → **«Настройки»** → блок **«Другие площадки»**.
2. **«Привязать OK ID»** → создать/выбрать приложение Одноклассников.
3. Указать URL размещения: `https://5mb2.ru/static/games/ocean-2048/index.html`.
4. Через ~15 мин игра появится по прямой ссылке `https://ok.ru/app/vk_app54731343`
   (у создателя сразу; всем — только после модерации).
5. Подать на модерацию OK. После одобрения доступна всем **по прямой ссылке**
   (в каталог OK не размещается).

---

## 4. Яндекс Игры (console.yandex.ru/games)

1. Пересобрать и загрузить архив:
   ```bash
   npm run build:yandex   # → build/yandex/ ; затем упаковать в build/yandex.zip
   ```
   (готовый `build/yandex.zip` ≈11.75 МБ уже пересобран 08.09).
2. В кабинете: **«Добавить игру»** → загрузить `build/yandex.zip`.
3. Заполнить метаданные (тексты в [`YANDEX_GAMES.md`](./YANDEX_GAMES.md)):
   короткое ≤70, полное ≤1000, SEO ≤160, «Как играть» ≤1000.
   ⚠️ Не писать «без рекламы» — на площадке реклама включена.
4. Загрузить иконку и скриншоты **1280×720**:
   `store/shots/yandex-home.png`, `yandex-moves.png`, `yandex-shop.png`, `yandex-shop-skin.png`.
5. Создать лидерборд **`ocean2048_top`**.
6. Включить монетизацию (interstitial + rewarded) → отправить на модерацию.

---

## 5. RuStore (console.rustore.ru) — повторная подача после модерации

> ⚠️ **Замечание модерации RuStore:** иконка на витрине не совпадала с иконкой
> установленного приложения. **Исправлено в коде** (08.09): launcher-иконки
> заменены на иконку игры (legacy + adaptive full-bleed, скрипт
> `scripts/gen-android-icons.mjs`). ✅ **AAB с новыми иконками пересобран (08.09)** —
> загружай свежий файл из шага 1.1 и подавай заново.

1. Регистрация/вход: console.rustore.ru (верификация ИНН — если ещё не сделана).
2. **«Добавить приложение»** → загрузить свежий AAB (шаг 1.1).
3. Заполнить листинг (тексты в [`RUSTORE.md`](./RUSTORE.md)).
4. Загрузить иконку **512×512**: `icons/icon-512.png` (RGB, без альфы).
5. Загрузить скриншоты **16:9 горизонтальные JPG 1920×1080**:
   `store/shots/rustore-land-{home,moves,shop,shop-skin}.jpg`.
   ⚠️ Вертикальные `rustore-*.png` (1080×1920) консоль обрежет — нужны 16:9.
6. Указать политику конфиденциальности:
   `https://5mb2.ru/static/games/ocean-2048/privacy-policy.html`.
7. Отправить на модерацию. Комиссия для free-приложений не взимается.

---

## 6. Google Play (Play Console)

1. **«Создать приложение»** → загрузить AAB (шаг 1.1).
2. Заполнить листинг (тексты в [`GOOGLE_PLAY.md`](./GOOGLE_PLAY.md)):
   краткое ≤80 симв., полное описание RU.
3. Загрузить графику:
   - Иконка 512×512: `icons/icon-512.png`
   - Feature graphic 1024×500: `store/assets/feature-graphic.png`
   - Скриншоты телефона (824×1830): `store/shots/android-{home,moves,shop,shop-skin}.png`
   - (опционально) планшет.
4. **Data safety**: «No data collected» (все ответы из GOOGLE_PLAY.md).
5. **Возрастной рейтинг**: пройти IARC (ожидаемо PEGI 3 / Everyone).
6. Указать политику конфиденциальности (URL выше).
7. **Production** → отправить на ревью.

---

## 7. App Store (App Store Connect) — только на macOS

1. Собрать iOS (шаг 1.2) → загрузить через Xcode/Transporter.
2. Заполнить листинг (тексты в [`APP_STORE.md`](./APP_STORE.md)):
   Subtitle, Keywords, Promotional text, описание.
3. Загрузить графику:
   - Иконка 1024×1024 без альфы: `store/assets/app-store-icon-1024.png`
   - Скриншоты (1179×2556): `store/shots/iphone-{home,moves,shop,shop-skin}.png`
4. **App Privacy**: «Data Not Collected» (все пункты No).
5. **Age Rating**: questionnaire → **4+**.
6. **Encryption**: Yes (HTTPS) / Exempt under category **5B**.
7. Указать **App Review notes** (текст в APP_STORE.md) и политику конфиденциальности.
8. Отправить на ревью.

---

## 8. После публикации

- [ ] Проверить живую игру на площадках: `node scripts/smoke-prod.js <URL>`.
- [ ] Обновить `docs/PROGRESS-NOTES.md` (даты публикаций, статусы).
- [ ] Обновить `store/STORE_CHECKLIST.md` — отметить выполненные ручные шаги.

---

## Ключевые ссылки

- Кабинеты: dev.vk.com (приложение 54731343) · console.yandex.ru/games ·
  console.rustore.ru · Play Console · App Store Connect.
- Политика: `https://5mb2.ru/static/games/ocean-2048/privacy-policy.html`.
- Контакт: `slavasundukov887@gmail.com`.
- Репозиторий: `attack444/ocean-2048` (ветка `feat/vk-yandex-sdk`).
