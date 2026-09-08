// ======================== Дуэль дня ⚔️ (асинхронная, общий сид) ========================
// Вирусная механика «вызови друга на бой» без серверного бэкенда:
//   - обе стороны играют ОДНУ И ТУ ЖЕ доску дня (детерминированный сид из даты,
//     как в турнире, но со своим префиксом — доски разные);
//   - фиксированная партия (50 ходов) на максимум очков — результат сравним честно;
//   - счёт соперника передаётся через requestKey запроса VK: отправитель вызывает
//     друга через VKWebAppShowRequestBox с ключом ocean2048_duel_<дата>_<счёт>,
//     получателю этот ключ приходит как URL-параметр vk_request_key;
//   - получатель играет ту же доску и сравнивает очки — победитель определяется
//     локально, без сервера.
//
// Экономика (защита от фарма):
//   - награда за ПОБЕДУ (+DUEL_WIN_REWARD) — не чаще одного раза в день;
//   - утешительный приз за поражение (+DUEL_LOSE_REWARD) — тоже не чаще раза в день;
//   - «тренировка» без соперника наград не даёт (нет противника — нет дуэли).
//
// Чистая логика (без DOM/localStorage): сид, доска, запись результата, парсинг вызова.

import { dailyDateStr } from './daily.js';
import { seedFromDate, puzzleStartBoard, PUZZLE_SIZE } from './daily-puzzle.js';

/** Ключ хранения дуэли в state. */
export const DUEL_KEY = 'duel';

/** Размер доски дуэли. */
export const DUEL_SIZE = PUZZLE_SIZE; // 4

/** Количество ходов на партию (лимит). */
export const DUEL_MOVES = 50;

/** Целевая плитка (недостижима за 50 ходов — нужна Game как формальная цель). */
export const DUEL_TARGET = 2048;

/** Префикс сида — отличается от головоломки и турнира (свои доски). */
const DUEL_SEED_PREFIX = 'ocean2048_duel_';

/** Награда за победу в дуэли (жемчужины), не чаще раза в день. */
export const DUEL_WIN_REWARD = 40;

/** Утешительная награда за участие в дуэли с соперником (жемчужины), раз в день. */
export const DUEL_LOSE_REWARD = 10;

/** Префикс requestKey вызова на дуэль (vk_request_key у получателя). */
export const DUEL_CHALLENGE_PREFIX = 'ocean2048_duel_';

/**
 * Сид дуэли для даты (YYYY-MM-DD) — общий у всех игроков.
 */
export function duelSeed(dateStr = dailyDateStr()) {
    return seedFromDate(DUEL_SEED_PREFIX + dateStr);
}

/**
 * Детерминированная стартовая доска дуэли для даты.
 * Свой сид → доска дня дуэли, отличная от головоломки и турнира.
 */
export function duelStartBoard(dateStr = dailyDateStr()) {
    return puzzleStartBoard(DUEL_SEED_PREFIX + dateStr, DUEL_SIZE);
}

/**
 * Ключ вызова на дуэль: приходит получателю как URL-параметр vk_request_key.
 * Формат: ocean2048_duel_<ГГГГММДД>_<счёт> — компактная дата + счёт соперника.
 */
export function buildDuelRequestKey(score, dateStr = dailyDateStr()) {
    const compact = String(dateStr).replace(/-/g, '');
    const sc = Math.max(0, Math.round(Number(score) || 0));
    return `${DUEL_CHALLENGE_PREFIX}${compact}_${sc}`;
}

/**
 * Разобрать vk_request_key вызова на дуэль.
 * @returns {{dateStr:string, score:number}|null} null — если это не вызов на дуэль
 *          или ключ повреждён.
 */
export function parseDuelChallenge(requestKey) {
    if (typeof requestKey !== 'string') return null;
    if (!requestKey.startsWith(DUEL_CHALLENGE_PREFIX)) return null;
    const rest = requestKey.slice(DUEL_CHALLENGE_PREFIX.length);
    const parts = rest.split('_');
    if (parts.length < 2) return null;
    const [dateCompact, scoreRaw] = parts;
    if (!/^\d{8}$/.test(dateCompact)) return null;
    const score = Number(scoreRaw);
    if (!Number.isFinite(score) || score < 0) return null;
    return {
        dateStr: `${dateCompact.slice(0, 4)}-${dateCompact.slice(4, 6)}-${dateCompact.slice(6, 8)}`,
        score,
    };
}

