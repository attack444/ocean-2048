     /**
 * Unit tests for the SDK adapter (platform-sdk.js).
 * Stubs window / location / document / navigator — no browser required.
 * Each test gets a fresh sdk instance (Object.create) so the shared singleton
 * is never polluted between tests.
 */
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

// ── Global stubs ─────────────────────────────────────────────────────────
// loadScript() appends a <script> and resolves on onload — fire it synchronously
// so the "load SDK script for local preview" path cannot hang.
globalThis.document = {
    createElement() {
        return { src: '', async: false, onload: null, onerror: null };
    },
    head: {
        appendChild(el) {
            if (typeof el.onload === 'function') el.onload();
            else if (typeof el.onerror === 'function') el.onerror();
        },
    },
};

function setSearch(search) {
    globalThis.location = { search, href: 'https://ocean2048.example/game' };
}

function setWindow(win) {
    globalThis.window = win || {};
}

function setNavigator(nav) {
    Object.defineProperty(globalThis, 'navigator', {
        value: nav || {},
        configurable: true,
        writable: true,
    });
}

// Load the module once; per-test fresh copies via prototype chain.
const sdk = (await import('./platform-sdk.js')).default;

function makeSdk() {
    return Object.assign(Object.create(sdk), {
        host: 'web',
        vk: null,
        ya: null,
        player: null,
        initialized: false,
    });
}

beforeEach(() => {
    setSearch('');
    setWindow({});
    setNavigator({});
});

// ── Host detection / init ────────────────────────────────────────────────
describe('sdk.init / host detection', () => {
    it('defaults to web when no SDK and no forced platform', async () => {
        const s = makeSdk();
        assert.equal(await s.init(), 'web');
        assert.equal(s.initialized, true);
        assert.equal(s.isPlatform(), false);
    });

    it('forces vk via ?platform=vk', async () => {
        setSearch('?platform=vk');
        const sent = [];
        setWindow({ vkBridge: { send: async (m) => { sent.push(m); return {}; } } });
        const s = makeSdk();
        assert.equal(await s.init(), 'vk');
        assert.equal(s.host, 'vk');
        assert.ok(s.vk, 'vk bridge should be attached');
        assert.equal(s.isPlatform(), true);
        // Обязательная инициализация моста VK Mini Apps
        assert.ok(sent.includes('VKWebAppInit'), 'VKWebAppInit должен вызываться при инициализации VK');
    });

    it('detects vk from window.vkBridge without a forced param', async () => {
        setWindow({ vkBridge: { send: async () => {} } });
        const s = makeSdk();
        assert.equal(await s.init(), 'vk');
    });

    it('does not fail when VKWebAppInit rejects (bridge is still usable)', async () => {
        setSearch('?platform=vk');
        setWindow({ vkBridge: { send: async () => { throw new Error('init blocked'); } } });
        const s = makeSdk();
        assert.equal(await s.init(), 'vk');
        assert.ok(s.vk, 'bridge должен остаться доступным даже если VKWebAppInit упал');
    });

    it('detects vk from ?vk_user_id', async () => {
        setSearch('?vk_user_id=123');
        const s = makeSdk();
        assert.equal(await s.init(), 'vk');
        // no bridge present — host is vk, but vk stays null
        assert.equal(s.vk, null);
    });

    it('forces yandex via ?platform=yandex', async () => {
        setSearch('?platform=yandex');
        setWindow({ ysdk: { getPlayer: async () => ({}) } });
        const s = makeSdk();
        assert.equal(await s.init(), 'yandex');
        assert.equal(s.host, 'yandex');
        assert.ok(s.ya);
        assert.equal(s.isPlatform(), true);
    });

    it('accepts ?platform=ya as a yandex alias', async () => {
        setSearch('?platform=ya');
        setWindow({ ysdk: { getPlayer: async () => ({}) } });
        const s = makeSdk();
        assert.equal(await s.init(), 'yandex');
    });

    it('detects yandex from window.ysdk and inits the player', async () => {
        setWindow({ ysdk: { getPlayer: async () => ({ name: 'Дельфин' }) } });
        const s = makeSdk();
        assert.equal(await s.init(), 'yandex');
        assert.deepEqual(s.player, { name: 'Дельфин' });
    });
});

