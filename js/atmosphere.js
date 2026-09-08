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
    dark: {
        label: 'Лагуна',
        sky: ['#062c44', '#0b4b6f'],        // тёмная вода, свет сверху
        water: ['rgba(6,44,68,.0)', 'rgba(2,18,34,.55)'],
        rayColor: 'rgba(140,220,255,.14)',
        fishColor: 'rgba(20,60,85,.6)',
        plankton: 'rgba(180,220,255,.4)',
        bubble: 'rgba(255,255,255,.22)',
        // Глубина океана: стайки рыб, планктон, лучи
        fishCount: 8, planktonCount: 40, rayCount: 5, bubbleCount: 10,
    },
    light: {
        label: 'Лагуна',
        sky: ['#a8dce6', '#d7f2f7'],        // светлая вода
        water: ['rgba(255,255,255,.0)', 'rgba(0,184,212,.08)'],
        rayColor: 'rgba(255,255,255,.3)',
        fishColor: 'rgba(0,120,160,.5)',
        plankton: 'rgba(0,140,170,.3)',
        bubble: 'rgba(255,255,255,.5)',
        fishCount: 12, planktonCount: 30, rayCount: 7, bubbleCount: 8,
    },
    autumn: {
        label: 'Осень',
        sky: ['#7a3b12', '#c96f2a'],        // тёплая вода
        water: ['rgba(120,50,10,.0)', 'rgba(70,30,4,.45)'],
        rayColor: 'rgba(255,200,120,.2)',
        fishColor: 'rgba(140,80,20,.6)',
        plankton: 'rgba(255,200,120,.35)',
        bubble: 'rgba(255,220,170,.3)',
        leafEmojis: ['🍁', '🍂', '🍃'],     // осенние листья в «живом океане»
        fishCount: 7, planktonCount: 35, rayCount: 6, bubbleCount: 6,
    },
    forest: {
        label: 'Затонувший лес',
        sky: ['#1b4d3a', '#0e2b1f'],        // тёмная зелёная вода
        water: ['rgba(10,40,28,.0)', 'rgba(3,18,12,.5)'],
        rayColor: 'rgba(160,255,200,.16)',
        fishColor: 'rgba(30,90,60,.7)',
        plankton: 'rgba(140,255,180,.3)',
        bubble: 'rgba(180,255,200,.25)',
        fishCount: 9, planktonCount: 45, rayCount: 8, bubbleCount: 10,
    },
    sunset: {
        label: 'Закат',
        sky: ['#4a1a4e', '#d44a3a'],        // розово-оранжевая вода
        water: ['rgba(90,20,40,.0)', 'rgba(40,8,20,.5)'],
        rayColor: 'rgba(255,180,140,.25)',
        fishColor: 'rgba(150,50,80,.6)',
        plankton: 'rgba(255,200,180,.4)',
        bubble: 'rgba(255,200,180,.3)',
        fishCount: 6, planktonCount: 30, rayCount: 7, bubbleCount: 7,
    },
    abyss: {
        label: 'Бездна',
        sky: ['#04101f', '#0a2a3f'],        // самая глубина
        water: ['rgba(0,6,16,.0)', 'rgba(0,2,8,.6)'],
        rayColor: 'rgba(0,180,255,.08)',
        fishColor: 'rgba(10,40,60,.5)',
        plankton: 'rgba(120,220,255,.5)',
        bubble: 'rgba(180,240,255,.3)',
        fishCount: 5, planktonCount: 55, rayCount: 4, bubbleCount: 9,
    },
    sakura: {
        label: 'Сакура',
        sky: ['#5c2a5e', '#b45a8c'],        // розовая вода
        water: ['rgba(80,20,60,.0)', 'rgba(50,10,40,.5)'],
        rayColor: 'rgba(255,180,220,.22)',
        fishColor: 'rgba(160,70,110,.6)',
        plankton: 'rgba(255,190,220,.4)',
        bubble: 'rgba(255,220,240,.3)',
        fishCount: 8, planktonCount: 38, rayCount: 6, bubbleCount: 8,
    },
};

// Лимиты частиц (снижаем на маленьких экранах / low-end)
export const DENSITY_LIMITS = {
    fish: 14, plankton: 60, ray: 10, bubble: 16,
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
    base.fishCount = Math.round((base.fishCount || 0) * mult);
    base.planktonCount = Math.round((base.planktonCount || 0) * mult);
    base.rayCount = Math.round((base.rayCount || 0) * mult);
    base.bubbleCount = Math.round((base.bubbleCount || 0) * mult);
    // Применяем лимиты
    ['fishCount', 'planktonCount', 'rayCount', 'bubbleCount'].forEach(k => {
        const limit = DENSITY_LIMITS[k.replace('Count', '')];
        base[k] = Math.min(base[k], limit);
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
        this.bursts = [];
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

    /** Выбрать тему и пересоздать обитателей. */
    setTheme(theme, size = 'desktop') {
        if (THEMES[theme]) this.theme = theme;
        const cfg = atmosphereConfigFor(this.theme, size);
        this.cfg = cfg;
        const rng = Math.random;
        this.fish = [];
        this.plankton = [];
        this.bubbles = [];
        this.rays = [];
        this.jellies = [];
        this.leaves = [];
        for (let i = 0; i < cfg.fishCount; i++) this.fish.push(makeFish(cfg, this.w, this.h, rng));
        for (let i = 0; i < cfg.planktonCount; i++) this.plankton.push(makePlankton(cfg, this.w, this.h, rng));
        for (let i = 0; i < cfg.bubbleCount; i++) this.bubbles.push(makeBubble(cfg, this.w, this.h, rng));
        for (let i = 0; i < cfg.rayCount; i++) this.rays.push(makeLightRay(cfg, this.w, this.h, rng));
        // Медузы — только для темы «Закат» и «Сакура» (светящиеся)
        if (this.theme === 'sunset' || this.theme === 'sakura') {
            for (let i = 0; i < 3; i++) this.jellies.push(makeJelly(cfg, this.w, this.h, rng));
        }
        // Лепестки/листья — для «Сакура» и «Осень»
        if (this.theme === 'sakura' || this.theme === 'autumn') {
            const n = this.theme === 'sakura' ? 12 : 10;
            for (let i = 0; i < n; i++) this.leaves.push(makeLeafParticle(cfg, this.w, this.h, rng));
        }
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
    }
}
