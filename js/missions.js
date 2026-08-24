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
 *   'maxTile'   — собери плитку N за партию (getMaxTile)
 *   'merges'    — суммарное число слияний за партию
 *   'moves'     — число ходов без проигрыша
 *   'score'     — набранные очки за партию
 *   'combo'     — максимальное число слияний за один ход (bestCombo)
 *   'streak'    — максимальная серия ходов подряд со слиянием (bestStreak)
 *   'position'  — позиционная цель (Фаза 4.5 «Глубина ядра»): миссия не
 *     «набери N», а привязана к месту на доске. Проверка по текущей доске
 *     через mission.position = { kind, target } (см. POSITION_CHECKS).
 *     Прогресс — 0 или 1 (выполнена/нет), награда выдаётся один раз.
 */
export const MISSIONS = [
    { id: 'm1', levelId: 1, icon: '🐟', title: 'Спаси малька',
      desc: 'Собери плитку 32 — малёк выберется на мелководье',
      type: 'maxTile', target: 32, reward: 50 },
    { id: 'm2', levelId: 2, icon: '🪸', title: 'Очисти риф от кораллов',
      desc: 'Сложи коралл 64 в углу рифа',
      type: 'position', position: { kind: 'corner', target: 64 }, reward: 60 },
    { id: 'm3', levelId: 3, icon: '🌊', title: 'Поймай течение',
      desc: 'Серия из 5 ходов подряд со слиянием',
      type: 'streak', target: 5, reward: 70 },
    { id: 'm4', levelId: 4, icon: '🐢', title: 'Спаси черепаху',
      desc: 'Собери плитку 512 — черепаху уносит течением',
      type: 'maxTile', target: 512, reward: 100 },
    { id: 'm5', levelId: 5, icon: '💥', title: 'Пара-близнецы',
      desc: 'Создай два 256 в одном ряду',
      type: 'position', position: { kind: 'pairInRow', target: 256 }, reward: 120 },
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
 * Проверки позиционных целей (Фаза 4.5 «Глубина ядра»).
 * Чистые функции от доски (плоский массив {value}|null) — без DOM/состояния.
 * kind:
 *   'corner'    — плитка `target` стоит в любом углу доски;
 *   'pairInRow' — в одном ряду есть не менее двух плиток `target` и выше.
 */
export const POSITION_CHECKS = {
    /** В углу (row=0/row=n-1, col=0/col=n-1) стоит плитка значения >= target. */
    corner(board, target) {
        const n = Math.round(Math.sqrt(board.length));
        if (!Number.isFinite(n) || n < 2 || n * n !== board.length) return false;
        const corners = [0, n - 1, n * (n - 1), n * n - 1];
        return corners.some((idx) => {
            const t = board[idx];
            return !!t && Number(t.value) >= Number(target);
        });
    },

    /** В одном ряду не менее двух плиток значения >= target. */
    pairInRow(board, target) {
        const n = Math.round(Math.sqrt(board.length));
        if (!Number.isFinite(n) || n < 2 || n * n !== board.length) return false;
        for (let r = 0; r < n; r++) {
            let count = 0;
            for (let c = 0; c < n; c++) {
                const t = board[r * n + c];
                if (t && Number(t.value) >= Number(target)) count++;
                if (count >= 2) return true;
            }
        }
        return false;
    },
};

/**
 * Прогресс позиционной миссии: 0 (не выполнена) или 1 (выполнена).
 * board — текущая доска партии (плоский массив {value}|null).
 * Для не-позиционных миссий возвращает 0 (они считаются через stats).
 */
export function positionProgress(mission, board) {
    if (!mission || mission.type !== 'position' || !mission.position) return 0;
    if (!Array.isArray(board)) return 0;
    const check = POSITION_CHECKS[mission.position.kind];
    if (!check) return 0;
    return check(board, mission.position.target) ? 1 : 0;
}

/**
 * Текущий прогресс миссии по статистике партии (клипируется к target
 * для корректного заполнения прогресс-бара). Для позиционных миссий
 * (тип 'position') прогресс — 0/1 по текущей доске `board`.
 */
export function missionProgress(mission, stats = {}, board) {
    if (!mission) return 0;
    if (mission.type === 'position') return positionProgress(mission, board);
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

/**
 * Выполнена ли миссия по статистике текущей партии (и доске для
 * позиционных целей).
 */
export function isMissionComplete(mission, stats = {}, board) {
    if (mission && mission.type === 'position') {
        return positionProgress(mission, board) === 1;
    }
    return missionProgress(mission, stats, board) >= (Number(mission.target) || 1);
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
export function claimMissionReward(state, missionId, stats = {}, board, missions = MISSIONS) {
    const mission = missions.find((m) => m.id === missionId);
    if (!mission) return 0;
    if (!isMissionComplete(mission, stats, board)) return 0;
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
