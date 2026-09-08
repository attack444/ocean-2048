// ======================== «Живой океан»: процедурная атмосфера (Canvas 2D) ========================
// Каждая тема получает живой фон, который дышит и реагирует на геймплей.
// Музыка в игре — готовая запись OST (js/ost.js), она от геймплея не зависит;
// а вот визуальная атмосфера по-прежнему «живая» (setIntensity/setPulse/setFlow).
// Чистые функции (config, генерация частиц, интерполяция) тестируются в node:test.
// Canvas-рендер — опционален (браузер); в node модуль импортируется без DOM.
//
// Структура модуля:
//   1. THEMES — конфиг атмосферы для каждой темы (свет, обитатели, частицы)
//   2. Чистые функции: atmosphereConfigFor(theme), makeBubble, makeFish, makePlankton,
//      makeLeafParticle, makeJelly, makeLightRay, makeShimmer, spawnBurst,
//      stepParticle, mergePulseValue, hexToRgba, mixColor, clamp
//   3. Canvas-класс OceanAtmosphere: рендер слоёв через requestAnimationFrame
//      (lifecycle: start/stop/pause/resume/setIntensity/setPulse/resize)

// ------------------------------------------------------------------
// 1. КОНФИГ ТЕМ
// ------------------------------------------------------------------
export const THEME_KEYS = ['dark', 'light', 'autumn', 'forest', 'sunset', 'abyss', 'sakura'];

export const THEMES = {
    // ── Лагуна (тёмная): коралловый риф ──
    // Фишка: стайки рыб + пузырьки + коралловый риф и водоросли у дна.
    dark: {
        label: 'Лагуна',
        sky: ['#062c44', '#0b4b6f'],        // тёмная вода, свет сверху
        water: ['rgba(6,44,68,.0)', 'rgba(2,18,34,.55)'],
        rayColor: 'rgba(140,220,255,.14)',
        fishColor: 'rgba(20,60,85,.6)',
        plankton: 'rgba(180,220,255,.4)',
        bubble: 'rgba(255,255,255,.22)',
        shimmer: 'rgba(190,235,255,.8)',    // светящиеся пылинки света
        glow: 'rgba(120,210,255,.10)',      // мягкое «дыхание» света сверху
        kelp: 'rgba(40,170,150,.55)',       // бирюзовые водоросли
        coral: ['rgba(255,120,150,.75)', 'rgba(255,170,90,.7)', 'rgba(120,200,255,.7)'], // риф
        fishCount: 8, planktonCount: 40, rayCount: 5, bubbleCount: 10, shimmerCount: 26,
        kelpCount: 6, coralCount: 7,
        shark: { alpha: 0.10, scale: 0.55, chance: 0.0006, tint: 'rgba(90,140,170,1)', belly: 'rgba(205,225,235,1)' },
    },

    // ── Лагуна светлая: яркий мелкий риф ──
    // Фишка: много рыбок + пузырьки-«искры» у поверхности.
    light: {
        label: 'Лагуна светлая',
        sky: ['#a8dce6', '#d7f2f7'],        // светлая вода
        water: ['rgba(255,255,255,.0)', 'rgba(0,184,212,.08)'],
        rayColor: 'rgba(255,255,255,.3)',
        fishColor: 'rgba(0,120,160,.5)',
        plankton: 'rgba(0,140,170,.3)',
        bubble: 'rgba(255,255,255,.5)',
        shimmer: 'rgba(255,255,255,.9)',
        glow: 'rgba(255,255,255,.16)',
        fishCount: 12, planktonCount: 30, rayCount: 7, bubbleCount: 8, shimmerCount: 30,
        shark: { alpha: 0.14, scale: 0.5, chance: 0.0007, tint: 'rgba(60,120,150,1)', belly: 'rgba(230,240,245,1)' },
    },

    // ── Осень: тёплый листопад у камышового берега ──
    // Фишка: падающие листья + золотистые светлячки + камыш/рогоз у дна. Без пузырей.
    autumn: {
        label: 'Осень',
        sky: ['#7a3b12', '#c96f2a'],        // тёплая вода
        water: ['rgba(120,50,10,.0)', 'rgba(70,30,4,.45)'],
        rayColor: 'rgba(255,200,120,.2)',
        fishColor: 'rgba(140,80,20,.6)',
        plankton: 'rgba(255,200,120,.35)',
        bubble: 'rgba(255,220,170,.3)',
        leafEmojis: ['🍁', '🍂', '🍃'],     // осенние листья в «живом океане»
        shimmer: 'rgba(255,220,150,.85)',   // тёплые золотистые искры
        glow: 'rgba(255,180,90,.12)',
        fireflies: 'rgba(255,214,120,.9)',  // золотистые светлячки
        kelp: 'rgba(190,120,50,.6)',        // янтарный камыш
        kelpHeads: true,                    // рисовать «рогоз» (шишки) на верхушках
        fishCount: 0, planktonCount: 30, rayCount: 5, bubbleCount: 0, shimmerCount: 18,
        fireflyCount: 16, kelpCount: 8,
        shark: { alpha: 0.10, scale: 0.55, chance: 0.0006, tint: 'rgba(120,90,50,1)', belly: 'rgba(220,190,150,1)' },
    },

    // ── Затонувший лес: зелёная чаща сквозь кроны ──
    // Фишка: густые колышущиеся водоросли + изумрудные светлячки. Без пузырей.
    forest: {
        label: 'Затонувший лес',
        sky: ['#1b4d3a', '#0e2b1f'],        // тёмная зелёная вода
        water: ['rgba(10,40,28,.0)', 'rgba(3,18,12,.5)'],
        rayColor: 'rgba(160,255,200,.16)',
        fishColor: 'rgba(30,90,60,.7)',
        plankton: 'rgba(140,255,180,.3)',
        bubble: 'rgba(180,255,200,.25)',
        shimmer: 'rgba(180,255,210,.85)',   // изумрудные светлячки
        glow: 'rgba(120,255,180,.10)',
        kelp: 'rgba(60,190,120,.6)',        // водоросли
        fireflies: 'rgba(140,255,180,.9)',  // изумрудные светлячки
        fishCount: 4, planktonCount: 30, rayCount: 7, bubbleCount: 0, shimmerCount: 16,
        kelpCount: 10, fireflyCount: 18,
        shark: { alpha: 0.10, scale: 0.55, chance: 0.0006, tint: 'rgba(60,110,80,1)', belly: 'rgba(180,210,190,1)' },
    },

    // ── Закат: романтика, светящиеся медузы ──
    // Фишка: стайка медуз. Без рыб и пузырей.
    sunset: {
        label: 'Закат',
        sky: ['#4a1a4e', '#d44a3a'],        // розово-оранжевая вода
        water: ['rgba(90,20,40,.0)', 'rgba(40,8,20,.5)'],
        rayColor: 'rgba(255,180,140,.25)',
        fishColor: 'rgba(150,50,80,.6)',
        plankton: 'rgba(255,200,180,.4)',
        bubble: 'rgba(255,200,180,.3)',
        shimmer: 'rgba(255,220,180,.9)',    // тёплые закатные искры
        glow: 'rgba(255,150,110,.14)',
        fishCount: 0, planktonCount: 26, rayCount: 6, bubbleCount: 0, shimmerCount: 22,
        jellyCount: 5,
        shark: { alpha: 0.10, scale: 0.55, chance: 0.0006, tint: 'rgba(150,80,90,1)', belly: 'rgba(230,190,190,1)' },
    },

    // ── Бездна: биолюминесценция ──
    // Фишка: светящиеся точки-«удильщики» + глубокие лучи. Без пузырей.
    abyss: {
        label: 'Бездна',
        sky: ['#04101f', '#0a2a3f'],        // самая глубина
        water: ['rgba(0,6,16,.0)', 'rgba(0,2,8,.6)'],
        rayColor: 'rgba(0,180,255,.08)',
        fishColor: 'rgba(10,40,60,.5)',
        plankton: 'rgba(120,220,255,.5)',
        bubble: 'rgba(180,240,255,.3)',
        shimmer: 'rgba(150,230,255,.9)',    // холодные биолюминесцентные точки
        glow: 'rgba(0,160,255,.08)',
        anglers: 'rgba(120,230,255,.9)',    // биолюминесцентные «удильщики»
        fishCount: 0, planktonCount: 50, rayCount: 4, bubbleCount: 0, shimmerCount: 30,
        anglerCount: 6,
        shark: { alpha: 0.08, scale: 0.6, chance: 0.0005, tint: 'rgba(40,80,110,1)', belly: 'rgba(140,180,200,1)' },
    },

    // ── Сакура: нежность, лепестки ──
    // Фишка: лепестки + светящиеся медузы. Без рыб и пузырей.
    sakura: {
        label: 'Сакура',
        sky: ['#5c2a5e', '#b45a8c'],        // розовая вода
        water: ['rgba(80,20,60,.0)', 'rgba(50,10,40,.5)'],
        rayColor: 'rgba(255,180,220,.22)',
        fishColor: 'rgba(160,70,110,.6)',
        plankton: 'rgba(255,190,220,.4)',
        bubble: 'rgba(255,220,240,.3)',
        shimmer: 'rgba(255,210,235,.9)',    // розовые искры
        glow: 'rgba(255,150,200,.12)',
        fishCount: 0, planktonCount: 30, rayCount: 5, bubbleCount: 0, shimmerCount: 22,
        jellyCount: 3,
        shark: { alpha: 0.10, scale: 0.55, chance: 0.0006, tint: 'rgba(150,90,120,1)', belly: 'rgba(230,200,215,1)' },
    },
};

