// ============================================================================
// Зрелищные визуализации существующих событий и механик.
//
// Единый движок «киношного оверлея» поверх доски (паттерн атаки акулы, часть B):
// один полноэкранный canvas (z-index 5000, pointer-events: none), который по
// имени эффекта гонит таймлайн процедурной графики. Логика событий уже применена
// в game.js — здесь только визуализация (вихрь, медузы, пузырь, волна, воронка).
//
// Модуль содержит чистые функции отрисовки (легко тестировать) и класс-движок
// EffectPlayer, который управляет canvas-оверлеем и requestAnimationFrame.
// ============================================================================

// --- Утилиты ---------------------------------------------------------------

/** Линейная интерполяция. */
export function lerp(a, b, t) {
    return a + (b - a) * t;
}

/** Плавное затухание (ease-out cubic). */
export function easeOut(t) {
    return 1 - Math.pow(1 - Math.max(0, Math.min(1, t)), 3);
}

/** Плавное появление (ease-in cubic). */
export function easeIn(t) {
    const c = Math.max(0, Math.min(1, t));
    return c * c * c;
}

/** Плавное появление-затухание (ease-in-out). */
export function easeInOut(t) {
    const c = Math.max(0, Math.min(1, t));
    return c < 0.5 ? 4 * c * c * c : 1 - Math.pow(-2 * c + 2, 3) / 2;
}

/** Ограничить значение диапазоном [min, max]. */
export function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
}

/** Псевдослучайное число из сида (детерминированно, для стабильных кадров). */
export function seeded(seed) {
    let s = seed >>> 0;
    return () => {
        // xorshift32
        s ^= s << 13;
        s >>>= 0;
        s ^= s >> 17;
        s >>>= 0;
        s ^= s << 5;
        s >>>= 0;
        return (s >>> 0) / 4294967296;
    };
}

// --- Палитры эффектов (согласованы с темами океана) ------------------------

// Каждый эффект получает палитру под активную тему. По умолчанию — «тёмная вода».
const PALETTES = {
    storm: {
        base: 'rgba(20,40,70,ALPHA)',
        swirl: 'rgba(120,180,255,ALPHA)',
        foam: 'rgba(220,240,255,ALPHA)',
        accent: 'rgba(150,210,255,ALPHA)',
    },
    jelly: {
        base: 'rgba(90,40,120,ALPHA)',
        dome: 'rgba(210,150,255,ALPHA)',
        glow: 'rgba(240,200,255,ALPHA)',
        accent: 'rgba(180,120,255,ALPHA)',
    },
    bubble: {
        base: 'rgba(120,200,255,ALPHA)',
        ring: 'rgba(200,240,255,ALPHA)',
        shine: 'rgba(255,255,255,ALPHA)',
        accent: 'rgba(160,220,255,ALPHA)',
    },
    tide: {
        base: 'rgba(30,90,150,ALPHA)',
        wave: 'rgba(80,170,230,ALPHA)',
        foam: 'rgba(235,250,255,ALPHA)',
        accent: 'rgba(140,210,255,ALPHA)',
    },
    whirlpool: {
        base: 'rgba(10,20,50,ALPHA)',
        swirl: 'rgba(60,120,200,ALPHA)',
        foam: 'rgba(200,230,255,ALPHA)',
        accent: 'rgba(90,160,240,ALPHA)',
    },
};

/** Подставить ALPHA в палитру. */
function pal(name, alpha) {
    const p = PALETTES[name] || PALETTES.storm;
    const out = {};
    for (const k of Object.keys(p)) {
        out[k] = p[k].replace('ALPHA', String(alpha));
    }
    return out;
}

// --- Отрисовка эффектов -----------------------------------------------------
// Каждая функция: draw(ctx, t, W, H, opts)
//   t  — нормализованное время 0..1
//   W,H — размеры сцены (CSS-пиксели)
//   opts — { cx, cy, radius, seed, ... } геометрия/настройки

/**
 * 🌪️ Шторм — «Ураганный вихрь».
 * Затемнение краёв → в центре доски закручивается воронка из спиральных линий и
 * брызг → вихрь рассеивается.
 */
