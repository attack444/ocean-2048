/**
 * Unit tests for the invite reward mechanics (invite.js).
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
    INVITE_REWARD,
    INVITE_DAILY_LIMIT,
    WELCOME_BONUS,
    inviteDefault,
    ensureInvite,
    inviteInfo,
    recordInvite,
    claimWelcomeBonus,
} from './invite.js';

function baseState(overrides = {}) {
    return { invite: inviteDefault(), ...overrides };
}

describe('invite.constants', () => {
    it('has sane economy numbers', () => {
        assert.ok(INVITE_REWARD > 0);
        assert.ok(INVITE_DAILY_LIMIT > 0);
        assert.ok(WELCOME_BONUS > INVITE_REWARD);
    });
});

describe('invite.ensureInvite', () => {
    it('creates the default block and resets the counter on a new day', () => {
        const st = {};
        ensureInvite(st, '2026-08-30');
        assert.deepEqual(st.invite, { date: '2026-08-30', count: 0, welcomeClaimed: false });

        st.invite.count = 4;
        st.invite.welcomeClaimed = true;
        ensureInvite(st, '2026-08-31');
        assert.equal(st.invite.date, '2026-08-31');
        assert.equal(st.invite.count, 0);
        assert.equal(st.invite.welcomeClaimed, true); // приветственный бонус не сбрасывается
    });

    it('keeps the counter for the same day', () => {
        const st = { invite: { date: '2026-08-30', count: 2, welcomeClaimed: false } };
        ensureInvite(st, '2026-08-30');
        assert.equal(st.invite.count, 2);
    });
});

describe('invite.recordInvite', () => {
    it('grants the reward and counts towards the daily limit', () => {
        const st = baseState();
        for (let i = 0; i < INVITE_DAILY_LIMIT; i++) {
            const r = recordInvite(st, '2026-08-30');
            assert.deepEqual(r, { rewarded: true, reward: INVITE_REWARD });
        }
        assert.equal(st.invite.count, INVITE_DAILY_LIMIT);
        // Лимит исчерпан
        const over = recordInvite(st, '2026-08-30');
        assert.deepEqual(over, { rewarded: false, reward: 0 });
        assert.equal(st.invite.count, INVITE_DAILY_LIMIT);
    });

    it('resets the limit on a new day', () => {
        const st = baseState();
        for (let i = 0; i < INVITE_DAILY_LIMIT; i++) recordInvite(st, '2026-08-30');
        const r = recordInvite(st, '2026-08-31');
        assert.deepEqual(r, { rewarded: true, reward: INVITE_REWARD });
    });
});

describe('invite.inviteInfo', () => {
    it('exposes the remaining invites for the day', () => {
        const st = baseState();
        const info = inviteInfo(st, '2026-08-30');
        assert.equal(info.remainingToday, INVITE_DAILY_LIMIT);
        assert.equal(info.usedToday, 0);
        assert.equal(info.welcomeAvailable, true);

        recordInvite(st, '2026-08-30');
        assert.equal(inviteInfo(st, '2026-08-30').remainingToday, INVITE_DAILY_LIMIT - 1);
    });
});

describe('invite.claimWelcomeBonus', () => {
    it('pays the welcome bonus exactly once', () => {
        const st = baseState();
        assert.equal(claimWelcomeBonus(st), true);
        assert.equal(st.invite.welcomeClaimed, true);
        assert.equal(claimWelcomeBonus(st), false); // повторно не выдаём
    });

    it('works even without a pre-existing invite block', () => {
        const st = {};
        assert.equal(claimWelcomeBonus(st), true);
        assert.equal(st.invite.welcomeClaimed, true);
    });
});
