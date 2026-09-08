// Юнит-тесты: ежедневный турнир глубин (js/tournament.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
    TOURNAMENT_KEY, TOURNAMENT_SIZE, TOURNAMENT_MOVES, TOURNAMENT_REWARDS,
    tournamentSeed, tournamentStartBoard,
    ensureTournament, recordTournamentResult, tournamentInfo,
} from './tournament.js';
import { seedFromDate } from './daily-puzzle.js';

function baseState(overrides = {}) {
    return { tournament: { date: '', best: 0, played: false, claimed: [] }, ...overrides };
}

test('tournament: seed дня детерминирован и уникален для даты', () => {
    assert.equal(tournamentSeed('2026-08-30'), tournamentSeed('2026-08-30'));
    assert.notEqual(tournamentSeed('2026-08-30'), tournamentSeed('2026-08-31'));
    // Сид турнира отличается от сида ежедневной головоломки (другие доски)
    assert.notEqual(tournamentSeed('2026-08-30'), seedFromDate('2026-08-30'));
});

test('tournament: стартовая доска детерминирована и имеет 2 плитки', () => {
    const b1 = tournamentStartBoard('2026-08-30');
    const b2 = tournamentStartBoard('2026-08-30');
    assert.equal(b1.length, TOURNAMENT_SIZE * TOURNAMENT_SIZE);
    assert.deepEqual(b1, b2);
    const filled = b1.filter(Boolean);
    assert.equal(filled.length, 2);
    assert.ok(filled.every(t => t.value === 2 || t.value === 4));
});

test('tournament: ensureTournament сбрасывает результат при смене дня', () => {
    const st = baseState({ tournament: { date: '2026-08-29', best: 777, played: true, claimed: [500] } });
    assert.equal(ensureTournament(st, '2026-08-29'), false);
    assert.equal(st.tournament.best, 777);
    assert.equal(ensureTournament(st, '2026-08-30'), true);
    assert.deepEqual(st.tournament, { date: '2026-08-30', best: 0, played: false, claimed: [] });
});

test('tournament: recordTournamentResult обновляет лучший счёт и возвращает isNewBest', () => {
    const st = baseState();
    ensureTournament(st, '2026-08-30');
    const r1 = recordTournamentResult(st, { score: 1200 }, '2026-08-30');
    assert.equal(r1.isNewBest, true);
    assert.equal(st.tournament.best, 1200);
    assert.equal(st.tournament.played, true);
    // Повторный результат ниже — не новый рекорд
    const r2 = recordTournamentResult(st, { score: 900 }, '2026-08-30');
    assert.equal(r2.isNewBest, false);
    assert.equal(st.tournament.best, 1200);
});

test('tournament: награды за пороги выдаются один раз и только за новые', () => {
    const st = baseState();
    ensureTournament(st, '2026-08-30');
    // 1200 очков: пороги 500 (+25) и 1000 (+60)
    const r1 = recordTournamentResult(st, { score: 1200 }, '2026-08-30');
    assert.deepEqual(r1.newRewards, [
        { threshold: 500, reward: 25 },
        { threshold: 1000, reward: 60 },
    ]);
    assert.deepEqual(st.tournament.claimed, [500, 1000]);
    // Повторная партия на 1300: новых порогов нет, награды не дублируются
    const r2 = recordTournamentResult(st, { score: 1300 }, '2026-08-30');
    assert.equal(r2.newRewards.length, 0);
    assert.deepEqual(st.tournament.claimed, [500, 1000]);
    // До 2900 — выдача новых порогов 1800 и 2800 один раз
    const r3 = recordTournamentResult(st, { score: 2900 }, '2026-08-30');
    assert.deepEqual(r3.newRewards, [
        { threshold: 1800, reward: 120 },
        { threshold: 2800, reward: 250 },
    ]);
    // Повторная партия на тот же результат — награды не дублируются
    const r4 = recordTournamentResult(st, { score: 2900 }, '2026-08-30');
    assert.equal(r4.newRewards.length, 0);
});

test('tournament: recordTournamentResult не выдаёт приз ниже порога', () => {
    const st = baseState();
    ensureTournament(st, '2026-08-30');
    const r = recordTournamentResult(st, { score: 450 }, '2026-08-30');
    assert.equal(r.newRewards.length, 0);
    assert.deepEqual(st.tournament.claimed, []);
});

test('tournament: info показывает ближайший недостигнутый порог', () => {
    const st = baseState();
    ensureTournament(st, '2026-08-30');
    let info = tournamentInfo(st, '2026-08-30');
    assert.equal(info.nextThreshold, 500);
    assert.equal(info.nextReward, 25);
    assert.equal(info.completedToday, false);
    assert.equal(info.moves, TOURNAMENT_MOVES);
    // После результата 600 — следующий порог 1000
    recordTournamentResult(st, { score: 600 }, '2026-08-30');
    info = tournamentInfo(st, '2026-08-30');
    assert.equal(info.nextThreshold, 1000);
    assert.equal(info.best, 600);
    assert.equal(info.completedToday, true);
});

test('tournament: info после всех порогов — nextThreshold null', () => {
    const st = baseState();
    ensureTournament(st, '2026-08-30');
    recordTournamentResult(st, { score: 99999 }, '2026-08-30');
    const info = tournamentInfo(st, '2026-08-30');
    assert.equal(info.nextThreshold, null);
    assert.equal(info.nextReward, null);
    assert.deepEqual(info.rewards, TOURNAMENT_REWARDS);
});

test('tournament: пустой state нормализуется через ensureTournament', () => {
    const st = {};
    ensureTournament(st, '2026-08-30');
    assert.ok(st[TOURNAMENT_KEY]);
    assert.equal(st[TOURNAMENT_KEY].date, '2026-08-30');
    assert.equal(st[TOURNAMENT_KEY].best, 0);
});
