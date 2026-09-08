// ======================== Оригинальный саундтрек (OST) ========================
// В игру встроены ДВА реальных MP3-трека Kevin MacLeod (Incompetech, CC BY 4.0):
//   - main   (вся игра, меню, обычные партии) — "Grand Dark Waltz" (Allegro)
//   - versus (PvP/соревнования: турнир и дуэль)  — "Ancient Mystery Waltz" (Presto)
//
// Играют оригинальные записи через HTMLAudioElement с loop=true — без синтеза.
// Треки были подготовлены скриптом (scripts/prepare-ost.mjs): обрезана длинная
// концевая тишина (Ancient Mystery), чтобы поворот был без длинной паузы.
//
// Модуль разделён на две части:
//   1. Чистые данные/функции (OST_TRACKS, ostTrackFor, ostModeForRunKind,
//      OST_CREDITS) — без DOM, тестируются в node (js/ost.test.js).
//   2. Плеер (browser-only): лениво создаёт <audio>, играет/паузит с фейдом.
//
// Интеграция: js/music.js выбирает «OST-режим», когда state.musicTrack === 'ost';
// main.js сообщает игровой контекст через setOstContext(runKind) — и OST сам
// переключается между main/versus треком (с плавным фейдом, без рестарта, если
// трек уже играет).

/** Ключ OST в настройках музыки (state.musicTrack / data-track кнопки). */
export const OST_TRACK_KEY = 'ost';

/** Контексты воспроизведения. */
export const OST_MAIN = 'main';
export const OST_VERSUS = 'versus';

/** Громкость OST (0..1) — чуть тише, чтобы не перекрывать звуковые эффекты. */
export const OST_VOLUME = 0.9;

/**
 * Реестр треков: по контексту. file — путь ОТНОСИТЕЛЬНО index.html (и сборок),
 * куда папка audio/ost/ копируется целиком.
 */
export const OST_TRACKS = {
    main: {
        context: 'main',
        file: 'audio/ost/grand-dark-waltz.mp3',
        name: 'Grand Dark Waltz (Allegro)',
        mood: 'Главная тема глубин',
        composer: 'Kevin MacLeod',
        source: 'incompetech.com',
        license: 'CC BY 4.0',
    },
    versus: {
        context: 'versus',
        file: 'audio/ost/ancient-mystery-waltz.mp3',
        name: 'Ancient Mystery Waltz (Presto)',
        mood: 'Тема PvP и соревнований',
        composer: 'Kevin MacLeod',
        source: 'incompetech.com',
        license: 'CC BY 4.0',
    },
};

/** Ключи контекстов (для перебора/тестов). */
export const OST_KEYS = Object.keys(OST_TRACKS);

/**
 * Строка атрибуции для экрана «Об игре»/настроек (CC BY 4.0 требует указания
 * автора). Используется в index.html и может выводиться в UI.
 */
export const OST_CREDITS =
    'Саундтрек: "Grand Dark Waltz" и "Ancient Mystery Waltz" — Kevin MacLeod ' +
    `(${OST_TRACKS.main.source}), лицензия ${OST_TRACKS.main.license}. ` +
    'Источник: incompetech.com';

/**
 * Вернуть запись трека по контексту (чистая функция).
 * Неизвестный контекст безопасно падает на main.
 */
export function ostTrackFor(context) {
    return OST_TRACKS[context === OST_VERSUS ? OST_VERSUS : OST_MAIN] || OST_TRACKS[OST_MAIN];
}

/**
 * Сопоставить игровой runKind контексту OST (чистая функция).
 * PvP/соревновательные режимы (турнир, дуэль) — versus-трек; всё остальное —
 * главный трек (включая челлендж/недельный/головоломку — это одиночные режимы).
 */
export function ostModeForRunKind(runKind) {
    const versus = new Set(['tournament', 'duel']);
    return versus.has(runKind) ? OST_VERSUS : OST_MAIN;
}

// ── Плеер (browser-only) ───────────────────────────────────────────────────────

/** Есть ли в окружении HTMLAudio (браузер). В node — false (модуль безопасен). */
function canUseAudio() {
    return typeof window !== 'undefined'
        && typeof document !== 'undefined'
        && typeof Audio === 'function';
}