// ── Yandex SDK connection path (модерация п.1.1 требований) ──────────────
describe('sdk Yandex connection path', () => {
    it('initializes via window.YaGames.init() when the SDK script is present', async () => {
        setSearch('?platform=yandex');
        let initCalls = 0;
        setWindow({
            YaGames: {
                init: async () => { initCalls++; return { features: { LoadingAPI: {} } }; },
            },
        });
        const s = makeSdk();
        assert.equal(await s.init(), 'yandex');
        assert.equal(initCalls, 1);
        assert.ok(s.ya, 'sdk.ya should hold the YaGames.init() result');
    });

    it('loads only the official relative /sdk.js (п. 1.7: без URL на S3-серверы)', async () => {
        setSearch('?platform=yandex');
        setWindow({});
        const srcs = [];
        const origCreate = globalThis.document.createElement;
        globalThis.document.createElement = (tag) => {
            const el = origCreate(tag);
            let _src = '';
            Object.defineProperty(el, 'src', {
                get() { return _src; },
                set(v) { _src = v; srcs.push(v); },
                configurable: true,
            });
            return el;
        };
        try {
            const s = makeSdk();
            const initPromise = s.init();
            // После onload /sdk.js (в моке срабатывает синхронно) сам SDK создаёт
            // window.YaGames чуть позже — имитируем, чтобы ensureYaGames()
            // дождался появления и вызвал YaGames.init() (гонка п.1.1).
            setTimeout(() => {
                globalThis.window.YaGames = { init: async () => ({ features: { LoadingAPI: {} } }) };
            }, 30);
            assert.equal(await initPromise, 'yandex');
            assert.ok(s.ya, 'SDK должен инициализироваться после появления window.YaGames');
            assert.deepEqual(srcs, ['/sdk.js'], 'подключается только относительный /sdk.js');
            assert.ok(srcs.every((src) => !/s3[.-]/.test(src) && !src.includes('yandex.net')),
                'в коде не должно быть абсолютных URL на S3-серверы Яндекса');
        } finally {
            globalThis.document.createElement = origCreate;
        }
    });

    it('detects the user language at startup (п. 2.14)', async () => {
        setSearch('?platform=yandex');
        setWindow({
            ysdk: {
                getPlayer: async () => ({}),
                environment: { i18n: { lang: 'ru' } },
            },
        });
        const s = makeSdk();
        assert.equal(await s.init(), 'yandex');
        assert.equal(s.getLang(), 'ru');
    });

    it('returns null language when SDK has no i18n environment', async () => {
        setSearch('?platform=yandex');
        setWindow({ ysdk: { getPlayer: async () => ({}) } });
        const s = makeSdk();
        assert.equal(await s.init(), 'yandex');
        assert.equal(s.getLang(), null);
    });

    it('does not hang when YaGames.init() never resolves (timeout guard)', async () => {
        setSearch('?platform=yandex');
        setWindow({ YaGames: { init: () => new Promise(() => {}) } });
        const s = makeSdk();
        const start = Date.now();
        const host = await s.init();
        assert.equal(host, 'yandex');
        assert.equal(s.ya, null);
        assert.ok(Date.now() - start < 10000, 'should resolve well before the 5s timeout');
    });

    it('detects yandex and inits SDK when the /sdk.js tag has already loaded (onload marker, п. 1.1)', async () => {
        // Гонка: onload тега /sdk.js уже произошёл (__yaSdkScriptLoaded), но
        // window.YaGames SDK создаёт чуть позже. Раньше разовая проверка
        // возвращала null → YaGames.init() не вызывался → LoadingAPI не работал →
        // модерация видела «W» («SDK не встроено», п.1.1).
        setWindow({ __yaSdkScriptLoaded: true });
        const s = makeSdk();
        const initPromise = s.init();
        // Имитируем позднее создание window.YaGames самим SDK.
        setTimeout(() => {
            globalThis.window.YaGames = { init: async () => ({ features: { LoadingAPI: {} } }) };
        }, 30);
        assert.equal(await initPromise, 'yandex');
        assert.equal(s.host, 'yandex');
        // window.YaGames появился позже — SDK обязан инициализироваться (не null!).
        assert.ok(s.ya, 'sdk.ya должен быть инициализирован после появления window.YaGames');
    });

    it('stays on web when the /sdk.js tag failed to load (onerror marker)', async () => {
        // Вне платформы (5mb2.ru / локально) /sdk.js не существует → onerror.
        setWindow({ __yaSdkScriptFailed: true });
        const s = makeSdk();
        assert.equal(await s.init(), 'web');
        assert.equal(s.isPlatform(), false);
    });

    it('waits for the async /sdk.js tag result and for window.YaGames before deciding the host (п. 1.1)', async () => {
        // Ключевой кейс повторного отклонения: тег /sdk.js (async) ещё грузился,
        // main.js стартовал раньше, и хост ошибочно определялся как 'web' →
        // LoadingAPI.ready() не вызывался → модерация видела «SDK не встроен».
        const origDoc = globalThis.document;
        globalThis.document = {
            ...origDoc,
            querySelectorAll: () => [{ src: '/sdk.js' }],
        };
        try {
            const s = makeSdk();
            const initPromise = s.init();
            // Имитируем поздний onload тега /sdk.js на платформе Яндекса,
            // а затем и позднее создание window.YaGames самим SDK.
            setTimeout(() => { globalThis.window.__yaSdkScriptLoaded = true; }, 30);
            setTimeout(() => {
                globalThis.window.YaGames = { init: async () => ({ features: { LoadingAPI: {} } }) };
            }, 60);
            assert.equal(await initPromise, 'yandex');
            assert.equal(s.host, 'yandex');
            assert.ok(s.ya, 'SDK должен инициализироваться после появления window.YaGames');
        } finally {
            globalThis.document = origDoc;
        }
    });
});

