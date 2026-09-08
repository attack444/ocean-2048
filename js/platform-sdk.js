// Адаптер SDK площадок (VK / Одноклассники / Яндекс / Web).
// Единый интерфейс для VK Mini Apps, Одноклассников (VK Games), Yandex Games и обычного веба
// (PWA / локальный запуск). Все методы безопасны: на вебе без SDK они «вырождаются» в локальные/пустые операции.
//
// Одноклассники (OK) — часть единой платформы VK Games: игра грузится в iframe ok.ru /
// WebView m.ok.ru и использует тот же VK Bridge (dev.vk.com → «Публикация в Одноклассниках»).
// Поэтому хост для OK остаётся 'vk' (все методы VK Bridge работают без изменений), а для
// различий VK/OK используется флаг sdk.ok (true — запуск именно в Одноклассниках).

const LB_NAME = 'ocean2048_top';

function detectHost() {
    const params = new URLSearchParams(location.search);
    const forced = (params.get('platform') || '').toLowerCase();
    if (forced === 'vk') return 'vk';
    if (forced === 'yandex' || forced === 'ya') return 'yandex';

    // VK Mini Apps и Одноклассники (VK Games): мост уже встроен хостом.
    // Одноклассники (ok.ru / m.ok.ru) используют тот же VK Bridge — хост 'vk'.
    if (window.vkBridge || window.VKWebApp) return 'vk';
    if (params.get('vk_app_id') || params.get('vk_platform') || params.get('vk_user_id')) return 'vk';
    // OK-параметры запуска (ok.ru передаёт свои идентификаторы/подпись)
    if (params.get('ok_app_id') || params.get('ok_platform') || params.get('ok_user_id')) return 'vk';

    // Yandex Games: SDK встроен через тег <script src="/sdk.js"> в <head> (async)
    // ИЛИ внедрён самой платформой. Платформа Яндекс Игр всегда добавляет в URL
    // страницы игры параметры app-id и sdk (и при обычном запуске, и в debug-режиме).
    // Без этой проверки, если тег /sdk.js вернул onerror (__yaSdkScriptFailed=true),
    // а window.YaGames ещё не создан — хост ошибочно определяется как 'web' и
    // YaGames.init() не вызывается → «SDK was not initialized» (модерация «W»).
    if (window.ysdk || window.YaGames || window.__yaSdkScriptLoaded) return 'yandex';
    if (params.has('app-id') || params.has('sdk')) return 'yandex';

    return 'web';
}

// Есть ли в документе тег <script src="/sdk.js"> (подключён в index.html)?
// Селектор покрывает и "/sdk.js" (ведущий слэш — официальный путь для архива),
// и "sdk.js" (без слэша) на случай локальной разработки.
// Если тег отсутствует — ждать результат его загрузки не нужно.
function hasYandexSdkTag() {
    try {
        return Array.from(
            document.querySelectorAll('script[src="/sdk.js"], script[src="sdk.js"]')
        ).length > 0;
    } catch (_) {
        return false;
    }
}

// Ждём завершения загрузки тега <script src="/sdk.js"> (async в <head>), чтобы
// корректно определить платформу даже если скрипт ещё грузился при старте модуля.
// На платформе Яндекса onload → window.__yaSdkScriptLoaded (SDK создаст window.YaGames);
// вне платформы /sdk.js не существует → onerror → window.__yaSdkScriptFailed.
// Таймаут ограничивает ожидание, чтобы игра не задерживалась на лоадере (п. 1.1).
function waitForSdkTagResult(ms = 2500) {
    return new Promise((resolve) => {
        if (!hasYandexSdkTag()) return resolve();
        const settled = () =>
            window.__yaSdkScriptLoaded || window.__yaSdkScriptFailed || window.YaGames || window.ysdk;
        if (settled()) return resolve();
        const finish = () => { clearInterval(iv); clearTimeout(timer); resolve(); };
        const timer = setTimeout(finish, ms);
        const iv = setInterval(() => { if (settled()) finish(); }, 50);
    });
}