/** Лениво создать <audio> для контекста (по одному на трек). */
function getEl(ctx) {
    const rec = ostTrackFor(ctx);
    if (!elements[ctx]) {
        const a = new Audio();
        a.src = rec.file;
        a.loop = true;
        a.preload = 'auto';
        a.volume = 0; // фейд-ин при старте
        elements[ctx] = a;
    }
    return elements[ctx];
}

function pauseSafe(el) {
    if (el && !el.paused) { try { el.pause(); } catch (_) {} }
}

/** Плавная смена громкости; возвращает Promise по завершении фейда. */
function fadeVolume(el, to, ms) {
    if (!el) return Promise.resolve();
    if (el.__fadeTok) clearInterval(el.__fadeTok);
    const from = el.volume;
    const t0 = performance.now();
    return new Promise((resolve) => {
        const step = () => {
            const k = Math.min(1, (performance.now() - t0) / ms);
            el.volume = from + (to - from) * k;
            if (k >= 1) {
                clearInterval(el.__fadeTok);
                el.__fadeTok = null;
                resolve();
            }
        };
        step();
        el.__fadeTok = setInterval(step, 30);
    });
}

/** Попытаться запустить audio.play() (может быть отклонён до жеста — ловим). */
function tryPlay(el) {
    try {
        const p = el.play();
        if (p && typeof p.catch === 'function') p.catch(() => {});
    } catch (_) {}
}

const elements = {};   // context -> HTMLAudioElement
let activeCtx = null;  // выбранный контекст ('main' | 'versus' | null)
let wanted = false;    // хочет ли OST звучать (музыка включена и выбран OST)
let suspended = false; // страница скрыта → пауза с сохранением позиции

/**
 * Включить OST для контекста. Если трек этого контекста уже играет — не трогаем
 * (не рестартим); если играл другой контекст — плавно глушим его и стартуем
 * нужный с начала фразы.
 */
export function playOst(ctx) {
    if (!canUseAudio()) return;
    const target = ostTrackFor(ctx).context;
    suspended = false;

    if (activeCtx === target && wanted) {
        // Нужный трек уже выбран. Если элемент на паузе — пробуем запустить.
        // Это покрывает два случая:
        //  (а) авто-пауза браузера по visibilitychange (позиция сохранена);
        //  (б) play() отклонён до первого жеста пользователя (currentTime = 0),
        //      а после жеста onFirstGesture вызывает playOst повторно.
        const cur = elements[target];
        if (cur && cur.paused) {
            tryPlay(cur);
            fadeVolume(cur, OST_VOLUME, 250);
        }
        return;
    }

    // Переключение контекста (или первый запуск)
    const prevCtx = activeCtx;
    activeCtx = target;
    wanted = true;

    if (prevCtx && prevCtx !== target && elements[prevCtx]) {
        const old = elements[prevCtx];
        fadeVolume(old, 0, 250).then(() => pauseSafe(old));
    }

    const el = getEl(target);
    el.volume = 0;
    el.currentTime = 0; // новая фраза с начала
    tryPlay(el);
    fadeVolume(el, OST_VOLUME, 400);
}

/** Полностью остановить OST (музыка выключена / выбран другой трек). */
export function stopOst() {
    wanted = false;
    suspended = false;
    activeCtx = null;
    for (const el of Object.values(elements)) {
        pauseSafe(el);
        el.currentTime = 0;
        el.volume = 0;
    }
}

/** Приостановить (страница скрыта / потеря фокуса) — с сохранением позиции. */
export function suspendOst() {
    if (!canUseAudio()) return;
    suspended = true;
    for (const el of Object.values(elements)) pauseSafe(el);
}

/** Возобновить после suspend — продолжить активный трек с той же позиции. */
export function resumeOst() {
    if (!canUseAudio() || !wanted) return;
    suspended = false;
    const el = activeCtx ? elements[activeCtx] : null;
    if (el && el.paused) {
        tryPlay(el);
        fadeVolume(el, OST_VOLUME, 300);
    }
}

/** Активен ли OST (музыка включена и выбран OST-трек). */
export function isOstActive() {
    return wanted;
}

/** Диагностика OST (для smoke-тестов/отладки; в node безопасен). */
export function getOstState() {
    const el = activeCtx ? elements[activeCtx] : null;
    return {
        mode: activeCtx,
        wanted,
        suspended,
        playing: el ? !el.paused : false,
        duration: el && Number.isFinite(el.duration) ? el.duration : null,
    };
}
