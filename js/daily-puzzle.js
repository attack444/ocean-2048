// ======================== Ежедневная головоломка (общий сид) ========================
// Wordle-механика: всем игрокам в один день выдаётся ОДНА И ТА ЖЕ доска
// (детерминированный сид из даты). Это даёт ежедневный возврат («зайди завтра,
// сегодняшняя доска уже недоступна») и вирусный потенциал («у меня 1024, а у тебя?»).
//
// Чистая логика (без DOM/localStorage): сид по дате, seeded-PRNG, цель,
// прогресс/результат. Начальная доска и каждая новая плитка генерируются
// детерминированно через сидированный RNG, инжектируемый в Game (js/game.js).

import { dailyDateStr } from './daily.js';

/** Цель ежедневной головоломки — плитка, которую нужно собрать за день. */
export const PUZZLE_TARGET = 512;

/** Награда за прохождение ежедневной головоломки (жемчужины). */
export const PUZZLE_REWARD = 150;

/** Размер доски ежедневной головоломки. */
export const PUZZLE_SIZE = 4;

/** Ключ для хранения прогресса головоломки в state. */
export const PUZZLE_KEY = 'dailyPuzzle';

/** Хэш строки в 32-битное беззнаковое число (для сида). */
export function hashString(str) {
    let h = 0;
    for (let i = 0; i < str.length; i++) {
        h = (h * 31 + str.charCodeAt(i)) >>> 0;
    }
    return h;
}

/**
 * Детерминированный сид для даты (YYYY-MM-DD). Уникален для каждой даты.
 */
export function seedFromDate(dateStr = dailyDateStr()) {
    return hashString('ocean2048_puzzle_' + dateStr);
}

/**
 * Seed-генератор случайных чисел (mulberry32). Возвращает функцию rng(),
 * которая выдаёт числа [0, 1) детерминированно для одного и того же seed.
 */
export function makeRng(seed) {
    let a = seed >>> 0;
    return function rng() {
        a |= 0;
        a = (a + 0x6D2B79F5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

/**
 * Начальная доска головоломки для даты: массив {value} | null длиной size*size
 * с двумя детерминированными стартовыми плитками.
 */
export function puzzleStartBoard(dateStr = dailyDateStr(), size = PUZZLE_SIZE) {
    const rng = makeRng(seedFromDate(dateStr));
    const tiles = new Array(size * size).fill(null);
    const pick = () => Math.floor(rng() * (size * size));
    let first = pick();
    let second = pick();
    while (second === first) second = pick();
    tiles[first]  = { value: rng() < 0.1 ? 4 : 2 };
    tiles[second] = { value: rng() < 0.1 ? 4 : 2 };
    return tiles;
}

/**
 * Подготовить state к сегодняшней головоломке. Если день сменился — сбрасывает
 * прогресс (результат «за сегодня» недоступен после смены даты).
 * Возвращает true, если state был обновлён (новый день).
 */
export function ensureDailyPuzzle(state, dateStr = dailyDateStr()) {
    state[PUZZLE_KEY] = state[PUZZLE_KEY] || { date: '', best: 0, done: false };
    const p = state[PUZZLE_KEY];
    if (p.date === dateStr) return false;
    state[PUZZLE_KEY] = { date: dateStr, best: 0, done: false };
    return true;
}

/**
 * Записать результат партии ежедневной головоломки.
 * Обновляет лучший счёт и флаг «пройдено» (достигнута целевая плитка).
 * Возвращает true, если это новый рекорд дня (для тост-уведомления).
 */
export function recordPuzzleResult(state, result, dateStr = dailyDateStr()) {
    const { score = 0, maxTile = 0 } = result || {};
    ensureDailyPuzzle(state, dateStr);
    const p = state[PUZZLE_KEY];
    let isNewBest = false;
    if (score > (p.best || 0)) {
        p.best = score;
        isNewBest = true;
    }
    if (maxTile >= PUZZLE_TARGET) p.done = true;
    return isNewBest;
}

/**
 * Текущее состояние головоломки для UI.
 * @returns {{date:string, target:number, reward:number, size:number, best:number,
 *           done:boolean, completed:boolean}}
 * completed — пройдена ли головоломка сегодня.
 */
export function puzzleInfo(state, dateStr = dailyDateStr()) {
    ensureDailyPuzzle(state, dateStr);
    const p = state[PUZZLE_KEY];
    return {
        date: p.date,
        target: PUZZLE_TARGET,
        reward: PUZZLE_REWARD,
        size: PUZZLE_SIZE,
        best: p.best || 0,
        done: p.done === true,
        completed: p.done === true && p.date === dateStr,
    };
}