// Лимиты частиц (снижаем на маленьких экранах / low-end)
export const DENSITY_LIMITS = {
    fish: 14, plankton: 60, ray: 10, bubble: 16, shimmer: 40,
    kelp: 14, firefly: 30, angler: 10, jelly: 6, coral: 12,
};

// ------------------------------------------------------------------
// 2. ЧИСТЫЕ ФУНКЦИИ
// ------------------------------------------------------------------
export const clamp = (v, min = 0, max = 1) => Math.min(max, Math.max(min, v));

export function hexToRgba(hex, alpha = 1) {
    const m = /^#?([0-9a-f]{6})$/i.exec(String(hex).trim());
    if (!m) return `rgba(0,0,0,${alpha})`;
    const n = parseInt(m[1], 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}

export function mixColor(a, b, t) {
    // Простое смешивание двух #RRGGBB (или 'rgb()') в строку
    const pa = parseColor(a), pb = parseColor(b);
    t = clamp(t);
    const r = Math.round(pa[0] + (pb[0] - pa[0]) * t);
    const g = Math.round(pa[1] + (pb[1] - pa[1]) * t);
    const bl = Math.round(pa[2] + (pb[2] - pa[2]) * t);
    return `rgba(${r},${g},${bl},1)`;
}

function parseColor(c) {
    if (typeof c !== 'string') return [0, 0, 0];
    const hx = /^#?([0-9a-f]{6})$/i.exec(c.trim());
    if (hx) {
        const n = parseInt(hx[1], 16);
        return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    }
    const rg = /rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)/i.exec(c.trim());
    if (rg) return [Number(rg[1]), Number(rg[2]), Number(rg[3])];
    return [0, 0, 0];
}

/** Конфиг атмосферы для темы (с учётом плотности и палитры). */
export function atmosphereConfigFor(theme, size = 'desktop', opts = {}) {
    const key = THEMES[theme] ? theme : 'dark';
    const base = { ...THEMES[key] };
    // Плотность зависит от размера экрана
    const mult = size === 'mobile' ? 0.6 : size === 'tablet' ? 0.8 : 1;
    // Все счётчики частиц масштабируются по размеру экрана
    const countKeys = ['fishCount', 'planktonCount', 'rayCount', 'bubbleCount', 'shimmerCount',
                       'kelpCount', 'fireflyCount', 'anglerCount', 'jellyCount', 'coralCount'];
    countKeys.forEach(k => {
        base[k] = Math.round((base[k] || 0) * mult);
    });
    // Применяем лимиты
    countKeys.forEach(k => {
        const limit = DENSITY_LIMITS[k.replace('Count', '')];
        if (limit != null) base[k] = Math.min(base[k], limit);
    });
    // Переопределения (например, от геймплея)
    if (opts.intensity != null) base.intensity = clamp(opts.intensity);
    if (opts.flow) base.flow = clamp(opts.flow);
    return base;
}

/** Создать пузырёк. */
export function makeBubble(cfg, w, h, rng = Math.random) {
    return {
        x: rng() * w,
        y: h + 20 + rng() * h * 0.2,
        r: 2 + rng() * 6,
        speed: 20 + rng() * 50,
        sway: (rng() * 60 - 30),
        swayPhase: rng() * Math.PI * 2,
        swaySpeed: 0.5 + rng() * 1.2,
        alpha: 0.3 + rng() * 0.5,
    };
}