// ── Cloud saves ──────────────────────────────────────────────────────────
describe('sdk.saveCloud / loadCloud', () => {
    it('saves to VK storage and returns true', async () => {
        const s = makeSdk();
        s.host = 'vk';
        const sent = [];
        s.vk = { send: async (method, params) => { sent.push([method, params]); return {}; } };
        assert.equal(await s.saveCloud({ score: 42 }), true);
        assert.equal(sent.length, 1);
        assert.equal(sent[0][0], 'VKWebAppStorageSet');
        assert.equal(sent[0][1].key, 'ocean2048_save');
        assert.equal(sent[0][1].value, JSON.stringify({ score: 42 }));
    });

    it('returns false when the VK save throws', async () => {
        const s = makeSdk();
        s.host = 'vk';
        s.vk = { send: async () => { throw new Error('denied'); } };
        assert.equal(await s.saveCloud({ a: 1 }), false);
    });

    it('loads and parses a VK cloud save', async () => {
        const s = makeSdk();
        s.host = 'vk';
        s.vk = {
            send: async () => ({ keys: [{ key: 'ocean2048_save', value: '{"score":7}' }] }),
        };
        assert.deepEqual(await s.loadCloud(), { score: 7 });
    });

    it('returns null for an empty VK save', async () => {
        const s = makeSdk();
        s.host = 'vk';
        s.vk = { send: async () => ({ keys: [{ value: '' }] }) };
        assert.equal(await s.loadCloud(), null);
    });

    it('returns null when the VK storage read fails', async () => {
        const s = makeSdk();
        s.host = 'vk';
        s.vk = { send: async () => { throw new Error('boom'); } };
        assert.equal(await s.loadCloud(), null);
    });

    it('saves to Yandex player data', async () => {
        const s = makeSdk();
        s.host = 'yandex';
        let saved = null;
        s.player = { setData: async (data) => { saved = data; } };
        assert.equal(await s.saveCloud({ a: 1 }), true);
        assert.deepEqual(saved, { ocean2048: '{"a":1}' });
    });

    it('loads Yandex player data', async () => {
        const s = makeSdk();
        s.host = 'yandex';
        s.player = { getData: async () => ({ ocean2048: '{"level":3}' }) };
        assert.deepEqual(await s.loadCloud(), { level: 3 });
    });

    it('returns null on invalid Yandex JSON', async () => {
        const s = makeSdk();
        s.host = 'yandex';
        s.player = { getData: async () => ({ ocean2048: 'not-json' }) };
        assert.equal(await s.loadCloud(), null);
    });

    it('is a no-op on web', async () => {
        const s = makeSdk();
        s.host = 'web';
        assert.equal(await s.saveCloud({ a: 1 }), false);
        assert.equal(await s.loadCloud(), null);
    });
});

