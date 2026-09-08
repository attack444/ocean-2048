// Генерация ассетов единого сообщества-хаба «5MB2 Digital» через HTML+Playwright (PNG).
// Одно сообщество — вся экосистема: игра «Океан 2048» + студия 5MB2 + SaaS NeoBrain.
// Выход: store/community/
//   cover-1590x400.png            — обложка сообщества VK (1590×400)
//   avatar-512.png / avatar-200.png — аватар (512×512 для загрузки; 200×200 минимум VK)
//   promo-game.png                — промо-пост: игра «Океан 2048» (1200×630)
//   promo-studio.png              — промо-пост: студия 5MB2 (1200×630)
//   promo-neobrain.png            — промо-пост: SaaS NeoBrain (1200×630)
//   promo-ecosystem.png           — промо-пост: экосистема 5MB2 Digital (1200×630)
//   post-game-1080x1080.png       — квадратный пост в ленту: игра (1080×1080)
//   post-ecosystem-1080x1080.png  — квадратный пост в ленту: экосистема (1080×1080)
//   story-game-1080x1920.png      — история: игра (1080×1920)
//   story-ecosystem-1080x1920.png — история: экосистема (1080×1920)
//   ad-game-1200x627.png          — реклама VK: тизер/промопост (1200×627)
//   ad-ecosystem-1080x1080.png    — реклама VK: квадрат (1080×1080)
//   ad-game-1080x1920.png         — реклама VK: история/вертикаль (1080×1920)
// Запуск:  node scripts/make-community-assets.mjs [--season autumn]
//   (без флага — базовый «океанский» комплект в store/community/; исходники сохраняются)
//   --season autumn — осенний сезонный комплект в store/community/autumn/
//   (тёплая палитра + падающие листья + тёплый градиент акцента; те же тексты и размеры).
/* global console, process */
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { renderHtmlToPng, ROOT } from './lib/media.mjs';

// Сезонный режим. Осенняя версия актуальна до конца сезона; оригиналы не перезаписываются.
const SEASON_IDX = process.argv.indexOf('--season');
const AUTUMN = SEASON_IDX !== -1 && (process.argv[SEASON_IDX + 1] || '').toLowerCase() === 'autumn';
const OUT_DIR = join(ROOT, 'store', 'community', AUTUMN ? 'autumn' : '');
// Базовый каталог store/community: для сток-фото и иконки (в осеннем режиме сток не используется).
const OUT = join(ROOT, 'store', 'community');
const iconGame = readFileSync(join(ROOT, 'icons', 'icon-512.png')).toString('base64');

// ---------- Фотореалистичная подводная подложка (сток-гибрид) ----------
// Если в store/community/stock/ лежит underwater.jpg — используем его как фон
// (фото из Unsplash/Pexels, скачанное вручную). Иначе — CSS-«фото» из слоёв:
// свет из глубины, блики, пузырьки, коралловые силуэты. Никаких внешних запросов.
// В осеннем режиме — «закатный океан»: тёплый градиент + листья (см. autumnLeaves).
const STOCK_JPG = join(OUT, 'stock', 'underwater.jpg');
const STOCK_B64 = existsSync(STOCK_JPG)
  ? readFileSync(STOCK_JPG).toString('base64')
  : null;

// Коралловые силуэты (тёмный низ) — повторяем в CSS-фоне как mask-image (декоративный низ)
function stockLayer({ width, height, cover = false }) {
  if (AUTUMN) {
    // Осень: тёплый «закатный» океан (не используем холодное сток-фото)
    return cover
      ? `background:
           radial-gradient(120% 90% at 50% -10%, rgba(255,180,60,.5), transparent 55%),
           radial-gradient(90% 60% at 12% 88%, rgba(255,120,40,.35), transparent 60%),
           radial-gradient(120% 100% at 85% 70%, rgba(120,50,10,.9), transparent 62%),
           linear-gradient(180deg,#4a1a05 0%,#7a3412 38%,#a8551e 62%,#5a2208 100%);
         position:relative;`
      : `background:
           radial-gradient(120% 80% at 78% 12%, rgba(255,180,60,.45), transparent 55%),
           radial-gradient(90% 70% at 90% 78%, rgba(255,120,40,.3), transparent 60%),
           linear-gradient(90deg,#4a1a05 0%,#7a3412 42%,#a8551e 66%,#8a441a 100%);
         position:relative;`;
  }
  if (cover) {
    // Полноэкранная фото-подложка: покрывает весь кадр, затемнение сверху для текста
    return STOCK_B64
      ? `background:linear-gradient(180deg,rgba(7,24,39,.55) 0%,rgba(7,24,39,.18) 45%,rgba(4,14,24,.72) 100%),url(data:image/jpeg;base64,${STOCK_B64}) center/cover no-repeat;`
      : `background:
           radial-gradient(120% 90% at 50% -10%, rgba(34,211,238,.45), transparent 55%),
           radial-gradient(90% 60% at 12% 88%, rgba(255,201,60,.22), transparent 60%),
           radial-gradient(120% 100% at 85% 70%, rgba(20,85,138,.85), transparent 62%),
           linear-gradient(180deg,#062b45 0%,#0a3a5e 38%,#0c4a6e 62%,#0a2a4a 100%);
         position:relative;`;
  }
  // Неполный фон (для обложки) — фото справа под плитками/глубиной, слева тёмная вуаль
  return STOCK_B64
    ? `background:
         linear-gradient(90deg, rgba(7,24,39,.92) 0%, rgba(7,24,39,.55) 34%, rgba(7,24,39,.12) 60%, rgba(4,14,24,.28) 100%),
         url(data:image/jpeg;base64,${STOCK_B64}) center/cover no-repeat;`
    : `background:
         radial-gradient(120% 80% at 78% 12%, rgba(34,211,238,.38), transparent 55%),
         radial-gradient(90% 70% at 90% 78%, rgba(255,201,60,.16), transparent 60%),
         linear-gradient(90deg,#062b45 0%,#0a3a5e 42%,#0c4a6e 66%,#0e5f88 100%);
       position:relative;`;
}