/** Создать рыбу-силуэт. */
export function makeFish(cfg, w, h, rng = Math.random) {
    return {
        x: rng() * (w + 200) - 100,
        y: rng() * h,
        len: 18 + rng() * 30,
        speed: 20 + rng() * 50,
        dir: rng() > 0.5 ? 1 : -1,
        depth: 0.2 + rng() * 0.8,
        alpha: 0.25 + rng() * 0.35,
        bob: rng() * Math.PI * 2,
        bobSpeed: 0.5 + rng() * 1,
    };
}

/** Создать планктон (светящуюся точку). */
export function makePlankton(cfg, w, h, rng = Math.random) {
    return {
        x: rng() * w,
        y: rng() * h,
        r: 0.8 + rng() * 1.8,
        speed: 3 + rng() * 8,
        drift: (rng() * 40 - 20),
        phase: rng() * Math.PI * 2,
        twinkleSpeed: 1 + rng() * 3,
        alpha: 0.2 + rng() * 0.5,
    };
}

/** Создать лепесток сакуры / лист (для осени). */
export function makeLeafParticle(cfg, w, h, rng = Math.random) {
    // Для осени — случайный из набора листьев конфига, иначе — лепесток.
    const pool = Array.isArray(cfg?.leafEmojis) && cfg.leafEmojis.length
        ? cfg.leafEmojis
        : ['🍃'];
    return {
        x: rng() * w,
        y: -20 - rng() * h * 0.2,
        size: 8 + rng() * 14,
        speed: 30 + rng() * 60,
        sway: (rng() * 60 - 30),
        swayPhase: rng() * Math.PI * 2,
        swaySpeed: 0.8 + rng() * 1.5,
        spin: (rng() * 2 - 1) * 4,
        phase: rng() * Math.PI * 2,
        alpha: 0.5 + rng() * 0.4,
        emoji: pool[Math.floor(rng() * pool.length)],
    };
}

/** Создать медузу (светящуюся). */
export function makeJelly(cfg, w, h, rng = Math.random) {
    return {
        x: rng() * w,
        y: rng() * h,
        r: 16 + rng() * 24,
        speed: 10 + rng() * 20,
        bob: rng() * Math.PI * 2,
        bobSpeed: 0.4 + rng() * 0.8,
        alpha: 0.35 + rng() * 0.3,
        pulse: rng() * Math.PI * 2,
        pulseSpeed: 0.6 + rng() * 1,
    };
}

/** Создать световой луч (сверху вниз, полупрозрачный конус). */
export function makeLightRay(cfg, w, h, rng = Math.random) {
    return {
        x: rng() * w,
        width: 30 + rng() * 60,
        alpha: 0.1 + rng() * 0.25,
        speed: 0.05 + rng() * 0.1,
        phase: rng() * Math.PI * 2,
    };
}

/** Создать мерцающий блик (искру света). */
export function makeShimmer(cfg, w, h, rng = Math.random) {
    return {
        x: rng() * w,
        y: rng() * h,
        r: 1 + rng() * 3,
        phase: rng() * Math.PI * 2,
        speed: 1 + rng() * 3,
        alpha: 0.15 + rng() * 0.4,
    };
}

/** Создать водоросль/лозу (для «Затонувшего леса»): вертикальная лента, качается у дна. */
export function makeKelp(cfg, w, h, rng = Math.random) {
    const side = rng() > 0.5 ? 1 : -1;          // слева или справа
    return {
        x: side === 1 ? rng() * w * 0.18 : w - rng() * w * 0.18,
        y: h + 10,                               // растёт от низа
        height: h * (0.25 + rng() * 0.45),       // высота ленты
        width: 10 + rng() * 22,                  // толщина
        lean: (rng() * 40 - 20),                 // наклон в сторону
        phase: rng() * Math.PI * 2,
        speed: 0.4 + rng() * 0.7,                // скорость покачивания
        swayAmp: 8 + rng() * 18,                 // амплитуда качания
        alpha: 0.35 + rng() * 0.4,
        segments: 5 + Math.floor(rng() * 4),
    };
}

/** Создать коралл (для «Лагуны»): ветвящийся куст у дна, мягко покачивается. */
export function makeCoral(cfg, w, h, rng = Math.random) {
    const palette = Array.isArray(cfg?.coral) && cfg.coral.length ? cfg.coral : ['rgba(255,120,150,.7)'];
    return {
        x: rng() * w,                            // по всему дну
        y: h + 6,                                // растёт от низа
        height: h * (0.08 + rng() * 0.16),       // невысокий куст
        width: 20 + rng() * 34,                  // размах ветвей
        branches: 3 + Math.floor(rng() * 3),     // число ветвей
        color: palette[Math.floor(rng() * palette.length)],
        phase: rng() * Math.PI * 2,
        speed: 0.3 + rng() * 0.5,                // медленное покачивание
        swayAmp: 3 + rng() * 6,
        alpha: 0.6 + rng() * 0.35,
        tipR: 3 + rng() * 4,                     // размер округлой верхушки
    };
}

/** Создать светлячка (для «Осени»/«Леса»): вспыхивает и гаснет с паузой. */
export function makeFirefly(cfg, w, h, rng = Math.random) {
    return {
        x: rng() * w,
        y: rng() * h,
        r: 1.2 + rng() * 2.2,
        phase: rng() * Math.PI * 2,
        speed: 0.4 + rng() * 0.9,                // скорость мерцания
        drift: (rng() * 30 - 15),
        driftSpeed: 0.2 + rng() * 0.5,
        alpha: 0.5 + rng() * 0.4,
        // «вспышка с паузой»: период и доля активной фазы
        period: 2 + rng() * 3,
        duty: 0.3 + rng() * 0.4,
    };
}

/** Создать биолюминесцентную точку-«удильщика» (для «Бездны»): крупная, с ореолом. */
export function makeAngler(cfg, w, h, rng = Math.random) {
    return {
        x: rng() * w,
        y: rng() * h,
        r: 3 + rng() * 4,
        phase: rng() * Math.PI * 2,
        speed: 0.5 + rng() * 1,
        drift: (rng() * 24 - 12),
        driftSpeed: 0.15 + rng() * 0.4,
        alpha: 0.5 + rng() * 0.4,
        period: 2.5 + rng() * 3,
        duty: 0.4 + rng() * 0.3,
    };
}

/**
 * Создать фоновую акулу (для «живого океана»): редкий силуэт, проплывающий
 * горизонтально в толще воды. Невзрачный (низкая alpha), не перекрывает геймплей.
 */
