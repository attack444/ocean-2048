/**
 * Unit tests for сюжетных миссий (js/missions.js), включая позиционные цели 🪸
 * (Фаза 4.5 «Глубина ядра»). Node built-in test runner, без DOM.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
    MISSIONS,
    MISSIONS_KEY,
    missionForLevel,
    POSITION_CHECKS,
    positionProgress,
    missionProgress,
    isMissionComplete,
    isMissionClaimed,
    claimMissionReward,
    unclaimedMissions,
} from './missions.js';

/** Плоская доска size×size из значений (null = пусто). */
function board(size, rows) {
    const out = new Array(size * size).fill(null);
    rows.forEach((row, r) => {
        row.forEach((v, c) => {
            if (v !== null && v !== 0) out[r * size + c] = { value: v };
        });
    });
    return out;
}

describe('MISSIONS (позиционные цели)', () => {
    it('миссии m2 и m5 — позиционные (type position)', () => {
        assert.equal(missionForLevel(2).type, 'position');
        assert.equal(missionForLevel(5).type, 'position');
        assert.equal(missionForLevel(2).position.kind, 'corner');
        assert.equal(missionForLevel(5).position.kind, 'pairInRow');
    });

    it('все миссии имеют уникальные id и levelId 1..7', () => {
        const ids = MISSIONS.map((m) => m.id);
        const levels = MISSIONS.map((m) => m.levelId);
        assert.equal(new Set(ids).size, ids.length);
        assert.deepEqual([...levels].sort((a, b) => a - b), [1, 2, 3, 4, 5, 6, 7]);
    });
});

describe('POSITION_CHECKS.corner', () => {
    const size = 4;

    it('плитка target в углу (0,0) — выполнено', () => {
        const b = board(size, [
            [64, null, null, null],
            [null, null, null, null],
            [null, null, null, null],
            [null, null, null, null],
        ]);
        assert.equal(POSITION_CHECKS.corner(b, 64), true);
    });

    it('плитка target в любом из 4 углов — выполнено', () => {
        const corners = [
            [3 * size],                     // (3,0)
            [3 * size + 3],                 // (3,3)
            [size - 1],                     // (0,3)
        ];
        for (const idx of corners) {
            const b = new Array(size * size).fill(null);
            b[idx] = { value: 64 };
            assert.equal(POSITION_CHECKS.corner(b, 64), true, `угол idx=${idx}`);
        }
    });

    it('плитка target НЕ в углу — не выполнено', () => {
        const b = board(size, [
            [null, null, null, null],
            [null, 64, null, null],
            [null, null, null, null],
            [null, null, null, null],
        ]);
        assert.equal(POSITION_CHECKS.corner(b, 64), false);
    });

    it('плитка меньше target в углу — не выполнено', () => {
        const b = board(size, [
            [32, null, null, null],
            [null, null, null, null],
            [null, null, null, null],
            [null, null, null, null],
        ]);
        assert.equal(POSITION_CHECKS.corner(b, 64), false);
    });

    it('пустая доска — не выполнено', () => {
        assert.equal(POSITION_CHECKS.corner(new Array(16).fill(null), 64), false);
    });
});

describe('POSITION_CHECKS.pairInRow', () => {
    const size = 4;

    it('два 256 в одном ряду — выполнено', () => {
        const b = board(size, [
            [256, null, 256, null],
            [null, null, null, null],
            [null, null, null, null],
            [null, null, null, null],
        ]);
        assert.equal(POSITION_CHECKS.pairInRow(b, 256), true);
    });

    it('два 256 в разных рядах — не выполнено', () => {
        const b = board(size, [
            [256, null, null, null],
            [null, null, null, null],
            [null, null, null, null],
            [256, null, null, null],
        ]);
        assert.equal(POSITION_CHECKS.pairInRow(b, 256), false);
    });

    it('одно 256 + одно 128 — не выполнено (нужно не менее двух >= target)', () => {
        const b = board(size, [
            [256, 128, null, null],
            [null, null, null, null],
            [null, null, null, null],
            [null, null, null, null],
        ]);
        assert.equal(POSITION_CHECKS.pairInRow(b, 256), false);
    });

    it('три 512 в ряду — выполнено (не менее двух)', () => {
        const b = board(size, [
            [512, 512, 512, null],
            [null, null, null, null],
            [null, null, null, null],
            [null, null, null, null],
        ]);
        assert.equal(POSITION_CHECKS.pairInRow(b, 512), true);
    });
});

