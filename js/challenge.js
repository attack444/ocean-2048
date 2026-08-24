// ======================== Режим «Челлендж» ⏱️ ========================
// «N ходов на цель»: на каждом уровне доступен челлендж — собери целевую
// плитку за ограниченное число ходов. Это «ещё один ход» и короткая цель:
// партия длится минуту, риск высокий, награда — жемчужины.
//
// Чистая логика (без DOM/localStorage): определения челленджей, состояние
// в state.challenges, запись результатов, выдача награды, данные для UI.
// По образцу js/daily-puzzle.js / js/missions.js.

/** Ключ в state: результаты челленджей по уровням. */
export const CHALLENGE_KEY = 'challenges';

/**
 * Челлендж каждого уровня: собери плитку `target` не более чем за `movesLimit`
 * ходов. `reward` — жемчужины за первое прохождение (награда выдаётся один раз).
 * Значения подобраны так, чтобы челлендж был напряжённым, но достижимым
 * при осознанной игре (обычно ~70% от типичного числа ходов до цели).
 */
export const CHALLENGES = [
    { levelId: 1, target: 128,  movesLimit: 20, reward: 100 },
    { levelId: 2, target: 256,  movesLimit: 28, reward: 120 },
    { levelId: 3, target: 512,  movesLimit: 36, reward: 140 },
    { levelId: 4, target: 1024, movesLimit: 48, reward: 160 },
    { levelId: 5, target: 1024, movesLimit: 52, reward: 180 },
    { levelId: 6, target: 2048, movesLimit: 64, reward: 200 },
    { levelId: 7, target: 2048, movesLimit: 70, reward: 250 },
];

/** Челлендж для конкретного уровня (null — если нет). */
export function challengeForLevel(levelId, challenges = CHALLENGES) {
    return challenges.find((c) => c.levelId === Number(levelId)) || null;
}

/**
 * Подготовить state.challenges: создаёт запись для каждого уровня с нулевым
 * прогрессом. Если запись уже есть — не трогает её (сохраняет прогресс).
 * Возвращает true, если state был обновлён.
 */
export function ensureChallenges(state) {
    if (!state[CHALLENGE_KEY] || typeof state[CHALLENGE_KEY] !== 'object') {
        state[CHALLENGE_KEY] = {};
    }
    const store = state[CHALLENGE_KEY];
    let changed = false;
    for (const c of CHALLENGES) {
        if (!store[c.levelId] || typeof store[c.levelId] !== 'object') {
            store[c.levelId] = { done: false, bestScore: 0, bestMoves: 0, claimed: false };
            changed = true;
        }
    }
    return changed;
}

/**
 * Записать результат партии челленджа уровня.
 * result: { completed:boolean, score:number, movesUsed:number }
 *   completed — собрана ли целевая плитка (maxTile >= target);
 *   score      — очки в конце партии;
 *   movesUsed  — сколько ходов было сделано.
 * Обновляет флаг «пройдено» (не откатывается назад) и лучший счёт/ходы.
 * Возвращает { isNewDone, isNewBest } — впервые пройдено / новый лучший счёт.
 */
export function recordChallengeResult(state, levelId, result, challenges = CHALLENGES) {
    const challenge = challengeForLevel(levelId, challenges);
    if (!challenge) return { isNewDone: false, isNewBest: false };
    ensureChallenges(state);
    const rec = state[CHALLENGE_KEY][challenge.levelId];
    const { completed = false, score = 0, movesUsed = 0 } = result || {};

    const isNewDone = !!completed && !rec.done;
    if (completed) rec.done = true;

    const isNewBest = Number(score) > (rec.bestScore || 0);
    if (Number(score) > (rec.bestScore || 0)) rec.bestScore = Number(score);
    if (Number(movesUsed) > (rec.bestMoves || 0)) rec.bestMoves = Number(movesUsed);

    return { isNewDone, isNewBest };
}

/**
 * Выдать награду за челлендж уровня. Меняет state (жемчужины + отметка о выдаче).
 * Возвращает количество выданных жемчужин (0 — если челлендж не пройден
 * или награда уже выдана).
 */
export function claimChallengeReward(state, levelId, challenges = CHALLENGES) {
    const challenge = challengeForLevel(levelId, challenges);
    if (!challenge) return 0;
    ensureChallenges(state);
    const rec = state[CHALLENGE_KEY][challenge.levelId];
    if (!rec.done || rec.claimed) return 0;
    rec.claimed = true;
    state.doubloons = (state.doubloons || 0) + challenge.reward;
    return challenge.reward;
}

/**
 * Текущее состояние челленджа уровня для UI.
 * @returns {{levelId:number, target:number, movesLimit:number, reward:number,
 *           done:boolean, claimed:boolean, bestScore:number, bestMoves:number}}
 */
export function challengeInfo(state, levelId, challenges = CHALLENGES) {
    const challenge = challengeForLevel(levelId, challenges);
    if (!challenge) return null;
    ensureChallenges(state);
    const rec = state[CHALLENGE_KEY][challenge.levelId];
    return {
        levelId: challenge.levelId,
        target: challenge.target,
        movesLimit: challenge.movesLimit,
        reward: challenge.reward,
        done: rec.done === true,
        claimed: rec.claimed === true,
        bestScore: rec.bestScore || 0,
        bestMoves: rec.bestMoves || 0,
    };
}

/**
 * Сколько челленджей пройдено, но награда ещё не забрана
 * (для бейджа «есть награда» на карте уровней).
 */
export function pendingChallengeRewards(state, challenges = CHALLENGES) {
    ensureChallenges(state);
    return challenges.filter((c) => {
        const rec = state[CHALLENGE_KEY][c.levelId];
        return rec.done === true && rec.claimed !== true;
    }).length;
}
