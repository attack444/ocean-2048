// ======================== Сюжетные миссии на глубинах 🎯 ========================
// «Цель ≠ набери N»: у каждой глубины (уровня) есть дополнительная сюжетная миссия
// («Спаси черепаху», «Разбуди коралл», «Очисти затонувший корабль»...).
// Прогресс считается в рамках одной партии и показывается прогресс-баром над доской;
// при выполнении — награда жемчужинами (выдаётся один раз, отметка хранится в state).
//
// Модуль чистый (без DOM/localStorage): определения миссий, прогресс, награды.

/** Ключ в state: какие миссии уже выполнены и награда выдана. */
export const MISSIONS_KEY = 'missionsCompleted';

/**
 * Одна сюжетная миссия на каждую глубину.
 * type — метрика партии:
 *   'maxTile'  — собери плитку N за партию (getMaxTile)
 *   'merges'   — суммарное число слияний за партию
 *   'moves'    — число ходов без проигрыша
 *   'score'    — набранные очки за партию
 *   'combo'    — максимальное число слияний за один ход (bestCombo)
 *   'streak'   — максимальная серия ходов подряд со слиянием (bestStreak)
 */
export const MISSIONS = [
    { id: 'm1', levelId: 1, icon: '🐟', title: 'Спаси малька',
      desc: 'Собери плитку 32 — малёк выберется на мелководье',
      type: 'maxTile', target: 32, reward: 50 },
    { id: 'm2', levelId: 2, icon: '🪸', title: 'Очисти риф от кораллов',
      desc: 'Сделай 20 слияний за партию',
      type: 'merges', target: 20, reward: 60 },
    { id: 'm3', levelId: 3, icon: '🌊', title: 'Поймай течение',
      desc: 'Серия из 5 ходов подряд со слиянием',
      type: 'streak', target: 5, reward: 70 },
    { id: 'm4', levelId: 4, icon: '🐢', title: 'Спаси черепаху',
      desc: 'Собери плитку 512 — черепаху уносит течением',
      type: 'maxTile', target: 512, reward: 100 },
    { id: 'm5', levelId: 5, icon: '💥', title: 'Тройной взрыв',
      desc: 'Сделай 3 слияния за один ход',
      type: 'combo', target: 3, reward: 120 },
    { id: 'm6', levelId: 6, icon: '🌩️', title: 'Переживи бурю',
      desc: 'Набери 3000 очков за партию',
      type: 'score', target: 3000, reward: 150 },
    { id: 'm7', levelId: 7, icon: '🐉', title: 'Разбуди Левиафана',
      desc: 'Собери плитку 2048',
      type: 'maxTile', target: 2048, reward: 250 },
];

/** Миссия для конкретной глубины (null — если нет). */
export function missionForLevel(levelId, missions = MISSIONS) {
    return missions.find((m) => m.levelId === Number(levelId)) || null;
}

/**
 * Текущий прогресс миссии по статистике партии (клипируется к target
 * для корректного заполнения прогресс-бара).
 */
export function missionProgress(mission, stats = {}) {
    if (!mission) return 0;
    const value = {
        maxTile: Number(stats.maxTile) || 0,
        merges:  Number(stats.merges)  || 0,
        moves:   Number(stats.moves)   || 0,
        score:   Number(stats.score)   || 0,
        combo:   Number(stats.bestCombo)  || 0,
        streak:  Number(stats.bestStreak) || 0,
    }[mission.type] || 0;
    const target = Number(mission.target) || 1;
    return Math.max(0, Math.min(value, target));
}

/** Выполнена ли миссия по статистике текущей партии. */
export function isMissionComplete(mission, stats = {}) {
    return missionProgress(mission, stats) >= (Number(mission.target) || 1);
}

/** Отмечена ли миссия как выполненная (награда уже выдана). */
export function isMissionClaimed(state, missionId) {
    return (state[MISSIONS_KEY] || []).includes(missionId);
}

/**
 * Выдать награду за миссию. Меняет state (жемчужины + отметка о выдаче).
 * Возвращает количество выданных жемчужин (0 — если миссия не выполнена
 * по статистике или уже выдана).
 */
export function claimMissionReward(state, missionId, stats = {}, missions = MISSIONS) {
    const mission = missions.find((m) => m.id === missionId);
    if (!mission) return 0;
    if (!isMissionComplete(mission, stats)) return 0;
    if (isMissionClaimed(state, missionId)) return 0;
    state[MISSIONS_KEY] = [...(state[MISSIONS_KEY] || []), missionId];
    state.doubloons = (state.doubloons || 0) + mission.reward;
    return mission.reward;
}

/** Сколько миссий ещё не выполнено (для бейджа на карте/уровне). */
export function unclaimedMissions(state, missions = MISSIONS) {
    const done = state[MISSIONS_KEY] || [];
    return missions.filter((m) => !done.includes(m.id)).length;
}
