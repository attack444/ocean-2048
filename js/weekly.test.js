/**
 * Unit tests for the Weekly Challenge (Еженедельный челлендж 📅).
 * Node built-in test runner — pure logic, no DOM required.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
    WEEKLY_KEY,
    WEEKLY_POOL,
    weekKey,
    weeklyChallenge,
    ensureWeekly,
    recordWeeklyResult,
    claimWeeklyReward,
    weeklyInfo,
} from './weekly.js';

describe('weekKey (ISO week)', () => {
    it('returns Monday-start ISO week key', () => {
        // 2026-08-24 — понедельник (ISO-неделя 2026-W35).
        assert.equal(weekKey('2026-08-24'), '2026-W35');
    });

    it('is stable across the whole week', () => {
        assert.equal(weekKey('2026-08-24'), '2026-W35');
        assert.equal(weekKey('2026-08-30'), '2026-W35'); // воскресенье той же недели
    });

    it('rolls over at the week boundary', () => {
        assert.equal(weekKey('2026-08-31'), '2026-W36'); // следующий понедельник
    });

    it('handles ISO year boundary (late December rolls into week 1)', () => {
        // 2026-12-31 — четверг; понедельник недели — 2026-12-28.
        // ISO-неделя 53: 2026-W53.
        assert.equal(weekKey('2026-12-31'), '2026-W53');
    });

    it('handles week 1 of the next year (early January)', () => {
        // 2027-01-01 — пятница; его ISO-неделя — 2026-W53 (неделя начинается 28.12.2026).
        assert.equal(weekKey('2027-01-01'), '2026-W53');
    });

    it('handles a January week that belongs to the previous ISO year', () => {
        // 2021-01-01 — пятница, ISO-неделя 2020-W53.
        assert.equal(weekKey('2021-01-01'), '2020-W53');
    });
});

describe('weeklyChallenge', () => {
    it('returns a valid challenge from the pool for any week', () => {
        for (const wk of ['2026-W35', '2026-W01', '2027-W01', '2020-W53']) {
            const c = weeklyChallenge(wk);
            assert.ok(c, `no challenge for ${wk}`);
            assert.ok(WEEKLY_POOL.includes(c));
            assert.ok(c.target > 0 && c.movesLimit > 0 && c.reward > 0);
        }
    });

    it('is deterministic: same week, same challenge', () => {
        assert.deepEqual(weeklyChallenge('2026-W35'), weeklyChallenge('2026-W35'));
    });

    it('usually differs between different weeks', () => {
        const seen = new Set();
        for (let w = 1; w <= 40; w++) {
            const key = `2026-W${String(w).padStart(2, '0')}`;
            seen.add(weeklyChallenge(key).levelId);
        }
        // Пул из 7 уровней — за 40 недель почти наверняка будут разные.
        assert.ok(seen.size > 1, 'expected variety across weeks');
    });
});

describe('ensureWeekly', () => {
    it('creates a fresh record on first call', () => {
        const state = {};
        assert.equal(ensureWeekly(state, '2026-W35'), true);
        assert.deepEqual(state[WEEKLY_KEY], {
            week: '2026-W35', done: false, bestScore: 0, bestMoves: 0, claimed: false,
        });
    });

    it('resets progress when the week changes', () => {
        const state = {};
        recordWeeklyResult(state, { completed: true, score: 1200, movesUsed: 30 }, '2026-W35');
        assert.equal(state[WEEKLY_KEY].done, true);

        assert.equal(ensureWeekly(state, '2026-W36'), true);
        assert.equal(state[WEEKLY_KEY].week, '2026-W36');
        assert.equal(state[WEEKLY_KEY].done, false);
        assert.equal(state[WEEKLY_KEY].bestScore, 0);
    });

    it('keeps the same week untouched', () => {
        const state = {};
        recordWeeklyResult(state, { completed: true, score: 900, movesUsed: 25 }, '2026-W35');
        assert.equal(ensureWeekly(state, '2026-W35'), false);
        assert.equal(state[WEEKLY_KEY].done, true);
    });
});

describe('recordWeeklyResult', () => {
    it('marks a completed run as done (first time)', () => {
        const state = {};
        const res = recordWeeklyResult(state, { completed: true, score: 1500, movesUsed: 40 }, '2026-W35');
        assert.deepEqual(res, { isNewDone: true, isNewBest: true });
        assert.equal(state[WEEKLY_KEY].done, true);
        assert.equal(state[WEEKLY_KEY].bestScore, 1500);
        assert.equal(state[WEEKLY_KEY].bestMoves, 40);
    });

    it('does not mark done when the run failed', () => {
        const state = {};
        recordWeeklyResult(state, { completed: false, score: 300, movesUsed: 45 }, '2026-W35');
        assert.equal(state[WEEKLY_KEY].done, false);
    });

    it('only raises best score and best moves, never lowers', () => {
        const state = {};
        recordWeeklyResult(state, { completed: true, score: 2000, movesUsed: 50 }, '2026-W35');
        const res = recordWeeklyResult(state, { completed: true, score: 800, movesUsed: 20 }, '2026-W35');
        assert.equal(res.isNewBest, false);
        assert.equal(state[WEEKLY_KEY].bestScore, 2000);
        assert.equal(state[WEEKLY_KEY].bestMoves, 50);
    });

    it('does not duplicate the first-completion flag', () => {
        const state = {};
        recordWeeklyResult(state, { completed: true, score: 500, movesUsed: 30 }, '2026-W35');
        const res = recordWeeklyResult(state, { completed: true, score: 900, movesUsed: 33 }, '2026-W35');
        assert.equal(res.isNewDone, false);
        assert.equal(res.isNewBest, true);
    });
});

describe('claimWeeklyReward', () => {
    it('pays out the reward once', () => {
        const state = { doubloons: 0 };
        recordWeeklyResult(state, { completed: true, score: 1500, movesUsed: 40 }, '2026-W35');
        const reward = weeklyChallenge('2026-W35').reward;

        const got = claimWeeklyReward(state, '2026-W35');
        assert.equal(got, reward);
        assert.equal(state.doubloons, reward);
        assert.equal(state[WEEKLY_KEY].claimed, true);

        // Повторный вызов ничего не даёт.
        assert.equal(claimWeeklyReward(state, '2026-W35'), 0);
        assert.equal(state.doubloons, reward);
    });

    it('returns 0 when the challenge is not done', () => {
        const state = { doubloons: 10 };
        assert.equal(claimWeeklyReward(state, '2026-W35'), 0);
        assert.equal(state.doubloons, 10);
    });

    it('pays out again after the week changes', () => {
        const state = { doubloons: 0 };
        recordWeeklyResult(state, { completed: true, score: 1500, movesUsed: 40 }, '2026-W35');
        claimWeeklyReward(state, '2026-W35');

        recordWeeklyResult(state, { completed: true, score: 1600, movesUsed: 45 }, '2026-W36');
        const got = claimWeeklyReward(state, '2026-W36');
        assert.ok(got > 0);
        assert.equal(state[WEEKLY_KEY].claimed, true);
    });
});

describe('weeklyInfo', () => {
    it('exposes the current week challenge state for UI', () => {
        const state = {};
        const info = weeklyInfo(state, '2026-W35');
        const ch = weeklyChallenge('2026-W35');
        assert.equal(info.week, '2026-W35');
        assert.equal(info.levelId, ch.levelId);
        assert.equal(info.target, ch.target);
        assert.equal(info.movesLimit, ch.movesLimit);
        assert.equal(info.reward, ch.reward);
        assert.equal(info.done, false);
        assert.equal(info.claimed, false);
        assert.equal(info.bestScore, 0);
        assert.equal(info.bestMoves, 0);
    });
});
