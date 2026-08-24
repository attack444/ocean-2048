// ======================== Уровни: ранги, размеры поля и цели ========================
// Чистые данные и хелперы уровней (без DOM/localStorage).

// Прилив 🌊 и Ходы как ресурс 🧮 (Фаза 2.5): у каждой плитки — свой конфиг.
// Уровень угрозы растёт с глубиной: чем дальше уровень, тем больше
// затапливаемых рядов (depth), тем меньше ходов до прилива (interval)
// и тем строже наказание за «бесполезный» ход (меньше порог maxWithoutMerge).
// Первые уровни — без механик, чтобы дать освоиться с базовыми правилами.
export const LEVELS = [
    { id: 1, name: 'Ракушка',        rank: '🐚',   size: 4, target: 256  },
    { id: 2, name: 'Краб',           rank: '🦀',   size: 4, target: 512  },
    { id: 3, name: 'Медуза',         rank: '🪼',   size: 4, target: 1024 },
    { id: 4, name: 'Черепаха',       rank: '🐢',   size: 4, target: 2048,
      tide: { interval: 10, depth: 1, scoreReturn: 0.5, warning: 3 },
      moves: { tideStep: 1, maxWithoutMerge: 6, depth: 1 } },
    { id: 5, name: 'Осьминог',       rank: '🐙',   size: 5, target: 2048,
      tide: { interval: 9,  depth: 1, scoreReturn: 0.5, warning: 3 },
      moves: { tideStep: 1, maxWithoutMerge: 5, depth: 1 } },
    { id: 6, name: 'Акула',          rank: '🦈',   size: 5, target: 4096,
      tide: { interval: 8,  depth: 2, scoreReturn: 0.5, warning: 2 },
      moves: { tideStep: 1, maxWithoutMerge: 4, depth: 1 },
      shark: { appearMoves: 6, stepInterval: 3, targetThreshold: 32, protectChance: 0.2 },
      abilities: { spawnChance: 0.03 } },
    { id: 7, name: 'Хозяин Моря',    rank: '👑',   size: 6, target: 4096,
      tide: { interval: 7,  depth: 2, scoreReturn: 0.5, warning: 2 },
      moves: { tideStep: 2, maxWithoutMerge: 3, depth: 2 },
      shark: { appearMoves: 5, stepInterval: 2, targetThreshold: 32, protectChance: 0.15 },
      abilities: { spawnChance: 0.04 } },
];

/** Конфиг прилива для уровня (null — прилив выключен на этом уровне). */
export function tideConfigForLevel(id) {
    return levelById(id).tide || null;
}

/** Конфиг «Ходы как ресурс» для уровня (null — механика выключена). */
export function movesConfigForLevel(id) {
    return levelById(id).moves || null;
}

/** Конфиг «Акула-охотник» для уровня (null — механика выключена). */
export function sharkConfigForLevel(id) {
    return levelById(id).shark || null;
}

/** Конфиг «Плитки-способности» для уровня (null — механика выключена). */
export function abilitiesConfigForLevel(id) {
    return levelById(id).abilities || null;
}

/**
 * Уровень по id (строковому или числовому). Неизвестный id — первый уровень.
 */
export function levelById(id) {
    const n = Number(id);
    return LEVELS.find(l => l.id === n) || LEVELS[0];
}

/**
 * Финальный ли это уровень (после него — победа «Хозяин Моря»)?
 */
export function isLastLevel(id) {
    return Number(id) === LEVELS[LEVELS.length - 1].id;
}