// Ждём появления window.YaGames (SDK создаёт его после onload тега /sdk.js).
// Устраняет гонку п.1.1: onload → __yaSdkScriptLoaded=true, но window.YaGames
// создаётся SDK чуть позже. Разовая проверка здесь возвращала null, YaGames.init()
// не вызывался → LoadingAPI не работал → модерация видела «W» («SDK не встроено»).
// Таймаут ограничивает ожидание, чтобы игра не задерживалась на лоадере.
function waitForYaGames(ms = 5000) {
    return new Promise((resolve) => {
        if (window.YaGames || window.ysdk) return resolve();
        const finish = () => { clearInterval(iv); clearTimeout(timer); resolve(); };
        const timer = setTimeout(finish, ms);
        const iv = setInterval(() => { if (window.YaGames || window.ysdk) finish(); }, 50);
    });
}

// Подгрузка SDK-скриптов для локального предпросмотра (?platform=vk / ?platform=yandex)
function loadScript(src) {
    return new Promise((resolve) => {
        window.__sdkScripts = window.__sdkScripts || {};
        if (window.__sdkScripts[src]) return resolve();
        const s = document.createElement('script');
        s.src = src;
        s.async = true;
        s.onload = () => { window.__sdkScripts[src] = true; resolve(); };
        s.onerror = () => resolve();
        document.head.appendChild(s);
    });
}

// Ограничиваем время инициализации, чтобы игра не «зависала» на загрузочном
// экране, если SDK недоступен (важно для прохождения модерации п.1.1).
function withTimeout(promise, ms = 5000) {
    return new Promise((resolve) => {
        let done = false;
        const timer = setTimeout(() => { if (!done) { done = true; resolve(null); } }, ms);
        const finish = (v) => { if (!done) { done = true; clearTimeout(timer); resolve(v); } };
        try { Promise.resolve(promise).then(finish, () => finish(null)); }
        catch (_) { finish(null); }
    });
}

async function ensureBridge() {
    if (window.vkBridge) return window.vkBridge;
    await loadScript('https://unpkg.com/@vkontakte/vk-bridge/dist/browser.min.js');
    return window.vkBridge || null;
}

async function ensureYaGames() {
    if (window.ysdk) return window.ysdk;
    // Официальная схема подключения SDK Яндекс Игр (раздел «Подключение»
    // документации): для игр, загружаемых архивом на сервер Яндекса, путь — /sdk.js
    // (с ведущим "/"), платформа проксирует его (скачивать sdk.js не нужно).
    // ВАЖНО (п.1.7): в программном коде нет абсолютных URL на внешние хранилища Яндекса.
    // Если тег /sdk.js уже есть в index.html — не подключаем его повторно, даже если
    // он вернул onerror (__yaSdkScriptFailed): на платформе SDK может быть внедрён
    // самой платформой (URL-параметр sdk=), поэтому достаточно дождаться window.YaGames.
    if (!window.YaGames && !hasYandexSdkTag()) {
        await loadScript('/sdk.js');
    }
    // Ждём создания window.YaGames: onload тега и создание SDK-объекта происходят
    // не в один момент времени (или SDK внедряется платформой с задержкой).
    // Если window.YaGames так и не появился — возвращаем null, игра продолжит
    // без SDK, но не «зависнет» на загрузочном экране.
    await waitForYaGames(5000);
    if (window.YaGames) {
        try { window.ysdk = await withTimeout(window.YaGames.init()); } catch (_) {}
    }
    return window.ysdk || null;
}

// Определение Одноклассников по hostname: окно игры может быть в iframe ok.ru
// (десктоп) или в WebView m.ok.ru (мобильная версия сайта / приложения OK).
// ВАЖНО: в iframe window.location.hostname — это хост родителя (ok.ru), т.к.
// платформа OK встраивает игру по адресу https://ok.ru/app/{ID} (как и VK — vk.com/app{ID}).
function isOkHost() {
    try {
        const h = String(location.hostname || '').toLowerCase();
        return h === 'ok.ru' || h.endsWith('.ok.ru') || h === 'm.ok.ru';
    } catch (_) { return false; }
}