// ── Leaderboards ─────────────────────────────────────────────────────────
// VK: VKWebAppSaveToLeaderBoard / VKWebAppGetLeaderBoard УДАЛЕНЫ из vk-bridge.
// Актуально: запись — серверный secure.addAppEvent (Фаза 4), показ — системная
// таблица VKWebAppShowLeaderBoardBox (showLeaderboard). Клиентского чтения нет.
describe('sdk.submitScore / getLeaderboard / showLeaderboard', () => {
    it('does not call removed VK methods on submitScore (VK has no client write)', async () => {
        const s = makeSdk();
        s.host = 'vk';
        const sent = [];
        s.vk = { send: async (m, p) => { sent.push([m, p]); return {}; } };
        // VK: клиентской записи больше нет — возвращаем false, ничего не шлём.
        assert.equal(await s.submitScore(1000, 5), false);
        assert.deepEqual(sent, []);
    });

    it('submits to the Yandex leaderboard via ysdk.leaderboards.setScore (новый API)', async () => {
        const s = makeSdk();
        s.host = 'yandex';
        const calls = [];
        s.ya = {
            leaderboards: {
                setScore: async (name, score) => calls.push([name, score]),
            },
        };
        assert.equal(await s.submitScore(500), true);
        assert.deepEqual(calls, [['ocean2048_top', 500]]);
    });

    it('returns false when the Yandex leaderboards API is unavailable', async () => {
        const s = makeSdk();
        s.host = 'yandex';
        s.ya = {}; // без leaderboards — старый getLeaderboards() не используется
        assert.equal(await s.submitScore(500), false);
    });

    it('returns empty leaderboard on VK (no client read of the table)', async () => {
        const s = makeSdk();
        s.host = 'vk';
        s.vk = { send: async () => { throw new Error('must not be called'); } };
        assert.deepEqual(await s.getLeaderboard(), []);
    });

    it('parses the Yandex leaderboard via ysdk.leaderboards.getEntries and marks my row by uniqueID', async () => {
        const s = makeSdk();
        s.host = 'yandex';
        s.player = { uniqueID: 'u2' };
        s.ya = {
            leaderboards: {
                getEntries: async () => ({
                    entries: [
                        { player: { publicName: 'Дельфин', uniqueID: 'u1' }, score: 300 },
                        { player: { publicName: 'Игрок', uniqueID: 'u2' }, score: 200 },
                    ],
                }),
            },
        };
        const lb = await s.getLeaderboard();
        assert.deepEqual(lb, [
            { name: 'Дельфин', score: 300, isMe: false },
            { name: 'Игрок', score: 200, isMe: true },
        ]);
    });

    it('marks the user row when their uniqueID appears around their rank (includeUser)', async () => {
        const s = makeSdk();
        s.host = 'yandex';
        s.player = { uniqueID: 'me' };
        s.ya = {
            leaderboards: {
                getEntries: async () => ({
                    entries: [
                        { player: { publicName: 'X', uniqueID: 'x' }, score: 50 },
                        { player: { publicName: 'Я', uniqueID: 'me' }, score: 999 },
                    ],
                }),
            },
        };
        const lb = await s.getLeaderboard();
        assert.deepEqual(lb, [
            { name: 'X', score: 50, isMe: false },
            { name: 'Я', score: 999, isMe: true },
        ]);
    });

    it('does not mark a row as mine when uniqueID is unknown', async () => {
        const s = makeSdk();
        s.host = 'yandex';
        s.player = { uniqueID: 'me' };
        s.ya = {
            leaderboards: {
                getEntries: async () => ({
                    entries: [{ player: { publicName: 'X', uniqueID: 'other' }, score: 50 }],
                }),
            },
        };
        const lb = await s.getLeaderboard();
        assert.deepEqual(lb, [
            { name: 'X', score: 50, isMe: false },
        ]);
    });

    it('returns an empty list on web', async () => {
        const s = makeSdk();
        s.host = 'web';
        assert.deepEqual(await s.getLeaderboard(), []);
    });

    it('shows the VK system leaderboard box with user_result', async () => {
        const s = makeSdk();
        s.host = 'vk';
        const sent = [];
        s.vk = { send: async (m, p) => { sent.push([m, p]); return {}; } };
        assert.equal(await s.showLeaderboard(12345, 3), true);
        assert.deepEqual(sent[0], ['VKWebAppShowLeaderBoardBox', { user_result: 12345 }]);
    });

    it('clamps showLeaderboard user_result to a positive integer', async () => {
        const s = makeSdk();
        s.host = 'vk';
        const sent = [];
        s.vk = { send: async (m, p) => { sent.push([m, p]); return {}; } };
        await s.showLeaderboard(0);
        assert.equal(sent[0][1].user_result, 1);
        await s.showLeaderboard(NaN);
        assert.equal(sent[1][1].user_result, 1);
    });

    it('returns false when VKWebAppShowLeaderBoardBox fails', async () => {
        const s = makeSdk();
        s.host = 'vk';
        s.vk = { send: async () => { throw new Error('x'); } };
        assert.equal(await s.showLeaderboard(500), false);
    });

    it('does nothing on web for showLeaderboard', async () => {
        const s = makeSdk();
        s.host = 'web';
        assert.equal(await s.showLeaderboard(500), false);
    });
});