// Анимированные пузырьки (белые полупрозрачные круги) поверх фона
function bubbles({ width, height, n = 10, seed = 7 }) {
  let out = '';
  for (let i = 0; i < n; i++) {
    const x = ((seed * 37 + i * 53) % 100) / 100;
    const y = ((seed * 19 + i * 29) % 100) / 100;
    const s = 6 + ((seed * 7 + i * 11) % 30);
    const o = 0.10 + ((seed * 3 + i * 5) % 20) / 100;
    out += `<div style="position:absolute;left:${(x * width).toFixed(0)}px;top:${(y * height).toFixed(0)}px;width:${s}px;height:${s}px;border-radius:50%;background:radial-gradient(circle at 32% 28%,rgba(255,255,255,.9),rgba(255,255,255,.05) 62%);opacity:${o.toFixed(2)};z-index:1"></div>`;
  }
  return out;
}

// Падающие листья (осенний режим) — эмодзи-частицы поверх кадра
function autumnLeaves({ width, height, n = 18, seed = 42 }) {
  const emojis = ['🍁', '🍂', '🍃'];
  let out = '';
  for (let i = 0; i < n; i++) {
    const x = ((seed * 31 + i * 47) % 100) / 100;
    const y = ((seed * 17 + i * 23) % 100) / 100;
    const s = Math.max(16, Math.round(width * 0.02) + ((seed * 7 + i * 13) % Math.round(width * 0.03)));
    const o = 0.3 + ((seed * 5 + i * 9) % 50) / 100;
    const emoji = emojis[(seed + i) % emojis.length];
    out += `<div style="position:absolute;left:${(x * width).toFixed(0)}px;top:${(y * height).toFixed(0)}px;font-size:${s}px;opacity:${o.toFixed(2)};transform:rotate(${((seed + i) * 23) % 180 - 90}deg);z-index:1">${emoji}</div>`;
  }
  return out;
}

