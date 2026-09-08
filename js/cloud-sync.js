// ======================== Стратегия облачной синхронизации ========================
// Разрешение конфликтов между локальным и облачным сохранением (VK / Yandex).
//
// Правила:
//   1. «Настройки и текущее место» — последняя запись побеждает (по updatedAt).
//   2. «Прогресс и экономика» — объединение/максимум, чтобы ничего не терялось.
//   3. «Сохранения партий» (saves) — для каждого уровня побеждает свежая запись (по ts).
//   4. После мержа результат сохраняется локально И пушится обратно в облако
//      (сходимость обеих сторон к одному состоянию).
//
// Модуль чистый (pure): не обращается к window/localStorage, легко тестируется.

/** Метка последнего изменения состояния (0 — если не задана). */
export function updatedAt(state) {
    return Number(state && state.updatedAt) || 0;
}

function unionArr(a, b, fallback = []) {
    const set = new Set([
        ...(Array.isArray(a) ? a : []),
        ...(Array.isArray(b) ? b : []),
        ...fallback,
    ]);
    return [...set];
}

function mergeMaxByKey(a = {}, b = {}) {
    const out = { ...a };
    for (const [k, v] of Object.entries(b)) {
        out[k] = Math.max(Number(out[k]) || 0, Number(v) || 0);
    }
    return out;
}

/**
 * Слияние двух состояний (local и cloud) по описанной выше стратегии.
 * Оба аргумента могут быть null/undefined — тогда возвращается «другая» сторона.
 */