// ── Interstitial ads ─────────────────────────────────────────────────────
describe('sdk.showInterstitial', () => {
    it('shows a VK native interstitial', async () => {
        const s = makeSdk();
        s.host = 'vk';
        const sent = [];
        s.vk = { send: async (m, p) => { sent.push([m, p]); return {}; } };
        assert.equal(await s.showInterstitial(), true);
        assert.deepEqual(sent[0], ['VKWebAppShowNativeAds', { ad_format: 'interstitial' }]);
    });

    it('shows a Yandex fullscreen and resolves true when wasShown is true', async () => {
        const s = makeSdk();
        s.host = 'yandex';
        let callbacks = null;
        s.ya = { adv: { showFullscreenAdv(opts) { callbacks = opts.callbacks; } } };
        const promise = s.showInterstitial();
        callbacks.onClose(true);
        assert.equal(await promise, true);
    });

    it('resolves false when the Yandex fullscreen was not shown (wasShown=false)', async () => {
        const s = makeSdk();
        s.host = 'yandex';
        let callbacks = null;
        s.ya = { adv: { showFullscreenAdv(opts) { callbacks = opts.callbacks; } } };
        const promise = s.showInterstitial();
        callbacks.onClose(false);
        assert.equal(await promise, false);
    });

    it('provides onOpen callback for the Yandex fullscreen (п. 4.7)', async () => {
        const s = makeSdk();
        s.host = 'yandex';
        let opened = 0;
        let callbacks = null;
        s.ya = { adv: { showFullscreenAdv(opts) { callbacks = opts.callbacks; } } };
        const promise = s.showInterstitial();
        callbacks.onOpen();
        assert.equal(opened, 0); // no-op onOpen; просто проверяем, что колбэк определён
        assert.equal(typeof callbacks.onOpen, 'function');
        callbacks.onClose(true);
        assert.equal(await promise, true);
    });

    it('resolves false when the Yandex fullscreen errors', async () => {
        const s = makeSdk();
        s.host = 'yandex';
        let callbacks = null;
        s.ya = { adv: { showFullscreenAdv(opts) { callbacks = opts.callbacks; } } };
        const promise = s.showInterstitial();
        callbacks.onError();
        assert.equal(await promise, false);
    });

    it('resolves false on web', async () => {
        const s = makeSdk();
        s.host = 'web';
        assert.equal(await s.showInterstitial(), false);
    });
});

// ── Rewarded ads ─────────────────────────────────────────────────────────
describe('sdk.showRewarded', () => {
    it('grants a reward only after the Yandex onRewarded callback', async () => {
        const s = makeSdk();
        s.host = 'yandex';
        let callbacks = null;
        s.ya = { adv: { showRewardedVideo(opts) { callbacks = opts.callbacks; } } };
        const promise = s.showRewarded();
        assert.equal(typeof callbacks.onOpen, 'function'); // onOpen обязателен по документации
        callbacks.onRewarded();
        callbacks.onClose();
        assert.equal(await promise, true);
    });

    it('does not grant a reward when the user closes early', async () => {
        const s = makeSdk();
        s.host = 'yandex';
        let callbacks = null;
        s.ya = { adv: { showRewardedVideo(opts) { callbacks = opts.callbacks; } } };
        const promise = s.showRewarded();
        callbacks.onClose();
        assert.equal(await promise, false);
    });

    it('shows a VK reward ad and grants the reward on result: true', async () => {
        const s = makeSdk();
        s.host = 'vk';
        const sent = [];
        s.vk = { send: async (m, p) => { sent.push([m, p]); return { result: true }; } };
        assert.equal(await s.showRewarded(), true);
        assert.deepEqual(sent[0], ['VKWebAppShowNativeAds', { ad_format: 'reward' }]);
    });

    it('does not grant a VK reward when the user closes the ad early (result: false)', async () => {
        const s = makeSdk();
        s.host = 'vk';
        s.vk = { send: async () => ({ result: false }) };
        assert.equal(await s.showRewarded(), false);
    });
});

// ── Yandex Loading API ───────────────────────────────────────────────────
describe('sdk loading API', () => {
    it('clamps progress to 0..100 and forwards to the Yandex LoadingAPI', () => {
        const s = makeSdk();
        const values = [];
        s.ya = {
            features: {
                LoadingAPI: {
                    setLoadingProgress: (v) => values.push(v),
                    ready: () => {},
                },
            },
        };
        s.setLoadingProgress(150);
        s.setLoadingProgress(-5);
        s.setLoadingProgress(42);
        assert.deepEqual(values, [100, 0, 42]);
    });

    it('calls ready() on the Yandex LoadingAPI', () => {
        const s = makeSdk();
        let readyCalled = 0;
        s.ya = {
            features: {
                LoadingAPI: {
                    setLoadingProgress: () => {},
                    ready: () => { readyCalled++; },
                },
            },
        };
        s.loadingReady();
        assert.equal(readyCalled, 1);
    });

    it('is safe without the Yandex SDK', () => {
        const s = makeSdk();
        assert.doesNotThrow(() => s.setLoadingProgress(50));
        assert.doesNotThrow(() => s.loadingReady());
    });
});