// ---------- Общий каркас ----------
function shell({ width, height, accent, mode = 'ocean', children, brand = true, photo = false }) {
  // Осень: тёплые акценты (янтарь/оранжевый), сохраняя оттенок бренда для 5MB2/NeoBrain
  const accents = AUTUMN
    ? {
        game: '#ffb020',      // тёплый янтарь — Океан 2048
        studio: '#ff9d2e',    // тёплый оранжевый — студия
        neobrain: '#ffb84d',  // мягкий жёлто-оранжевый — NeoBrain
        ocean: '#ffb84d',     // тёплый — экосистема
      }
    : {
        game: '#ffc93c',      // янтарный — Океан 2048
        studio: '#76b900',    // зелёный — 5MB2 (студия)
        neobrain: '#818cf8',  // индиго — NeoBrain
        ocean: '#22d3ee',     // бирюза — экосистема
      };
  const a = accents[accent] || accents.ocean;
  const grid = mode === 'neobrain'
    ? `linear-gradient(rgba(129,140,248,.14) 1px,transparent 1px) 0 0/44px 44px,
       linear-gradient(90deg,rgba(129,140,248,.14) 1px,transparent 1px) 0 0/44px 44px,`
    : '';
  // Фон: если photo — подводная подложка, иначе фирменный градиент
  const bg = photo
    ? stockLayer({ width, height })
    : AUTUMN
      ? `background:
          radial-gradient(1000px 560px at 12% -10%, rgba(255,180,60,.4), transparent 55%),
          radial-gradient(800px 480px at 95% -4%, rgba(255,120,40,.25), transparent 50%),
          ${grid}
          linear-gradient(135deg,#3d1605 0%,#6b2c0c 55%,#421a06 100%);`
      : `background:
          radial-gradient(1000px 560px at 12% -10%, ${a}33, transparent 55%),
          radial-gradient(800px 480px at 95% -4%, rgba(99,102,241,.20), transparent 50%),
          ${grid}
          linear-gradient(135deg,#0c2033 0%,#0a2a4a 55%,#071827 100%);`;
  const bubblesHtml = photo ? bubbles({ width, height }) : '';
  const seasonDecor = AUTUMN ? autumnLeaves({ width, height }) : bubblesHtml;
  return `<!doctype html><html lang="ru"><head><meta charset="utf-8"><style>
  *{margin:0;padding:0;box-sizing:border-box}
  html,body{width:${width}px;height:${height}px;overflow:hidden;
    font-family:'Segoe UI',Roboto,Arial,sans-serif}
  body{
    ${bg}
    color:#fff;position:relative;
  }
  .glow{position:absolute;right:-140px;top:-140px;width:560px;height:560px;border-radius:50%;
    background:${AUTUMN
      ? 'radial-gradient(circle,rgba(255,190,90,.4),transparent 60%)'
      : 'radial-gradient(circle,rgba(34,211,238,.32),transparent 60%)'}}
  .accent{position:absolute;left:0;bottom:0;height:10px;width:100%;
    background:linear-gradient(90deg,${a},${AUTUMN ? '#ff8c2e' : '#22d3ee'})}
  .brand{position:absolute;left:34px;bottom:26px;display:flex;align-items:center;gap:12px;z-index:6}
  .brand .logo{width:${Math.round(width * 0.05)}px;height:${Math.round(width * 0.05)}px;border-radius:10px;
    background:${AUTUMN
      ? 'linear-gradient(135deg,#b3531a,#5a2208)'
      : 'linear-gradient(135deg,#1c6ea4,#0a2a4a)'};border:2px solid ${a};
    display:flex;align-items:center;justify-content:center;font-weight:900;font-size:${Math.round(width * 0.022)}px;color:${a}}
  .brand .nm{font-size:${Math.round(width * 0.018)}px;font-weight:700;letter-spacing:4px;color:#e2e8f0}
  .brand .nm small{display:block;font-size:${Math.round(width * 0.012)}px;font-weight:400;letter-spacing:2px;color:#7d8a9a;margin-top:2px}
  .grad-text{background:${AUTUMN
    ? `linear-gradient(90deg,${a},#ff8c2e)`
    : `linear-gradient(90deg,${a},#22d3ee)`};
    -webkit-background-clip:text;background-clip:text;color:transparent}
  ${children}
</style></head><body>
  <div class="glow"></div>
  ${seasonDecor}
  ${brand ? `<div class="brand"><div class="logo">5M</div>
    <div class="nm">5MB2&nbsp;Digital<small>студия · SaaS · игры</small></div></div>` : ''}
  <div class="accent"></div>
