/**
 * Unit tests for the daily puzzle (Ежедневная головоломка, общий сид).
 * Node built-in test runner — pure logic, no DOM required.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
    PUZZLE_TARGET,
    PUZZLE_REWARD,
    PUZZLE_SIZE,
    PUZZLE_KEY,
    hashString,
    seedFromDate,
    makeRng,
    puzzleStartBoard,
    ensureDailyPuzzle,
    recordPuzzleResult,
    puzzleInfo,
} from './daily-puzzle.js';

describe('daily-puzzle constants', () => {
    it('targets a 512 tile on a 4x4 board', () => {
        assert.equal(PUZZLE_TARGET, 512);
        assert.equal(PUZZLE_SIZE, 4);
        assert.equal(PUZZLE_REWARD, 150);
        assert.equal(PUZZLE_KEY, 'dailyPuzzle');
    });
});

describe('hashString / seedFromDate', () => {
    it('is deterministic for the same input', () => {
        assert.equal(hashString('abc'), hashString('abc'));
        assert.equal(seedFromDate('2026-08-22'), seedFromDate('2026-08-22'));
    });

    it('produces different seeds for different dates', () => {
        const a = seedFromDate('2026-08-22');
        const b = seedFromDate('2026-08-23');
        assert.notEqual(a, b);
        assert.ok(a >= 0 && a <= 0xFFFFFFFF);
        assert.ok(b >= 0 && b <= 0xFFFFFFFF);
    });

    it('prefixes the salt so unrelated strings hash differently', () => {
        assert.notEqual(seedFromDate('2026-08-22'), hashString('2026-08-22'));
    });
});

describe('makeRng (mulberry32)', () => {
    it('is deterministic for the same seed', () => {
        const rngA = makeRng(123);
        const rngB = makeRng(123);
        const seqA = [rngA(), rngA(), rngA(), rngA()];
        const seqB = [rngB(), rngB(), rngB(), rngB()];
        assert.deepEqual(seqA, seqB);
    });

    it('differs for different seeds', () => {
        const seqA = [makeRng(1)(), makeRng(1)(), makeRng(1)()];
        const seqB = [makeRng(2)(), makeRng(2)(), makeRng(2)()];
        assert.notDeepEqual(seqA, seqB);
    });

    it('yields values in [0, 1)', () => {
        const rng = makeRng(42);
        for (let i = 0; i < 100; i++) {
            const v = rng();
            assert.ok(v >= 0 && v < 1, `value ${v} out of range`);
        }
    });
});

describe('puzzleStartBoard', () => {
    it('is deterministic for the same date', () => {
        const a = puzzleStartBoard('2026-08-22');
        const b = puzzleStartBoard('2026-08-22');
        assert.equal(a.length, PUZZLE_SIZE * PUZZLE_SIZE);
        assert.deepEqual(a, b);
    });

    it('differs across dates', () => {
        const a = puzzleStartBoard('2026-08-22');
        const b = puzzleStartBoard('2026-08-23');
        assert.notDeepEqual(a, b);
    });

    it('places exactly two valid starting tiles', () => {
        const tiles = puzzleStartBoard('2026-08-22');
        const placed = tiles.filter(Boolean);
        assert.equal(placed.length, 2);
        for (const t of placed) {
            assert.ok([2, 4].includes(t.value));
        }
    });
});

describe('ensureDailyPuzzle', () => {
    it('creates fresh progress on first call', () => {
        const state = {};
        assert.equal(ensureDailyPuzzle(state, '2026-08-22'), true);
        assert.deepEqual(state[PUZZLE_KEY], { date: '2026-08-22', best: 0, done: false });
    });

    it('does not touch state on the same day', () => {
        const state = { dailyPuzzle: { date: '2026-08-22', best: 120, done: true } };
        assert.equal(ensureDailyPuzzle(state, '2026-08-22'), false);
        assert.equal(state.dailyPuzzle.best, 120);
    });

    it('resets progress when the day changes', () => {
        const state = { dailyPuzzle: { date: '2026-08-22', best: 500, done: true } };
        assert.equal(ensureDailyPuzzle(state, '2026-08-23'), true);
        assert.deepEqual(state[PUZZLE_KEY], { date: '2026-08-23', best: 0, done: false });
    });
});

describe('recordPuzzleResult', () => {
    it('records a new best score', () => {
        const state = {};
        const isNew = recordPuzzleResult(state, { score: 320, maxTile: 128 }, '2026-08-22');
        assert.equal(isNew, true);
        assert.equal(state[PUZZLE_KEY].best, 320);
        assert.equal(state[PUZZLE_KEY].done, false);
    });

    it('does not lower the best score', () => {
        const state = { dailyPuzzle: { date: '2026-08-22', best: 1000, done: true } };
        const isNew = recordPuzzleResult(state, { score: 400, maxTile: 256 }, '2026-08-22');
        assert.equal(isNew, false);
        assert.equal(state[PUZZLE_KEY].best, 1000);
    });

    it('marks done when the target tile is reached', () => {
        const state = {};
        recordPuzzleResult(state, { score: 900, maxTile: PUZZLE_TARGET }, '2026-08-22');
        assert.equal(state[PUZZLE_KEY].done, true);
    });

    it('tolerates missing result fields', () => {
        const state = {};
        assert.equal(recordPuzzleResult(state, {}, '2026-08-22'), false);
        assert.equal(state[PUZZLE_KEY].best, 0);
    });
});

describe('puzzleInfo', () => {
    it('reports today target/reward/size and best', () => {
        const state = {};
        recordPuzzleResult(state, { score: 210, maxTile: 64 }, '2026-08-22');
        const info = puzzleInfo(state, '2026-08-22');
        assert.equal(info.target, PUZZLE_TARGET);
        assert.equal(info.reward, PUZZLE_REWARD);
        assert.equal(info.size, PUZZLE_SIZE);
        assert.equal(info.best, 210);
        assert.equal(info.done, false);
        assert.equal(info.completed, false);
    });

    it('completed is true only when done today', () => {
        const state = {};
        recordPuzzleResult(state, { score: 900, maxTile: PUZZLE_TARGET }, '2026-08-22');
        assert.equal(puzzleInfo(state, '2026-08-22').completed, true);
        // На следующий день — сброс
        assert.equal(puzzleInfo(state, '2026-08-23').completed, false);
        assert.equal(puzzleInfo(state, '2026-08-23').best, 0);
    });
});
