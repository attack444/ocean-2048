// Юнит-тесты: дуэль дня (js/duel.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
    DUEL_KEY, DUEL_SIZE, DUEL_MOVES, DUEL_TARGET,
    DUEL_WIN_REWARD, DUEL_LOSE_REWARD,
    duelSeed, duelStartBoard, buildDuelRequestKey, parseDuelChallenge,
    applyDuelChallenge, clearDuelPending, ensureDuel, recordDuelResult, duelInfo,
} from './duel.js';
import { seedFromDate } from './daily-puzzle.js';

function baseState(overrides = {}) {
    return { duel: { date: '', best: 0, played: false, wins: 0, claimed: [], pendingScore: 0 }, ...overrides };
}

test('duel: seed дня детерминирован и уникален для даты', () => {
    assert.equal(duelSeed('2026-08-30'), duelSeed('2026-08-30'));
    assert.notEqual(duelSeed('2026-08-30'), duelSeed('2026-08-31'));
    // Сид дуэли отличается от сида головоломки и турнира (свои доски)
    assert.notEqual(duelSeed('2026-08-30'), seedFromDate('2026-08-30'));
});

test('duel: стартовая доска детерминирована и имеет 2 плитки', () => {
    const b1 = duelStartBoard('2026-08-30');
    const b2 = duelStartBoard('2026-08-30');
    assert.equal(b1.length, DUEL_SIZE * DUEL_SIZE);
    assert.deepEqual(b1, b2);
    const filled = b1.filter(Boolean);
    assert.equal(filled.length, 2);
    assert.ok(filled.every(t => t.value === 2 || t.value === 4));
});

test('duel: requestKey содержит дату и счёт, парсится обратно', () => {
    const key = buildDuelRequestKey(12345, '2026-08-30');
    assert.equal(key, 'ocean2048_duel_20260830_12345');
    const ch = parseDuelChallenge(key);
    assert.deepEqual(ch, { dateStr: '2026-08-30', score: 12345 });
});

test('duel: requestKey защищён от некорректных значений', () => {
    // Отрицательный / дробный счёт округляется и зажимается в 0..n
    assert.equal(buildDuelRequestKey(-5, '2026-08-30'), 'ocean2048_duel_20260830_0');
    assert.equal(buildDuelRequestKey(99.6, '2026-08-30'), 'ocean2048_duel_20260830_100');
    // Не вызов на дуэль / битые ключи → null
    assert.equal(parseDuelChallenge('ocean2048_invite'), null);
    assert.equal(parseDuelChallenge('ocean2048_duel_20260830'), null); // нет счёта
    assert.equal(parseDuelChallenge('ocean2048_duel_abc_10'), null);   // битая дата
    assert.equal(parseDuelChallenge('ocean2048_duel_20260830_abc'), null); // битый счёт
    assert.equal(parseDuelChallenge(42), null);
});

test('duel: входящий вызов принимается только за сегодняшний день', () => {
    const st = baseState();
    // Чужая дата — устаревший вызов
    const stale = applyDuelChallenge(st, 'ocean2048_duel_20260829_5000', '2026-08-30');
    assert.deepEqual(stale, { accepted: false, reason: 'stale', score: 5000, dateStr: '2026-08-29' });
    // Сегодняшний вызов — принят, счёт соперника сохранён
    const ok = applyDuelChallenge(st, 'ocean2048_duel_20260830_5000', '2026-08-30');
    assert.equal(ok.accepted, true);
    assert.equal(ok.score, 5000);
    assert.equal(st.duel.pendingScore, 5000);
    // Не дуэльный ключ — игнорируется
    assert.deepEqual(applyDuelChallenge(st, 'ocean2048_invite', '2026-08-30'), { accepted: false, reason: 'no-challenge' });
});

test('duel: ensureDuel сбрасывает результат при смене дня', () => {
    const st = baseState({ duel: { date: '2026-08-29', best: 777, played: true, wins: 3, claimed: ['win'], pendingScore: 5000 } });
    assert.equal(ensureDuel(st, '2026-08-29'), false);
    assert.equal(st.duel.best, 777);
    assert.equal(ensureDuel(st, '2026-08-30'), true);
    assert.deepEqual(st.duel, { date: '2026-08-30', best: 0, played: false, wins: 0, claimed: [], pendingScore: 0 });
});

