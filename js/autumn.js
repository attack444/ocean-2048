// ======================== Осень: падающие листья (pure, testable) ========================
// Чистые функции генерации и движения листьев без DOM — используются канвас-слоем
// из main.js. Конвенция проекта: механика в модулях js/, UI/оркестрация в main.js.

/** Варианты листьев (эмодзи отрисовываются на канвасе текстом). */
export const LEAVES = ['🍁', '🍂', '🍃', '🌿'];

/** Параметры анимации по умолчанию. */
export const AUTUMN_OPTIONS = {
    count: 14,        // число листьев на экране
    minSpeedY: 15,    // мин. скорость падения, px/с
    maxSpeedY: 42,    // макс. скорость падения, px/с
    minSize: 18,      // мин. размер листа, px
    maxSize: 34,      // макс. размер листа, px
    drift: 26,        // амплитуда покачивания по X, px/с
    spin: 0.6,        // скорость вращения фазы покачивания, рад/с
    opacityMin: 0.55, // мин. прозрачность
};

/** Осенний сезон: с августа (старт акции) по ноябрь включительно (месяцы 7–10). */
export function isAutumnSeason(date = new Date()) {
    const m = date.getMonth();
    return m >= 7 && m <= 10;
}

/**
 * Создаёт один лист со случайными параметрами (чистая функция).
 * @param {number} w ширина области, px
 * @param {number} h высота области, px
 * @param {() => number} [rng] генератор случайных чисел (Math.random по умолчанию)
 * @returns {{emoji:string,x:number,y:number,size:number,speedY:number,drift:number,phase:number,spin:number,opacity:number}}
 */
export function makeLeaf(w, h, rng = Math.random) {
    const o = AUTUMN_OPTIONS;
    const size = o.minSize + rng() * (o.maxSize - o.minSize);
    return {
        emoji: LEAVES[Math.floor(rng() * LEAVES.length)],
        x: rng() * w,
        y: -size - rng() * h * 0.3,          // стартуют чуть выше экрана (сразу «в полёте»)
        size,
        speedY: o.minSpeedY + rng() * (o.maxSpeedY - o.minSpeedY),
        drift: (o.drift * 0.4 + rng() * o.drift * 0.6) * (rng() < 0.5 ? -1 : 1),
        phase: rng() * Math.PI * 2,
        spin: o.spin * 0.5 + rng() * o.spin,
        opacity: o.opacityMin + rng() * (1 - o.opacityMin),
    };
}

/**
 * Сдвигает лист на dt секунд: падает вниз с покачиванием по X.
 * Чистая функция: мутирует переданный лист и возвращает его же.
 * @param {{x:number,y:number,phase:number}} leaf
 * @param {number} dt секунды с прошлого кадра
 * @param {number} w ширина области (для возврата слева/справа)
 * @param {number} h высота области (для ухода за низ)
 * @returns {boolean} true — лист ещё на экране, false — улетел за низ (пора пересоздать)
 */
export function stepLeaf(leaf, dt, w, h) {
    if (dt <= 0) return true;
    leaf.y += leaf.speedY * dt;
    leaf.x += Math.sin(leaf.phase + leaf.y * 0.02) * leaf.drift * dt;
    leaf.phase += leaf.spin * dt;
    // Покачивание: если улетел за бок — возвращаем на противоположную сторону.
    if (leaf.x < -leaf.size) leaf.x = w + leaf.size;
    if (leaf.x > w + leaf.size) leaf.x = -leaf.size;
    return leaf.y < h + leaf.size;
}

/**
 * Признак того, что листья вообще стоит показывать: осенний сезон
 * или включена тема «Осень». Позволяет UI решать без лишней логики.
 * @param {string|null} theme текущая тема ('autumn' и т.п.)
 * @param {Date} [date]
 */
export function shouldShowAutumn(theme = null, date = new Date()) {
    return theme === 'autumn' || isAutumnSeason(date);
}