export function makeShark(cfg, w, h, rng = Math.random) {
    const sc = cfg?.shark || { alpha: 0.1, scale: 0.55, chance: 0.0006, tint: 'rgba(90,140,170,1)', belly: 'rgba(205,225,235,1)' };
    const fromLeft = rng() > 0.5;
    return {
        x: fromLeft ? -0.25 * w : 1.25 * w,       // старт за экраном
        y: h * (0.12 + rng() * 0.5),              // средняя глубина
        dir: fromLeft ? 1 : -1,                   // направление движения
        speed: w * (0.05 + rng() * 0.06),         // px/сек
        scale: sc.scale * (0.8 + rng() * 0.5),    // размер относительно высоты
        alpha: sc.alpha * (0.7 + rng() * 0.6),    // непрозрачность
        tint: sc.tint,
        belly: sc.belly,
        phase: rng() * Math.PI * 2,               // фаза волны хвоста
        bob: rng() * Math.PI * 2,                 // фаза вертикального покачивания
        bobSpeed: 0.6 + rng() * 0.5,
        gone: false,
    };
}

/**
 * Всплеск частиц в точке (при слиянии / событии).
 * Возвращает массив частиц для добавления в слой.
 */
export function spawnBurst(x, y, count = 12, color = '255,255,255', rng = Math.random, opts = {}) {
    const out = [];
    for (let i = 0; i < count; i++) {
        const ang = rng() * Math.PI * 2;
        const spd = 40 + rng() * 120;
        out.push({
            x, y,
            vx: Math.cos(ang) * spd,
            vy: Math.sin(ang) * spd - 30,   // лёгкий подъём
            r: 1.5 + rng() * 3,
            life: 0.5 + rng() * 0.6,
            maxLife: 1,
            color,
            alpha: 0.7 + rng() * 0.3,
            type: opts.type || 'spark',
        });
    }
    return out;
}

/** Продвинуть частицу/рыбу/планктон на dt секунд. Возвращает true, если объект на экране. */
export function stepParticle(p, dt, w, h) {
    if (!p || dt <= 0) return true;
    const t = performance.now ? performance.now() / 1000 : 0;
    // Пузырёк: вверх + покачивание
    if (p.speed != null && p.sway != null && p.r != null) {
        p.y -= p.speed * dt;
        p.x += Math.sin(t * p.swaySpeed + p.swayPhase) * p.sway * dt;
        return p.y > -40;
    }
    // Рыба: горизонтально + лёгкое покачивание по вертикали
    if (p.len != null && p.dir != null) {
        p.x += p.dir * p.speed * dt;
        p.y += Math.sin(t * p.bobSpeed + p.bob) * 0.6 * dt * 60;
        return p.x > -220 && p.x < w + 220;
    }
    // Планктон: дрейф вверх + мерцание
    if (p.r != null && p.twinkleSpeed != null && p.speed != null) {
        p.y -= p.speed * dt;
        p.x += Math.sin(t * p.drift * 0.1 + p.phase) * 0.5 * dt * 60;
        return p.y > -20;
    }
    // Лепесток: вниз + покачивание
    if (p.size != null && p.sway != null && p.spin != null) {
        p.y += p.speed * dt;
        p.x += Math.sin(t * p.swaySpeed + p.swayPhase) * p.sway * dt;
        p.spin += (p.spinSpeed || 2) * dt;
        return p.y < h + 40;
    }
    // Медуза: медленное движение + пульс
    if (p.r != null && p.bobSpeed != null && p.pulse != null && p.pulseSpeed != null) {
        p.y -= p.speed * dt;
        p.x += Math.sin(t * p.bobSpeed + p.bob) * 0.3 * dt * 60;
        return p.y > -60;
    }
    // Светлячок / «удильщик»: медленный дрейф + мерцание с паузой
    if (p.drift != null && p.driftSpeed != null && p.period != null) {
        p.x += Math.sin(t * p.driftSpeed + p.phase) * p.drift * dt;
        p.y += Math.cos(t * p.driftSpeed * 0.7 + p.phase) * p.drift * 0.5 * dt;
        // мягко возвращаем в пределы экрана
        if (p.x < -20) p.x = w + 20;
        if (p.x > w + 20) p.x = -20;
        if (p.y < -20) p.y = h + 20;
        if (p.y > h + 20) p.y = -20;
        return true;
    }
    // Водоросль/лоза: закреплена у дна, только покачивается — всегда на экране
    if (p.height != null && p.swayAmp != null && p.segments != null) {
        return true;
    }
    // Коралл: закреплён у дна, только покачивается — всегда на экране
    if (p.height != null && p.swayAmp != null && p.branches != null) {
        return true;
    }
    // Световой луч / блик — без движения
    return true;
}

/**
 * Значение «пульса» (0..1) для визуального отклика:
 * плавно нарастает от pulseAt к 0 за duration сек.
 */
export function mergePulseValue(now, pulseAt, duration = 0.8) {
    if (!pulseAt) return 0;
    const t = (now - pulseAt) / 1000;
    if (t < 0 || t > duration) return 0;
    return 1 - t / duration;
}

/**
 * Вычислить «накал» геймплея (0..1) для визуальной атмосферы.
 * Чем опаснее/активнее партия — тем насыщеннее свет и быстрее вода.
 * Раньше функция жила в music.js (питала процедурную музыку) — после удаления
 * Web Audio-синтеза она нужна только «живому океану» и перенесена сюда.
 * @param {object} s { streak, movesWithoutMerge, maxWithoutMerge, tideLevel,
 *                     tideWarning, sharkActive, threatLevel }
 */
export function computeIntensity(s = {}) {
    let v = 0.35; // база — спокойное море
    // Серия слияний → драйв
    if (s.streak >= 3) v += 0.15;
    if (s.streak >= 5) v += 0.1;
    if (s.streak >= 8) v += 0.1;
    // Бесполезные ходы подряд (напряжение)
    const nm = s.movesWithoutMerge || 0;
    const mx = Math.max(1, s.maxWithoutMerge || 1);
    const ratio = Math.min(1, nm / mx);
    v += ratio * 0.25;
    // Прилив приближается
    if (s.tideLevel !== undefined && s.tideLevel > 0) v += Math.min(0.2, s.tideLevel * 0.05);
    // Акула на доске
    if (s.sharkActive) v += 0.15;
    // Угроза водоворота
    if (s.threatLevel) v += Math.min(0.15, s.threatLevel * 0.1);
    return Math.max(0, Math.min(1, v));
}

// ------------------------------------------------------------------
// 3. CANVAS-РЕНДЕР
// ------------------------------------------------------------------
/**
 * Живой океан: рисует фон по конфигу темы.
 * Слои: небо (градиент) → световые лучи → рыбы → планктон → пузыри → медузы → лепестки.
 * Реакция на геймплей: setIntensity(0..1), setPulse(kind), setFlow(скорость течения).
 */
