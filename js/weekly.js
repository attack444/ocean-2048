// ======================== Еженедельный челлендж 📅 ========================
// Раз в неделю (пн–вс, ISO 8601) выпадает ОДИН челлендж «собери N за M ходов».
// Цель, лимит и уровень детерминированы от недельного ключа (seed по ключу) —
// у всех игроков одна и та же задача, что даёт тему для обсуждения и повод
// заходить раз в неделю. Награда — жемчужины за первое прохождение недели.
//
// Чистая логика (без DOM/localStorage): ключ недели, детерминированная выдача,
// состояние в state.weekly, запись результатов, выдача награды, данные для UI.
// По образцу js/challenge.js / js/daily.js.

import { dailyDateStr } from './daily.js';

/** Ключ в state: состояние текущего недельного челленджа. */
export const WEEKLY_KEY = 'weekly';

/**
 * Пул недельных челленджей. Цель/лимит чуть мягче обычных челленджей уровней —
 * еженедельная задача должна быть достижима за несколько партий в течение
 * недели (а не за одну идеальную). Награда выше, чем у обычного челленджа.
 */
export const WEEKLY_POOL = [
    { levelId: 1, target: 256,  movesLimit: 45, reward: 300 },
    { levelId: 2, target: 512,  movesLimit: 60, reward: 350 },
    { levelId: 3, target: 1024, movesLimit: 80, reward: 400 },
    { levelId: 4, target: 1024, movesLimit: 85, reward: 450 },
    { levelId: 5, target: 2048, movesLimit: 100, reward: 500 },
    { levelId: 6, target: 2048, movesLimit: 105, reward: 550 },
    { levelId: 7, target: 4096, movesLimit: 130, reward: 600 },
];

/**
 * ISO-недельный ключ «YYYY-Www» (неделя начинается с понедельника).
 * Использует UTC, чтобы не зависеть от часового пояса устройства.
 */
export function weekKey(date = dailyDateStr()) {
    const [y, m, d] = date.split('-').map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d));
    const day = (dt.getUTCDay() + 6) % 7;      // 0 = понедельник
    dt.setUTCDate(dt.getUTCDate() - day);      // понедельник текущей недели
    const year = dt.getUTCFullYear();

    const jan4 = new Date(Date.UTC(year, 0, 4));
    const jan4day = (jan4.getUTCDay() + 6) % 7;
    const week1Monday = new Date(jan4);
    week1Monday.setUTCDate(jan4.getUTCDate() - jan4day);
    const weekNumber = 1 + Math.round((dt - week1Monday) / (7 * 86400000));

    // Неделя 0 → последняя неделя предыдущего ISO-года.
    if (weekNumber < 1) {
        const prevJan4 = new Date(Date.UTC(year - 1, 0, 4));
        const prevJan4day = (prevJan4.getUTCDay() + 6) % 7;
        const prevWeek1Monday = new Date(prevJan4);
        prevWeek1Monday.setUTCDate(prevJan4.getUTCDate() - prevJan4day);
        const prevWeeks = Math.round(
            (new Date(Date.UTC(year - 1, 11, 31)) - prevWeek1Monday) / (7 * 86400000)
        ) + 1;
        return `${year - 1}-W${String(prevWeeks).padStart(2, '0')}`;
    }

    // Неделя больше реального числа недель года → это 1-я неделя следующего года.
    const nextJan4 = new Date(Date.UTC(year + 1, 0, 4));
    const nextJan4day = (nextJan4.getUTCDay() + 6) % 7;
    const nextWeek1Monday = new Date(nextJan4);
    nextWeek1Monday.setUTCDate(nextJan4.getUTCDate() - nextJan4day);
    const maxWeeks = Math.round((nextWeek1Monday - week1Monday) / (7 * 86400000));
    if (weekNumber > maxWeeks) {
        return `${year + 1}-W01`;
    }

    return `${year}-W${String(weekNumber).padStart(2, '0')}`;
}

/**
 * Детерминированный выбор челленджа по недельному ключу (перемешивание/выбор
 * на seed от строки ключа). Одна и та же неделя → один и тот же челлендж.
 */
export function weeklyChallenge(week = weekKey(), pool = WEEKLY_POOL) {
    let seed = 0;
    for (const ch of week) seed = (seed * 31 + ch.charCodeAt(0)) >>> 0;
    const rnd = () => { seed = (seed * 1103515245 + 12345) >>> 0; return seed / 0xFFFFFFFF; };
    return pool[Math.floor(rnd() * pool.length)];
}

/**
 * Подготовить state.weekly к текущей неделе. Если неделя сменилась — выдаёт
 * свежую запись (обнуляет прогресс). Возвращает true, если state обновлён.
 */
export function ensureWeekly(state, week = weekKey()) {
    if (!state[WEEKLY_KEY] || typeof state[WEEKLY_KEY] !== 'object') {
        state[WEEKLY_KEY] = { week: '', done: false, bestScore: 0, bestMoves: 0, claimed: false };
    }
    if (state[WEEKLY_KEY].week === week) return false;
    state[WEEKLY_KEY] = { week, done: false, bestScore: 0, bestMoves: 0, claimed: false };
    return true;
}

/**
 * Записать результат партии недельного челленджа.
 * result: { completed:boolean, score:number, movesUsed:number }
 * Обновляет флаг «пройдено» (не откатывается) и лучший счёт/ходы текущей недели.
 * Возвращает { isNewDone, isNewBest } — впервые пройдено / новый лучший счёт.
 */
export function recordWeeklyResult(state, result, week = weekKey()) {
    ensureWeekly(state, week);
    const rec = state[WEEKLY_KEY];
    const { completed = false, score = 0, movesUsed = 0 } = result || {};

    const isNewDone = !!completed && !rec.done;
    if (completed) rec.done = true;

    const isNewBest = Number(score) > (rec.bestScore || 0);
    if (Number(score) > (rec.bestScore || 0)) rec.bestScore = Number(score);
    if (Number(movesUsed) > (rec.bestMoves || 0)) rec.bestMoves = Number(movesUsed);

    return { isNewDone, isNewBest };
}

/**
 * Выдать награду за недельный челлендж. Меняет state (жемчужины + отметка).
 * Возвращает количество выданных жемчужин (0 — если не пройден или уже выдана).
 */
export function claimWeeklyReward(state, week = weekKey()) {
    ensureWeekly(state, week);
    const rec = state[WEEKLY_KEY];
    const ch = weeklyChallenge(week);
    if (!rec.done || rec.claimed) return 0;
    rec.claimed = true;
    state.doubloons = (state.doubloons || 0) + ch.reward;
    return ch.reward;
}

/**
 * Текущее состояние недельного челленджа для UI.
 * @returns {{week:string, levelId:number, target:number, movesLimit:number,
 *           reward:number, done:boolean, claimed:boolean,
 *           bestScore:number, bestMoves:number}}
 */
export function weeklyInfo(state, week = weekKey()) {
    ensureWeekly(state, week);
    const ch = weeklyChallenge(week);
    const rec = state[WEEKLY_KEY];
    return {
        week,
        levelId: ch.levelId,
        target: ch.target,
        movesLimit: ch.movesLimit,
        reward: ch.reward,
        done: rec.done === true,
        claimed: rec.claimed === true,
        bestScore: rec.bestScore || 0,
        bestMoves: rec.bestMoves || 0,
    };
}
