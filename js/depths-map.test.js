/**
 * Unit tests for the depths map (Карта глубин 🗺️ — визуальный выбор уровня).
 * Node built-in test runner — pure logic, no DOM required.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { LEVELS } from './levels.js';
import {
    DEPTH_KEY,
    DEPTH_REWARDS,
    DEPTH_NODES,
    depthRewardFor,
    depthStatus,
    canClaimDepthReward,
    claimDepthReward,
    pendingDepthRewards,
} from './depths-map.js';

/** Минимальный валидный state (всё, что нужно depths-map). */
function makeState(overrides = {}) {
    return {
        currentLevel: 1,
        unlockedLevels: [1],
        bestScores: {},
        doubloons: 0,
        ...overrides,
    };
}

describe('depths-map constants', () => {
    it('has a reward for every level and growing values', () => {
        assert.equal(DEPTH_KEY, 'depthRewardsClaimed');
        assert.equal(Object.keys(DEPTH_REWARDS).length, LEVELS.length);
        assert.equal(DEPTH_REWARDS[1], 100);
        assert.ok(DEPTH_REWARDS[LEVELS.length] > DEPTH_REWARDS[1]);
    });

    it('has one node per level with in-bounds % coordinates', () => {
        assert.equal(DEPTH_NODES.length, LEVELS.length);
        DEPTH_NODES.forEach((node, i) => {
            assert.equal(node.id, LEVELS[i].id, `node ${i} id`);
            assert.ok(node.x >= 0 && node.x <= 100, `node ${node.id} x`);
            assert.ok(node.y >= 0 && node.y <= 100, `node ${node.id} y`);
            assert.ok(node.zone.length > 0, `node ${node.id} zone`);
        });
    });
});

describe('depthRewardFor', () => {
    it('returns the reward for known levels (string or number)', () => {
        assert.equal(depthRewardFor(1), 100);
        assert.equal(depthRewardFor('3'), 200);
        assert.equal(depthRewardFor(7), 800);
    });

    it('returns 0 for unknown levels', () => {
        assert.equal(depthRewardFor(0), 0);
        assert.equal(depthRewardFor(99), 0);
        assert.equal(depthRewardFor('abc'), 0);
    });
});

describe('depthStatus', () => {
    it('reports completed even for the active level (reward stays claimable)', () => {
        const state = makeState({
            currentLevel: 2,
            bestScores: { 2: 600 },
        });
        assert.equal(depthStatus(state, 2), 'completed');
    });

    it('reports current for the active level that is not completed yet', () => {
        const state = makeState({ currentLevel: 1, bestScores: {} });
        assert.equal(depthStatus(state, 1), 'current');
    });

    it('reports completed once a level has a best score', () => {
        const state = makeState({ bestScores: { 3: 1200 } });
        assert.equal(depthStatus(state, 3), 'completed');
    });

    it('reports unlocked for accessible but not completed levels', () => {
        const state = makeState({ unlockedLevels: [1, 2] });
        assert.equal(depthStatus(state, 1), 'current');   // currentLevel=1 по умолчанию
        assert.equal(depthStatus(state, 2), 'unlocked');
    });

    it('reports locked for not unlocked levels', () => {
        const state = makeState({ unlockedLevels: [1] });
        assert.equal(depthStatus(state, 5), 'locked');
    });

    it('reports locked for invalid ids (daily puzzle id 0 is ignored)', () => {
        const state = makeState({ currentLevel: 0 });
        assert.equal(depthStatus(state, 0), 'locked');
        assert.equal(depthStatus(state, 999), 'locked');
    });

    it('accepts a custom levels list', () => {
        const levels = [{ id: 1, name: 'X', size: 4, target: 128 }];
        const state = makeState({ unlockedLevels: [1] });
        assert.equal(depthStatus(state, 1, levels), 'current');
        assert.equal(depthStatus(state, 2, levels), 'locked');
    });
});

describe('canClaimDepthReward', () => {
    it('allows claiming only for completed, not yet claimed levels', () => {
        const state = makeState({ bestScores: { 1: 300, 2: 600 } });
        assert.equal(canClaimDepthReward(state, 1), true);
        assert.equal(canClaimDepthReward(state, 2), true);
        assert.equal(canClaimDepthReward(state, 3), false); // не пройден
    });

    it('allows claiming the reward for the just-completed current level', () => {
        const state = makeState({ currentLevel: 1, bestScores: { 1: 300 } });
        assert.equal(canClaimDepthReward(state, 1), true);
    });

    it('is false for already claimed levels', () => {
        const state = makeState({
            bestScores: { 1: 300 },
            [DEPTH_KEY]: [1],
        });
        assert.equal(canClaimDepthReward(state, 1), false);
    });

    it('is false for the current level without a best score', () => {
        const state = makeState({ currentLevel: 1, bestScores: {} });
        assert.equal(canClaimDepthReward(state, 1), false);
    });
});

describe('claimDepthReward', () => {
    it('adds the reward to doubloons and marks it claimed', () => {
        const state = makeState({
            bestScores: { 4: 2100 },
            doubloons: 50,
        });
        const reward = claimDepthReward(state, 4);
        assert.equal(reward, DEPTH_REWARDS[4]);
        assert.equal(state.doubloons, 50 + DEPTH_REWARDS[4]);
        assert.deepEqual(state[DEPTH_KEY], [4]);
    });

    it('is idempotent — a second claim returns 0 and changes nothing', () => {
        const state = makeState({ bestScores: { 1: 300 }, doubloons: 0 });
        claimDepthReward(state, 1);
        assert.equal(claimDepthReward(state, 1), 0);
        assert.equal(state.doubloons, DEPTH_REWARDS[1]);
        assert.deepEqual(state[DEPTH_KEY], [1]);
    });

    it('returns 0 for levels that cannot be claimed yet', () => {
        const state = makeState({ bestScores: {} });
        assert.equal(claimDepthReward(state, 1), 0);
        assert.equal(state.doubloons, 0);
        assert.equal(state[DEPTH_KEY], undefined);
    });
});

describe('pendingDepthRewards', () => {
    it('counts only completed and unclaimed levels', () => {
        const state = makeState({
            bestScores: { 1: 300, 2: 600, 3: 1200 },
            [DEPTH_KEY]: [2],
        });
        assert.equal(pendingDepthRewards(state), 2); // уровни 1 и 3
    });

    it('returns 0 when nothing is claimable', () => {
        const state = makeState({ bestScores: {} });
        assert.equal(pendingDepthRewards(state), 0);
    });

    it('accepts a custom levels list', () => {
        const levels = [{ id: 1, name: 'X', size: 4, target: 128 }];
        const state = makeState({ bestScores: { 1: 300 } });
        assert.equal(pendingDepthRewards(state, levels), 1);
        assert.equal(pendingDepthRewards(makeState({}), levels), 0);
    });
});
