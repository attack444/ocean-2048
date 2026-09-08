/**
 * Unit tests for the treasure economy (chest.js): chest with legendary
 * guarantee, points exchange with daily limit, and donate packs.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
    openChest,
    exchangePointsForDoubloons,
    exchangeUsedToday,
    creditGamePoints,
    todayKey,
    DONATE_PACKS,
} from './chest.js';

function baseState(overrides = {}) {
    return {
        doubloons: 10000,
        pointsBalance: 5000,
        inventory: {},
        perks: {},
        unlockedSkins: ['gold'],
        unlockedThemes: ['dark'],
        chestGuaranteed: 0,
        chestOpened: 0,
        exchangeDaily: {},
        ...overrides,
    };
}

const CHEST = {
    price: 1500,
    legendaryChance: 0.06,
    legendaryGuaranteeStep: 0.02,
    tiers: [
        { tier: 'common',    kind: 'doubloons', amount: 600,  name: '600 жемчужин',  icon: '🦪' },
        { tier: 'uncommon',  kind: 'boost',     key: 'bomb',  amount: 2, name: '2× Бомба', icon: '💣' },
        { tier: 'rare',      kind: 'perk',      key: 'fourChance', name: 'Перк: Дух четвёрки', icon: '🎲' },
        { tier: 'epic',      kind: 'skin',      key: 'pearl', name: 'Скин: Жемчужина глубин', icon: '🐚' },
        { tier: 'legendary', kind: 'skin',      key: 'kraken', name: 'Скин: Кракен', icon: '🐙' },
        { tier: 'legendary', kind: 'theme',     key: 'abyss',  name: 'Тема: Глубина', icon: '🌌' },
    ],
};

describe('chest.openChest', () => {
    it('fails without enough doubloons', () => {
        const st = baseState({ doubloons: 100 });
        assert.deepEqual(openChest(st, { chest: CHEST }), { ok: false, reason: 'not_enough' });
        assert.equal(st.doubloons, 100);
    });
    it('fails on missing chest config', () => {
        assert.deepEqual(openChest(baseState(), {}), { ok: false, reason: 'no_chest' });
        assert.deepEqual(openChest(null, { chest: CHEST }), { ok: false, reason: 'no_chest' });
    });
    it('deducts the price and grants a doubloons reward', () => {
        const st = baseState({ doubloons: 2000 });
        const res = openChest(st, { chest: CHEST, random: () => 0.1 }); // common → doubloons
        assert.equal(res.ok, true);
        assert.equal(res.legendary, false);
        assert.equal(res.reward.kind, 'doubloons');
        assert.equal(st.doubloons, 2000 - 1500 + 600);
    });
    it('grants a boost into inventory', () => {
        const st = baseState();
        // openChest вызывает random() дважды: 0.3 < 0.06 → не легендарка;
        // выбор из 4 не-легендарных тиров: floor(0.3*4)=1 → uncommon (bomb).
        const res = openChest(st, { chest: CHEST, random: () => 0.3 });
        assert.equal(res.ok, true);
        assert.equal(res.reward.kind, 'boost');
        assert.equal(st.inventory.bomb, 2);
    });
    it('unlocks a perk from the chest', () => {
        const st = baseState();
        const res = openChest(st, { chest: CHEST, random: () => 0.7 }); // rare → fourChance
        assert.equal(res.ok, true);
        assert.equal(res.reward.kind, 'perk');
        assert.equal(st.perks.fourChance, true);
    });
    it('gives a legendary when forced by random', () => {
        const st = baseState();
        const res = openChest(st, { chest: CHEST, random: () => 0.0 }); // legendary roll
        assert.equal(res.ok, true);
        assert.equal(res.legendary, true);
        assert.equal(res.reward.tier, 'legendary');
        assert.equal(st.chestGuaranteed, 0);
        // legendary pool: kraken skin or abyss theme
        assert.ok(st.unlockedSkins.includes('kraken') || st.unlockedThemes.includes('abyss'));
    });
    it('resets the guarantee counter on a legendary, increments otherwise', () => {
        const st = baseState({ chestGuaranteed: 5 });
        openChest(st, { chest: CHEST, random: () => 0.0 }); // legendary
        assert.equal(st.chestGuaranteed, 0);

        const st2 = baseState({ chestGuaranteed: 5 });
        openChest(st2, { chest: CHEST, random: () => 0.9 }); // non-legendary
        assert.equal(st2.chestGuaranteed, 6);
    });
    it('guarantee raises the legendary chance step by step', () => {
        const st = baseState({ chestGuaranteed: 40 });
        // 0.06 + 40*0.02 = 0.86 → random 0.5 lands legendary
        const res = openChest(st, { chest: CHEST, random: () => 0.5 });
        assert.equal(res.legendary, true);
    });
});

describe('chest.exchangePointsForDoubloons', () => {
    it('exchanges points for doubloons at the given rate', () => {
        const st = baseState({ pointsBalance: 2000 });
        const res = exchangePointsForDoubloons(st, 2, { rate: 500, limit: 3, day: '2026-01-01' });
        assert.equal(res.ok, true);
        assert.equal(res.spent, 1000);
        assert.equal(res.gained, 2);
        assert.equal(st.pointsBalance, 1000);
        assert.equal(st.doubloons, 10002);
        assert.equal(exchangeUsedToday(st, '2026-01-01'), 2);
    });
    it('fails when points are insufficient', () => {
        const st = baseState({ pointsBalance: 100 });
        assert.deepEqual(
            exchangePointsForDoubloons(st, 2, { rate: 500, limit: 3, day: '2026-01-01' }),
            { ok: false, reason: 'not_enough' }
        );
        assert.equal(st.doubloons, 10000);
    });
    it('respects the daily limit and never grants more than remaining', () => {
        const st = baseState({ pointsBalance: 5000, exchangeDaily: { '2026-01-01': 2 } });
        const res = exchangePointsForDoubloons(st, 3, { rate: 500, limit: 3, day: '2026-01-01' });
        assert.equal(res.ok, true);
        assert.equal(res.gained, 1); // only 1 slot left today
        assert.equal(res.spent, 500);
        assert.equal(st.pointsBalance, 4500);
    });
    it('blocks the exchange entirely once the daily limit is reached', () => {
        const st = baseState({ pointsBalance: 5000, exchangeDaily: { '2026-01-01': 3 } });
        assert.deepEqual(
            exchangePointsForDoubloons(st, 1, { rate: 500, limit: 3, day: '2026-01-01' }),
            { ok: false, reason: 'limit' }
        );
    });
    it('a new day resets the used counter', () => {
        const st = baseState({ pointsBalance: 5000, exchangeDaily: { '2026-01-01': 3 } });
        const res = exchangePointsForDoubloons(st, 1, { rate: 500, limit: 3, day: '2026-01-02' });
        assert.equal(res.ok, true);
        assert.equal(res.gained, 1);
        assert.equal(exchangeUsedToday(st, '2026-01-01'), 3);
        assert.equal(exchangeUsedToday(st, '2026-01-02'), 1);
    });
    it('todayKey produces YYYY-MM-DD', () => {
        assert.match(todayKey(new Date(2026, 0, 5)), /^2026-01-05$/);
        assert.match(todayKey(new Date(2026, 11, 31)), /^2026-12-31$/);
    });
});

describe('chest.creditGamePoints', () => {
    it('credits the full score when nothing was credited yet', () => {
        const st = baseState({ pointsBalance: 5000 });
        const res = creditGamePoints(st, 1234);
        assert.deepEqual(res, { gained: 1234, total: 1234 });
        assert.equal(st.pointsBalance, 6234);
    });
    it('credits only the delta when part of the score is already credited', () => {
        // Победа → «Продолжить» → game over: повторное завершение той же партии
        const st = baseState({ pointsBalance: 5000 });
        const first = creditGamePoints(st, 2000);
        assert.equal(first.gained, 2000);
        // Счёт вырос до 3000 — зачисляется только разница, без задвоения
        const second = creditGamePoints(st, 3000, first.total);
        assert.deepEqual(second, { gained: 1000, total: 3000 });
        assert.equal(st.pointsBalance, 5000 + 2000 + 1000);
    });
    it('never credits twice for the same final score', () => {
        const st = baseState({ pointsBalance: 5000 });
        creditGamePoints(st, 1500);
        const again = creditGamePoints(st, 1500, 1500);
        assert.deepEqual(again, { gained: 0, total: 1500 });
        assert.equal(st.pointsBalance, 6500);
    });
    it('handles zero, negative and non-numeric scores safely', () => {
        const st = baseState({ pointsBalance: 5000 });
        assert.deepEqual(creditGamePoints(st, 0), { gained: 0, total: 0 });
        assert.deepEqual(creditGamePoints(st, -5), { gained: 0, total: 0 });
        assert.deepEqual(creditGamePoints(st, NaN), { gained: 0, total: 0 });
        assert.deepEqual(creditGamePoints(st, undefined), { gained: 0, total: 0 });
        assert.equal(st.pointsBalance, 5000); // баланс не тронут
    });
    it('floors fractional scores like game addScore does', () => {
        const st = baseState({ pointsBalance: 5000 });
        creditGamePoints(st, 25.9);
        assert.equal(st.pointsBalance, 5025);
    });
    it('works when state lacks the field and tolerates null state', () => {
        const st = baseState();
        delete st.pointsBalance;
        const res = creditGamePoints(st, 400);
        assert.equal(res.gained, 400);
        assert.equal(st.pointsBalance, 400);

        assert.deepEqual(creditGamePoints(null, 100), { gained: 0, total: 0 });
    });
});

describe('chest.donate packs', () => {
    it('has four packs with pearls and ruble prices', () => {
        assert.equal(DONATE_PACKS.length, 4);
        for (const p of DONATE_PACKS) {
            assert.ok(p.pearls > 0);
            assert.ok(p.priceRub > 0);
            assert.ok(p.id);
        }
    });
});