describe('positionProgress / missionProgress для позиционных', () => {
    const mission = missionForLevel(2); // corner 64

    it('не выполнена — 0', () => {
        const b = board(4, [
            [32, null, null, null],
            [null, null, null, null],
            [null, null, null, null],
            [null, null, null, null],
        ]);
        assert.equal(positionProgress(mission, b), 0);
        assert.equal(missionProgress(mission, {}, b), 0);
    });

    it('выполнена — 1 (независимо от stats)', () => {
        const b = board(4, [
            [64, null, null, null],
            [null, null, null, null],
            [null, null, null, null],
            [null, null, null, null],
        ]);
        assert.equal(positionProgress(mission, b), 1);
        assert.equal(missionProgress(mission, { maxTile: 0 }, b), 1);
    });

    it('без доски — 0 (board не передан)', () => {
        assert.equal(positionProgress(mission, undefined), 0);
        assert.equal(missionProgress(mission, {}), 0);
        assert.equal(isMissionComplete(mission, {}), false);
    });
});

describe('isMissionComplete для позиционных', () => {
    it('корner 64 в углу — выполнено', () => {
        const mission = missionForLevel(2);
        const b = board(4, [
            [64, null, null, null],
            [null, null, null, null],
            [null, null, null, null],
            [null, null, null, null],
        ]);
        assert.equal(isMissionComplete(mission, {}, b), true);
    });

    it('pairInRow 256 в одном ряду — выполнено', () => {
        const mission = missionForLevel(5);
        const b = board(4, [
            [256, null, 256, null],
            [null, null, null, null],
            [null, null, null, null],
            [null, null, null, null],
        ]);
        assert.equal(isMissionComplete(mission, {}, b), true);
    });
});

describe('claimMissionReward (позиционные)', () => {
    it('выдаёт награду при выполненной позиции и отмечает в state', () => {
        const state = { doubloons: 100 };
        const mission = missionForLevel(2);
        const b = board(4, [
            [64, null, null, null],
            [null, null, null, null],
            [null, null, null, null],
            [null, null, null, null],
        ]);
        const got = claimMissionReward(state, mission.id, {}, b);
        assert.equal(got, mission.reward);
        assert.equal(state.doubloons, 100 + mission.reward);
        assert.deepEqual(state[MISSIONS_KEY], [mission.id]);
    });

    it('не выдаёт повторно', () => {
        const state = { doubloons: 100, [MISSIONS_KEY]: ['m2'] };
        const b = board(4, [
            [64, null, null, null],
            [null, null, null, null],
            [null, null, null, null],
            [null, null, null, null],
        ]);
        assert.equal(claimMissionReward(state, 'm2', {}, b), 0);
        assert.equal(state.doubloons, 100);
    });

    it('не выдаёт, если позиция не выполнена', () => {
        const state = { doubloons: 100 };
        const b = board(4, [
            [32, null, null, null],
            [null, null, null, null],
            [null, null, null, null],
            [null, null, null, null],
        ]);
        assert.equal(claimMissionReward(state, 'm2', {}, b), 0);
        assert.equal(state.doubloons, 100);
        assert.equal(isMissionClaimed(state, 'm2'), false);
    });
});

describe('Обратная совместимость: не-позиционные миссии', () => {
    it('missionProgress по maxTile работает без доски', () => {
        const mission = missionForLevel(1); // maxTile 32
        assert.equal(missionProgress(mission, { maxTile: 32 }), 32);
        assert.equal(missionProgress(mission, { maxTile: 100 }), 32); // клип
        assert.equal(isMissionComplete(mission, { maxTile: 32 }), true);
    });

    it('claimMissionReward для maxTile работает без доски', () => {
        const state = { doubloons: 0 };
        const got = claimMissionReward(state, 'm1', { maxTile: 32 });
        assert.equal(got, missionForLevel(1).reward);
        assert.deepEqual(state[MISSIONS_KEY], ['m1']);
    });

    it('unclaimedMissions считает только невыполненные', () => {
        const state = { [MISSIONS_KEY]: ['m1', 'm2'] };
        assert.equal(unclaimedMissions(state), MISSIONS.length - 2);
    });
});
