/**
 * Unit tests for the "beat my record" request mechanic (request.js).
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
    REQUEST_REWARD,
    REQUEST_DAILY_LIMIT,
    requestsDefault,
    ensureRequests,
    requestsInfo,
    recordRequest,
    buildChallengeText,
} from './request.js';

function baseState(overrides = {}) {
    return { requests: requestsDefault(), ...overrides };
}

describe('request.constants', () => {
    it('has sane economy numbers', () => {
        assert.ok(REQUEST_REWARD > 0);
        assert.ok(REQUEST_DAILY_LIMIT > 0);
    });
});

describe('request.ensureRequests', () => {
    it('creates the default block and resets the counter on a new day', () => {
        const st = {};
        ensureRequests(st, '2026-08-30');
        assert.deepEqual(st.requests, { date: '2026-08-30', count: 0 });

        st.requests.count = 3;
        ensureRequests(st, '2026-08-31');
        assert.equal(st.requests.date, '2026-08-31');
        assert.equal(st.requests.count, 0);
    });

    it('keeps the counter for the same day', () => {
        const st = { requests: { date: '2026-08-30', count: 2 } };
        ensureRequests(st, '2026-08-30');
        assert.equal(st.requests.count, 2);
    });
});

describe('request.recordRequest', () => {
    it('grants the reward and counts towards the daily limit', () => {
        const st = baseState();
        for (let i = 0; i < REQUEST_DAILY_LIMIT; i++) {
            const r = recordRequest(st, '2026-08-30');
            assert.deepEqual(r, { rewarded: true, reward: REQUEST_REWARD });
        }
        const over = recordRequest(st, '2026-08-30');
        assert.deepEqual(over, { rewarded: false, reward: 0 });
    });

    it('resets the limit on a new day', () => {
        const st = baseState();
        for (let i = 0; i < REQUEST_DAILY_LIMIT; i++) recordRequest(st, '2026-08-30');
        const r = recordRequest(st, '2026-08-31');
        assert.deepEqual(r, { rewarded: true, reward: REQUEST_REWARD });
    });
});

describe('request.requestsInfo', () => {
    it('exposes the remaining requests for the day', () => {
        const st = baseState();
        assert.equal(requestsInfo(st, '2026-08-30').remainingToday, REQUEST_DAILY_LIMIT);
        recordRequest(st, '2026-08-30');
        assert.equal(requestsInfo(st, '2026-08-30').remainingToday, REQUEST_DAILY_LIMIT - 1);
    });
});

describe('request.buildChallengeText', () => {
    it('builds a short, motivating message with the best score and level', () => {
        const text = buildChallengeText(12345, 4);
        // toLocaleString('ru') использует неразрывный пробел — проверяем через \s
        assert.match(text, /12[\s\u00A0]345/);
        assert.ok(text.includes('4'));
        assert.ok(text.length <= 200);
        assert.ok(text.includes('Побей мой рекорд'));
    });

    it('handles a zero score with an invitation message', () => {
        const text = buildChallengeText(0, 1);
        assert.ok(text.includes('Присоединяйся'));
        assert.ok(text.length <= 200);
    });

    it('clamps invalid inputs', () => {
        assert.ok(buildChallengeText(NaN, NaN).length <= 200);
        assert.ok(buildChallengeText(-5, 0).length <= 200);
    });
});
