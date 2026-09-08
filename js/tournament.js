// ======================== Ежедневный турнир глубин ========================
// Соревновательный режим «50 ходов на максимум очков».
// Всем игрокам в один день выдаётся ОДНА И ТА ЖЕ доска (детерминированный
// сид из даты, как в ежедневной головоломке) — результат сравним честно.
//
// Почему 50 ходов, а не «собери плитку»:
//   - фиксированная длина партии = честный рейтинг по очкам (нет «затянул
//     игру до 2048»);
//   - детерминированная доска = одинаковые условия у всех (удача не влияет);
//   - дневной возврат: результат дня доступен только сегодня, завтра новая.
//
// Призы: пороговые награды в жемчужинах (аналог «топ-10%»). Пороги и доска
// одинаковы у всех, поэтому проверка «дошёл до N очков» честна и работает
// без бэкенда. Реальный топ-100/призы топ-10 — на бэкенде (Фаза 4); на
// клиенте результат дня дополнительно отправляется в платформенный
// лидерборд (Яндекс setScore / VK системная таблица).
//
// Чистая логика (без DOM/localStorage): сид по дате, пороги, запись результата.

import { dailyDateStr } from './daily.js';
import { seedFromDate, puzzleStartBoard, PUZZLE_SIZE } from './daily-puzzle.js';

/** Ключ хранения турнира в state. */
export const TOURNAMENT_KEY = 'tournament';

/** Размер доски турнира. */
export const TOURNAMENT_SIZE = PUZZLE_SIZE; // 4

/** Количество ходов на партию (лимит). */
export const TOURNAMENT_MOVES = 50;

/** Целевая плитка (недостижима за 50 ходов — нужна Game как формальная цель). */
export const TOURNAMENT_TARGET = 2048;

/** Префикс сида — отличается от ежедневной головоломки (другие доски). */
const TOURNAMENT_SEED_PREFIX = 'ocean2048_tournament_';

/** Награды за пороги очков (жемчужины). Отсортированы по возрастанию. */
export const TOURNAMENT_REWARDS = [
    { threshold: 500,  reward: 25  },
    { threshold: 1000, reward: 60  },
    { threshold: 1800, reward: 120 },
    { threshold: 2800, reward: 250 },
];

/**
 * Сид турнира для даты (YYYY-MM-DD) — общий у всех игроков.
 */
export function tournamentSeed(dateStr = dailyDateStr()) {
    return seedFromDate(TOURNAMENT_SEED_PREFIX + dateStr);
}

/**
 * Детерминированная стартовая доска турнира для даты.
 * Переиспользуем генератор головоломки, но со своим сидом — доски разные.
 */
export function tournamentStartBoard(dateStr = dailyDateStr()) {
    return puzzleStartBoard(TOURNAMENT_SEED_PREFIX + dateStr, TOURNAMENT_SIZE);
}

/**
 * Подготовить state к сегодняшнему турниру. Если день сменился — сбрасывает
 * результат и выданные награды. Возвращает true, если state был обновлён.
 */
export function ensureTournament(state, dateStr = dailyDateStr()) {
    state[TOURNAMENT_KEY] = state[TOURNAMENT_KEY] || { date: '', best: 0, played: false, claimed: [] };
    const t = state[TOURNAMENT_KEY];
    if (t.date === dateStr) return false;
    state[TOURNAMENT_KEY] = { date: dateStr, best: 0, played: false, claimed: [] };
    return true;
}

/**
 * Записать результат турнирной партии.
 * Обновляет лучший счёт дня и определяет новые достигнутые пороги наград.
 * @returns {{isNewBest:boolean, newRewards:Array<{threshold:number, reward:number}>}}
 * newRewards — пороги, достигнутые этой партией (их награды ещё не выдавались).
 */
export function recordTournamentResult(state, result = {}, dateStr = dailyDateStr()) {
    const { score = 0 } = result;
    ensureTournament(state, dateStr);
    const t = state[TOURNAMENT_KEY];
    const claimed = Array.isArray(t.claimed) ? t.claimed : [];
    let isNewBest = false;
    if (score > (t.best || 0)) {
        t.best = score;
        isNewBest = true;
    }
    t.played = true;
    const newRewards = [];
    for (const r of TOURNAMENT_REWARDS) {
        if (score >= r.threshold && !claimed.includes(r.threshold)) {
            claimed.push(r.threshold);
            newRewards.push(r);
        }
    }
    t.claimed = claimed;
    return { isNewBest, newRewards };
}

/**
 * Текущее состояние турнира для UI.
 * @returns {{date:string, size:number, moves:number, target:number, best:number,
 *           played:boolean, rewards:Array, nextThreshold:number|null,
 *           nextReward:number|null, completedToday:boolean}}
 * completedToday — сыграл ли игрок сегодня (результат дня записан).
 */
export function tournamentInfo(state, dateStr = dailyDateStr()) {
    ensureTournament(state, dateStr);
    const t = state[TOURNAMENT_KEY];
    const claimed = new Set(Array.isArray(t.claimed) ? t.claimed : []);
    let next = null;
    for (const r of TOURNAMENT_REWARDS) {
        if (!claimed.has(r.threshold)) { next = r; break; }
    }
    return {
        date: t.date,
        size: TOURNAMENT_SIZE,
        moves: TOURNAMENT_MOVES,
        target: TOURNAMENT_TARGET,
        best: t.best || 0,
        played: t.played === true,
        rewards: TOURNAMENT_REWARDS,
        nextThreshold: next ? next.threshold : null,
        nextReward: next ? next.reward : null,
        completedToday: t.played === true && t.date === dateStr,
    };
}