export function drawStorm(ctx, t, W, H, opts) {
    const cx = opts.cx;
    const cy = opts.cy;
    const R = opts.radius;
    const c = pal('storm', 1);

    // 1) Виньетка-затемнение по краям (нарастает и спадает).
    const vig = Math.sin(Math.min(1, t) * Math.PI) * 0.5;
    const vg = ctx.createRadialGradient(cx, cy, R * 0.3, cx, cy, Math.max(W, H) * 0.75);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, `rgba(5,15,35,${0.55 * vig})`);
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, W, H);

    // 2) Вращающиеся спиральные дуги (воронка).
    const spin = t * 6; // обороты
    const grow = easeInOut(clamp(t * 1.6, 0, 1)); // воронка растёт в начале
    const fade = 1 - easeIn(clamp((t - 0.7) / 0.3, 0, 1)); // рассеивание в конце
    const swirlA = fade * (0.35 + 0.3 * grow);
    ctx.strokeStyle = c.swirl;
    ctx.lineWidth = 2;
    for (let ring = 0; ring < 5; ring++) {
        const rr = R * (0.15 + ring * 0.2) * grow;
        ctx.beginPath();
        for (let a = 0; a <= Math.PI * 2 + 0.2; a += 0.12) {
            const wob = Math.sin(a * 3 + spin + ring) * rr * 0.08;
            const x = cx + Math.cos(a + spin * 0.4) * (rr + wob);
            const y = cy + Math.sin(a + spin * 0.4) * (rr + wob) * 0.7;
            if (a === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.globalAlpha = swirlA * (1 - ring / 6);
        ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // 3) Брызги-частицы, разлетающиеся по спирали.
    const rng = seeded(opts.seed || 7);
    const n = 40;
    for (let i = 0; i < n; i++) {
        const ang = rng() * Math.PI * 2;
        const dist = R * (0.1 + rng() * 0.9);
        const ph = rng() * Math.PI * 2;
        const rad = dist * grow;
        const x = cx + Math.cos(ang + spin * 0.5 + ph) * rad;
        const y = cy + Math.sin(ang + spin * 0.5 + ph) * rad * 0.7;
        const sz = 1 + rng() * 3;
        ctx.globalAlpha = fade * (0.4 + rng() * 0.5);
        ctx.fillStyle = c.foam;
        ctx.beginPath();
        ctx.arc(x, y, sz, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.globalAlpha = 1;
}

/**
 * 🪼 Медузий дождь — «Рой медуз».
 * Сверху опускаются полупрозрачные медузы (купол + щупальца), мягко покачиваясь.
 */
export function drawJelly(ctx, t, W, H, opts) {
    const c = pal('jelly', 1);
    const rng = seeded(opts.seed || 11);
    const n = opts.count || 8;

    // Лёгкое затемнение неба сверху.
    const dark = Math.sin(Math.min(1, t) * Math.PI) * 0.35;
    const dg = ctx.createLinearGradient(0, 0, 0, H);
    dg.addColorStop(0, `rgba(20,10,40,${dark})`);
    dg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = dg;
    ctx.fillRect(0, 0, W, H);

    // Каждая медуза: фиксированная горизонталь, падает сверху вниз с покачиванием.
    for (let i = 0; i < n; i++) {
        const x = (rng() * 0.8 + 0.1) * W;
        const speed = 0.5 + rng() * 0.5;
        const delay = rng() * 0.4;
        const prog = clamp((t - delay) / speed, 0, 1);
        if (prog <= 0 || prog >= 1) continue;
        const y = -40 + prog * (H + 80);
        const size = (0.02 + rng() * 0.03) * Math.min(W, H);
        const sway = Math.sin(t * 4 + i * 2) * size * 0.6;
        const alpha = Math.sin(prog * Math.PI) * 0.8;

        ctx.save();
        ctx.translate(x + sway, y);
        ctx.globalAlpha = alpha;

        // Купол-полусфера.
        const dome = ctx.createRadialGradient(0, -size * 0.2, size * 0.1, 0, 0, size);
        dome.addColorStop(0, c.glow);
        dome.addColorStop(1, c.dome);
        ctx.fillStyle = dome;
        ctx.beginPath();
        ctx.arc(0, 0, size, Math.PI, 0);
        ctx.closePath();
        ctx.fill();

        // Щупальца (волнистые линии).
        ctx.strokeStyle = c.accent;
        ctx.lineWidth = Math.max(1, size * 0.06);
        const tentacles = 5;
        for (let k = 0; k < tentacles; k++) {
            const tx = -size * 0.7 + (k / (tentacles - 1)) * size * 1.4;
            ctx.beginPath();
            ctx.moveTo(tx, 0);
            for (let s = 0; s <= 1; s += 0.1) {
                const yy = s * size * 1.4;
                const xx = tx + Math.sin(s * 6 + t * 5 + k) * size * 0.18;
                ctx.lineTo(xx, yy);
            }
            ctx.stroke();
        }
        ctx.restore();
    }
    ctx.globalAlpha = 1;
}

/**
 * 🫧 Пузырь — «Пузырь удачи».
 * Растущий мыльный пузырь с радужным переливом вокруг целевой плитки, затем лопание.
 */
export function drawBubble(ctx, t, W, H, opts) {
    const cx = opts.cx;
    const cy = opts.cy;
    const R = opts.radius;
    const c = pal('bubble', 1);

    // Фазы: 0-0.6 рост, 0.6-0.8 перелив, 0.8-1 лопание.
    const grow = easeOut(clamp(t / 0.6, 0, 1));
    const pop = clamp((t - 0.8) / 0.2, 0, 1);
    const r = R * (0.3 + grow * 0.7) * (1 - pop * 0.4);

    // Мягкое свечение вокруг.
    const glow = ctx.createRadialGradient(cx, cy, r * 0.2, cx, cy, r * 1.4);
    glow.addColorStop(0, `rgba(200,240,255,${0.25 * (1 - pop)})`);
    glow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(cx - r * 1.5, cy - r * 1.5, r * 3, r * 3);

    // Оболочка пузыря (радужный перелив через hue-вращение).
    const hue = (t * 360) % 360;
    ctx.strokeStyle = `hsla(${hue}, 90%, 80%, ${0.9 * (1 - pop)})`;
    ctx.lineWidth = Math.max(2, r * 0.06);
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();

    // Внутренняя полупрозрачная плёнка.
    const film = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.3, r * 0.1, cx, cy, r);
    film.addColorStop(0, `hsla(${(hue + 60) % 360}, 90%, 85%, ${0.25 * (1 - pop)})`);
    film.addColorStop(1, `hsla(${hue}, 80%, 70%, ${0.1 * (1 - pop)})`);
    ctx.fillStyle = film;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();

    // Блик-«зайчик».
    ctx.fillStyle = c.shine;
    ctx.globalAlpha = 0.8 * (1 - pop);
    ctx.beginPath();
    ctx.ellipse(cx - r * 0.35, cy - r * 0.4, r * 0.12, r * 0.07, -0.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    // Лопание: кольцо + капли.
    if (pop > 0) {
        const ringR = r + pop * R * 1.2;
        ctx.strokeStyle = c.ring;
        ctx.globalAlpha = (1 - pop) * 0.9;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(cx, cy, ringR, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;

        const rng = seeded(opts.seed || 3);
        for (let i = 0; i < 12; i++) {
            const ang = (i / 12) * Math.PI * 2 + rng() * 0.3;
            const d = r + pop * R * (0.5 + rng() * 0.8);
            const x = cx + Math.cos(ang) * d;
            const y = cy + Math.sin(ang) * d;
            ctx.globalAlpha = (1 - pop) * 0.8;
            ctx.fillStyle = c.shine;
            ctx.beginPath();
            ctx.arc(x, y, 1.5 + rng() * 2, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1;
    }
}

/**
 * 🌊 Прилив/Отлив — «Волна».
 * Полупрозрачный гребень-волна прокатывается по доске (сверху вниз = прилив,
 * снизу вверх = отлив), с белой пеной по кромке.
 */
export function drawTide(ctx, t, W, H, opts) {
    const c = pal('tide', 1);
    const dir = opts.dir === 'up' ? -1 : 1; // up = отлив (вверх), down = прилив
    const prog = easeInOut(clamp(t * 1.4, 0, 1));
    const fade = Math.sin(Math.min(1, t) * Math.PI);

    // Позиция гребня волны.
    const y0 = dir === 1 ? -H * 0.2 : H * 1.2;
    const y1 = dir === 1 ? H * 1.2 : -H * 0.2;
    const crestY = lerp(y0, y1, prog);

    // Полоса воды позади гребня.
    const bandH = H * 0.5;
    const bandTop = dir === 1 ? crestY - bandH : crestY;
    const wg = ctx.createLinearGradient(0, bandTop, 0, bandTop + bandH);
    wg.addColorStop(0, c.wave);
    wg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = wg;
    ctx.globalAlpha = 0.5 * fade;
    ctx.fillRect(0, bandTop, W, bandH);
    ctx.globalAlpha = 1;

    // Гребень с пеной (синусоида по горизонтали).
    ctx.strokeStyle = c.foam;
    ctx.lineWidth = 3;
    ctx.globalAlpha = 0.9 * fade;
    ctx.beginPath();
    for (let x = 0; x <= W; x += 6) {
        const yy = crestY + Math.sin(x * 0.02 + t * 6) * 8;
        if (x === 0) ctx.moveTo(x, yy);
        else ctx.lineTo(x, yy);
    }
    ctx.stroke();

    // Вторая линия пены (позади).
    ctx.globalAlpha = 0.5 * fade;
    ctx.beginPath();
    for (let x = 0; x <= W; x += 8) {
        const yy = crestY + 14 + Math.sin(x * 0.015 + t * 5 + 2) * 6;
        if (x === 0) ctx.moveTo(x, yy);
        else ctx.lineTo(x, yy);
    }
    ctx.stroke();
    ctx.globalAlpha = 1;

    // Капли-брызги над гребнем.
    const rng = seeded(opts.seed || 5);
    for (let i = 0; i < 30; i++) {
        const x = rng() * W;
        const yy = crestY - rng() * 30 - Math.sin(x * 0.02 + t * 6) * 8;
        ctx.globalAlpha = fade * (0.3 + rng() * 0.5);
        ctx.fillStyle = c.foam;
        ctx.beginPath();
        ctx.arc(x, yy, 1 + rng() * 2, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.globalAlpha = 1;
}

/**
 * 🌀 Водоворот — «Воронка».
 * Нарастающее вращение концентрических эллипсов, сужающихся к центру; плитки
 * затягиваются по спирали и гаснут; воронка схлопывается.
 */
export function drawWhirlpool(ctx, t, W, H, opts) {
    const cx = opts.cx;
    const cy = opts.cy;
    const R = opts.radius;
    const c = pal('whirlpool', 1);

    // Фазы: 0-0.5 нарастание, 0.5-0.85 затягивание, 0.85-1 схлопывание.
    const grow = easeInOut(clamp(t / 0.5, 0, 1));
    const suck = clamp((t - 0.5) / 0.35, 0, 1);
    const collapse = easeIn(clamp((t - 0.85) / 0.15, 0, 1));
    const fade = 1 - collapse;

    // Тёмная глубина в центре.
    const depth = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * grow);
    depth.addColorStop(0, `rgba(5,10,30,${0.7 * fade})`);
    depth.addColorStop(0.6, `rgba(10,20,50,${0.4 * fade})`);
    depth.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = depth;
    ctx.fillRect(cx - R, cy - R, R * 2, R * 2);

    // Вращающиеся концентрические эллипсы (сужаются к центру).
    const spin = t * 8;
    const rings = 7;
    for (let i = 0; i < rings; i++) {
        const rr = R * (0.15 + (i / rings) * 0.85) * grow * (1 - collapse * 0.6);
        const squash = 0.55 + (i / rings) * 0.25; // ближе к краю — круглее
        ctx.strokeStyle = c.swirl;
        ctx.globalAlpha = fade * (0.5 - (i / rings) * 0.3);
        ctx.lineWidth = 1.5 + (i / rings) * 2;
        ctx.beginPath();
        ctx.ellipse(cx, cy, rr, rr * squash, spin * (0.3 + (i / rings) * 0.5), 0, Math.PI * 2);
        ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // Частицы-плитки, затягиваемые по спирали к центру и гаснущие.
    const rng = seeded(opts.seed || 13);
    const n = 26;
    for (let i = 0; i < n; i++) {
        const ang0 = rng() * Math.PI * 2;
        const dist0 = R * (0.2 + rng() * 0.8);
        // По мере suck частица приближается к центру по спирали.
        const k = easeIn(clamp(suck * 1.4 - rng() * 0.3, 0, 1));
        const ang = ang0 + spin * 0.6 + k * 4;
        const dist = dist0 * (1 - k) * grow;
        const x = cx + Math.cos(ang) * dist;
        const y = cy + Math.sin(ang) * dist * 0.7;
        const sz = (1 + rng() * 2.5) * (1 - k * 0.6);
        ctx.globalAlpha = fade * (0.6 - k * 0.5) * (0.4 + rng() * 0.5);
        ctx.fillStyle = c.foam;
        ctx.beginPath();
        ctx.arc(x, y, Math.max(0.5, sz), 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.globalAlpha = 1;
}

// --- Реестр эффектов --------------------------------------------------------

export const EFFECTS = {
    storm:     { duration: 1.4, draw: drawStorm },
    jelly:     { duration: 1.2, draw: drawJelly },
    bubble:    { duration: 1.0, draw: drawBubble },
    tide:      { duration: 1.5, draw: drawTide },
    whirlpool: { duration: 1.6, draw: drawWhirlpool },
};

// --- Класс-движок -----------------------------------------------------------

/**
 * Управляет одним полноэкранным canvas-оверлеем и гонит таймлайн эффекта.
 *
 * Использование:
 *   const player = new EffectPlayer(canvasEl, ctx, { reduceMotion });
 *   player.play('storm', boardEl, () => { /* после эффекта *\/ });
 */
export class EffectPlayer {
    /**
     * @param {HTMLCanvasElement} canvas  canvas-оверлей на весь экран
     * @param {CanvasRenderingContext2D} ctx 2d-контекст canvas
     * @param {object} opts { reduceMotion: boolean }
     */
    constructor(canvas, ctx, opts = {}) {
        this.canvas = canvas;
        this.ctx = ctx;
        this.reduceMotion = !!opts.reduceMotion;
        this.busy = false;
        this._raf = 0;
    }

    /**
     * Запустить эффект по имени.
     * @param {string} name  ключ из EFFECTS
     * @param {HTMLElement} boardEl  элемент доски (для геометрии центра)
     * @param {Function} done  колбэк по завершении
     * @param {object} extra  доп. параметры (dir для прилива/отлива, count и т.п.)
     */
    play(name, boardEl, done, extra = {}) {
        const def = EFFECTS[name];
        if (!def) { if (done) done(); return; }
        if (this.busy) { if (done) done(); return; }
        if (this.reduceMotion) { if (done) done(); return; }

        this.busy = true;
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const dpr = Math.min(2, window.devicePixelRatio || 1);

        this.canvas.width = vw * dpr;
        this.canvas.height = vh * dpr;
        this.canvas.style.width = vw + 'px';
        this.canvas.style.height = vh + 'px';
        this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

        // Геометрия: центр доски + радиус под доску.
        const br = boardEl ? boardEl.getBoundingClientRect() : { left: vw / 2, top: vh / 2, width: vw * 0.6, height: vh * 0.6 };
        const cx = br.left + br.width / 2;
        const cy = br.top + br.height / 2;
        const radius = Math.max(br.width, br.height) * 0.62;
        const opts = Object.assign({ cx, cy, radius, seed: Math.floor(Math.random() * 100000) }, extra);

        const layer = this.canvas.parentElement;
        if (layer) layer.classList.add('active');

        const T0 = performance.now();
        const DUR = def.duration * 1000;

        const frame = () => {
            const t = Math.min(1, (performance.now() - T0) / DUR);
            const ctx = this.ctx;
            ctx.clearRect(0, 0, vw, vh);
            def.draw(ctx, t, vw, vh, opts);
            if (t < 1) {
                this._raf = requestAnimationFrame(frame);
            } else {
                this._finish(layer, done);
            }
        };
        this._raf = requestAnimationFrame(frame);
    }

    /** Остановить текущий эффект (например, при смене сцены). */
    cancel() {
        if (this._raf) cancelAnimationFrame(this._raf);
        this._raf = 0;
        const layer = this.canvas.parentElement;
        if (layer) layer.classList.remove('active');
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.busy = false;
    }

    _finish(layer, done) {
        this._raf = 0;
        if (layer) layer.classList.remove('active');
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.busy = false;
        if (done) done();
    }
}
