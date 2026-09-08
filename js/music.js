// ======================== Музыка: оригинальный саундтрек (OST) ========================
//
// Процедурная Web Audio-музыка УДАЛЕНА (2026-09): в игре звучит только
// ОРИГИНАЛЬНЫЙ саундтрек — два MP3 Kevin MacLeod (incompetech.com, CC BY 4.0):
//   - main   (вся игра, меню, обычные партии) — "Grand Dark Waltz" (Allegro)
//   - versus (PvP: турнир, дуэль)             — "Ancient Mystery Waltz" (Presto)
//
// Этот модуль — тонкий фасад над js/ost.js: единый API для main.js.
// Реальное воспроизведение (HTMLAudio + loop + фейды) живёт в ost.js.
//
// Состояние (state.musicTrack): 'ost' — включён (по умолчанию), 'off' — выключен.
// Значения старых процедурных тем ('dark'/'light'/'sakura'/...) из старых сейвов
// безопасно трактуются как 'ost' (см. normalizeTrackKey и loadState в main.js).

import {
    OST_TRACK_KEY,
    playOst,
    stopOst,
    suspendOst,
    resumeOst,
    isOstActive,
    getOstState,
} from './ost.js';

let enabled = true;          // пользователь включил музыку (state.music)
let currentTrack = null;     // 'ost' | null (музыка играет/готова играть)
let ostContext = 'main';     // контекст OST: 'main' | 'versus' (обновляет main.js)
let gestureSeen = false;     // был ли первый пользовательский жест (autoplay-политика)

/**
 * Привести ключ трека к актуальному значению (чистая функция).
 * 'ost' → 'ost'; 'off' / пусто → 'off'; любые устаревшие процедурные ключи
 * ('dark', 'sakura' и т.п.) из старых сейвов → 'ost'.
 */
export function normalizeTrackKey(key) {
    if (!key || key === 'off') return 'off';
    return OST_TRACK_KEY; // единственный включённый режим — OST
}

function isOstOn() {
    return currentTrack === OST_TRACK_KEY;
}

/** Есть ли в окружении DOM/жесты (браузер). В node — false (модуль безопасен). */
function canUseDom() {
    return typeof window !== 'undefined' && typeof document !== 'undefined';
}

function onFirstGesture() {
    if (gestureSeen) return;
    gestureSeen = true;
    if (enabled && isOstOn()) playOst(ostContext);
}

function installGestureListener() {
    if (gestureSeen || !canUseDom()) return;
    const opts = { once: true, passive: true };
    document.addEventListener('pointerdown', onFirstGesture, opts);
    document.addEventListener('touchstart', onFirstGesture, opts);
    document.addEventListener('keydown', onFirstGesture, opts);
    document.addEventListener('click', onFirstGesture, opts);
}

/** Запустить воспроизведение. До первого жеста OST «ждёт» его (autoplay-политика). */
export function startMusic() {
    enabled = true;
    if (!isOstOn()) return;
    installGestureListener();
    // Если до жеста — браузер отклонит play() (поймаем в ost.js);
    // по первому взаимодействию onFirstGesture перезапустит OST.
    playOst(ostContext);
}

/** Остановить музыку. */
export function stopMusic() {
    enabled = false;
    stopOst();
}

/**
 * Переключить трек.
 * @param key 'ost' | 'off' (легаси-ключи процедурных тем трактуются как 'ost').
 * Выбор 'ost' всегда включает музыку (startMusic ставит enabled=true);
 * 'off' останавливает её полностью.
 */
export function playTrack(key) {
    if (normalizeTrackKey(key) === 'off') {
        currentTrack = null;
        stopMusic();
        return;
    }
    currentTrack = OST_TRACK_KEY;
    startMusic();
}

/**
 * Сообщить музыкальному движку текущий игровой контекст (runKind).
 * OST выбирает трек по нему: 'tournament'/'duel' → versus-трек, иначе main.
 */
export function setOstContext(runKind) {
    const next = (runKind === 'tournament' || runKind === 'duel') ? 'versus' : 'main';
    const changed = next !== ostContext;
    ostContext = next;
    if (changed && enabled && isOstOn()) playOst(ostContext);
}

/** Приостановить (потеря фокуса, реклама) — без отключения трека. */
export function suspendMusic() {
    try { suspendOst(); } catch (_) {}
}

/** Возобновить после suspend. */
export function resumeMusic() {
    try { resumeOst(); } catch (_) {}
}

/** Обновить состояние включения музыки (вызывается из настроек). */
export function setMusicEnabled(on) {
    enabled = !!on;
    if (on) startMusic();
    else stopMusic();
}

/** Проверка: пользователь включил музыку и OST звучит/готов звучать. */
export function isMusicActive() {
    return enabled && isOstOn() && isOstActive();
}

/** Диагностика состояния (для smoke-тестов и отладки). */
export function getMusicState() {
    return {
        enabled,
        track: currentTrack,
        gestureSeen,
        ost: getOstState(),
    };
}

// Smoke-диагностика: window.__music — геттер состояния (безопасен в node,
// где window не определён; используется scripts/smoke-prod.js).
if (canUseDom()) {
    Object.defineProperty(window, '__music', {
        configurable: true,
        get: () => getMusicState(),
    });
}
