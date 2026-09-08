// ======================== Тесты атмосферы «Живой океан» ========================
// node:test, чистые функции из js/atmosphere.js (без DOM/canvas).
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
    THEME_KEYS,
    THEMES,
    atmosphereConfigFor,
    makeBubble,
    makeFish,
    makePlankton,
    makeLeafParticle,
    makeLightRay,
    spawnBurst,
    stepParticle,
    mergePulseValue,
    computeIntensity,
    hexToRgba,
    mixColor,
    clamp,
} from './atmosphere.js';

test('THEME_KEYS содержит все 7 тем', () => {
    assert.deepEqual([...THEME_KEYS].sort(), ['abyss', 'autumn', 'dark', 'forest', 'light', 'sakura', 'sunset'].sort());
});

test('THEMES: у каждой темы есть все ключевые поля', () => {
    for (const key of THEME_KEYS) {
        const t = THEMES[key];
        assert.ok(t, `тема ${key} существует`);
        assert.ok(Array.isArray(t.sky) && t.sky.length === 2, `${key}: sky`);
        assert.ok(Array.isArray(t.water) && t.water.length === 2, `${key}: water`);
        assert.equal(typeof t.rayColor, 'string', `${key}: rayColor`);
        assert.equal(typeof t.plankton, 'string', `${key}: plankton`);
        assert.ok(t.fishCount > 0, `${key}: fishCount`);
    }
});

test('atmosphereConfigFor: базовый конфиг для dark', () => {
    const c = atmosphereConfigFor('dark');
    assert.equal(c.fishCount, THEMES.dark.fishCount);
    assert.equal(c.planktonCount, THEMES.dark.planktonCount);
    assert.equal(c.rayCount, THEMES.dark.rayCount);
    assert.equal(c.bubbleCount, THEMES.dark.bubbleCount);
    assert.equal(c.intensity, undefined); // без opts
});

test('atmosphereConfigFor: mobile снижает плотность, desktop нет', () => {
    const d = atmosphereConfigFor('dark', 'desktop');
    const m = atmosphereConfigFor('dark', 'mobile');
    assert.ok(m.fishCount < d.fishCount);
    assert.ok(m.planktonCount < d.planktonCount);
    assert.ok(m.rayCount <= d.rayCount);
});

test('atmosphereConfigFor: несуществующая тема → fallback dark', () => {
    const c = atmosphereConfigFor('nope');
    assert.equal(c.fishCount, THEMES.dark.fishCount);
});

test('atmosphereConfigFor: лимиты плотности соблюдаются', () => {
    const c = atmosphereConfigFor('dark', 'desktop');
    assert.ok(c.fishCount <= 14);
    assert.ok(c.planktonCount <= 60);
    assert.ok(c.rayCount <= 10);
    assert.ok(c.bubbleCount <= 16);
});

test('clamp: ограничивает в 0..1', () => {
    assert.equal(clamp(1.5), 1);
    assert.equal(clamp(-0.5), 0);
    assert.equal(clamp(0.5), 0.5);
    assert.equal(clamp(0), 0);
});

test('hexToRgba: конвертация #RRGGBB в rgba', () => {
    assert.equal(hexToRgba('#ff0000'), 'rgba(255,0,0,1)');
    assert.equal(hexToRgba('#00ff00', 0.5), 'rgba(0,255,0,0.5)');
    assert.equal(hexToRgba('0000ff', 0.25), 'rgba(0,0,255,0.25)');
});

test('hexToRgba: невалидный ввод → чёрный с заданной альфой', () => {
    assert.equal(hexToRgba('nope', 0.3), 'rgba(0,0,0,0.3)');
});

test('mixColor: смешивание чёрного и белого', () => {
    assert.equal(mixColor('#000000', '#ffffff', 0), 'rgba(0,0,0,1)');
    assert.equal(mixColor('#000000', '#ffffff', 1), 'rgba(255,255,255,1)');
    assert.equal(mixColor('#000000', '#ffffff', 0.5), 'rgba(128,128,128,1)');
});

test('makeBubble: поля и диапазоны', () => {
    const b = makeBubble(THEMES.dark, 800, 600, () => 0.5);
    assert.equal(typeof b.x, 'number');
    assert.ok(b.r >= 2 && b.r <= 8);
    assert.ok(b.speed >= 20);
    assert.ok(b.y > 600); // стартует снизу
    assert.ok(b.alpha >= 0.3 && b.alpha <= 0.8);
});

test('makeFish: поля и диапазоны', () => {
    const f = makeFish(THEMES.dark, 800, 600, () => 0.5);
    assert.equal(typeof f.x, 'number');
    assert.ok(f.len >= 18 && f.len <= 48);
    assert.ok(f.dir === 1 || f.dir === -1);
    assert.ok(f.depth >= 0.2 && f.depth <= 1);
});