/**
 * Применить входящий вызов на дуэль (vk_request_key) к state.
 * Принимает вызов ТОЛЬКО за сегодняшний день — вчерашняя дуэль на другой доске
 * нечестна, поэтому помечается как устаревшая.
 * @returns {{accepted:boolean, reason:string, score?:number, dateStr?:string}}
 */
export function applyDuelChallenge(state, requestKey, today = dailyDateStr()) {
    const ch = parseDuelChallenge(requestKey);
    if (!ch) return { accepted: false, reason: 'no-challenge' };
    if (ch.dateStr !== today) return { accepted: false, reason: 'stale', score: ch.score, dateStr: ch.dateStr };
    ensureDuel(state, today);
    state[DUEL_KEY].pendingScore = ch.score;
    return { accepted: true, score: ch.score, dateStr: ch.dateStr };
}

/** Сбросить отображаемый счёт соперника (после старта партии). */
export function clearDuelPending(state) {
    if (state[DUEL_KEY]) state[DUEL_KEY].pendingScore = 0;
}

/**
 * Подготовить state к сегодняшней дуэли. Если день сменился — сбрасывает
 * результат, выданные награды и счёт соперника. Возвращает true, если обновлено.
 */
export function ensureDuel(state, dateStr = dailyDateStr()) {
    state[DUEL_KEY] = state[DUEL_KEY] || { date: '', best: 0, played: false, wins: 0, claimed: [], pendingScore: 0 };
    const d = state[DUEL_KEY];
    if (d.date === dateStr) return false;
    state[DUEL_KEY] = { date: dateStr, best: 0, played: false, wins: 0, claimed: [], pendingScore: 0 };
    return true;
}

/**
 * Записать результат дуэльной партии.
 * Обновляет лучший счёт дня, счётчик побед и начисляет награду (win/lose) —
 * каждый тип не чаще одного раза в день.
 * @returns {{isNewBest:boolean, won:boolean, draw:boolean, reward:number}}
 * reward — жемчужины, которые нужно начислить игроку (0, если уже получены).
 */
export function recordDuelResult(state, result = {}, dateStr = dailyDateStr()) {
    const { score = 0, opponentScore = 0 } = result;
    ensureDuel(state, dateStr);
    const d = state[DUEL_KEY];
    const hasOpponent = opponentScore > 0;
    const won = hasOpponent && score > opponentScore;
    const draw = hasOpponent && score === opponentScore;

    let isNewBest = false;
    if (score > (d.best || 0)) {
        d.best = score;
        isNewBest = true;
    }
    if (won) d.wins = (d.wins || 0) + 1;
    d.played = true;

    // Награда — только за дуэль с реальным соперником, раз в день на каждый тип.
    const claimed = Array.isArray(d.claimed) ? d.claimed : [];
    let reward = 0;
    if (hasOpponent && won && !claimed.includes('win')) {
        claimed.push('win');
        reward = DUEL_WIN_REWARD;
    } else if (hasOpponent && !won && !claimed.includes('lose')) {
        claimed.push('lose');
        reward = DUEL_LOSE_REWARD;
    }
    d.claimed = claimed;
    return { isNewBest, won, draw, reward };
}

/**
 * Текущее состояние дуэли для UI.
 * @returns {{date:string, size:number, moves:number, target:number, best:number,
 *           played:boolean, wins:number, claimedWin:boolean, claimedLose:boolean,
 *           pendingScore:number, completedToday:boolean}}
 * pendingScore — счёт соперника из входящего вызова (0, если вызова нет).
 */
export function duelInfo(state, dateStr = dailyDateStr()) {
    ensureDuel(state, dateStr);
    const d = state[DUEL_KEY];
    const claimed = new Set(Array.isArray(d.claimed) ? d.claimed : []);
    return {
        date: d.date,
        size: DUEL_SIZE,
        moves: DUEL_MOVES,
        target: DUEL_TARGET,
        best: d.best || 0,
        played: d.played === true,
        wins: d.wins || 0,
        claimedWin: claimed.has('win'),
        claimedLose: claimed.has('lose'),
        pendingScore: d.pendingScore || 0,
        completedToday: d.played === true && d.date === dateStr,
    };
}
