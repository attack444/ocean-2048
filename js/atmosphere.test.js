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
    makeKelp,
    makeCoral,
    makeFirefly,
    makeAngler,
    makeShark,
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
    }
});

test('THEMES: у каждой темы есть своя «сигнатура» (хотя бы один активный слой)', () => {
    const countKeys = ['fishCount', 'planktonCount', 'rayCount', 'bubbleCount', 'shimmerCount',
                       'kelpCount', 'coralCount', 'fireflyCount', 'anglerCount', 'jellyCount'];
    for (const key of THEME_KEYS) {
        const t = THEMES[key];
        const active = countKeys.filter(k => (t[k] || 0) > 0);
        assert.ok(active.length > 0, `${key}: нет ни одного активного слоя`);
        // Планктон и блики есть у всех — сигнатура должна отличаться чем-то ещё
        const signature = active.filter(k => !['planktonCount', 'shimmerCount', 'rayCount'].includes(k));
        assert.ok(signature.length > 0, `${key}: нет уникальной сигнатуры (только общие слои)`);
    }
});

test('THEMES: сигнатуры тем различаются (не у всех рыбы и пузыри)', () => {
    // Осень/Закат/Бездна/Сакура не должны иметь рыб и пузырей
    for (const key of ['autumn', 'sunset', 'abyss', 'sakura']) {
        assert.equal(THEMES[key].fishCount, 0, `${key}: fishCount должен быть 0`);
        assert.equal(THEMES[key].bubbleCount, 0, `${key}: bubbleCount должен быть 0`);
    }
    // Классические лагуны сохраняют рыб и пузыри
    assert.ok(THEMES.dark.fishCount > 0 && THEMES.dark.bubbleCount > 0);
    assert.ok(THEMES.light.fishCount > 0 && THEMES.light.bubbleCount > 0);
    // Новые сигнатуры
    assert.ok(THEMES.forest.kelpCount > 0 && THEMES.forest.fireflyCount > 0, 'forest: водоросли+светлячки');
    assert.ok(THEMES.autumn.fireflyCount > 0 && THEMES.autumn.kelpCount > 0, 'autumn: светлячки+камыш');
    assert.ok(THEMES.autumn.kelpHeads === true, 'autumn: рогоз на камыше');
    assert.ok(THEMES.dark.kelpCount > 0 && THEMES.dark.coralCount > 0, 'dark: водоросли+кораллы');
    assert.ok(Array.isArray(THEMES.dark.coral) && THEMES.dark.coral.length > 0, 'dark: палитра кораллов');
    assert.ok(THEMES.abyss.anglerCount > 0, 'abyss: удильщики');
    assert.ok(THEMES.sunset.jellyCount > 0 && THEMES.sakura.jellyCount > 0, 'sunset/sakura: медузы');
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

test('makeKelp: водоросль растёт от дна и качается', () => {
    const k = makeKelp(THEMES.forest, 800, 600, () => 0.5);
    assert.ok(k.y > 600, 'стартует у дна');
    assert.ok(k.height > 0 && k.height < 600, 'высота в пределах экрана');
    assert.ok(k.width >= 10 && k.width <= 32);
    assert.ok(k.segments >= 5 && k.segments <= 8);
    assert.ok(k.swayAmp >= 8);
});

test('makeCoral: коралл растёт от дна, ветвится и берёт цвет из палитры', () => {
    const c = makeCoral(THEMES.dark, 800, 600, () => 0.5);
    assert.ok(c.y > 600, 'стартует у дна');
    assert.ok(c.height > 0 && c.height < 600, 'высота в пределах экрана');
    assert.ok(c.branches >= 3 && c.branches <= 5, 'число ветвей');
    assert.ok(c.swayAmp >= 3);
    assert.ok(THEMES.dark.coral.includes(c.color), 'цвет из палитры темы');
    assert.ok(c.tipR >= 3);
});

test('makeCoral: без палитры — цвет по умолчанию', () => {
    const c = makeCoral({}, 800, 600, () => 0.5);
    assert.equal(c.color, 'rgba(255,120,150,.7)');
});

test('stepParticle: коралл закреплён и всегда на экране', () => {
    const c = makeCoral(THEMES.dark, 100, 100, () => 0.5);
    const y0 = c.y;
    const onScreen = stepParticle(c, 0.5, 100, 100);
    assert.equal(onScreen, true);
    assert.equal(c.y, y0, 'коралл не должен двигаться по вертикали');
});

test('makeFirefly: светлячок с периодом и duty (вспышка с паузой)', () => {
    const f = makeFirefly(THEMES.autumn, 800, 600, () => 0.5);
    assert.ok(f.r >= 1.2 && f.r <= 3.4);
    assert.ok(f.period >= 2);
    assert.ok(f.duty > 0 && f.duty < 1);
    assert.equal(typeof f.drift, 'number');
});

test('makeAngler: биолюминесцентная точка с ореолом', () => {
    const a = makeAngler(THEMES.abyss, 800, 600, () => 0.5);
    assert.ok(a.r >= 3 && a.r <= 7);
    assert.ok(a.period >= 2.5);
    assert.ok(a.duty > 0 && a.duty < 1);
});

test('stepParticle: светлячок дрейфует и остаётся на экране', () => {
    // rng=0.7 даёт ненулевой drift (0.7*30-15=6), чтобы проверить движение
    const f = makeFirefly(THEMES.autumn, 100, 100, () => 0.7);
    const x0 = f.x, y0 = f.y;
    const onScreen = stepParticle(f, 0.5, 100, 100);
    assert.equal(onScreen, true);
    // должен хоть немного сдвинуться (дрейф)
    assert.ok(Math.abs(f.x - x0) > 0 || Math.abs(f.y - y0) > 0);
});

test('stepParticle: водоросль закреплена и всегда на экране', () => {
    const k = makeKelp(THEMES.forest, 100, 100, () => 0.5);
    const y0 = k.y;
    const onScreen = stepParticle(k, 0.5, 100, 100);
    assert.equal(onScreen, true);
    assert.equal(k.y, y0, 'водоросль не должна двигаться по вертикали');
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

// --- Фоновая акула (часть A) ---

test('THEMES: у каждой темы есть конфиг фоновой акулы', () => {
    for (const key of THEME_KEYS) {
        const s = THEMES[key].shark;
        assert.ok(s, `${key}: shark`);
        assert.ok(s.alpha > 0 && s.alpha <= 1, `${key}: alpha`);
        assert.ok(s.scale > 0, `${key}: scale`);
        assert.ok(s.chance > 0, `${key}: chance`);
        assert.equal(typeof s.tint, 'string', `${key}: tint`);
        assert.equal(typeof s.belly, 'string', `${key}: belly`);
    }
});

test('makeShark: создаёт акулу с полями и стартом за экраном', () => {
    const sh = makeShark(THEMES.dark, 1000, 600, () => 0.5);
    assert.ok(sh.x < 0 || sh.x > 1000, `старт за экраном, x=${sh.x}`);
    assert.ok([1, -1].includes(sh.dir), `dir=${sh.dir}`);
    assert.ok(sh.speed > 0, 'скорость положительна');
    assert.ok(sh.scale > 0, 'scale положителен');
    assert.ok(sh.alpha > 0 && sh.alpha <= 1, `alpha=${sh.alpha}`);
    assert.equal(sh.tint, THEMES.dark.shark.tint);
    assert.equal(sh.belly, THEMES.dark.shark.belly);
    assert.ok(sh.y > 0 && sh.y < 600, `y в пределах экрана, y=${sh.y}`);
    assert.equal(sh.gone, false);
});

test('makeShark: направление зависит от rng (слева/справа)', () => {
    const fromLeft = makeShark(THEMES.dark, 1000, 600, () => 0.9); // rng > 0.5 => слева
    assert.equal(fromLeft.dir, 1);
    assert.ok(fromLeft.x < 0, 'слева — x отрицательный');
    const fromRight = makeShark(THEMES.dark, 1000, 600, () => 0.1); // rng < 0.5 => справа
    assert.equal(fromRight.dir, -1);
    assert.ok(fromRight.x > 1000, 'справа — x больше ширины');
});

test('makeShark: без конфига shark использует значения по умолчанию', () => {
    const sh = makeShark({}, 1000, 600, () => 0.5);
    assert.ok(sh.scale > 0 && sh.alpha > 0, 'есть дефолтные scale/alpha');
    assert.equal(typeof sh.tint, 'string');
});