</body></html>`;
}

// ---------- 1. Обложка VK 1590×400 (оффер: студия 5MB2 + SaaS NeoBrain) ----------
// Сообщество — хаб бренда: студия 5MB2 + SaaS NeoBrain. Игры (в т.ч. «Океан 2048») —
// продукты студии: их продвигаем постами, на обложке они не доминируют.
// Оффер-структура (по COMMUNITY_DESIGN.md §4): лейбл → заголовок «Студия и SaaS.»
// → 3 коротких преимущества → CTA на сайт. Справа — 2 карточки брендов-якорей.
function coverHtml() {
  return shell({
    width: 1590, height: 400, accent: 'ocean', photo: true,
    children: `
  .main{position:absolute;left:70px;top:0;bottom:0;display:flex;flex-direction:column;justify-content:center;z-index:3;max-width:960px}
  .label{display:inline-flex;width:fit-content;align-items:center;gap:10px;font-size:20px;letter-spacing:7px;
    color:#bfe9f5;text-transform:uppercase;margin-bottom:16px;
    background:rgba(7,24,39,.5);border:1px solid rgba(34,211,238,.4);border-radius:999px;padding:8px 18px}
  .title{font-size:92px;font-weight:900;letter-spacing:2px;line-height:1;color:#fff;
    text-shadow:0 6px 24px rgba(0,0,0,.55), 0 4px 0 rgba(0,0,0,.3)}
  .title .w{color:#a5b4fc}
  .benefits{margin-top:20px;display:flex;flex-direction:column;gap:8px}
  .benefits .b{font-size:24px;font-weight:600;color:#e6f4fb;line-height:1.25;
    text-shadow:0 2px 10px rgba(0,0,0,.6)}
  .cta{position:absolute;left:70px;bottom:58px;z-index:4;display:inline-flex;align-items:center;gap:10px;
    background:linear-gradient(180deg,#ffe27a,#ffc93c);color:#0f2233;font-size:26px;font-weight:800;
    padding:15px 32px;border-radius:999px;box-shadow:0 12px 34px rgba(0,0,0,.5)}
  .cards{position:absolute;right:84px;top:50%;transform:translateY(-50%);display:flex;gap:20px;z-index:4}
  .card{width:236px;height:236px;border-radius:30px;padding:28px 24px;display:flex;flex-direction:column;justify-content:center;
    background:#0f2033cc;border:2px solid rgba(255,255,255,.32);
    box-shadow:0 24px 60px rgba(0,0,0,.55)}
  .card .ic{font-size:44px;margin-bottom:16px}
  .card .n{font-size:42px;font-weight:900;letter-spacing:1px}
  .card .d{font-size:19px;color:#b9cbd9;margin-top:10px;line-height:1.4}`,
  }).replace('</body>', `
  <div class="cards">
    <div class="card">
      <div class="ic">👾</div>
      <div class="n" style="color:#76b900">5MB2</div>
      <div class="d">Студия · игры и приложения</div>
    </div>
    <div class="card">
      <div class="ic">🛠</div>
      <div class="n" style="color:#818cf8">NeoBrain</div>
      <div class="d">SaaS · сайты под ключ</div>
    </div>
  </div>
  <div class="main">
    <div class="label">5MB2 Digital · Студия и SaaS</div>
    <div class="title">Студия и <span class="w">SaaS.</span></div>
    <div class="benefits">
      <div class="b">👾 5MB2 — игры и приложения под ключ</div>
      <div class="b">🛠 NeoBrain — сайты, которые сами себя ведут</div>
      <div class="b">🎮 Пробуй наши игры — бесплатно в VK</div>
    </div>
  </div>
  <div class="cta">🌐 5mb2.ru</div>
</body>`);
}