test('makePlankton: мерцающая точка', () => {
    const p = makePlankton(THEMES.dark, 800, 600, () => 0.5);
    assert.ok(p.r >= 0.8 && p.r <= 2.6);
    assert.ok(p.speed >= 3);
    assert.ok(p.twinkleSpeed >= 1);
});

test('makeLightRay: луч сверху', () => {
    const r = makeLightRay(THEMES.dark, 800, 600, () => 0.5);
    assert.ok(r.width >= 30 && r.width <= 90);
    assert.ok(r.alpha >= 0.1 && r.alpha <= 0.35);
});

test('spawnBurst: создаёт частицы с векторами и временем жизни', () => {
    const arr = spawnBurst(100, 100, 12, '255,255,0', () => 0.5);
    assert.equal(arr.length, 12);
    for (const p of arr) {
        assert.equal(p.x, 100);
        assert.equal(p.y, 100);
        assert.equal(typeof p.vx, 'number');
        assert.ok(p.life > 0);
        assert.equal(p.maxLife, 1);
        assert.equal(p.color, '255,255,0');
    }
});

test('stepParticle: пузырёк движется вверх и исчезает за экраном', () => {
    const b = makeBubble(THEMES.dark, 100, 100, () => 0.5);
    b.y = 10;   // почти у верха
    b.speed = 100; // быстрый
    const onScreen = stepParticle(b, 0.5, 100, 100);
    assert.ok(b.y < 10); // поднялся
    assert.equal(onScreen, false); // улетел за -40
});

test('stepParticle: рыба движется горизонтально', () => {
    const f = makeFish(THEMES.dark, 100, 100, () => 0.5);
    const x0 = f.x;
    stepParticle(f, 0.5, 100, 100);
    assert.notEqual(f.x, x0);
});

test('stepParticle: лепесток падает вниз', () => {
    const l = makeLeafParticle(THEMES.dark, 100, 100, () => 0.5);
    const y0 = l.y;
    stepParticle(l, 0.5, 100, 100);
    assert.ok(l.y > y0);
});

test('makeLeafParticle: для осени берётся лист из набора темы', () => {
    const l = makeLeafParticle(THEMES.autumn, 100, 100, () => 0.5);
    assert.ok(['🍁', '🍂', '🍃'].includes(l.emoji), `emoji=${l.emoji}`);
});

test('makeLeafParticle: без набора — лепесток (по умолчанию)', () => {
    const l = makeLeafParticle(THEMES.sakura, 100, 100, () => 0.5);
    assert.equal(l.emoji, '🍃');
});

test('stepParticle: dt <= 0 не двигает', () => {
    const b = makeBubble(THEMES.dark, 100, 100, () => 0.5);
    const y0 = b.y;
    stepParticle(b, 0, 100, 100);
    assert.equal(b.y, y0);
});

test('mergePulseValue: плавно убывает от 1 к 0', () => {
    assert.equal(mergePulseValue(1000, 1000, 0.8), 1);
    assert.equal(mergePulseValue(1800, 1000, 0.8), 0); // прошло > 0.8s
    const mid = mergePulseValue(1400, 1000, 0.8);
    assert.ok(mid > 0 && mid < 1);
    assert.equal(mergePulseValue(500, 1000, 0.8), 0); // pulse в будущем
});

// computeIntensity переехал из music.js (процедурная музыка удалена) —
// теперь это «накал» геймплея только для визуальной атмосферы.
test('computeIntensity: базовая спокойная ~0.35', () => {
    const v = computeIntensity({});
    assert.ok(v >= 0.3 && v <= 0.4, `база должна быть ~0.35, получено ${v}`);
});

test('computeIntensity: серия слияний повышает накал', () => {
    const low = computeIntensity({ streak: 0 });
    const high = computeIntensity({ streak: 6 });
    assert.ok(high > low, 'длинная серия должна поднимать интенсивность');
});

test('computeIntensity: бесполезные ходы подряд — напряжение', () => {
    const calm = computeIntensity({ movesWithoutMerge: 0, maxWithoutMerge: 4 });
    const tense = computeIntensity({ movesWithoutMerge: 4, maxWithoutMerge: 4 });
    assert.ok(tense > calm, 'накопление бесполезных ходов должно увеличивать накал');
});

test('computeIntensity: акула и прилив добавляют тревоги', () => {
    const calm = computeIntensity({ sharkActive: false, tideLevel: 0 });
    const danger = computeIntensity({ sharkActive: true, tideLevel: 0.6 });
    assert.ok(danger > calm);
});

test('computeIntensity: результат в диапазоне 0..1', () => {
    for (const s of [
        { streak: 0 }, { streak: 20, movesWithoutMerge: 20, maxWithoutMerge: 3, tideLevel: 1, sharkActive: true },
        { movesWithoutMerge: 99 }, {},
    ]) {
        const v = computeIntensity(s);
        assert.ok(v >= 0 && v <= 1, `вне диапазона: ${v}`);
    }
});
