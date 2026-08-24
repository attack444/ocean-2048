// ======================== Карта глубин 🗺️ (чистая логика) ========================
// Визуальный выбор уровня вместо простого списка: узлы-локации от Лагуны до Бездны,
// анимированные статусы (пройдено/текущий/доступно/заблокировано) и награды за глубину.
//
// Логика чистая (без DOM/localStorage): координаты узлов, статусы, награды.
// Рендер карты и анимации — в main.js + css/styles.css.

import { LEVELS } from './levels.js';

/** Ключ в state: какие награды за глубину уже выданы. */
export const DEPTH_KEY = 'depthRewardsClaimed';

/**
 * Награда (жемчужины) за первое прохождение каждой глубины.
 * Растёт с глубиной — «всегда в паре шагов от награды».
 */
export const DEPTH_REWARDS = { 1: 100, 2: 150, 3: 200, 4: 300, 5: 400, 6: 500, 7: 800 };

/**
 * Узлы карты: координаты на контейнере (x, y в % от верхнего левого угла)
 * и название морской зоны. Путь «зигзагом» вниз — от поверхности к бездне.
 */
export const DEPTH_NODES = [
    { id: 1, x: 30, y: 7,  zone: 'Лагуна' },
    { id: 2, x: 72, y: 18, zone: 'Риф' },
    { id: 3, x: 24, y: 31, zone: 'Открытое море' },
    { id: 4, x: 68, y: 43, zone: 'Тёплые течения' },
    { id: 5, x: 30, y: 56, zone: 'Затонувший корабль' },
    { id: 6, x: 68, y: 69, zone: 'Океанический жёлоб' },
    { id: 7, x: 48, y: 84, zone: 'Атлантида / Бездна' },
];

/** Награда за прохождение глубины (0 — неизвестный уровень). */
export function depthRewardFor(levelId) {
    return DEPTH_REWARDS[Number(levelId)] || 0;
}

/**
 * Статус глубины для UI.
 * 'completed' — пройдена (побеждает 'current', чтобы награда за только что пройденный
 *   уровень оставалась доступной); 'current' — текущая, ещё не пройденная;
 * 'unlocked' — доступна, но не пройдена; 'locked' — закрыта.
 * Маркер daily-puzzle=0 корректно игнорируется.
 */
export function depthStatus(state, levelId, levels = LEVELS) {
    const id = Number(levelId);
    const maxId = levels.length;
    if (!Number.isInteger(id) || id < 1 || id > maxId) return 'locked';
    if (state.bestScores && state.bestScores[id] !== undefined) return 'completed';
    if (id === Number(state.currentLevel)) return 'current';
    return (state.unlockedLevels || []).includes(id) ? 'unlocked' : 'locked';
}

/** Можно ли забрать награду за глубину (пройдена и ещё не выдана). */
export function canClaimDepthReward(state, levelId) {
    const id = Number(levelId);
    if (depthStatus(state, id) !== 'completed') return false;
    return !(state[DEPTH_KEY] || []).includes(id);
}

/**
 * Выдать награду за глубину. Меняет state (жемчужины + отметка о выдаче).
 * Возвращает количество выданных жемчужин (0 — если недоступна).
 */
export function claimDepthReward(state, levelId) {
    if (!canClaimDepthReward(state, levelId)) return 0;
    const id = Number(levelId);
    const reward = depthRewardFor(id);
    state[DEPTH_KEY] = [...(state[DEPTH_KEY] || []), id];
    state.doubloons = (state.doubloons || 0) + reward;
    return reward;
}

/** Сколько наград за глубины ещё не забрано (для бейджа на кнопке). */
export function pendingDepthRewards(state, levels = LEVELS) {
    return levels.filter((lv) => canClaimDepthReward(state, lv.id)).length;
}
