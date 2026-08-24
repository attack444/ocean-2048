/**
 * Unit tests for the Challenge mode (Режим «Челлендж», N ходов на цель).
 * Node built-in test runner — pure logic, no DOM required.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
    CHALLENGE_KEY,
    CHALLENGES,
    challengeForLevel,
    ensureChallenges,
    recordChallengeResult,
    claimChallengeReward,
    challengeInfo,
    pendingChallengeRewards,
} from './challenge.js';

describe('challenge constants', () => {
    it('defines a challenge for every level 1..7', () => {
        assert.equal(CHALLENGES.length, 7);
        for (let id = 1; id <= 7; id++) {
            const c = challengeForLevel(id);
            assert.ok(c, `no challenge for level ${id}`);
            assert.ok(c.target > 0);
            assert.ok(c.movesLimit > 0);
            assert.ok(c.reward > 0);
        }
    });

    it('is a strict challenge: movesLimit is finite and reasonable', () => {
        for (const c of CHALLENGES) {
            assert.ok(Number.isInteger(c.movesLimit));
            assert.ok(c.movesLimit >= 10);
            assert.ok(c.movesLimit <= 100);
        }
    });

    it('returns null for an unknown level', () => {
        assert.equal(challengeForLevel(99), null);
    });
});

describe('ensureChallenges', () => {
    it('creates a record for every level on first call', () => {
        const state = {};
        assert.equal(ensureChallenges(state), true);
        assert.equal(Object.keys(state[CHALLENGE_KEY]).length, CHALLENGES.length);
        for (const c of CHALLENGES) {
            assert.deepEqual(state[CHALLENGE_KEY][c.levelId],
                { done: false, bestScore: 0, bestMoves: 0, claimed: false });
        }
    });

    it('keeps existing progress untouched', () => {
        const state = { challenges: { 2: { done: true, bestScore: 900, bestMoves: 30, claimed: false } } };
        assert.equal(ensureChallenges(state), true);
        assert.deepEqual(state[CHALLENGE_KEY][2],
            { done: true, bestScore: 900, bestMoves: 30, claimed: false });
    });
});

describe('recordChallengeResult', () => {
    it('marks a completed run as done (first time)', () => {
        const state = {};
        const res = recordChallengeResult(state, 1, { completed: true, score: 1200, movesUsed: 15 });
        assert.deepEqual(res, { isNewDone: true, isNewBest: true });
        assert.equal(state[CHALLENGE_KEY][1].done, true);
        assert.equal(state[CHALLENGE_KEY][1].bestScore, 1200);
        assert.equal(state[CHALLENGE_KEY][1].bestMoves, 15);
    });

    it('does not mark done when the run failed', () => {
        const state = {};
        recordChallengeResult(state, 1, { completed: false, score: 300, movesUsed: 20 });
        assert.equal(state[CHALLENGE_KEY][1].done, false);
    });

    it('only raises best score and best moves, never lowers', () => {
        const state = {};
        recordChallengeResult(state, 1, { completed: true, score: 1000, movesUsed: 12 });
        const res = recordChallengeResult(state, 1, { completed: true, score: 600, movesUsed: 9 });
        assert.equal(res.isNewBest, false);
        assert.equal(state[CHALLENGE_KEY][1].bestScore, 1000);
        assert.equal(state[CHALLENGE_KEY][1].bestMoves, 12);
    });

    it('does not duplicate the first-completion flag', () => {
        const state = {};
        recordChallengeResult(state, 1, { completed: true, score: 500, movesUsed: 10 });
        const res = recordChallengeResult(state, 1, { completed: true, score: 800, movesUsed: 11 });
        assert.equal(res.isNewDone, false);
        assert.equal(res.isNewBest, true);
    });

    it('ignores unknown levels', () => {
        const state = {};
        const res = recordChallengeResult(state, 99, { completed: true, score: 1, movesUsed: 1 });
        assert.deepEqual(res, { isNewDone: false, isNewBest: false });
    });
});

describe('claimChallengeReward', () => {
    it('grants doubloons once after a completed run', () => {
        const state = { doubloons: 10 };
        recordChallengeResult(state, 1, { completed: true, score: 500, movesUsed: 10 });
        const got = claimChallengeReward(state, 1);
        assert.equal(got, challengeForLevel(1).reward);
        assert.equal(state.doubloons, 10 + challengeForLevel(1).reward);
        assert.equal(state[CHALLENGE_KEY][1].claimed, true);
    });

    it('pays nothing twice', () => {
        const state = {};
        recordChallengeResult(state, 1, { completed: true, score: 500, movesUsed: 10 });
        claimChallengeReward(state, 1);
        assert.equal(claimChallengeReward(state, 1), 0);
    });

    it('pays nothing before the challenge is completed', () => {
        const state = {};
        recordChallengeResult(state, 1, { completed: false, score: 100, movesUsed: 19 });
        assert.equal(claimChallengeReward(state, 1), 0);
    });

    it('ignores unknown levels', () => {
        const state = {};
        assert.equal(claimChallengeReward(state, 99), 0);
    });
});

describe('challengeInfo', () => {
    it('returns the challenge config and progress for UI', () => {
        const state = {};
        recordChallengeResult(state, 3, { completed: true, score: 2400, movesUsed: 30 });
        const info = challengeInfo(state, 3);
        assert.equal(info.levelId, 3);
        assert.equal(info.target, 512);
        assert.ok(info.movesLimit > 0);
        assert.equal(info.done, true);
        assert.equal(info.claimed, false);
        assert.equal(info.bestScore, 2400);
        assert.equal(info.bestMoves, 30);
    });

    it('returns null for unknown levels', () => {
        assert.equal(challengeInfo({}, 99), null);
    });
});

describe('pendingChallengeRewards', () => {
    it('counts completed-but-unclaimed challenges', () => {
        const state = {};
        recordChallengeResult(state, 1, { completed: true, score: 500, movesUsed: 10 });
        recordChallengeResult(state, 2, { completed: true, score: 800, movesUsed: 20 });
        recordChallengeResult(state, 3, { completed: false, score: 100, movesUsed: 30 });
        assert.equal(pendingChallengeRewards(state), 2);

        claimChallengeReward(state, 1);
        assert.equal(pendingChallengeRewards(state), 1);
    });
});