export function resolveConflict(local, cloud) {
    const hasLocal = !!local && typeof local === 'object';
    const hasCloud = !!cloud && typeof cloud === 'object';
    if (!hasLocal) return { ...(hasCloud ? cloud : {}) };
    if (!hasCloud) return { ...local };

    // base — более свежее состояние (источник настроек и «текущего места»),
    // other — данные с другого устройства.
    const localNewer = updatedAt(local) >= updatedAt(cloud);
    const base = localNewer ? local : cloud;
    const other = localNewer ? cloud : local;

    // Чужие ключи не теряем: сначала other, поверх base.
    const merged = { ...other, ...base };

    // ── Прогресс: объединение / максимум ──
    merged.unlockedLevels = unionArr(base.unlockedLevels, other.unlockedLevels, [1]).sort((x, y) => x - y);
    merged.bestScores = mergeMaxByKey(base.bestScores, other.bestScores);
    merged.achievements = { ...(other.achievements || {}), ...(base.achievements || {}) };
    merged.bestTotal = Math.max(base.bestTotal || 0, other.bestTotal || 0);
    merged.bestTile = Math.max(base.bestTile || 0, other.bestTile || 0);
    merged.gamesPlayed = Math.max(base.gamesPlayed || 0, other.gamesPlayed || 0);
    merged.hintsUsed = Math.max(base.hintsUsed || 0, other.hintsUsed || 0);
    merged.undoCount = Math.max(base.undoCount || 0, other.undoCount || 0);
    merged.doubloons = Math.max(base.doubloons || 0, other.doubloons || 0);
    // Очки партии для «Обмена очков» — максимум, чтобы заслуженное не терялось.
    merged.pointsBalance = Math.max(base.pointsBalance || 0, other.pointsBalance || 0);
    merged.lastAdTime = Math.max(base.lastAdTime || 0, other.lastAdTime || 0);
    merged.unlockedSkins = unionArr(base.unlockedSkins, other.unlockedSkins, ['gold']);
    merged.unlockedThemes = unionArr(base.unlockedThemes, other.unlockedThemes, ['dark']);

    // ── Магазин (бусты / перки / ежедневный вход) ──
    // Запасы бустов складываем по максимуму каждого ключа (ничего не теряем).
    merged.inventory = mergeMaxByKey(base.inventory, other.inventory);
    // Перки — одноразовые флаги: объединяем (base поверх other для совпадений).
    merged.perks = { ...(other.perks || {}), ...(base.perks || {}) };
    // Ежедневный вход: максимум дней серии, метка последнего захода от base (иначе other).
    const baseStreak = base.dailyStreak || {};
    const otherStreak = other.dailyStreak || {};
    merged.dailyStreak = {
        days: Math.max(Number(baseStreak.days) || 0, Number(otherStreak.days) || 0),
        lastClaim: baseStreak.lastClaim || otherStreak.lastClaim || '',
    };

    // Текущий уровень — «последняя запись побеждает», но всегда внутри разблокированного.
    if (!merged.unlockedLevels.includes(merged.currentLevel)) {
        merged.currentLevel = merged.unlockedLevels[merged.unlockedLevels.length - 1] || 1;
    }

    // ── Ежедневные задания (объединяем только если дата совпадает) ──
    const baseDaily = base.daily && base.daily.date ? base.daily : null;
    const otherDaily = other.daily && other.daily.date ? other.daily : null;
    if (baseDaily && otherDaily && baseDaily.date === otherDaily.date) {
        merged.dailyCounters = mergeMaxByKey(base.dailyCounters, other.dailyCounters);
        merged.daily = {
            ...baseDaily,
            claimed: { ...(otherDaily.claimed || {}), ...(baseDaily.claimed || {}) },
        };
    } else if (!baseDaily && otherDaily) {
        merged.daily = { ...otherDaily };
        merged.dailyCounters = { ...(other.dailyCounters || {}) };
    }

    // ── Ежедневный турнир глубин (объединяем только если дата совпадает) ──
    // best — максимум с обоих устройств, played — true, если играли хоть где-то,
    // claimed (достигнутые пороги наград) — объединение.
    const baseT = base.tournament && base.tournament.date ? base.tournament : null;
    const otherT = other.tournament && other.tournament.date ? other.tournament : null;
    if (baseT && otherT && baseT.date === otherT.date) {
        merged.tournament = {
            date: baseT.date,
            best: Math.max(Number(baseT.best) || 0, Number(otherT.best) || 0),
            played: !!(baseT.played || otherT.played),
            claimed: unionArr(baseT.claimed, otherT.claimed).sort((x, y) => x - y),
        };
    } else if (!baseT && otherT) {
        merged.tournament = { ...otherT };
    }

    // ── Приглашения 👥: приветственный бонус не должен дублироваться ──
    // welcomeClaimed — true, если хотя бы на одном устройстве уже забрали.
    // Счётчик дня берём по более свежему состоянию (base).
    const baseI = base.invite && typeof base.invite === 'object' ? base.invite : null;
    const otherI = other.invite && typeof other.invite === 'object' ? other.invite : null;
    if (baseI || otherI) {
        merged.invite = {
            date: (baseI && baseI.date) || (otherI && otherI.date) || '',
            count: Math.max(Number(baseI && baseI.count) || 0, Number(otherI && otherI.count) || 0),
            welcomeClaimed: !!(baseI && baseI.welcomeClaimed) || !!(otherI && otherI.welcomeClaimed),
        };
    }

    // ── Сообщения-вызовы 💪: счётчик дня по максимуму ──
    const baseR = base.requests && typeof base.requests === 'object' ? base.requests : null;
    const otherR = other.requests && typeof other.requests === 'object' ? other.requests : null;
    if (baseR || otherR) {
        merged.requests = {
            date: (baseR && baseR.date) || (otherR && otherR.date) || '',
            count: Math.max(Number(baseR && baseR.count) || 0, Number(otherR && otherR.count) || 0),
        };
    }

    // ── Дуэль дня ⚔️ (объединяем только если дата совпадает) ──
    // best — максимум с обоих устройств, played — true, если играли хоть где-то,
    // wins — суммарные победы дня, claimed (win/lose награды) — объединение.
    // pendingScore (счёт соперника из входящего вызова) — более свежее состояние.
    const baseD = base.duel && base.duel.date ? base.duel : null;
    const otherD = other.duel && other.duel.date ? other.duel : null;
    if (baseD && otherD && baseD.date === otherD.date) {
        merged.duel = {
            date: baseD.date,
            best: Math.max(Number(baseD.best) || 0, Number(otherD.best) || 0),
            played: !!(baseD.played || otherD.played),
            wins: Math.max(Number(baseD.wins) || 0, Number(otherD.wins) || 0),
            claimed: unionArr(baseD.claimed, otherD.claimed).sort(),
            pendingScore: Math.max(Number(baseD.pendingScore) || 0, Number(otherD.pendingScore) || 0),
        };
    } else if (!baseD && otherD) {
        merged.duel = { ...otherD };
    }

    // updatedAt остаётся от более свежего состояния — без «отката» метки времени.
    return merged;
}

/**
 * Слияние сохранений партий (per-level board saves).
 * Для каждого уровня побеждает запись с более поздним ts (равные — в пользу local).
 */
export function mergeBoardSaves(local = {}, cloud = {}) {
    const out = { ...(cloud || {}) };
    for (const [k, v] of Object.entries(local || {})) {
        if (!out[k] || (Number(v && v.ts) || 0) >= (Number(out[k] && out[k].ts) || 0)) {
            out[k] = v;
        }
    }
    return out;
}

/** Пометить состояние как изменённое (последняя запись = текущий момент). */
export function bumpUpdatedAt(state, now = Date.now()) {
    return { ...state, updatedAt: now };
}