export const sdk = {
    host: 'web',          // 'vk' | 'yandex' | 'web'
    ok: false,            // true — запуск в Одноклассниках (ok.ru/m.ok.ru, хост при этом 'vk')
    vk: null,
    ya: null,
    player: null,
    lang: null,           // автоопределённый язык (п. 2.14) — из environment.i18n.lang
    initialized: false,

    async init() {
        // Ждём результат загрузки тега sdk.js (async в <head>): на платформе
        // Яндекса он успешно загружается (onload) и создаёт window.YaGames.
        // Это устраняет гонку, когда main.js стартует раньше, чем sdk.js,
        // и хост ошибочно определялся как 'web' (SDK не инициализировался →
        // LoadingAPI.ready() не вызывался → модерация видела «SDK не встроен»).
        await waitForSdkTagResult(2500);
        this.host = detectHost();
        // Одноклассники используют тот же VK Bridge: хост 'vk', но флаг ok=true,
        // чтобы код мог отличать VK от OK (URL запуска ok.ru/app/{ID} vs vk.com/app{ID}).
        this.ok = this.host === 'vk' && (isOkHost() || /[?&]ok_/.test(String(location.search)));
        if (this.host === 'vk') {
            this.vk = await ensureBridge();
            // VK Mini Apps: обязательный VKWebAppInit — инициализация моста.
            // Без него методы (VKWebAppStorageSet/Get, VKWebAppShowLeaderBoardBox,
            // VKWebAppShowNativeAds, VKWebAppShare) не работают.
            if (this.vk) {
                try { await this.vk.send('VKWebAppInit', {}); } catch (_) {}
            }
        } else if (this.host === 'yandex') {
            this.ya = await ensureYaGames();
        } else if (hasYandexSdkTag() && !window.__yaSdkScriptFailed) {
            // Тег /sdk.js есть в документе, но ещё не «созрел» за время
            // waitForSdkTagResult (например, медленная сеть на платформе Яндекса).
            // Пытаемся инициализировать SDK; если удалось — повышаем хост до
            // 'yandex', иначе LoadingAPI не отработает и модерация отклонит (п.1.1).
            const ya = await ensureYaGames();
            if (ya) {
                this.ya = ya;
                this.host = 'yandex';
            }
        }
        if (this.ya) {
            // getPlayer() — единственный SDK-вызов без withTimeout: если в окружении
            // (debug-панель Яндекс Игр / draft) он не разрешается, sdk.init() «зависает»,
            // LoadingAPI.ready() не вызывается → платформа видит «SDK в режиме ожидания» (W).
            try { this.player = await withTimeout(this.ya.getPlayer({ scopes: false }), 5000); } catch (_) {}
        }
        // П. 2.14: автоопределение языка — строго при запуске, не в процессе игры.
        // ysdk.environment.i18n.lang доступен сразу после YaGames.init().
        this.lang = this.ya?.environment?.i18n?.lang || null;
        this.initialized = true;
        return this.host;
    },

    isPlatform() { return this.host === 'vk' || this.host === 'yandex'; },

    // Одноклассники (VK Games). При запуске в iframe/WebView OK хост === 'vk'
    // (тот же VK Bridge), но флаг ok === true. Удобно для точечных отличий UI.
    isOk() { return this.ok === true; },

    // ── Язык (п. 2.14) ─────────────────────────────────────────
    getLang() {
        return this.lang;
    },

    // ── Загрузочный экран (Yandex LoadingAPI) ──────────────────
    setLoadingProgress(p) {
        try {
            if (this.ya?.features?.LoadingAPI?.setLoadingProgress) {
                this.ya.features.LoadingAPI.setLoadingProgress(Math.max(0, Math.min(100, p)));
            }
        } catch (_) {}
    },
    loadingReady() {
        try {
            if (this.ya?.features?.LoadingAPI?.ready) {
                this.ya.features.LoadingAPI.ready();
            }
        } catch (_) {}
    },

    // ── Разметка геймплея (Yandex GameplayAPI, п. 1.19.3) ─────
    // start — когда игра реально запущена (уровень, игровой процесс),
    // stop — когда игровой процесс завершён/прерван (меню, пауза, реклама, проигрыш).
    gameplayStart() {
        try {
            if (this.ya?.features?.GameplayAPI?.start) this.ya.features.GameplayAPI.start();
        } catch (_) {}
    },
    gameplayStop() {
        try {
            if (this.ya?.features?.GameplayAPI?.stop) this.ya.features.GameplayAPI.stop();
        } catch (_) {}
    },

    // ── Пауза и возобновление (game_api_pause / game_api_resume, п. 1.19.4) ──
    // Платформа уведомляет о показе полноэкранной рекламы, сворачивании и т.п.
    onPause(cb) {
        try { if (this.ya?.on) this.ya.on('game_api_pause', cb); } catch (_) {}
    },
    offPause(cb) {
        try { if (this.ya?.off) this.ya.off('game_api_pause', cb); } catch (_) {}
    },
    onResume(cb) {
        try { if (this.ya?.on) this.ya.on('game_api_resume', cb); } catch (_) {}
    },
    offResume(cb) {
        try { if (this.ya?.off) this.ya.off('game_api_resume', cb); } catch (_) {}
    },

    // ── Облачные сохранения ────────────────────────────────────
    // obj — произвольный JSON-сериализуемый объект
    async saveCloud(obj) {
        if (this.host === 'vk' && this.vk) {
            try {
                await this.vk.send('VKWebAppStorageSet', {
                    key: 'ocean2048_save',
                    value: JSON.stringify(obj),
                });
                return true;
            } catch (_) { return false; }
        }
        if (this.host === 'yandex' && this.player) {
            try {
                await withTimeout(this.player.setData({ ocean2048: JSON.stringify(obj) }), 5000);
                return true;
            } catch (_) { return false; }
        }
        return false;
    },
    async loadCloud() {
        if (this.host === 'vk' && this.vk) {
            try {
                const res = await this.vk.send('VKWebAppStorageGet', { keys: ['ocean2048_save'] });
                const val = res?.keys?.[0]?.value;
                if (!val) return null;
                return JSON.parse(val);
            } catch (_) { return null; }
        }
        if (this.host === 'yandex' && this.player) {
            try {
                // getData() идёт до LoadingAPI.ready() (main.js → loadCloud) — без
                // таймаута зависший вызов оставляет загрузочный экран и «W» (SDK ждёт).
                const data = await withTimeout(this.player.getData(), 5000);
                const raw = data?.ocean2048;
                if (!raw) return null;
                return JSON.parse(raw);
            } catch (_) { return null; }
        }
        return null;
    },

    // ── Лидерборды ─────────────────────────────────────────────
    // VK: методы VKWebAppSaveToLeaderBoard / VKWebAppGetLeaderBoard УДАЛЕНЫ из
    // vk-bridge (проверено в 3.0.2 и 2.2.2). Актуальный механизм (по документации
    // dev.vk.com «Таблица результатов»):
    //   1) запись — серверный secure.addAppEvent (только после публикации в каталоге,
    //      требует сервисный ключ — реализуется в Фазе 4 на бэкенде);
    //   2) показ — системная таблица VK через VKWebAppShowLeaderBoardBox { user_result }.
    // Клиентского чтения записей таблицы в свою UI-таблицу НЕТ.
    // score — итоговые очки (1–10 000 000). Уровень для VK больше не нужен:
    // клиентской записи нет (серверный secure.addAppEvent в Фазе 4).
    async submitScore(score) {
        // VK: клиентского метода записи больше нет. Запись происходит на сервере
        // через secure.addAppEvent (после каталога, Фаза 4). На клиенте только
        // показываем системную таблицу (showLeaderboard) с текущим результатом.
        // Возвращаем false, чтобы не вводить в заблуждение: запись НЕ выполнена.
        if (this.host === 'vk') return false;
        if (this.host === 'yandex' && this.ya?.leaderboards) {
            try {
                // Новый API лидербордов (см. документацию): ysdk.leaderboards.setScore().
                await this.ya.leaderboards.setScore(LB_NAME, Math.round(score));
                return true;
            } catch (_) { return false; }
        }
        return false;
    },
    async getLeaderboard() {
        // Возвращает [{ name, score, isMe }] или []
        // VK: клиентского чтения таблицы нет — системная таблица показывается
        // через showLeaderboard(). Для кастомной UI-таблицы возвращаем [] и
        // main.js рисует локальный фолбэк (рекорд + рекорды уровней).
        if (this.host === 'vk') return [];
        if (this.host === 'yandex' && this.ya?.leaderboards) {
            try {
                // Новый API лидербордов (см. документацию): ysdk.leaderboards.getEntries().
                const res = await this.ya.leaderboards.getEntries(LB_NAME, {
                    quantityTop: 10,
                    includeUser: true,
                    quantityAround: 5,
                });
                const rows = res?.entries || [];
                const myId = this.player?.uniqueID;
                const list = rows.map(r => ({
                    name: r.player?.publicName || 'Игрок',
                    score: Number(r.score) || 0,
                    // isMe определяется по уникальному идентификатору пользователя (uniqueID).
                    isMe: !!myId && !!r.player && String(r.player.uniqueID) === String(myId),
                }));
                return list;
            } catch (_) { return []; }
        }
        return [];
    },
    // Показ системной таблицы результатов VK с результатом игрока.
    // score — очки партии (user_result по документации: «передайте уровень,
    // количество очков или баллов миссии в параметр user_result»).
    // VKWebAppShowLeaderBoardBox не проверяет user_result на ограничения.
    // Возвращает true, если таблица открыта.
    async showLeaderboard(score) {
        if (this.host === 'vk' && this.vk) {
            try {
                const userResult = Math.max(1, Math.round(Number(score) || 0));
                await this.vk.send('VKWebAppShowLeaderBoardBox', { user_result: userResult });
                return true;
            } catch (_) { return false; }
        }
        return false;
    },

    // ── Донат / игровые покупки (VK, голоса) ─────────────────
    // Покупка виртуальных ценностей за голоса VK: товары создаются в настройках
    // приложения (кабинет VK → Платежи). Клиент открывает системное окно
    // подтверждения через VKWebAppShowOrderBox; списание голосов выполняет VK.
    //
    // ⚠️ Безопасная (рекомендуемая) схема — подтверждать покупку на своём сервере
    // (платёжные уведомления + secure API). Здесь — клиентская выдача по успешному
    // ответу моста (подходит для тестового режима и простых игр; для продакшена
    // добавьте серверную валидацию в Фазе 6).
    //
    // getDonateCatalog(): список товаров магазина (id, title, price в голосах).
    // Возвращает [] вне VK или при ошибке.
    async getDonateCatalog() {
        if (this.host !== 'vk' || !this.vk) return [];
        try {
            const res = await this.vk.send('VKWebAppGetOrderItems', {});
            const items = res?.items || [];
            return items.map((it) => ({
                id: String(it.id || ''),
                title: String(it.title || ''),
                description: String(it.description || ''),
                price: Number(it.price) || 0, // голоса
            }));
        } catch (_) { return []; }
    },
    // buyDonate(itemId): открывает окно подтверждения покупки товара за голоса.
    // Возвращает { ok: true, itemId } — оплата подтверждена, { ok: false } — иначе.
    async buyDonate(itemId) {
        if (this.host !== 'vk' || !this.vk || !itemId) return { ok: false };
        try {
            const res = await this.vk.send('VKWebAppShowOrderBox', {
                type: 'item',
                item: String(itemId),
            });
            return { ok: !!(res && res.success !== false), itemId: String(itemId) };
        } catch (_) { return { ok: false }; }
    },

    // ── Реклама ────────────────────────────────────────────────
    // showInterstitial: true — реклама показана (или закрыта)
    async showInterstitial() {
        if (this.host === 'vk' && this.vk) {
            try {
                await this.vk.send('VKWebAppShowNativeAds', { ad_format: 'interstitial' });
                return true;
            } catch (_) { return false; }
        }
        if (this.host === 'yandex' && this.ya?.adv) {
            return new Promise((resolve) => {
                try {
                    // Колбэки строго по документации: onOpen, onClose(wasShown), onError.
                    this.ya.adv.showFullscreenAdv({
                        callbacks: {
                            onOpen: () => {},
                            onClose: (wasShown) => resolve(wasShown !== false),
                            onError: () => resolve(false),
                        },
                    });
                } catch (_) { resolve(false); }
            });
        }
        return false;
    },
    // showRewarded: true — награда получена (ролик досмотрен до конца)
    async showRewarded() {
        if (this.host === 'vk' && this.vk) {
            try {
                // VK: VKWebAppShowNativeAds возвращает { result: true } только если
                // пользователь досмотрел rewarded-ролик до конца. result: false —
                // закрыл раньше (награда не выдаётся).
                const res = await this.vk.send('VKWebAppShowNativeAds', { ad_format: 'reward' });
                return !!(res && res.result !== false);
            } catch (_) { return false; }
        }
        if (this.host === 'yandex' && this.ya?.adv) {
            return new Promise((resolve) => {
                let rewarded = false;
                try {
                    // Колбэки строго по документации: onOpen, onRewarded, onClose(wasShown), onError.
                    this.ya.adv.showRewardedVideo({
                        callbacks: {
                            onOpen: () => {},
                            onRewarded: () => { rewarded = true; },
                            onClose: () => resolve(rewarded),
                            onError: () => resolve(false),
                        },
                    });
                } catch (_) { resolve(false); }
            });
        }
        return false;
    },

    // ── Поделиться ─────────────────────────────────────────────
    // Возвращает true, если действие выполнено (диалог/копирование)
    async share(text, link) {
        const url = link || location.href;
        if (this.host === 'vk' && this.vk) {
            try {
                // VKWebAppShare открывает системный диалог «Поделиться» внутри VK
                // (не требует прав wall / access token) — предпочтительный способ.
                await this.vk.send('VKWebAppShare', { link: url });
                return true;
            } catch (_) { return false; }
        }
        // Яндекс / веб: Web Share API, иначе копируем ссылку
        if (navigator.share) {
            try { await navigator.share({ text, url }); return true; } catch (_) { return false; }
        }
        if (navigator.clipboard) {
            try { await navigator.clipboard.writeText(url); return true; } catch (_) {}
        }
        return false;
    },

    // ── Соцмеханики VK (Фаза 2) ────────────────────────────────
    // Все методы безопасны: вне VK («web» / «yandex») возвращают false или [].
    // ⚠️ По документации dev.vk.com приглашения (VKWebAppShowInviteBox) и запросы
    // (VKWebAppShowRequestBox) доступны только после публикации в каталоге;
    // код готовим заранее, активируем после каталога (Фаза 3).
    // requestKey — дефолтный текст приглашения из кабинета приложения.
    // Возвращает true, если системный диалог открыт.
    async showInvite(requestKey) {
        if (this.host !== 'vk' || !this.vk) return false;
        try {
            const params = {};
            if (requestKey) params.requestKey = requestKey;
            await this.vk.send('VKWebAppShowInviteBox', params);
            return true;
        } catch (_) { return false; }
    },

    // Запрос: выбрать друга и отправить ему сообщение-вызов из приложения.
    // friendId — конкретный друг (по умолчанию системный выбор списка друзей).
    // text — текст сообщения (по документации не более 200 символов).
    // requestKey — ключ запроса: придёт получателю как URL-параметр vk_request_key
    //              при запуске игры (для отслеживания конверсии).
    // ВАЖНО: по документации dev.vk.com (раздел «Запросы») параметр адресата
    // называется uid (не user_id) — иначе мост не найдёт получателя.
    // Возвращает true, если запрос отправлен.
    async showRequest(friendId, text, requestKey) {
        if (this.host !== 'vk' || !this.vk) return false;
        try {
            const params = {};
            if (friendId) params.uid = Number(friendId);
            if (text) params.message = String(text).slice(0, 200);
            if (requestKey) params.requestKey = String(requestKey);
            await this.vk.send('VKWebAppShowRequestBox', params);
            return true;
        } catch (_) { return false; }
    },

    // История: публикация в «Истории» VK (VKWebAppShowStoryBox).
    // Формат параметров — строго по документации dev.vk.com (раздел «Истории»):
    //   - стикеры: sticker_type 'native' + sticker.action_type 'text' (+ transform);
    //   - attachment — объект-кнопка { type:'url', text:'open'|'game', url } для
    //     перехода в игру из опубликованной истории;
    //   - background_type: 'image' (+ url) или 'none' (однотонный фон).
    // opts: { text, url, attachment, link }.
    //   text — текст-стикер (от первого лица);
    //   url  — HTTPS-ссылка на фон-изображение (если не задана — фон 'none');
    //   attachment — готовое вложение (если задано, используется как есть);
    //   link — URL игры: превращается в кнопку «Открыть» внизу истории.
    // Возвращает true, если редактор истории открыт.
    async showStory(opts = {}) {
        if (this.host !== 'vk' || !this.vk) return false;
        try {
            const { text, url, attachment, link } = opts;
            const params = {};
            if (url) {
                params.background_type = 'image';
                params.url = String(url);
                params.locked = true;
            } else {
                // Без внешнего HTTPS-изображения используем однотонный фон
                params.background_type = 'none';
            }
            if (text) {
                params.stickers = [{
                    sticker_type: 'native',
                    sticker: {
                        action_type: 'text',
                        action: {
                            text: String(text).slice(0, 200),
                            style: 'classic',
                            background_style: 'none',
                        },
                        transform: { gravity: 'center_top', translation_y: 0.25 },
                    },
                }];
            }
            if (attachment) {
                params.attachment = attachment;
            } else if (link) {
                params.attachment = { type: 'url', text: 'open', url: String(link) };
            }
            await this.vk.send('VKWebAppShowStoryBox', params);
            return true;
        } catch (_) { return false; }
    },

    // Добавить приложение в избранное (раздел меню VK).
    // Возвращает true, если успешно.
    async addToFavorites() {
        if (this.host !== 'vk' || !this.vk) return false;
        try {
            await this.vk.send('VKWebAppAddToFavorites', {});
            return true;
        } catch (_) { return false; }
    },

    // Добавить на главный экран (Android; в iOS возвращает false — недоступно).
    // По документации dev.vk.com сначала проверяем VKWebAppAddToHomeScreenInfo —
    // не добавлена ли уже игра; если добавлена — сразу true (бонус не дублируем).
    // Затем вызываем VKWebAppAddToHomeScreen и возвращаем data.result.
    // Возвращает true, если игра добавлена (или уже была добавлена).
    async addToHomeScreen() {
        if (this.host !== 'vk' || !this.vk) return false;
        try {
            const info = await this.vk.send('VKWebAppAddToHomeScreenInfo', {});
            if (info && info.is_added_to_home_screen) return true;
            const res = await this.vk.send('VKWebAppAddToHomeScreen', {});
            return !!(res && res.result !== false);
        } catch (_) { return false; }
    },

    // Профиль пользователя (VKWebAppGetUserInfo).
    // Возвращает { id, first_name, last_name, photo_200 } или null.
    async getUserInfo() {
        if (this.host !== 'vk' || !this.vk) return null;
        try {
            const res = await this.vk.send('VKWebAppGetUserInfo', {});
            if (!res) return null;
            return {
                id: res.id,
                first_name: res.first_name || '',
                last_name: res.last_name || '',
                photo_200: res.photo_200 || '',
            };
        } catch (_) { return null; }
    },

    // Список друзей, установивших приложение (VKWebAppGetFriends).
    // Возвращает массив { id, first_name, last_name, photo_200 } или [].
    async getFriends() {
        if (this.host !== 'vk' || !this.vk) return [];
        try {
            const res = await this.vk.send('VKWebAppGetFriends', {});
            const users = res?.users || [];
            return users.map((u) => ({
                id: u.id,
                first_name: u.first_name || '',
                last_name: u.last_name || '',
                photo_200: u.photo_200 || '',
            }));
        } catch (_) { return []; }
    },

    // Параметры запуска мини-приложения: query-параметры + хэш (#).
    // Возвращает объект; vk_request_key — ключ запроса/приглашения от друга.
    // В Одноклассниках OK передаёт свои параметры (ok_app_id, ok_user_id и т.п.)
    // — они также попадают в результат как есть.
    getLaunchParams() {
        const params = {};
        try {
            const q = new URLSearchParams(location.search);
            q.forEach((v, k) => { params[k] = v; });
            const h = String(location.hash || '').replace(/^#/, '');
            if (h) {
                h.split('&').forEach((pair) => {
                    const [k, v] = pair.split('=');
                    if (k) params[k] = decodeURIComponent(v || '');
                });
            }
        } catch (_) {}
        return params;
    },
};

export default sdk;
