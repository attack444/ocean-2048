/**
 * Unit tests for the cloud save conflict strategy (cloud-sync.js).
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { updatedAt, resolveConflict, mergeBoardSaves, bumpUpdatedAt } from './cloud-sync.js';

const baseLocal = {
    updatedAt: 100,
    currentLevel: 2,
    unlockedLevels: [1, 2],
    bestScores: { 1: 100, 2: 400 },
    bestTotal: 500,
    bestTile: 128,
    gamesPlayed: 7,
    sound: true,
    theme: 'light',
    skin: 'gold',
    infinity: false,
    achievements: { first_merge: 1 },
    doubloons: 50,
    unlockedSkins: ['gold'],
    unlockedThemes: ['dark', 'light'],
    lastAdTime: 1000,
    daily: { date: '2026-08-17', tasks: [], claimed: { a: 1 } },
    dailyCounters: { moves: 10, merges: 4, wins: 1, hints: 2 },
    inventory: { shuffle: 2, bomb: 0, x2: 1 },
    perks: { coinBonus: true },
    dailyStreak: { days: 3, lastClaim: '2026-08-16' },
    pointsBalance: 1200,
};

const baseCloud = {
    updatedAt: 200,
    currentLevel: 3,
    unlockedLevels: [1, 2, 3],
    bestScores: { 1: 80, 3: 700 },
    bestTotal: 700,
    bestTile: 256,
    gamesPlayed: 4,
    sound: false,
    theme: 'dark',
    skin: 'wood',
    infinity: true,
    achievements: { tile_64: 1, first_merge: 2 },
    doubloons: 30,
    unlockedSkins: ['gold', 'wood'],
    unlockedThemes: ['dark'],
    lastAdTime: 500,
    daily: { date: '2026-08-17', tasks: [], claimed: { b: 1 } },
    dailyCounters: { moves: 20, merges: 0, wins: 0, hints: 0 },
    inventory: { shuffle: 1, bomb: 3, x2: 0 },
    perks: { extraUndos: true },
    dailyStreak: { days: 2, lastClaim: '2026-08-15' },
    pointsBalance: 500,
};

describe('cloud-sync.updatedAt', () => {
    it('reads the numeric timestamp with a fallback to 0', () => {
        assert.equal(updatedAt({ updatedAt: 42 }), 42);
        assert.equal(updatedAt({}), 0);
        assert.equal(updatedAt(null), 0);
        assert.equal(updatedAt(undefined), 0);
    });
});

describe('cloud-sync.resolveConflict', () => {
    it('returns the only available side', () => {
        assert.deepEqual(resolveConflict(null, baseCloud), baseCloud);
        assert.deepEqual(resolveConflict(baseLocal, null), baseLocal);
        assert.deepEqual(resolveConflict(null, null), {});
    });

    it('treats the newer side as the base (settings win by last write)', () => {
        const m = resolveConflict(baseLocal, baseCloud); // cloud newer (200 > 100)
        assert.equal(m.theme, 'dark');
        assert.equal(m.sound, false);
        assert.equal(m.infinity, true);
        assert.equal(m.currentLevel, 3);
        assert.equal(m.updatedAt, 200);
    });

    it('is symmetric — the newer side always wins', () => {
        const m = resolveConflict(baseCloud, baseLocal);
        assert.equal(m.theme, 'dark');
        assert.equal(m.updatedAt, 200);
    });

    it('unions progression and economy (max) so nothing is lost', () => {
        const m = resolveConflict(baseLocal, baseCloud);
        assert.equal(m.bestTotal, 700);
        assert.equal(m.bestTile, 256);
        assert.equal(m.gamesPlayed, 7);
        assert.equal(m.doubloons, 50);
        assert.equal(m.pointsBalance, 1200); // максимум: earned points не теряются
        assert.equal(m.hintsUsed, 0);
        assert.equal(m.undoCount, 0);
        assert.equal(m.lastAdTime, 1000);
        assert.deepEqual(m.unlockedLevels, [1, 2, 3]);
        assert.deepEqual(m.bestScores, { 1: 100, 2: 400, 3: 700 });
        assert.deepEqual(m.unlockedSkins, ['gold', 'wood']);
        assert.deepEqual(m.unlockedThemes, ['dark', 'light']);
        assert.deepEqual(m.achievements, { first_merge: 2, tile_64: 1 }); // base (newer) wins on conflict
    });

    it('merges daily counters and claimed tasks when the date matches', () => {
        const m = resolveConflict(baseLocal, baseCloud);
        assert.deepEqual(m.dailyCounters, { moves: 20, merges: 4, wins: 1, hints: 2 });
        assert.deepEqual(m.daily.claimed, { b: 1, a: 1 });
    });

    it('merges shop boosts, perks and the daily-login streak', () => {
        const m = resolveConflict(baseLocal, baseCloud); // cloud newer → base
        // Запасы бустов — по максимуму каждого ключа
        assert.deepEqual(m.inventory, { shuffle: 2, bomb: 3, x2: 1 });
        // Перки — OR-объединение флагов
        assert.deepEqual(m.perks, { coinBonus: true, extraUndos: true });
        // Серия входа: максимум дней, метка последнего захода от base (новее)
        assert.equal(m.dailyStreak.days, 3);
        assert.equal(m.dailyStreak.lastClaim, '2026-08-15');
    });

    it('keeps the shop keys when only one side has them', () => {
        const local = { ...baseLocal };
        delete local.inventory;
        delete local.perks;
        delete local.dailyStreak;
        const m = resolveConflict(local, baseCloud);
        assert.deepEqual(m.inventory, baseCloud.inventory);
        assert.deepEqual(m.perks, baseCloud.perks);
        assert.deepEqual(m.dailyStreak, baseCloud.dailyStreak);
    });

    it('keeps pointsBalance when only one side has it', () => {
        const local = { ...baseLocal };
        delete local.pointsBalance;
        let m = resolveConflict(local, baseCloud);
        assert.equal(m.pointsBalance, 500); // из облака

        const cloud = { ...baseCloud };
        delete cloud.pointsBalance;
        m = resolveConflict(baseLocal, cloud);
        assert.equal(m.pointsBalance, 1200); // из локалки
    });

    it('keeps the base daily block when dates differ', () => {
        const local = { ...baseLocal };
        const cloud = {
            ...baseCloud,
            daily: { date: '2026-08-16', tasks: [], claimed: {} },
            dailyCounters: { moves: 99, merges: 0, wins: 0, hints: 0 },
        };
        const m = resolveConflict(local, cloud); // cloud newer
        assert.deepEqual(m.daily, cloud.daily);
        assert.deepEqual(m.dailyCounters, cloud.dailyCounters);
    });

    it('merges the daily tournament (max best, OR played, union claimed) when the date matches', () => {
        const local = {
            ...baseLocal,
            tournament: { date: '2026-08-30', best: 1500, played: true, claimed: [500, 1000] },
        };
        const cloud = {
            ...baseCloud,
            tournament: { date: '2026-08-30', best: 2100, played: false, claimed: [500, 1800] },
        };
        const m = resolveConflict(local, cloud); // cloud newer → base = cloud
        assert.deepEqual(m.tournament, {
            date: '2026-08-30',
            best: 2100, // max из двух устройств
            played: true, // OR
            claimed: [500, 1000, 1800], // union
        });
    });

    it('keeps the tournament from the only side that has it', () => {
        const local = {
            ...baseLocal,
            tournament: { date: '2026-08-30', best: 900, played: true, claimed: [500] },
        };
        const cloud = { ...baseCloud }; // без tournament
        const m = resolveConflict(local, cloud); // cloud newer → base = cloud, baseT = null
        assert.deepEqual(m.tournament, local.tournament);

        // Симметрично: турнир только в облаке
        const m2 = resolveConflict(baseLocal, cloud);
        assert.equal(m2.tournament, undefined);
    });

    it('keeps the newer tournament when dates differ (no cross-day merge)', () => {
        const local = {
            ...baseLocal,
            tournament: { date: '2026-08-29', best: 5000, played: true, claimed: [500, 1000, 1800, 2800] },
        };
        const cloud = {
            ...baseCloud,
            tournament: { date: '2026-08-30', best: 700, played: true, claimed: [500] },
        };
        const m = resolveConflict(local, cloud); // cloud newer → base = cloud
        assert.deepEqual(m.tournament, cloud.tournament);
    });

    it('merges invites without duplicating the welcome bonus', () => {
        const local = {
            ...baseLocal,
            invite: { date: '2026-08-30', count: 3, welcomeClaimed: false },
        };
        const cloud = {
            ...baseCloud,
            invite: { date: '2026-08-30', count: 1, welcomeClaimed: true },
        };
        const m = resolveConflict(local, cloud); // cloud newer → base = cloud
        assert.deepEqual(m.invite, {
            date: '2026-08-30',
            count: 3, // максимум счётчика
            welcomeClaimed: true, // OR — бонус не выдаётся повторно
        });
    });

    it('keeps the invite block from the only side that has it', () => {
        const local = {
            ...baseLocal,
            invite: { date: '2026-08-30', count: 2, welcomeClaimed: true },
        };
        const m = resolveConflict(local, baseCloud); // cloud newer → base = cloud
        assert.deepEqual(m.invite, local.invite);
    });

    it('merges request counters by max for the same day', () => {
        const local = {
            ...baseLocal,
            requests: { date: '2026-08-30', count: 4 },
        };
        const cloud = {
            ...baseCloud,
            requests: { date: '2026-08-30', count: 1 },
        };
        const m = resolveConflict(local, cloud); // cloud newer → base = cloud
        assert.deepEqual(m.requests, { date: '2026-08-30', count: 4 });
    });

    it('merges the daily duel by max best/wins and union of claimed rewards', () => {
        const local = {
            ...baseLocal,
            duel: { date: '2026-08-30', best: 2000, played: true, wins: 1, claimed: ['win'], pendingScore: 0 },
        };
        const cloud = {
            ...baseCloud,
            duel: { date: '2026-08-30', best: 1500, played: true, wins: 2, claimed: ['lose'], pendingScore: 4200 },
        };
        const m = resolveConflict(local, cloud); // cloud newer → base = cloud
        assert.deepEqual(m.duel, {
            date: '2026-08-30',
            best: 2000,        // максимум счёта
            played: true,      // играли хоть где-то
            wins: 2,           // максимум побед дня
            claimed: ['lose', 'win'], // объединение наград (не дублируются)
            pendingScore: 4200, // счёт соперника из более свежего состояния
        });
    });

    it('keeps the duel block from the only side that has it', () => {
        const local = {
            ...baseLocal,
            duel: { date: '2026-08-30', best: 900, played: true, wins: 0, claimed: ['lose'], pendingScore: 0 },
        };
        const m = resolveConflict(local, baseCloud); // cloud newer → base = cloud
        assert.deepEqual(m.duel, local.duel);
    });

    it('keeps the newer duel when dates differ (no cross-day merge)', () => {
        const local = {
            ...baseLocal,
            duel: { date: '2026-08-29', best: 5000, played: true, wins: 1, claimed: ['win'], pendingScore: 0 },
        };
        const cloud = {
            ...baseCloud,
            duel: { date: '2026-08-30', best: 700, played: false, wins: 0, claimed: [], pendingScore: 0 },
        };
        const m = resolveConflict(local, cloud); // cloud newer → base = cloud
        assert.deepEqual(m.duel, cloud.duel);
    });

    it('clamps currentLevel to the max unlocked level if it regressed', () => {
        const local = { ...baseLocal, updatedAt: 300, currentLevel: 9, unlockedLevels: [1, 2] };
        const cloud = { ...baseCloud, unlockedLevels: [1, 2, 3] };
        const m = resolveConflict(local, cloud);
        assert.equal(m.currentLevel, 3);
    });

    it('keeps unknown keys from both sides', () => {
        const local = { ...baseLocal, updatedAt: 300, newLocalKey: 'x' };
        const cloud = { ...baseCloud, newCloudKey: 'y' };
        const m = resolveConflict(local, cloud);
        assert.equal(m.newLocalKey, 'x');
        assert.equal(m.newCloudKey, 'y');
    });
});

describe('cloud-sync.mergeBoardSaves', () => {
    it('keeps the newer save per level', () => {
        const local = { 1: { board: {}, ts: 100 }, 2: { board: {}, ts: 200 } };
        const cloud = { 1: { board: {}, ts: 150 }, 3: { board: {}, ts: 300 } };
        const m = mergeBoardSaves(local, cloud);
        assert.equal(m[1].ts, 150); // cloud newer
        assert.equal(m[2].ts, 200); // only local
        assert.equal(m[3].ts, 300); // only cloud
    });

    it('breaks ts ties toward local', () => {
        const local = { 1: { board: { a: 1 }, ts: 100 } };
        const cloud = { 1: { board: { b: 2 }, ts: 100 } };
        const m = mergeBoardSaves(local, cloud);
        assert.deepEqual(m[1].board, { a: 1 });
    });

    it('handles missing or empty inputs', () => {
        assert.deepEqual(mergeBoardSaves(null, null), {});
        assert.deepEqual(mergeBoardSaves(undefined, { 1: { ts: 5 } }), { 1: { ts: 5 } });
        assert.deepEqual(mergeBoardSaves({ 1: { ts: 5 } }, null), { 1: { ts: 5 } });
    });
});

describe('cloud-sync.bumpUpdatedAt', () => {
    it('sets the timestamp without mutating the input', () => {
        const s = { score: 1 };
        const out = bumpUpdatedAt(s, 123);
        assert.equal(out.updatedAt, 123);
        assert.equal(s.updatedAt, undefined);
        assert.equal(out.score, 1);
    });

    it('defaults to Date.now()', () => {
        const out = bumpUpdatedAt({});
        assert.equal(typeof out.updatedAt, 'number');
        assert.ok(out.updatedAt > 0);
    });
});