// ── GameplayAPI (п. 1.19.3) ───────────────────────────────────────────────
describe('sdk gameplay markup (GameplayAPI)', () => {
    it('calls GameplayAPI.start() on gameplayStart()', () => {
        const s = makeSdk();
        let started = 0;
        s.ya = { features: { GameplayAPI: { start: () => { started++; }, stop: () => {} } } };
        s.gameplayStart();
        assert.equal(started, 1);
    });

    it('calls GameplayAPI.stop() on gameplayStop()', () => {
        const s = makeSdk();
        let stopped = 0;
        s.ya = { features: { GameplayAPI: { start: () => {}, stop: () => { stopped++; } } } };
        s.gameplayStop();
        assert.equal(stopped, 1);
    });

    it('is safe without the Yandex SDK', () => {
        const s = makeSdk();
        assert.doesNotThrow(() => s.gameplayStart());
        assert.doesNotThrow(() => s.gameplayStop());
    });

    it('is safe when GameplayAPI is missing from features', () => {
        const s = makeSdk();
        s.ya = { features: {} };
        assert.doesNotThrow(() => s.gameplayStart());
        assert.doesNotThrow(() => s.gameplayStop());
    });
});

// ── Пауза / возобновление (game_api_pause / game_api_resume, п. 1.19.4) ──
describe('sdk pause / resume events', () => {
    it('subscribes to game_api_pause via ysdk.on()', () => {
        const s = makeSdk();
        let subscribed = [];
        const cb = () => {};
        s.ya = { on: (ev, fn) => subscribed.push([ev, fn]), off: () => {} };
        s.onPause(cb);
        assert.deepEqual(subscribed, [['game_api_pause', cb]]);
    });

    it('subscribes to game_api_resume via ysdk.on()', () => {
        const s = makeSdk();
        let subscribed = [];
        const cb = () => {};
        s.ya = { on: (ev, fn) => subscribed.push([ev, fn]), off: () => {} };
        s.onResume(cb);
        assert.deepEqual(subscribed, [['game_api_resume', cb]]);
    });

    it('unsubscribes via ysdk.off()', () => {
        const s = makeSdk();
        let unsubscribed = [];
        const cb = () => {};
        s.ya = { on: () => {}, off: (ev, fn) => unsubscribed.push([ev, fn]) };
        s.offPause(cb);
        s.offResume(cb);
        assert.deepEqual(unsubscribed, [['game_api_pause', cb], ['game_api_resume', cb]]);
    });

    it('is safe without the Yandex SDK', () => {
        const s = makeSdk();
        assert.doesNotThrow(() => s.onPause(() => {}));
        assert.doesNotThrow(() => s.onResume(() => {}));
        assert.doesNotThrow(() => s.offPause(() => {}));
        assert.doesNotThrow(() => s.offResume(() => {}));
    });
});

// ── Share ────────────────────────────────────────────────────────────────
describe('sdk.share', () => {
    it('uses the Web Share API when available', async () => {
        setNavigator({ share: async () => {}, clipboard: {} });
        const s = makeSdk();
        s.host = 'web';
        let shared = null;
        globalThis.navigator.share = async (data) => { shared = data; };
        assert.equal(await s.share('text', 'https://x.test/'), true);
        assert.deepEqual(shared, { text: 'text', url: 'https://x.test/' });
    });

    it('falls back to copying the link on web', async () => {
        setNavigator({ clipboard: {} });
        const s = makeSdk();
        s.host = 'web';
        let copied = '';
        globalThis.navigator.clipboard.writeText = async (t) => { copied = t; };
        assert.equal(await s.share('text', 'https://x.test/'), true);
        assert.equal(copied, 'https://x.test/');
    });

    it('uses location.href when the link is omitted', async () => {
        setSearch('?x=1');
        setNavigator({ clipboard: {} });
        const s = makeSdk();
        s.host = 'web';
        let copied = '';
        globalThis.navigator.clipboard.writeText = async (t) => { copied = t; };
        assert.equal(await s.share('text'), true);
        assert.equal(copied, 'https://ocean2048.example/game');
    });

    it('returns false when the user cancels the Web Share dialog', async () => {
        setNavigator({ share: async () => { throw new Error('AbortError'); }, clipboard: {} });
        const s = makeSdk();
        s.host = 'web';
        assert.equal(await s.share('text', 'https://x.test/'), false);
    });

    it('returns false when nothing is available', async () => {
        setNavigator({});
        const s = makeSdk();
        s.host = 'web';
        assert.equal(await s.share('text', 'https://x.test/'), false);
    });
});

