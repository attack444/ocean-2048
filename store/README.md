# Публикация: веб · iOS · Android

> ✅ **Единый отслеживаемый чеклист готовности: [`STORE_CHECKLIST.md`](./STORE_CHECKLIST.md)**

Три версии одной игры:

| Версия | Как выглядит | Как собрать / открыть |
|--------|--------------|------------------------|
| **Веб** | Деревянная рамка-«окошко», PWA, fullscreen-кнопка | Открыть `index.html` / задеплоить на 5mb2.ru |
| **Android** | Без рамки, safe-area, D-pad, haptics | `npm run android` → Android Studio → AAB |
| **iOS** | Без рамки, safe-area, D-pad, haptics | На Mac: `npm run ios` → Xcode → Archive |
| **RuStore** | Та же Android-сборка | `npm run android` → AAB → console.rustore.ru |

Предпросмотр нативного UI в браузере:
- `index.html?platform=android`
- `index.html?platform=ios`

## Обязательно до отправки в магазины
1. Задеплойте игру и `privacy-policy.html` на **HTTPS** (5mb2.ru).
2. В Play Console / App Store Connect укажите **URL политики конфиденциальности**.
3. Заполните формы по гайдам:
   - [GOOGLE_PLAY.md](./GOOGLE_PLAY.md) — Data safety, IARC, listing
   - [APP_STORE.md](./APP_STORE.md) — App Privacy, Age Rating, Review notes
   - [RUSTORE.md](./RUSTORE.md) — RuStore: консоль, подпись, листинг
4. Сделайте **реальные скриншоты** с эмулятора/устройства (не оставляйте заглушки).
5. Privacy Policy URL: `https://5mb2.ru/static/games/ocean-2048/privacy-policy.html`
   Контакт: `slavasundukov887@gmail.com`

## Графика
Сгенерированные ассеты лежат в `store/assets/`:
- `app-store-icon-1024.png` — иконка App Store (без прозрачности)
- `feature-graphic.png` — Google Play Feature Graphic 1024×500
- `splash-2732.png` — универсальный splash

Иконки PWA — в `/icons/`.