export class OceanAtmosphere {
    constructor(canvas, { reduceMotion = false } = {}) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.reduceMotion = reduceMotion;
        this.theme = 'dark';
        this.intensity = 0.35;       // 0..1 — как у музыки
        this.flow = 0.35;            // скорость течения
        this.pulses = {};            // kind -> timestamp
        this.fish = [];
        this.plankton = [];
        this.bubbles = [];
        this.rays = [];
        this.jellies = [];
        this.leaves = [];
        this.shimmers = [];
        this.kelp = [];
        this.coral = [];
        this.fireflies = [];
        this.anglers = [];
        this.bursts = [];
        this.sharks = [];
        this.w = window.innerWidth;
        this.h = window.innerHeight;
        this.rafId = 0;
        this.lastT = 0;
        this._running = false;
        this.resize();
        window.addEventListener('resize', () => this.resize());
    }

    resize() {
        this.w = window.innerWidth;
        this.h = window.innerHeight;
        if (this.canvas) {
            this.canvas.width = this.w;
            this.canvas.height = this.h;
        }
    }

    /** Выбрать тему и пересоздать обитателей (декларативно, по счётчикам конфига). */
    setTheme(theme, size = 'desktop') {
        if (THEMES[theme]) this.theme = theme;
        const cfg = atmosphereConfigFor(this.theme, size);
        this.cfg = cfg;
        const rng = Math.random;
        // Сбрасываем все слои
        this.fish = [];
        this.plankton = [];
        this.bubbles = [];
        this.rays = [];
        this.jellies = [];
        this.leaves = [];
        this.shimmers = [];
        this.kelp = [];
        this.coral = [];
        this.fireflies = [];
        this.anglers = [];
        this.sharks = [];
        // Каждый слой включается только если его счётчик > 0 — так у тем
        // появляется собственная «сигнатура» (рыбы/пузыри/медузы/водоросли/кораллы/светлячки/удильщики).
        for (let i = 0; i < cfg.fishCount; i++) this.fish.push(makeFish(cfg, this.w, this.h, rng));
        for (let i = 0; i < cfg.planktonCount; i++) this.plankton.push(makePlankton(cfg, this.w, this.h, rng));
        for (let i = 0; i < cfg.bubbleCount; i++) this.bubbles.push(makeBubble(cfg, this.w, this.h, rng));
        for (let i = 0; i < cfg.rayCount; i++) this.rays.push(makeLightRay(cfg, this.w, this.h, rng));
        for (let i = 0; i < (cfg.shimmerCount || 0); i++) this.shimmers.push(makeShimmer(cfg, this.w, this.h, rng));
        for (let i = 0; i < (cfg.jellyCount || 0); i++) this.jellies.push(makeJelly(cfg, this.w, this.h, rng));
        for (let i = 0; i < (cfg.kelpCount || 0); i++) this.kelp.push(makeKelp(cfg, this.w, this.h, rng));
        for (let i = 0; i < (cfg.coralCount || 0); i++) this.coral.push(makeCoral(cfg, this.w, this.h, rng));
        for (let i = 0; i < (cfg.fireflyCount || 0); i++) this.fireflies.push(makeFirefly(cfg, this.w, this.h, rng));
        for (let i = 0; i < (cfg.anglerCount || 0); i++) this.anglers.push(makeAngler(cfg, this.w, this.h, rng));
        // Лепестки/листья — для «Сакура» и «Осень» (по эмодзи конфига)
        if (cfg.leafEmojis) {
            const n = this.theme === 'sakura' ? 12 : 10;
            for (let i = 0; i < n; i++) this.leaves.push(makeLeafParticle(cfg, this.w, this.h, rng));
        }
        // При reduce-motion анимационный цикл не запускается, поэтому рисуем
        // один статичный кадр темы сразу — иначе фон не менялся бы между темами
        // (пользователь видел бы только тёмный фон body для всех тем).
        if (this.reduceMotion) this.renderStatic();
    }

    /** Нарисовать один статичный кадр (для reduce-motion / мгновенного отклика). */
    renderStatic() {
        if (!this.ctx) return;
        this.draw(0, performance.now());
    }

    /** Геймплей → интенсивность 0..1 (общий темп/насыщенность). */
    setIntensity(v) {
        this.intensity = clamp(v, 0, 1);
    }

    /** Скорость течения 0..1 (серии ускоряют). */
    setFlow(v) {
        this.flow = clamp(v, 0, 1);
    }

    /** Пульс-событие: 'merge' | 'tide' | 'shark' | 'win' | 'gameover' | 'streak'. */
    setPulse(kind, at) {
        const now = at || performance.now();
        this.pulses[kind] = now;
        // Всплеск пузырьков/искр по центру при merge/win
        if (kind === 'merge' || kind === 'win' || kind === 'streak') {
            const color = kind === 'win' ? '255,215,0' : '255,255,255';
            const n = kind === 'win' ? 30 : 14;
            const rng = Math.random;
            this.bursts.push(...spawnBurst(this.w / 2, this.h / 2, n, color, rng));
        }
        if (kind === 'shark') {
            // Тревожный тёмный пульс
            this.pulses.shark = now;
        }
    }

    start() {
        if (this._running || this.reduceMotion) return;
        this._running = true;
        this.lastT = performance.now();
        this.rafId = requestAnimationFrame(t => this.tick(t));
    }

    stop() {
        this._running = false;
        if (this.rafId) cancelAnimationFrame(this.rafId);
        this.rafId = 0;
        if (this.ctx) this.ctx.clearRect(0, 0, this.w, this.h);
    }

    pause() {
        this._running = false;
        if (this.rafId) cancelAnimationFrame(this.rafId);
        this.rafId = 0;
    }

    resume() {
        if (this._running || this.reduceMotion) return;
        this._running = true;
        this.lastT = performance.now();
        this.rafId = requestAnimationFrame(t => this.tick(t));
    }

    tick(t) {
        if (!this._running) return;
        this.rafId = requestAnimationFrame(t2 => this.tick(t2));
        const dt = Math.min(0.05, (t - this.lastT) / 1000 || 0.016);
        this.lastT = t;
        this.draw(dt, t);
    }

    draw(dt, t) {
        const ctx = this.ctx, w = this.w, h = this.h;
        if (!ctx) return;
        const cfg = this.cfg || THEMES.dark;
        const now = t;

        // --- Небо: градиент темы ---
        const g = ctx.createLinearGradient(0, 0, 0, h);
        const skyA = cfg.sky[0], skyB = cfg.sky[1];
        g.addColorStop(0, skyA);
        g.addColorStop(1, skyB);
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);

        // --- «Дыхание» света: мягкое мерцающее свечение сверху (у всех тем) ---
        if (cfg.glow) {
            const breathe = 0.6 + 0.4 * Math.sin(t / 2600);
            const glowA = cfg.glow.replace(/[\d.]+\)$/, `${(0.7 * breathe).toFixed(3)})`);
            const gg = ctx.createRadialGradient(w * 0.5, -h * 0.15, 0, w * 0.5, -h * 0.15, h * 0.9);
            gg.addColorStop(0, glowA);
            gg.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.fillStyle = gg;
            ctx.fillRect(0, 0, w, h);
        }

        // --- Тревога акулы: тёмный красноватый пульс ---
        const sharkV = mergePulseValue(now, this.pulses.shark, 1.2);
        if (sharkV > 0.01) {
            ctx.fillStyle = `rgba(120,10,10,${sharkV * 0.35})`;
            ctx.fillRect(0, 0, w, h);
        }
        // --- Победа: золотой пульс ---
        const winV = mergePulseValue(now, this.pulses.win, 1.6);
        if (winV > 0.01) {
            ctx.fillStyle = `rgba(255,215,0,${winV * 0.18})`;
            ctx.fillRect(0, 0, w, h);
        }

        // --- Световые лучи (только если не reduce-motion) ---
        if (!this.reduceMotion) {
            for (const ray of this.rays) {
                const a = ray.alpha * (0.7 + 0.3 * Math.sin(t / 1000 * ray.speed + ray.phase));
                const rg = ctx.createLinearGradient(ray.x, 0, ray.x + ray.width, h);
                rg.addColorStop(0, cfg.rayColor.replace(/[\d.]+\)$/, `${a.toFixed(3)})`));
                rg.addColorStop(1, 'rgba(0,0,0,0)');
                ctx.fillStyle = rg;
                ctx.fillRect(ray.x, 0, ray.width, h);
            }
        }

        // --- Рыбы (силуэты) ---
        for (const f of this.fish) {
            stepParticle(f, dt, w, h);
            if (f.x > w + 220 || f.x < -220) { this.fish.splice(this.fish.indexOf(f), 1); this.fish.push(makeFish(cfg, w, h)); }
            const alpha = f.alpha * (0.6 + 0.4 * Math.sin(t / 1000 * f.bobSpeed + f.bob));
            ctx.globalAlpha = alpha;
            ctx.fillStyle = cfg.fishColor;
            ctx.beginPath();
            const len = f.len * (f.dir === 1 ? 1 : -1);
            ctx.moveTo(f.x - len / 2, f.y);
            ctx.lineTo(f.x + len / 2, f.y - len * 0.2);
            ctx.lineTo(f.x + len / 2, f.y + len * 0.2);
            ctx.closePath();
            ctx.fill();
            // хвост
            ctx.beginPath();
            ctx.moveTo(f.x - len / 2, f.y);
            ctx.lineTo(f.x - len / 2 - len * 0.35, f.y - len * 0.28);
            ctx.lineTo(f.x - len / 2 - len * 0.35, f.y + len * 0.28);
            ctx.closePath();
            ctx.fill();
        }
        ctx.globalAlpha = 1;

        // --- Фоновая акула (редкий силуэт в толще воды) ---
        if (cfg.shark && !this.reduceMotion) {
            // Редкий спавн: не чаще одной акулы одновременно
            if (this.sharks.length === 0 && Math.random() < cfg.shark.chance * dt * 60) {
                this.sharks.push(makeShark(cfg, w, h));
            }
            for (let i = this.sharks.length - 1; i >= 0; i--) {
                const sh = this.sharks[i];
                sh.x += sh.dir * sh.speed * dt;
                if (sh.dir === 1 && sh.x > w + 0.3 * w) { this.sharks.splice(i, 1); continue; }
                if (sh.dir === -1 && sh.x < -0.3 * w) { this.sharks.splice(i, 1); continue; }
                const bobY = sh.y + Math.sin(t / 1000 * sh.bobSpeed + sh.bob) * 10;
                this._drawShark(ctx, sh, bobY, t);
            }
            ctx.globalAlpha = 1;
        }

        // --- Планктон ---
        for (const p of this.plankton) {
            stepParticle(p, dt, w, h);
            if (p.y < -20) { this.plankton.splice(this.plankton.indexOf(p), 1); this.plankton.push(makePlankton(cfg, w, h)); }
            const tw = 0.5 + 0.5 * Math.sin(t / 1000 * p.twinkleSpeed + p.phase);
            ctx.globalAlpha = p.alpha * tw;
            ctx.fillStyle = cfg.plankton;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1;

        // --- Светящиеся пылинки (мерцающие «звёздочки» света) ---
        if (cfg.shimmer) {
            for (const s of this.shimmers) {
                const tw = 0.35 + 0.65 * Math.abs(Math.sin(t / 1000 * s.speed + s.phase));
                ctx.globalAlpha = s.alpha * tw;
                ctx.fillStyle = cfg.shimmer;
                ctx.beginPath();
                ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
                ctx.fill();
                // мягкий ореол вокруг ярких точек
                if (tw > 0.7) {
                    ctx.globalAlpha = s.alpha * tw * 0.25;
                    ctx.beginPath();
                    ctx.arc(s.x, s.y, s.r * 3, 0, Math.PI * 2);
                    ctx.fill();
                }
            }
            ctx.globalAlpha = 1;
        }

        // --- Пузыри ---
        for (const b of this.bubbles) {
            stepParticle(b, dt, w, h);
            if (b.y < -40) { this.bubbles.splice(this.bubbles.indexOf(b), 1); this.bubbles.push(makeBubble(cfg, w, h)); }
            ctx.globalAlpha = b.alpha;
            ctx.strokeStyle = cfg.bubble;
            ctx.lineWidth = 1.2;
            ctx.beginPath();
            ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
            ctx.stroke();
            // блик
            ctx.globalAlpha = b.alpha * 0.6;
            ctx.beginPath();
            ctx.arc(b.x - b.r * 0.3, b.y - b.r * 0.3, b.r * 0.25, 0, Math.PI * 2);
            ctx.fillStyle = cfg.bubble;
            ctx.fill();
        }
        ctx.globalAlpha = 1;

        // --- Медузы (светящиеся) ---
        for (const j of this.jellies) {
            stepParticle(j, dt, w, h);
            if (j.y < -60) { this.jellies.splice(this.jellies.indexOf(j), 1); this.jellies.push(makeJelly(cfg, w, h)); }
            const pulse = 0.5 + 0.5 * Math.sin(t / 1000 * j.pulseSpeed + j.pulse);
            ctx.globalAlpha = j.alpha * (0.5 + 0.5 * pulse);
            // Купол
            ctx.fillStyle = this.theme === 'sakura' ? 'rgba(255,180,220,.5)' : 'rgba(255,180,140,.45)';
            ctx.beginPath();
            ctx.ellipse(j.x, j.y, j.r * (0.8 + pulse * 0.2), j.r * 0.7, 0, 0, Math.PI * 2);
            ctx.fill();
            // Щупальца
            ctx.strokeStyle = this.theme === 'sakura' ? 'rgba(255,190,220,.4)' : 'rgba(255,190,140,.35)';
            ctx.lineWidth = 1;
            for (let i = -2; i <= 2; i++) {
                ctx.beginPath();
                ctx.moveTo(j.x + i * j.r * 0.3, j.y + j.r * 0.6);
                ctx.quadraticCurveTo(j.x + i * j.r * 0.4 + Math.sin(t / 500 + i) * 6, j.y + j.r * 1.4,
                                     j.x + i * j.r * 0.3 + Math.sin(t / 400 + i) * 10, j.y + j.r * 2);
                ctx.stroke();
            }
        }
        ctx.globalAlpha = 1;

        // --- Лепестки (сакура/осень) ---
        for (const l of this.leaves) {
            stepParticle(l, dt, w, h);
            if (l.y > h + 40) { this.leaves.splice(this.leaves.indexOf(l), 1); this.leaves.push(makeLeafParticle(cfg, w, h)); }
            ctx.globalAlpha = l.alpha;
            ctx.font = `${l.size}px "Segoe UI", sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(l.emoji, l.x, l.y);
        }
        ctx.globalAlpha = 1;

        // --- Всплески (bursts) ---
        for (let i = this.bursts.length - 1; i >= 0; i--) {
            const b = this.bursts[i];
            b.life -= dt;
            if (b.life <= 0) { this.bursts.splice(i, 1); continue; }
            b.x += b.vx * dt;
            b.y += b.vy * dt;
            b.vy += 60 * dt; // гравитация
            const fade = Math.max(0, b.life / b.maxLife);
            ctx.globalAlpha = b.alpha * fade;
            ctx.fillStyle = `rgba(${b.color},${(b.alpha * fade).toFixed(3)})`;
            ctx.beginPath();
            ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1;

        // --- Вода: затемнение снизу (глубина) ---
        const wg = ctx.createLinearGradient(0, h * 0.4, 0, h);
        wg.addColorStop(0, cfg.water[0]);
        wg.addColorStop(1, cfg.water[1]);
        ctx.fillStyle = wg;
        ctx.fillRect(0, 0, w, h);

        // --- Водоросли/лозы (сигнатура «Затонувшего леса»): колышутся у дна ---
        if (cfg.kelp) {
            for (const k of this.kelp) {
                stepParticle(k, dt, w, h);
                const sway = Math.sin(t / 1000 * k.speed + k.phase) * k.swayAmp;
                ctx.globalAlpha = k.alpha;
                ctx.strokeStyle = cfg.kelp;
                ctx.lineWidth = k.width;
                ctx.lineCap = 'round';
                const baseX = k.x + k.lean;
                const segH = k.height / k.segments;
                ctx.beginPath();
                ctx.moveTo(baseX, k.y);
                let px = baseX, py = k.y;
                for (let s = 1; s <= k.segments; s++) {
                    const nx = baseX + sway * Math.sin((s / k.segments) * Math.PI);
                    const ny = k.y - segH * s;
                    ctx.quadraticCurveTo(px, py - segH * 0.5, nx, ny);
                    px = nx; py = ny;
                }
                ctx.stroke();
                // узкий светлый блик по центру ленты
                ctx.globalAlpha = k.alpha * 0.5;
                ctx.lineWidth = k.width * 0.3;
                ctx.strokeStyle = 'rgba(255,255,255,.25)';
                ctx.beginPath();
                ctx.moveTo(baseX, k.y);
                px = baseX; py = k.y;
                for (let s = 1; s <= k.segments; s++) {
                    const nx = baseX + sway * Math.sin((s / k.segments) * Math.PI);
                    const ny = k.y - segH * s;
                    ctx.quadraticCurveTo(px, py - segH * 0.5, nx, ny);
                    px = nx; py = ny;
                }
                ctx.stroke();
            }
            // Рогоз/камышовые головки на верхушках (сигнатура «Осени»)
            if (cfg.kelpHeads) {
                for (const k of this.kelp) {
                    const sway = Math.sin(t / 1000 * k.speed + k.phase) * k.swayAmp;
                    const topX = k.x + k.lean + sway * Math.sin(Math.PI);
                    const topY = k.y - k.height;
                    ctx.globalAlpha = Math.min(1, k.alpha * 1.2);
                    ctx.fillStyle = 'rgba(120,70,30,.85)';
                    // продолговатая «шишка» рогоза
                    ctx.beginPath();
                    ctx.ellipse(topX, topY - k.width * 0.6, k.width * 0.5, k.width * 1.6, 0, 0, Math.PI * 2);
                    ctx.fill();
                    // светлый кончик
                    ctx.globalAlpha = Math.min(1, k.alpha * 0.9);
                    ctx.fillStyle = 'rgba(200,160,90,.7)';
                    ctx.beginPath();
                    ctx.ellipse(topX, topY - k.width * 2.0, k.width * 0.28, k.width * 0.7, 0, 0, Math.PI * 2);
                    ctx.fill();
                }
            }
            ctx.globalAlpha = 1;
        }

        // --- Кораллы (сигнатура «Лагуны»): ветвящиеся кусты у дна ---
        if (cfg.coral) {
            for (const c of this.coral) {
                stepParticle(c, dt, w, h);
                const sway = Math.sin(t / 1000 * c.speed + c.phase) * c.swayAmp;
                ctx.globalAlpha = c.alpha;
                ctx.lineCap = 'round';
                ctx.lineJoin = 'round';
                const baseX = c.x, baseY = c.y;
                const bh = c.height;
                // рисуем ветви от основания вверх с лёгким покачиванием
                for (let b = 0; b < c.branches; b++) {
                    const ang = -Math.PI / 2 + (b - (c.branches - 1) / 2) * 0.5; // веер вверх
                    const len = bh * (0.7 + (b % 2) * 0.3);
                    const tipX = baseX + Math.cos(ang) * len + sway * 0.5;
                    const tipY = baseY + Math.sin(ang) * len;
                    ctx.strokeStyle = c.color;
                    ctx.lineWidth = Math.max(2, c.width * 0.16);
                    ctx.beginPath();
                    ctx.moveTo(baseX, baseY);
                    ctx.quadraticCurveTo(baseX + Math.cos(ang) * len * 0.5 + sway * 0.3,
                                         baseY + Math.sin(ang) * len * 0.5,
                                         tipX, tipY);
                    ctx.stroke();
                    // округлая светлая верхушка ветви
                    ctx.globalAlpha = c.alpha * 0.9;
                    ctx.fillStyle = c.color;
                    ctx.beginPath();
                    ctx.arc(tipX, tipY, c.tipR, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.globalAlpha = c.alpha;
                }
            }
            ctx.globalAlpha = 1;
        }

        // --- Светлячки (сигнатура «Осени»/«Леса»): вспыхивают и гаснут с паузой ---
        if (cfg.fireflies) {
            for (const f of this.fireflies) {
                stepParticle(f, dt, w, h);
                // «вспышка с паузой»: пилообразный сигнал по периоду и duty
                const ph = ((t / 1000) % f.period) / f.period;
                const on = ph < f.duty;
                const local = on ? ph / f.duty : 0;
                const glow = on ? Math.sin(local * Math.PI) : 0; // 0..1..0 внутри активной фазы
                ctx.globalAlpha = f.alpha * (0.15 + 0.85 * glow);
                ctx.fillStyle = cfg.fireflies;
                ctx.beginPath();
                ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2);
                ctx.fill();
                // мягкий ореол вокруг вспышки
                if (glow > 0.3) {
                    ctx.globalAlpha = f.alpha * glow * 0.35;
                    ctx.beginPath();
                    ctx.arc(f.x, f.y, f.r * 4, 0, Math.PI * 2);
                    ctx.fill();
                }
            }
            ctx.globalAlpha = 1;
        }

        // --- Биолюминесцентные «удильщики» (сигнатура «Бездны»): крупные точки с ореолом ---
        if (cfg.anglers) {
            for (const a of this.anglers) {
                stepParticle(a, dt, w, h);
                const ph = ((t / 1000) % a.period) / a.period;
                const on = ph < a.duty;
                const local = on ? ph / a.duty : 0;
                const glow = on ? Math.sin(local * Math.PI) : 0;
                // широкий холодный ореол
                ctx.globalAlpha = a.alpha * (0.2 + 0.6 * glow);
                ctx.fillStyle = cfg.anglers;
                ctx.beginPath();
                ctx.arc(a.x, a.y, a.r * 5, 0, Math.PI * 2);
                ctx.fill();
                // яркое ядро
                ctx.globalAlpha = a.alpha * (0.4 + 0.6 * glow);
                ctx.beginPath();
                ctx.arc(a.x, a.y, a.r, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.globalAlpha = 1;
        }
    }

    /**
     * Нарисовать реалистичный силуэт акулы в профиль (фоновая, часть A).
     * Тело-торпеда, спинной плавник, хвост с лопастями, грудной плавник,
     * светлое брюхо и глаз. Ориентируется по направлению движения (dir).
     */
    _drawShark(ctx, sh, y, t) {
        const w = this.w;
        const len = Math.max(60, w * 0.16 * sh.scale);   // длина тела
        const bodyH = len * 0.22;                        // высота тела
        const dir = sh.dir;
        // Покачивание хвоста (волна)
        const tailWag = Math.sin(t / 300 + sh.phase) * 0.35;
        ctx.save();
        ctx.translate(sh.x, y);
        ctx.scale(dir, 1);                               // разворот по направлению
        ctx.globalAlpha = sh.alpha;

        // --- Хвост (две лопасти) ---
        ctx.fillStyle = sh.tint;
        ctx.beginPath();
        ctx.moveTo(-len * 0.42, 0);
        ctx.lineTo(-len * 0.62, -bodyH * 0.7 - tailWag * bodyH * 0.4);
        ctx.lineTo(-len * 0.55, 0);
        ctx.lineTo(-len * 0.62, bodyH * 0.7 + tailWag * bodyH * 0.4);
        ctx.closePath();
        ctx.fill();

        // --- Тело (торпеда) ---
        ctx.beginPath();
        ctx.moveTo(len * 0.5, 0);                        // нос
        ctx.quadraticCurveTo(len * 0.42, -bodyH, -len * 0.1, -bodyH * 0.85);
        ctx.quadraticCurveTo(-len * 0.42, -bodyH * 0.6, -len * 0.45, 0);
        ctx.quadraticCurveTo(-len * 0.42, bodyH * 0.6, -len * 0.1, bodyH * 0.85);
        ctx.quadraticCurveTo(len * 0.42, bodyH, len * 0.5, 0);
        ctx.closePath();
        ctx.fill();

        // --- Спинной плавник ---
        ctx.beginPath();
        ctx.moveTo(-len * 0.02, -bodyH * 0.7);
        ctx.lineTo(-len * 0.12, -bodyH * 1.7);
        ctx.lineTo(-len * 0.28, -bodyH * 0.75);
        ctx.closePath();
        ctx.fill();

        // --- Грудной плавник ---
        ctx.beginPath();
        ctx.moveTo(len * 0.02, bodyH * 0.3);
        ctx.quadraticCurveTo(-len * 0.05, bodyH * 1.1, -len * 0.2, bodyH * 0.9);
        ctx.quadraticCurveTo(-len * 0.08, bodyH * 0.5, -len * 0.02, bodyH * 0.3);
        ctx.closePath();
        ctx.fill();

        // --- Светлое брюхо ---
        ctx.globalAlpha = sh.alpha * 0.7;
        ctx.fillStyle = sh.belly;
        ctx.beginPath();
        ctx.moveTo(len * 0.42, bodyH * 0.35);
        ctx.quadraticCurveTo(-len * 0.05, bodyH * 0.95, -len * 0.4, bodyH * 0.35);
        ctx.quadraticCurveTo(-len * 0.3, bodyH * 0.15, len * 0.3, bodyH * 0.15);
        ctx.closePath();
        ctx.fill();

        // --- Жабры (дуги) ---
        ctx.globalAlpha = sh.alpha * 0.8;
        ctx.strokeStyle = sh.tint;
        ctx.lineWidth = Math.max(1, bodyH * 0.06);
        for (let i = 0; i < 3; i++) {
            const gx = len * 0.12 - i * len * 0.05;
            ctx.beginPath();
            ctx.moveTo(gx, -bodyH * 0.5);
            ctx.quadraticCurveTo(gx + len * 0.02, 0, gx, bodyH * 0.5);
            ctx.stroke();
        }

        // --- Глаз ---
        ctx.globalAlpha = sh.alpha;
        ctx.fillStyle = '#0a0a0a';
        ctx.beginPath();
        ctx.arc(len * 0.3, -bodyH * 0.28, Math.max(1.5, bodyH * 0.09), 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }
}