test('duel: победа над соперником даёт награду, поражение — утешительную, один раз в день', () => {
    const st = baseState();
    ensureDuel(st, '2026-08-30');
    // Победа: 5000 против 3000
    const win = recordDuelResult(st, { score: 5000, opponentScore: 3000 }, '2026-08-30');
    assert.equal(win.isNewBest, true);
    assert.equal(win.won, true);
    assert.equal(win.draw, false);
    assert.equal(win.reward, DUEL_WIN_REWARD);
    assert.equal(st.duel.best, 5000);
    assert.equal(st.duel.wins, 1);
    // Повторная победа в тот же день — награда не дублируется
    const win2 = recordDuelResult(st, { score: 6000, opponentScore: 1000 }, '2026-08-30');
    assert.equal(win2.isNewBest, true);
    assert.equal(win2.won, true);
    assert.equal(win2.reward, 0);
    // Поражение в тот же день — утешительная выдача (win уже получен)
    const lose = recordDuelResult(st, { score: 800, opponentScore: 7000 }, '2026-08-30');
    assert.equal(lose.won, false);
    assert.equal(lose.reward, DUEL_LOSE_REWARD);
    // Повторное поражение — снова без награды
    const lose2 = recordDuelResult(st, { score: 100, opponentScore: 9000 }, '2026-08-30');
    assert.equal(lose2.reward, 0);
});

test('duel: ничья с соперником даёт утешительную награду', () => {
    const st = baseState();
    ensureDuel(st, '2026-08-30');
    const draw = recordDuelResult(st, { score: 4000, opponentScore: 4000 }, '2026-08-30');
    assert.equal(draw.draw, true);
    assert.equal(draw.won, false);
    assert.equal(draw.reward, DUEL_LOSE_REWARD);
});

test('duel: тренировка без соперника наград не даёт', () => {
    const st = baseState();
    ensureDuel(st, '2026-08-30');
    const res = recordDuelResult(st, { score: 9999, opponentScore: 0 }, '2026-08-30');
    assert.equal(res.won, false);
    assert.equal(res.reward, 0);
    assert.equal(st.duel.best, 9999); // рекорд дня всё равно обновляется
    assert.equal(st.duel.claimed.length, 0);
});

test('duel: duelInfo показывает статус дня и счёт соперника', () => {
    const st = baseState();
    ensureDuel(st, '2026-08-30');
    const i1 = duelInfo(st, '2026-08-30');
    assert.equal(i1.completedToday, false);
    assert.equal(i1.moves, DUEL_MOVES);
    assert.equal(i1.target, DUEL_TARGET);
    assert.equal(i1.wins, 0);

    applyDuelChallenge(st, 'ocean2048_duel_20260830_4200', '2026-08-30');
    const i2 = duelInfo(st, '2026-08-30');
    assert.equal(i2.pendingScore, 4200);

    recordDuelResult(st, { score: 4300, opponentScore: 4200 }, '2026-08-30');
    const i3 = duelInfo(st, '2026-08-30');
    assert.equal(i3.completedToday, true);
    assert.equal(i3.claimedWin, true);
    assert.equal(i3.claimedLose, false);
    assert.equal(i3.best, 4300);
});

test('duel: clearDuelPending убирает счёт соперника после старта партии', () => {
    const st = baseState();
    applyDuelChallenge(st, 'ocean2048_duel_20260830_4200', '2026-08-30');
    assert.equal(st.duel.pendingScore, 4200);
    clearDuelPending(st);
    assert.equal(st.duel.pendingScore, 0);
});

test('duel: константы экономики не нулевые', () => {
    assert.ok(DUEL_WIN_REWARD > 0);
    assert.ok(DUEL_LOSE_REWARD > 0);
    assert.ok(DUEL_WIN_REWARD > DUEL_LOSE_REWARD);
    assert.equal(DUEL_KEY, 'duel');
});