// ---------- 2. Аватар (фото-подложка + бренд-логотип «5MB2») ----------
// Лицо сообщества — бренд 5MB2 (не иконка игры): игры/продукты в аватар не входят.
function avatarHtml(size) {
  const plate = Math.round(size * 0.68);
  const br = Math.round(size * 0.18);
  return `<!doctype html><html lang="ru"><head><meta charset="utf-8"><style>
  *{margin:0;padding:0;box-sizing:border-box}
  html,body{width:${size}px;height:${size}px;overflow:hidden}
  body{
    ${STOCK_B64
      ? `background:url(data:image/jpeg;base64,${STOCK_B64}) center/cover no-repeat;`
      : `background:
           radial-gradient(120% 120% at 18% -5%, rgba(34,211,238,.65), transparent 55%),
           radial-gradient(100% 90% at 88% 90%, rgba(255,201,60,.5), transparent 58%),
           radial-gradient(140% 140% at 50% 50%, #0c4a6e 0%, #0a3a5e 48%, #062b45 100%);`}
    display:flex;align-items:center;justify-content:center}
  .plate{width:${plate}px;height:${plate}px;border-radius:${br}px;
    background:linear-gradient(135deg,#1c6ea4,#0a2a4a);
    border:${Math.round(size * 0.02)}px solid rgba(34,211,238,.85);
    display:flex;align-items:center;justify-content:center;flex-direction:column;gap:${Math.round(size * 0.015)}px;
    box-shadow:0 ${Math.round(size * 0.05)}px ${Math.round(size * 0.12)}px rgba(0,0,0,.55)}
  .plate .t{font-size:${Math.round(size * 0.14)}px;font-weight:900;letter-spacing:1px;color:#fff;
    text-shadow:0 3px 10px rgba(0,0,0,.4)}
  .plate .s{font-size:${Math.round(size * 0.045)}px;font-weight:700;letter-spacing:${Math.round(size * 0.012)}px;color:#7dd3ee}
  .ring{position:absolute;width:${Math.round(plate * 1.14)}px;height:${Math.round(plate * 1.14)}px;
    border-radius:50%;border:${Math.round(size * 0.016)}px solid rgba(255,201,60,.85);
    box-shadow:0 0 ${Math.round(size * 0.06)}px rgba(255,201,60,.5)}
</style></head><body>
  <div class="plate"><div class="t">5MB2</div><div class="s">DIGITAL</div></div>
  <div class="ring"></div>
</body></html>`;
}

// ---------- 3. Промо-посты 1200×630 (лента) ----------
function promo({ accent, kicker, title, sub, cta, game }) {
  const gameBlock = game ? `
    <img style="position:absolute;right:90px;top:50%;transform:translateY(-50%);width:250px;height:250px;
      border-radius:40px;box-shadow:0 24px 60px rgba(0,0,0,.55);z-index:3"
      src="data:image/png;base64,${iconGame}" alt=""/>` : '';
  return shell({
    width: 1200, height: 630, accent, photo: !!game,
    mode: accent === 'neobrain' ? 'neobrain' : 'ocean',
    children: `
  ${gameBlock}
  .main{position:absolute;left:80px;top:0;bottom:0;display:flex;flex-direction:column;justify-content:center;
    max-width:${game ? 640 : 980}px;z-index:2}
  .kicker{display:inline-flex;width:fit-content;align-items:center;gap:8px;font-size:20px;letter-spacing:6px;
    color:#bfe9f5;text-transform:uppercase;margin-bottom:18px;
    background:rgba(7,24,39,.5);border:1px solid rgba(34,211,238,.4);border-radius:999px;padding:8px 18px}
  .title{font-size:${game ? 74 : 84}px;font-weight:900;line-height:1.02;letter-spacing:1px;color:#fff;
    text-shadow:0 5px 0 rgba(0,0,0,.3), 0 8px 28px rgba(0,0,0,.5)}
  .sub{font-size:30px;color:#e6f4fb;margin-top:20px;font-weight:600;line-height:1.35;
    text-shadow:0 2px 10px rgba(0,0,0,.55)}
  .sub b{color:${accent === 'neobrain' ? '#a5b4fc' : '#ffd24a'}}
  .cta{margin-top:36px;display:inline-flex;width:fit-content;align-items:center;gap:10px;
    background:linear-gradient(180deg,#ffe27a,#ffc93c);color:#0f2233;font-size:24px;font-weight:800;
    padding:16px 34px;border-radius:999px;box-shadow:0 10px 30px rgba(0,0,0,.4)}`,
  }).replace('</body>', `
  <div class="main">
    <div class="kicker">${kicker}</div>
    <div class="title grad-text">${title}</div>
    <div class="sub">${sub}</div>
    ${cta ? `<div class="cta">${cta}</div>` : ''}
  </div>
</body>`);
}

// ---------- 4. Квадратный пост 1080×1080 (лента / соцсети) ----------
function squarePost({ accent, kicker, title, sub, cta, game = false }) {
  const art = game ? `
    <img style="position:absolute;left:50%;top:57%;transform:translate(-50%,-50%);width:330px;height:330px;
      border-radius:56px;box-shadow:0 32px 72px rgba(0,0,0,.6);z-index:3"
      src="data:image/png;base64,${iconGame}" alt=""/>` : `
    <div style="position:absolute;left:70px;right:70px;top:56%;transform:translateY(-50%);z-index:3;
      display:flex;gap:20px;align-items:stretch">
      <div style="flex:1;background:#0f2033cc;border:1px solid #76b90055;border-radius:22px;padding:30px 24px;box-shadow:0 16px 40px rgba(0,0,0,.4)">
        <div style="font-size:44px;font-weight:900;color:#76b900;margin-bottom:12px">5MB2</div>
        <div style="font-size:22px;color:#b9cbd9;line-height:1.4">Игровая студия · релизы</div>
      </div>
      <div style="flex:1;background:#0f2033cc;border:1px solid #818cf855;border-radius:22px;padding:30px 24px;box-shadow:0 16px 40px rgba(0,0,0,.4)">
        <div style="font-size:44px;font-weight:900;color:#818cf8;margin-bottom:12px">NeoBrain</div>
        <div style="font-size:22px;color:#b9cbd9;line-height:1.4">SaaS · SEO · ИИ-агент</div>
      </div>
      <div style="flex:1;background:#0f2033cc;border:1px solid #ffc93c55;border-radius:22px;padding:30px 24px;box-shadow:0 16px 40px rgba(0,0,0,.4)">
        <div style="font-size:34px;font-weight:900;color:#ffc93c;margin-bottom:12px">Океан 2048</div>
        <div style="font-size:22px;color:#b9cbd9;line-height:1.4">Головоломка · VK Mini App</div>
      </div>
    </div>`;
  return shell({
    width: 1080, height: 1080, accent, photo: !!game,
    mode: accent === 'neobrain' ? 'neobrain' : 'ocean',
    children: `
  ${art}
  .main{position:absolute;left:80px;right:80px;top:84px;z-index:4;text-align:center}
  .kicker{display:inline-flex;align-items:center;gap:8px;font-size:24px;letter-spacing:7px;
    color:#bfe9f5;text-transform:uppercase;margin-bottom:18px;
    background:rgba(7,24,39,.5);border:1px solid rgba(34,211,238,.4);border-radius:999px;padding:9px 20px}
  .title{font-size:${game ? 92 : 84}px;font-weight:900;line-height:1.04;letter-spacing:1px;color:#fff;
    text-shadow:0 5px 0 rgba(0,0,0,.3), 0 10px 32px rgba(0,0,0,.55)}
  .sub{font-size:32px;color:#e6f4fb;margin-top:22px;font-weight:600;line-height:1.35;max-width:900px;margin-left:auto;margin-right:auto;
    text-shadow:0 2px 10px rgba(0,0,0,.55)}
  .cta{position:absolute;left:0;right:0;bottom:104px;z-index:5;text-align:center}
  .cta a{display:inline-flex;align-items:center;gap:10px;
    background:linear-gradient(180deg,#ffe27a,#ffc93c);color:#0f2233;font-size:30px;font-weight:800;
    padding:20px 46px;border-radius:999px;box-shadow:0 12px 34px rgba(0,0,0,.5);
    text-decoration:none}`,
  }).replace('</body>', `
  <div class="main">
    <div class="kicker">${kicker}</div>
    <div class="title grad-text">${title}</div>
    <div class="sub">${sub}</div>
  </div>
  ${cta ? `<div class="cta"><a href="#">${cta}</a></div>` : ''}
</body>`);
}

// ---------- 5. История 1080×1920 (9:16) ----------
function storyHtml({ accent, kicker, title, sub, cta, game = false }) {
  const art = game ? `
    <img style="position:absolute;left:50%;top:57%;transform:translate(-50%,-50%);width:440px;height:440px;
      border-radius:76px;box-shadow:0 40px 90px rgba(0,0,0,.65);z-index:3"
      src="data:image/png;base64,${iconGame}" alt=""/>` : `
    <div style="position:absolute;left:120px;right:120px;top:58%;transform:translateY(-50%);z-index:3;
      display:flex;flex-direction:column;gap:26px;align-items:stretch">
      <div style="background:#0f2033cc;border:1px solid #76b90055;border-radius:28px;padding:34px 30px;box-shadow:0 16px 40px rgba(0,0,0,.4)">
        <div style="font-size:52px;font-weight:900;color:#76b900;margin-bottom:12px">5MB2</div>
        <div style="font-size:27px;color:#b9cbd9;line-height:1.4">Игровая студия · релизы</div>
      </div>
      <div style="background:#0f2033cc;border:1px solid #818cf855;border-radius:28px;padding:34px 30px;box-shadow:0 16px 40px rgba(0,0,0,.4)">
        <div style="font-size:52px;font-weight:900;color:#818cf8;margin-bottom:12px">NeoBrain</div>
        <div style="font-size:27px;color:#b9cbd9;line-height:1.4">SaaS · SEO · ИИ-агент</div>
      </div>
      <div style="background:#0f2033cc;border:1px solid #ffc93c55;border-radius:28px;padding:34px 30px;box-shadow:0 16px 40px rgba(0,0,0,.4)">
        <div style="font-size:42px;font-weight:900;color:#ffc93c;margin-bottom:12px">Океан 2048</div>
        <div style="font-size:27px;color:#b9cbd9;line-height:1.4">Головоломка · VK Mini App</div>
      </div>
    </div>`;
  return shell({
    width: 1080, height: 1920, accent, photo: !!game,
    mode: accent === 'neobrain' ? 'neobrain' : 'ocean',
    children: `
  ${art}
  .main{position:absolute;left:100px;right:100px;top:130px;z-index:4;text-align:center}
  .kicker{display:inline-flex;align-items:center;gap:8px;font-size:30px;letter-spacing:8px;
    color:#bfe9f5;text-transform:uppercase;margin-bottom:24px;
    background:rgba(7,24,39,.5);border:1px solid rgba(34,211,238,.4);border-radius:999px;padding:12px 26px}
  .title{font-size:${game ? 118 : 104}px;font-weight:900;line-height:1.02;letter-spacing:1px;color:#fff;
    text-shadow:0 7px 0 rgba(0,0,0,.3), 0 14px 40px rgba(0,0,0,.6)}
  .sub{font-size:38px;color:#e6f4fb;margin-top:28px;font-weight:600;line-height:1.35;
    text-shadow:0 2px 12px rgba(0,0,0,.6)}
  .sub b{color:#ffd24a}
  .cta{position:absolute;left:0;right:0;bottom:240px;z-index:5;text-align:center}
  .cta a{display:inline-flex;align-items:center;gap:12px;
    background:linear-gradient(180deg,#ffe27a,#ffc93c);color:#0f2233;font-size:40px;font-weight:800;
    padding:26px 66px;border-radius:999px;box-shadow:0 16px 44px rgba(0,0,0,.55);
    text-decoration:none}`,
  }).replace('</body>', `
  <div class="main">
    <div class="kicker">${kicker}</div>
    <div class="title grad-text">${title}</div>
    <div class="sub">${sub}</div>
  </div>
  ${cta ? `<div class="cta"><a href="#">${cta}</a></div>` : ''}
</body>`);
}

// ---------- 6. Рекламные креативы VK Рекламы ----------
// variant: '1200x627' — тизер/промопост; '1080x1080' — квадрат; '1080x1920' — история/вертикаль
function ad({ variant, accent, kicker, title, sub, cta, game = false }) {
  if (variant === '1080x1080') {
    return squarePost({ accent, kicker, title, sub, cta, game });
  }
  if (variant === '1080x1920') {
    return storyHtml({ accent, kicker, title, sub, cta, game });
  }
  // 1200×627 — компактный тизер: текст слева, игра справа, CTA внизу
  const gameBlock = game ? `
    <img style="position:absolute;right:80px;top:50%;transform:translateY(-50%);width:250px;height:250px;
      border-radius:40px;box-shadow:0 24px 60px rgba(0,0,0,.55);z-index:3"
      src="data:image/png;base64,${iconGame}" alt=""/>` : '';
  return shell({
    width: 1200, height: 627, accent, photo: !!game,
    mode: accent === 'neobrain' ? 'neobrain' : 'ocean',
    children: `
  ${gameBlock}
  .main{position:absolute;left:80px;top:0;bottom:0;display:flex;flex-direction:column;justify-content:center;
    max-width:${game ? 640 : 980}px;z-index:2}
  .kicker{display:inline-flex;width:fit-content;align-items:center;gap:8px;font-size:20px;letter-spacing:6px;
    color:#bfe9f5;text-transform:uppercase;margin-bottom:16px;
    background:rgba(7,24,39,.5);border:1px solid rgba(34,211,238,.4);border-radius:999px;padding:8px 18px}
  .title{font-size:${game ? 72 : 84}px;font-weight:900;line-height:1.02;letter-spacing:1px;color:#fff;
    text-shadow:0 5px 0 rgba(0,0,0,.3), 0 8px 28px rgba(0,0,0,.5)}
  .sub{font-size:28px;color:#e6f4fb;margin-top:20px;font-weight:600;line-height:1.35;
    text-shadow:0 2px 10px rgba(0,0,0,.55)}
  .sub b{color:#ffd24a}
  .cta{position:absolute;left:80px;bottom:56px;z-index:5;display:inline-flex;align-items:center;gap:10px;
    background:linear-gradient(180deg,#ffe27a,#ffc93c);color:#0f2233;font-size:24px;font-weight:800;
    padding:16px 34px;border-radius:999px;box-shadow:0 10px 30px rgba(0,0,0,.4)}`,
  }).replace('</body>', `
  <div class="main">
    <div class="kicker">${kicker}</div>
    <div class="title grad-text">${title}</div>
    <div class="sub">${sub}</div>
  </div>
  ${cta ? `<div class="cta">${cta}</div>` : ''}
</body>`);
}

// ---------- 7. Промо экосистемы (сетка продуктов, 1200×630) ----------
function ecoHtml() {
  const cards = [
    { n: '5MB2', c: '#76b900', d: 'Игровая студия · релизы · ассеты' },
    { n: 'NeoBrain', c: '#818cf8', d: 'SaaS · SEO · ИИ-агент · деплой' },
    { n: 'Океан 2048', c: '#ffc93c', d: 'Головоломка · VK Mini App' },
  ].map((x, i) => `
    <div style="flex:1;background:#0f2033cc;border:1px solid ${x.c}55;border-radius:18px;padding:26px 22px;
      box-shadow:0 16px 40px rgba(0,0,0,.4)">
      <div style="font-size:${i === 2 ? 34 : 42}px;font-weight:900;letter-spacing:1px;color:${x.c};margin-bottom:10px">${x.n}</div>
      <div style="font-size:19px;color:#b9cbd9;line-height:1.4">${x.d}</div>
    </div>`).join('');
  return shell({
    width: 1200, height: 630, accent: 'ocean',
    children: `
  .main{position:absolute;left:80px;top:64px;right:80px;z-index:2}
  .kicker{font-size:22px;letter-spacing:6px;color:#9fb4c6;text-transform:uppercase;margin-bottom:14px}
  .title{font-size:64px;font-weight:900;letter-spacing:1px;line-height:1}
  .sub{font-size:24px;color:#cfe0ee;margin-top:14px}
  .cards{position:absolute;left:80px;right:80px;bottom:64px;display:flex;gap:22px;z-index:2}
  ${cards}`,
  });
}

async function main() {
  console.log(`${AUTUMN ? 'Осенний сезонный комплект' : 'Ассеты сообщества'} →`, OUT_DIR);
  const jobs = [
    // --- Обложка и аватары ---
    ['cover-1590x400.png', 1590, 400, coverHtml()],
    ['avatar-512.png', 512, 512, avatarHtml(512)],
    ['avatar-200.png', 200, 200, avatarHtml(200)],

    // --- Промо-посты в ленту (1200×630) ---
    ['promo-game.png', 1200, 630, promo({
      accent: 'game', kicker: AUTUMN ? '🍁 Осень в Океане 2048' : 'Новая игра студии 5MB2',
      title: 'Океан 2048', sub: AUTUMN
        ? 'Соединяй плитки, собирай <b>2048</b> и исследуй 7 глубин — в осенних тонах'
        : 'Соединяй плитки, собирай <b>2048</b> и исследуй 7 глубин океана',
      cta: 'Играть в VK', game: true,
    })],
    ['promo-studio.png', 1200, 630, promo({
      accent: 'studio', kicker: 'Инди-студия',
      title: '5MB2', sub: 'Создаём игры и цифровые продукты, которые хочется открывать снова',
      cta: 'Смотреть каталог', game: false,
    })],
    ['promo-neobrain.png', 1200, 630, promo({
      accent: 'neobrain', kicker: 'SaaS · SEO · ИИ',
      title: 'NeoBrain', sub: 'ИИ-агент вносит правки и выкладывает сайт за минуты',
      cta: 'neobrain.site', game: false,
    })],
    ['promo-ecosystem.png', 1200, 630, ecoHtml()],

    // --- Квадратные посты (1080×1080) ---
    ['post-game-1080x1080.png', 1080, 1080, squarePost({
      accent: 'game', kicker: AUTUMN ? '🍁 Осеннее обновление' : 'Играй в VK',
      title: 'Океан 2048', sub: AUTUMN
        ? 'Собирай <b>2048</b>, исследуй 7 глубин и встречай осень в игре'
        : 'Собирай <b>2048</b>, исследуй 7 глубин и стань Хозяином Моря',
      cta: 'Играть в VK', game: true,
    })],
    ['post-ecosystem-1080x1080.png', 1080, 1080, squarePost({
      accent: 'ocean', kicker: '5MB2 Digital',
      title: 'Вся экосистема в одном сообществе', sub: 'Игры · SaaS · студия',
      cta: 'Подписаться', game: false,
    })],

    // --- Истории (1080×1920) ---
    ['story-game-1080x1920.png', 1080, 1920, storyHtml({
      accent: 'game', kicker: AUTUMN ? '🍁 Осень в игре' : 'Играй в VK',
      title: 'Океан 2048', sub: AUTUMN
        ? 'Собирай 2048 и исследуй 7 глубин — под звуки осеннего океана'
        : 'Собирай 2048 и исследуй 7 глубин океана',
      cta: 'Играть сейчас', game: true,
    })],
    ['story-ecosystem-1080x1920.png', 1080, 1920, storyHtml({
      accent: 'ocean', kicker: '5MB2 Digital',
      title: 'Вся экосистема в одном месте', sub: 'Игры · SaaS · студия — подписывайся!',
      cta: 'Подписаться', game: false,
    })],

    // --- Рекламные креативы VK Рекламы ---
    ['ad-game-1200x627.png', 1200, 627, ad({
      variant: '1200x627', accent: 'game', kicker: AUTUMN ? 'Океан 2048 · осень' : 'Океан 2048 · VK',
      title: '2048 в подводном мире', sub: AUTUMN
        ? 'Соединяй плитки, открывай глубины. Осенняя атмосфера. <b>Бесплатно</b>'
        : 'Соединяй плитки, открывай глубины. <b>Бесплатно</b> в VK',
      cta: 'Играть', game: true,
    })],
    ['ad-ecosystem-1080x1080.png', 1080, 1080, ad({
      variant: '1080x1080', accent: 'ocean', kicker: '5MB2 Digital',
      title: 'Игры · SaaS · студия', sub: 'Одно сообщество — вся наша экосистема',
      cta: 'Подписаться', game: false,
    })],
    ['ad-game-1080x1920.png', 1080, 1920, ad({
      variant: '1080x1920', accent: 'game', kicker: 'Океан 2048 · VK',
      title: '2048 в подводном мире', sub: 'Собирай плитки, становись Хозяином Моря. <b>Бесплатно</b>',
      cta: 'Играть сейчас', game: true,
    })],
  ];
  for (const [name, w, h, html] of jobs) {
    await renderHtmlToPng({ html, width: w, height: h, outPath: join(OUT_DIR, name), waitMs: 350 });
  }
  console.log('Готово.');
}

main().catch((e) => { console.error('Ошибка:', e.message); process.exit(1); });
