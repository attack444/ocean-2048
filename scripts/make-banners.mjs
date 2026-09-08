// Генерация рекламных баннеров «Океан 2048» через HTML+Playwright (PNG).
// Платформы и размеры:
//   vk      VK Group / VK Ads            1280×720
//   telegram  Telegram post preview      1200×630
//   youtube  YouTube thumbnail           1280×720
//   story    VK/IG/TG Story               1080×1920 (9:16)
//   banner  Play Feature / малый баннер   728×90
// Запуск:  node scripts/make-banners.mjs [all|vk|telegram|youtube|story|banner] [--season autumn]
// Выход:   store/media/banners/*.png   (без флага)
//          store/media/banners/autumn/*.png  (--season autumn — осенняя версия)
/* global console, process */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderHtmlToPng, MEDIA_DIR, ROOT } from './lib/media.mjs';

// Осенний сезонный режим: тёплая палитра + листья; оригиналы не перезаписываются.
const SEASON_IDX = process.argv.indexOf('--season');
const AUTUMN = SEASON_IDX !== -1 && (process.argv[SEASON_IDX + 1] || '').toLowerCase() === 'autumn';
const outDir = join(MEDIA_DIR, 'banners', AUTUMN ? 'autumn' : '');

const icon = readFileSync(join(ROOT, 'icons', 'icon-512.png')).toString('base64');

// Эмодзи-листья для осеннего режима (фиксированный seed — детерминированно)
function leaves(n = 14, seed = 7) {
  const emojis = ['🍁', '🍂', '🍃'];
  let out = '';
  for (let i = 0; i < n; i++) {
    const x = ((seed * 31 + i * 47) % 100) / 100;
    const y = ((seed * 17 + i * 23) % 100) / 100;
    const s = 22 + ((seed * 7 + i * 13) % 34);
    const o = 0.25 + ((seed * 5 + i * 9) % 40) / 100;
    out += `<div style="position:absolute;left:${(x * 100).toFixed(1)}%;top:${(y * 100).toFixed(1)}%;font-size:${s}px;opacity:${o.toFixed(2)};transform:rotate(${((seed + i) * 23) % 180 - 90}deg);z-index:0;pointer-events:none">${emojis[(seed + i) % emojis.length]}</div>`;
  }
  return out;
}

function shell({ width, height, title, sub, cta }) {
  const bg = AUTUMN
    ? 'background: radial-gradient(1200px 700px at 18% -12%, #8a4a1a 0%, #6b2c0c 45%, #421a06 100%);'
    : 'background: radial-gradient(1200px 700px at 18% -12%, #2a5a85 0%, #1c3b5a 45%, #0f2233 100%);';
  const titleColor = AUTUMN ? '#ffd24a' : '#ffd24a';
  const subColor = AUTUMN ? '#ffe3c0' : '#dce8f2';
  const leavesHtml = AUTUMN ? leaves() : '';
  return `<!doctype html>
<html lang="ru"><head><meta charset="utf-8"><style>
  * { margin:0; padding:0; box-sizing:border-box; }
  html,body { width:${width}px; height:${height}px; overflow:hidden;
    font-family:'Segoe UI', Roboto, Arial, sans-serif; }
  body { ${bg} }
  .wrap { position:relative; width:100%; height:100%; display:flex; flex-direction:column;
    align-items:center; justify-content:center; text-align:center; }
  .tile { position:absolute; width:${Math.round(width * 0.055)}px; height:${Math.round(width * 0.055)}px;
    border-radius:14px; display:flex; align-items:center; justify-content:center;
    font-size:${Math.round(width * 0.03)}px; font-weight:700; color:#fff; opacity:.9;
    box-shadow:0 8px 18px rgba(0,0,0,.35); }
  .t1 { background:#e3b23c; left:6%; top:8%; transform:rotate(-10deg); }
  .t2 { background:#d27c2c; right:6%; top:8%; transform:rotate(9deg); }
  .t3 { background:#b0bec5; left:7%; bottom:9%; transform:rotate(7deg); }
  .t4 { background:#8d6e63; right:7%; bottom:9%; transform:rotate(-9deg); }
  .content { position:relative; z-index:1; display:flex; flex-direction:column; align-items:center; }
  .icon { width:${Math.round(width * 0.14)}px; height:${Math.round(width * 0.14)}px;
    border-radius:${Math.round(width * 0.03)}px; box-shadow:0 16px 34px rgba(0,0,0,.5); margin-bottom:${Math.round(height * 0.02)}px; }
  h1 { font-size:${Math.round(width * 0.062)}px; font-weight:800; color:${titleColor};
    letter-spacing:1px; text-shadow:0 4px 0 rgba(0,0,0,.4); }
  .sub { margin-top:${Math.round(height * 0.014)}px; font-size:${Math.round(width * 0.024)}px; color:${subColor}; letter-spacing:.5px; }
  .cta { margin-top:${Math.round(height * 0.03)}px; font-size:${Math.round(width * 0.026)}px; font-weight:700;
    color:#0f2233; background:linear-gradient(180deg,#ffe27a,#ffc93c); padding:${Math.round(height * 0.014)}px ${Math.round(width * 0.03)}px;
    border-radius:999px; box-shadow:0 8px 20px rgba(0,0,0,.35); }
</style></head><body>
  ${leavesHtml}
  <div class="wrap">
    <div class="tile t1">2</div><div class="tile t2">4</div>
    <div class="tile t3">8</div><div class="tile t4">16</div>
    <div class="content">
      <img class="icon" src="data:image/png;base64,${icon}" alt=""/>
      <h1>${title}</h1>
      <div class="sub">${sub}</div>
      ${cta ? `<div class="cta">${cta}</div>` : ''}
    </div>
  </div>
</body></html>`;
}

const TARGETS = {
  vk:      { width: 1280, height: 720,  title: 'Океан 2048', sub: AUTUMN ? 'Осенняя атмосфера · новый саундтрек' : 'Головоломка в подводном стиле · 7 рангов', cta: 'Играть бесплатно', emoji: '🍁' },
  telegram: { width: 1200, height: 630, title: 'Океан 2048', sub: AUTUMN ? 'Собирай 2048 под осенний саундтрек' : 'Соединяй плитки и исследуй глубины', cta: 'Попробовать', emoji: '🍁' },
  youtube: { width: 1280, height: 720,  title: 'Океан 2048', sub: AUTUMN ? 'Осень в игре · оригинальный OST' : 'Головоломка в подводном стиле', cta: 'Смотреть', emoji: '🍁' },
  story:   { width: 1080, height: 1920, title: 'Океан 2048', sub: AUTUMN ? 'Собери 2048 в осеннем океане' : 'Собери 2048 в подводном мире', cta: 'Играть', emoji: '🍁' },
  banner:  { width: 728,  height: 90,   title: 'Океан 2048', sub: AUTUMN ? 'Осеннее обновление' : 'Головоломка', cta: 'Играть', emoji: '🍁' },
};

const which = process.argv[2] || 'all';

async function main() {
  console.log(`${AUTUMN ? 'Осенние' : ''} Баннеры →`, outDir);
  for (const [name, t] of Object.entries(TARGETS)) {
    if (which !== 'all' && which !== name) continue;
    const html = shell(t);
    await renderHtmlToPng({
      html,
      width: t.width,
      height: t.height,
      outPath: join(outDir, `banner-${name}.png`),
      waitMs: 300,
    });
  }
  console.log('Готово.');
}

main().catch((e) => { console.error('Ошибка:', e.message); process.exit(1); });