// ── Соцмеханики VK (Фаза 2) ───────────────────────────────────────────────
describe('sdk social mechanics (VK)', () => {
    function vkSdk() {
        const s = makeSdk();
        s.host = 'vk';
        const sent = [];
        s.vk = { send: async (m, p) => { sent.push([m, p || {}]); return {}; } };
        return { s, sent };
    }

    it('showInvite opens the invite box with requestKey', async () => {
        const { s, sent } = vkSdk();
        assert.equal(await s.showInvite('ocean2048_invite'), true);
        assert.deepEqual(sent[0], ['VKWebAppShowInviteBox', { requestKey: 'ocean2048_invite' }]);
    });

    it('showInvite works without a requestKey', async () => {
        const { s, sent } = vkSdk();
        assert.equal(await s.showInvite(), true);
        assert.deepEqual(sent[0], ['VKWebAppShowInviteBox', {}]);
    });

    it('showRequest sends a challenge message to a friend (uid + requestKey)', async () => {
        const { s, sent } = vkSdk();
        assert.equal(await s.showRequest(123, 'Сможешь побить мой рекорд?', 'ocean2048_challenge'), true);
        assert.deepEqual(sent[0], ['VKWebAppShowRequestBox', {
            uid: 123,
            message: 'Сможешь побить мой рекорд?',
            requestKey: 'ocean2048_challenge',
        }]);
    });

    it('showRequest without args still opens the friend picker', async () => {
        const { s, sent } = vkSdk();
        assert.equal(await s.showRequest(), true);
        assert.deepEqual(sent[0], ['VKWebAppShowRequestBox', {}]);
    });

    it('truncates the request message to 200 chars', async () => {
        const { s, sent } = vkSdk();
        await s.showRequest(1, 'x'.repeat(300));
        assert.equal(sent[0][1].message.length, 200);
    });

    it('showStory sends a native text sticker + button attachment', async () => {
        const { s, sent } = vkSdk();
        const ok = await s.showStory({
            text: 'Новый рекорд!',
            link: 'https://vk.com/app123',
        });
        assert.equal(ok, true);
        const [m, p] = sent[0];
        assert.equal(m, 'VKWebAppShowStoryBox');
        assert.deepEqual(p.stickers, [{
            sticker_type: 'native',
            sticker: {
                action_type: 'text',
                action: { text: 'Новый рекорд!', style: 'classic', background_style: 'none' },
                transform: { gravity: 'center_top', translation_y: 0.25 },
            },
        }]);
        assert.deepEqual(p.attachment, { type: 'url', text: 'open', url: 'https://vk.com/app123' });
    });

    it('showStory keeps a raw attachment when provided', async () => {
        const { s, sent } = vkSdk();
        const ok = await s.showStory({ attachment: 'photo-1_2' });
        assert.equal(ok, true);
        assert.equal(sent[0][1].attachment, 'photo-1_2');
    });

    it('showStory works with an empty opts object (flat background)', async () => {
        const { s, sent } = vkSdk();
        assert.equal(await s.showStory(), true);
        assert.deepEqual(sent[0][1], { background_type: 'none' });
    });

    it('showStory uses image background when url is provided', async () => {
        const { s, sent } = vkSdk();
        await s.showStory({ url: 'https://x.test/bg.jpg' });
        assert.deepEqual(sent[0][1], { background_type: 'image', url: 'https://x.test/bg.jpg', locked: true });
    });

    it('addToFavorites calls VKWebAppAddToFavorites', async () => {
        const { s, sent } = vkSdk();
        assert.equal(await s.addToFavorites(), true);
        assert.equal(sent[0][0], 'VKWebAppAddToFavorites');
    });

    it('addToHomeScreen calls VKWebAppAddToHomeScreen when not yet added', async () => {
        const s = makeSdk();
        s.host = 'vk';
        const sent = [];
        s.vk = {
            send: async (m) => {
                sent.push(m);
                if (m === 'VKWebAppAddToHomeScreenInfo') return { is_added_to_home_screen: false };
                return { result: true };
            },
        };
        assert.equal(await s.addToHomeScreen(), true);
        assert.deepEqual(sent, ['VKWebAppAddToHomeScreenInfo', 'VKWebAppAddToHomeScreen']);
    });

    it('addToHomeScreen returns true immediately when already added', async () => {
        const s = makeSdk();
        s.host = 'vk';
        const sent = [];
        s.vk = {
            send: async (m) => {
                sent.push(m);
                return { is_added_to_home_screen: true };
            },
        };
        assert.equal(await s.addToHomeScreen(), true);
        assert.deepEqual(sent, ['VKWebAppAddToHomeScreenInfo']);
    });

    it('getUserInfo maps the VK user object', async () => {
        const s = makeSdk();
        s.host = 'vk';
        s.vk = { send: async () => ({ id: 42, first_name: 'Иван', last_name: 'Море', photo_200: 'http://x/1.jpg' }) };
        const info = await s.getUserInfo();
        assert.deepEqual(info, { id: 42, first_name: 'Иван', last_name: 'Море', photo_200: 'http://x/1.jpg' });
    });

    it('getUserInfo returns null when the bridge rejects', async () => {
        const s = makeSdk();
        s.host = 'vk';
        s.vk = { send: async () => { throw new Error('x'); } };
        assert.equal(await s.getUserInfo(), null);
    });

    it('getFriends maps the users list', async () => {
        const s = makeSdk();
        s.host = 'vk';
        s.vk = { send: async () => ({ users: [{ id: 1, first_name: 'А', last_name: 'Б', photo_200: 'http://x/1.jpg' }] }) };
        const friends = await s.getFriends();
        assert.equal(friends.length, 1);
        assert.equal(friends[0].id, 1);
        assert.equal(friends[0].first_name, 'А');
    });

    it('getFriends returns [] when there are no users or on error', async () => {
        const s = makeSdk();
        s.host = 'vk';
        s.vk = { send: async () => ({}) };
        assert.deepEqual(await s.getFriends(), []);
        s.vk = { send: async () => { throw new Error('x'); } };
        assert.deepEqual(await s.getFriends(), []);
    });

    it('returns false / [] / null on non-VK hosts', async () => {
        const s = makeSdk();
        s.host = 'web';
        assert.equal(await s.showInvite('k'), false);
        assert.equal(await s.showRequest(), false);
        assert.equal(await s.showStory({ text: 't' }), false);
        assert.equal(await s.addToFavorites(), false);
        assert.equal(await s.addToHomeScreen(), false);
        assert.equal(await s.getUserInfo(), null);
        assert.deepEqual(await s.getFriends(), []);
        assert.deepEqual(await s.getDonateCatalog(), []);
        assert.equal((await s.buyDonate('donate_small')).ok, false);
    });

    it('getDonateCatalog maps VK order items', async () => {
        const s = makeSdk();
        s.host = 'vk';
        s.vk = {
            send: async () => ({
                items: [
                    { id: 'donate_small', title: 'Мешочек жемчуга', description: '1000 жемчужин', price: 10 },
                ],
            }),
        };
        const list = await s.getDonateCatalog();
        assert.equal(list.length, 1);
        assert.deepEqual(list[0], {
            id: 'donate_small',
            title: 'Мешочек жемчуга',
            description: '1000 жемчужин',
            price: 10,
        });
    });

    it('buyDonate opens the order box and returns success', async () => {
        const s = makeSdk();
        s.host = 'vk';
        const sent = [];
        s.vk = { send: async (m, p) => { sent.push([m, p]); return { success: true }; } };
        const res = await s.buyDonate('donate_small');
        assert.deepEqual(res, { ok: true, itemId: 'donate_small' });
        assert.deepEqual(sent[0], ['VKWebAppShowOrderBox', { type: 'item', item: 'donate_small' }]);
    });

    it('buyDonate returns failure when the bridge rejects', async () => {
        const s = makeSdk();
        s.host = 'vk';
        s.vk = { send: async () => { throw new Error('x'); } };
        assert.deepEqual(await s.buyDonate('donate_small'), { ok: false });
    });

    it('getLaunchParams merges query and hash params', () => {
        // В реальном браузере location.search обрезается на '#', а hash идёт
        // отдельно (диплинки VK Mini Apps). Стаб воспроизводит это разделение.
        globalThis.location = {
            search: '?platform=vk&foo=1',
            hash: '#bar=2&name=Иван',
            href: 'https://ocean2048.example/game?platform=vk&foo=1#bar=2&name=Иван',
        };
        const s = makeSdk();
        const p = s.getLaunchParams();
        assert.equal(p.platform, 'vk');
        assert.equal(p.foo, '1');
        assert.equal(p.bar, '2');
        assert.equal(p.name, 'Иван');
    });
});
