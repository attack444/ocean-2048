// ======================== Сокровищница (сундук и обмен) ========================
// Чистая, тестируемая логика экономики: сундук за жемчужины, обмен очков
// на жемчужины, рецепты донатных наборов и раздача наград сундука.
// Модуль не трогает DOM и не обращается к window/localStorage — только state.

/**
 * Развернуть сундук за жемчужины.
 * Стоимость: chestPrice. Награда случайная (детерминированный тест через opts.random).
 * Бонусные скины/темы добавляются в state.unlockedSkins / state.unlockedThemes.
 * Бонусные перки — в state.perks.
 *
 * state.chestGuaranteed — накопительный гарант: каждый сундук без легендарки
 * повышает шанс следующего на +chestGuaranteeStep до достижения гаранта.
 * При выпадении легендарки счётчик сбрасывается.
 *
 * @returns {{ok:true, reward:object, legendary:boolean} | {ok:false, reason:'not_enough'|'no_chest'}}
 */
export function openChest(state, opts = {}) {
    if (!state || !opts.chest) return { ok: false, reason: 'no_chest' };
    const { price, tiers } = opts.chest;
    if (!price || !Array.isArray(tiers) || tiers.length === 0) return { ok: false, reason: 'no_chest' };
    if ((state.doubloons || 0) < price) return { ok: false, reason: 'not_enough' };

    state.doubloons = (state.doubloons || 0) - price;
    state.chestGuaranteed = state.chestGuaranteed || 0;

    // Гарант: каждый неудачный сундук повышает шанс легендарки.
    const random = opts.random || Math.random;
    const legendaryChance = Math.min(
        opts.chest.legendaryChance + state.chestGuaranteed * (opts.chest.legendaryGuaranteeStep || 0),
        1
    );
    const legendary = random() < legendaryChance;

    // Собираем пул наград: на легендарку — только легендарные скины/темы.
    const pool = legendary
        ? tiers.filter(t => t.tier === 'legendary')
        : tiers.filter(t => t.tier !== 'legendary');
    const safePool = pool.length > 0 ? pool : tiers;
    const reward = safePool[Math.floor(random() * safePool.length)];

    // Выдача награды.
    const grant = { ...reward };
    if (reward.kind === 'doubloons') {
        state.doubloons = (state.doubloons || 0) + (reward.amount || 0);
    } else if (reward.kind === 'boost') {
        state.inventory = state.inventory || {};
        state.inventory[reward.key] = (state.inventory[reward.key] || 0) + (reward.amount || 1);
    } else if (reward.kind === 'perk') {
        state.perks = state.perks || {};
        state.perks[reward.key] = true;
    } else if (reward.kind === 'skin') {
        state.unlockedSkins = [...new Set([...(state.unlockedSkins || []), reward.key])];
    } else if (reward.kind === 'theme') {
        state.unlockedThemes = [...new Set([...(state.unlockedThemes || []), reward.key])];
    }

    // Сброс гаранта при легендарке, иначе — рост счётчика.
    if (legendary) {
        state.chestGuaranteed = 0;
    } else {
        state.chestGuaranteed += 1;
    }

    return { ok: true, reward: grant, legendary };
}

/**
 * Обменять очки на жемчужины.
 * rate: сколько очков за 1 жемчужину (например 500). Минимальная сделка — 1 жемчужина.
 * Перк «Жемчужная жила» (+50%) НЕ применяется к обмену (уже очки→жемчужины), но
 * лимит сделок в день ограничен dailyExchangeLimit (чтобы не «печатать» валюту).
 *
 * @returns {{ok:true, spent:number, gained:number} | {ok:false, reason:'no_state'|'bad_rate'|'not_enough'|'limit'}}
 */
export function exchangePointsForDoubloons(state, points, opts = {}) {
    if (!state) return { ok: false, reason: 'no_state' };
    const rate = Number(opts.rate) || 0;
    if (rate <= 0) return { ok: false, reason: 'bad_rate' };
    const gained = Math.floor(Number(points) || 0);
    if (gained <= 0) return { ok: false, reason: 'not_enough' };

    const day = opts.day || todayKey();
    const used = ((state.exchangeDaily || {})[day] || 0);
    const limit = opts.limit || 3;
    if (used + gained > limit) {
        const gained = limit - used;
        if (gained <= 0) return { ok: false, reason: 'limit' };
        return exchangePointsForDoubloons(state, gained, { ...opts, limit });
    }

    const spent = gained * rate;
    if ((state.pointsBalance || 0) < spent) return { ok: false, reason: 'not_enough' };

    state.pointsBalance = (state.pointsBalance || 0) - spent;
    state.doubloons = (state.doubloons || 0) + gained;
    state.exchangeDaily = state.exchangeDaily || {};
    state.exchangeDaily[day] = used + gained;

    return { ok: true, spent, gained };
}

/**
 * Текущий дневной счётчик обмена очков (для UI).
 * @returns {number}
 */
export function exchangeUsedToday(state, day = todayKey()) {
    return state ? ((state.exchangeDaily || {})[day] || 0) : 0;
}

/**
 * Зачислить очки, заработанные за партию, в баланс обмена (pointsBalance).
 * Одна и та же партия может завершаться несколько раз (победа → «продолжить»
 * → game over, спасение после game over), поэтому начисляется только разница
 * между итоговым счётом и уже зачтённым (alreadyCredited), без задвоений.
 *
 * @param {object} state — игровое состояние (мутируется).
 * @param {number} finalScore — итоговый счёт партии.
 * @param {number} [alreadyCredited=0] — сколько очков этой партии уже зачтено.
 * @returns {{gained:number, total:number}} фактически зачтено и полный счёт.
 */
export function creditGamePoints(state, finalScore, alreadyCredited = 0) {
    if (!state) return { gained: 0, total: 0 };
    const total = Math.max(0, Math.floor(Number(finalScore) || 0));
    const credited = Math.max(0, Math.floor(Number(alreadyCredited) || 0));
    const gained = Math.max(0, total - credited);
    if (gained > 0) {
        state.pointsBalance = (state.pointsBalance || 0) + gained;
    }
    return { gained, total };
}

/** Ключ текущего дня (YYYY-MM-DD по локальному времени). */
export function todayKey(d = new Date()) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

// ──────────────────────────────────────────────────────────────
// Донат (реальные деньги) — рецепты для платформ VK / Yandex.
// Здесь только декларативные наборы; реальную оплату проводит
// платформа:
//   - VK: товары за голоса (id — идентификатор товара в кабинете
//     VK → Платежи; votes — цена в голосах; отображается на кнопке).
//   - Yandex: Purchase API (Фаза 6).
// На вебе вкладка доната показывает «скоро».
// ──────────────────────────────────────────────────────────────

export const DONATE_PACKS = [
    { id: 'donate_small',  pearls: 1000,  votes: 10,  priceRub: 49,  icon: '🦪', name: 'Мешочек жемчуга' },
    { id: 'donate_medium', pearls: 3000,  votes: 25,  priceRub: 129, icon: '💰', name: 'Сундук с жемчугом' },
    { id: 'donate_large',  pearls: 8000,  votes: 60,  priceRub: 299, icon: '👑', name: 'Сокровища глубин' },
    { id: 'donate_mega',   pearls: 20000, votes: 130, priceRub: 699, icon: '🐙', name: 'Наследие Кракена' },
];
