// ======================== Тесты: осенние листья (js/autumn.js) ========================
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
    LEAVES,
    AUTUMN_OPTIONS,
    isAutumnSeason,
    makeLeaf,
    stepLeaf,
    shouldShowAutumn,
} from './autumn.js';

function rng0() { return 0; }
function rng1() { return 0.999; }

test('isAutumnSeason: осень — август (старт акции) и до конца ноября', () => {
    assert.equal(isAutumnSeason(new Date(2026, 7, 15)), true);  // август
    assert.equal(isAutumnSeason(new Date(2026, 8, 15)), true);  // сентябрь
    assert.equal(isAutumnSeason(new Date(2026, 9, 15)), true);  // октябрь
    assert.equal(isAutumnSeason(new Date(2026, 10, 15)), true); // ноябрь
    assert.equal(isAutumnSeason(new Date(2026, 11, 15)), false);// декабрь
    assert.equal(isAutumnSeason(new Date(2026, 0, 15)), false); // январь
});

test('makeLeaf: лист имеет все поля и корректные диапазоны', () => {
    const w = 300, h = 500;
    const l0 = makeLeaf(w, h, rng0);
    const l1 = makeLeaf(w, h, rng1);
    // rng0 → минимальные size/speed/opacity; rng1 → почти максимальные
    assert.ok(LEAVES.includes(l0.emoji) && LEAVES.includes(l1.emoji));
    assert.equal(l0.size, AUTUMN_OPTIONS.minSize);
    assert.ok(l1.size > AUTUMN_OPTIONS.maxSize - 0.05, `size=${l1.size} должен приближаться к max`);
    assert.ok(l1.size <= AUTUMN_OPTIONS.maxSize);
    assert.equal(l0.speedY, AUTUMN_OPTIONS.minSpeedY);
    assert.ok(l1.speedY > AUTUMN_OPTIONS.maxSpeedY - 0.05);
    assert.ok(l1.speedY <= AUTUMN_OPTIONS.maxSpeedY);
    assert.equal(l0.opacity, AUTUMN_OPTIONS.opacityMin);
    assert.ok(l0.opacity >= AUTUMN_OPTIONS.opacityMin && l0.opacity <= 1);
    // Стартовая y — чуть выше экрана (сразу «в полёте»)
    assert.ok(l0.y < 0);
    assert.ok(Number.isFinite(l0.x) && Number.isFinite(l0.phase));
});

test('makeLeaf: стартовая позиция внутри ширины', () => {
    const w = 400;
    const leaf = makeLeaf(w, 600, () => 0.5);
    assert.ok(leaf.x >= 0 && leaf.x <= w);
});

test('stepLeaf: лист падает вниз, амплитуда по X ограничена', () => {
    const w = 300, h = 500;
    const leaf = makeLeaf(w, h, rng0);
    const x0 = leaf.x, y0 = leaf.y, ph0 = leaf.phase;
    const onScreen = stepLeaf(leaf, 0.5, w, h);
    assert.equal(onScreen, true);
    assert.ok(leaf.y > y0, 'лист должен опускаться');
    assert.ok(leaf.phase !== ph0, 'фаза покачивания меняется');
    assert.ok(Math.abs(leaf.x - x0) <= AUTUMN_OPTIONS.drift * 0.5 + 0.0001, 'сдвиг по X ограничен');
});

test('stepLeaf: dt <= 0 не двигает лист', () => {
    const leaf = makeLeaf(300, 500, rng0);
    const snap = { ...leaf };
    stepLeaf(leaf, 0, 300, 500);
    assert.deepEqual(leaf, snap);
    stepLeaf(leaf, -1, 300, 500);
    assert.deepEqual(leaf, snap);
});

test('stepLeaf: улетевший за низ пересоздаётся (false), ушедший за бок — возвращается', () => {
    const w = 200, h = 200;
    const leaf = makeLeaf(w, h, rng0);
    // Медленный лист (minSpeedY) — уйдёт за низ за много шагов
    let done = false;
    for (let i = 0; i < 200 && !done; i++) {
        done = !stepLeaf(leaf, 2, w, h);
    }
    assert.equal(done, true, 'лист в итоге должен уйти за низ');

    // Боковой возврат: сильно сдвигаем лист вправо, после шага он должен вернуться слева
    const leaf2 = makeLeaf(w, h, rng0);
    leaf2.x = w + leaf2.size + 1;
    stepLeaf(leaf2, 1, w, h);
    assert.ok(leaf2.x < leaf2.size, 'ушедший за правый край возвращается слева');
});

test('shouldShowAutumn: тема «Осень» включает листья в любой сезон', () => {
    assert.equal(shouldShowAutumn('autumn', new Date(2026, 0, 15)), true);  // январь
    assert.equal(shouldShowAutumn('dark', new Date(2026, 0, 15)), false);   // январь, другая тема
    assert.equal(shouldShowAutumn('dark', new Date(2026, 9, 15)), true);    // октябрь — сезон
    assert.equal(shouldShowAutumn(null, new Date(2026, 8, 15)), true);      // осень по сезону
    assert.equal(shouldShowAutumn('dark', new Date(2026, 4, 15)), false);   // май
});
