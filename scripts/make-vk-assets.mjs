// Генерация ассетов для кабинета VK Mini App («Океан 2048», app 54731343).
// Покрывает все обязательные/рекомендуемые изображения из панели «Изображения»:
//   - Универсальная иконка (каталог, лента, сообщения, рекомендации)  576×576  PNG
//   - Иконка для каталога и сниппетов (дополнительная)                278×278  PNG
//   - Маленькая иконка (экран запуска, сообщения, уведомления)         150×150  PNG
//   - Фавикон                                                          32×32    PNG  ≤50 КБ
//   - Большой сниппет                                                 1120×630  PNG
//   - Скриншоты (экран запуска в десктопе)                            600×1200  PNG
//   - Анимированная иконка (экран загрузки)                            96×96    Lottie JSON  ≤24 КБ
//
// Исходники: icons/icon.svg (иконки), icons/icon-512.png (сниппет),
//   store/shots/iphone-*.png (реальные скриншоты игры), плюс вручную описанная Lottie-анимация.
// Запуск:  node scripts/make-vk-assets.mjs   (или  npm run make:vk)
/* global console, Image, document */
import { chromium } from 'playwright';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(root, 'store', 'vk');
const SHOTS = join(root, 'store', 'shots');
mkdirSync(join(OUT, 'screenshots'), { recursive: true });

const svg = readFileSync(join(root, 'icons', 'icon.svg'), 'utf8');
const icon512b64 = readFileSync(join(root, 'icons', 'icon-512.png')).toString('base64');

async function renderSvg(size, out) {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: size, height: size }, deviceScaleFactor: 1 });
    const html = `<!doctype html><html><head><meta charset="utf-8"><style>
      * { margin:0; padding:0; }
      html,body { width:${size}px; height:${size}px; overflow:hidden; }
      svg { width:${size}px; height:${size}px; display:block; }
    </style></head><body>${svg}</body></html>`;
    await page.setContent(html, { waitUntil: 'load' });
    await page.screenshot({ path: out, omitBackground: true });
    console.log('  OK', `${size}x${size}`, out.split('/').pop());
  } finally {
    await browser.close();
  }
}

// Рендер большого сниппета 1120×630 в фирменном стиле (как make-yandex-cover.mjs)
async function renderSnippet() {
  const width = 1120;
  const height = 630;
  const html = `<!doctype html>
<html lang="ru"><head><meta charset="utf-8"><style>
  * { margin:0; padding:0; box-sizing:border-box; }
  html,body { width:${width}px; height:${height}px; overflow:hidden;
    font-family:'Segoe UI', Roboto, Arial, sans-serif; }
  body { background: radial-gradient(1600px 800px at 20% -10%, #2a5a85 0%, #1c3b5a 45%, #0f2233 100%); }
  .wrap { width:100%; height:100%; display:flex; flex-direction:column;
    align-items:center; justify-content:center; text-align:center; position:relative; }
  .tile { position:absolute; width:78px; height:78px; border-radius:16px;
    display:flex; align-items:center; justify-content:center;
    font-size:32px; font-weight:700; color:#fff; opacity:.92;
    box-shadow:0 8px 18px rgba(0,0,0,.35); z-index:0; }
  .t1 { background:#e3b23c; left:44px; top:44px; transform:rotate(-10deg); }
  .t2 { background:#d27c2c; right:44px; top:44px; transform:rotate(9deg); }
  .t3 { background:#b0bec5; left:52px; bottom:48px; transform:rotate(7deg); }
  .t4 { background:#8d6e63; right:52px; bottom:48px; transform:rotate(-9deg); }
  .content { position:relative; z-index:1; display:flex; flex-direction:column;
    align-items:center; text-align:center; }
  .icon { width:180px; height:180px; border-radius:36px; box-shadow:0 16px 36px rgba(0,0,0,.45); margin-bottom:18px; }
  h1 { font-size:78px; font-weight:800; color:#ffd24a; letter-spacing:1px; text-shadow:0 4px 0 rgba(0,0,0,.4); }
  .sub { margin-top:8px; font-size:29px; color:#dce8f2; letter-spacing:.5px; }
  .badge { margin-top:16px; font-size:17px; color:#9fb6c9; letter-spacing:2px; text-transform:uppercase; }
</style></head><body>
  <div class="wrap">
    <div class="tile t1">2</div><div class="tile t2">4</div>
    <div class="tile t3">8</div><div class="tile t4">16</div>
    <div class="content">
      <img class="icon" src="data:image/png;base64,${icon512b64}" alt=""/>
      <h1>Океан 2048</h1>
      <div class="sub">Головоломка в подводном стиле · 7 рангов · поля до 6×6</div>
      <div class="badge">Соединяй плитки · Стань Хозяином Моря</div>
    </div>
  </div>
</body></html>`;
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
    await page.setContent(html, { waitUntil: 'load' });
    await page.screenshot({ path: join(OUT, 'snippet-1120x630.png') });
    console.log('  OK 1120×630 snippet-1120x630.png');
  } finally {
    await browser.close();
  }
}

// Скриншот 600×1200 из реального игрового скриншота (1179×2556): центральный кроп до 0.5 + ресайз
async function makeScreenshot(src, name) {
  const b64 = readFileSync(src).toString('base64');
  const dataUrl = `data:image/png;base64,${b64}`;
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.setContent('<!doctype html><html><body><canvas id="c" width="600" height="1200"></canvas></body></html>');
    const png = await page.evaluate(async (dUrl) => {
      const img = new Image();
      await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = dUrl; });
      const c = document.getElementById('c');
      const ctx = c.getContext('2d');
      const targetRatio = 1200 / 600; // 2
      const srcW = img.naturalWidth;
      const srcH = img.naturalHeight;
      const cropH = Math.min(srcH, srcW * targetRatio);
      const sy = (srcH - cropH) / 2;
      ctx.drawImage(img, 0, sy, srcW, cropH, 0, 0, 600, 1200);
      return c.toDataURL('image/png');
    }, dataUrl);
    const buf = globalThis.Buffer.from(png.split(',')[1], 'base64');
    writeFileSync(join(OUT, 'screenshots', name), buf);
    console.log('  OK 600×1200', name);
  } finally {
    await browser.close();
  }
}

// Минимальная валидная Lottie-анимация 96×96: плитка 2048 + жемчужина «дышат» и покачиваются.
function buildLottie() {
  const bounce = (startY, endY) => [
    { i: { x: 0.42, y: 1 }, o: { x: 0.58, y: 0 }, t: 0, s: [48, startY, 0] },
    { t: 30, s: [48, endY, 0] },
    { t: 60, s: [48, startY, 0] },
  ];
  const pearlScale = [
    { i: { x: 0.42, y: 1 }, o: { x: 0.58, y: 0 }, t: 0, s: [100, 100, 100] },
    { t: 15, s: [112, 112, 100] },
    { t: 30, s: [100, 100, 100] },
    { t: 45, s: [112, 112, 100] },
    { t: 60, s: [100, 100, 100] },
  ];
  return {
    v: '5.7.4',
    fr: 30,
    ip: 0,
    op: 60,
    w: 96,
    h: 96,
    nm: 'Ocean 2048 loading',
    ddd: 0,
    assets: [],
    layers: [
      {
        ddd: 0, ind: 2, ty: 4, nm: 'tile', sr: 1,
        ks: {
          o: { a: 0, k: 100 },
          r: { a: 0, k: 0 },
          p: { a: 1, k: bounce(46, 62) },
          a: { a: 0, k: [0, 0, 0] },
          s: { a: 0, k: [100, 100, 100] },
        },
        ao: 0,
        shapes: [
          { ty: 'rc', d: 1, s: { a: 0, k: [56, 56] }, p: { a: 0, k: [0, 0] }, r: { a: 0, k: 14 }, nm: 'tile rect' },
          { ty: 'fl', c: { a: 0, k: [0.89, 0.7, 0.23, 1] }, o: { a: 0, k: 100 }, r: 1, nm: 'tile fill' },
        ],
        ip: 0, op: 60, st: 0, bm: 0,
      },
      {
        ddd: 0, ind: 1, ty: 4, nm: 'pearl', sr: 1,
        ks: {
          o: { a: 0, k: 100 },
          r: { a: 0, k: 0 },
          p: { a: 1, k: bounce(50, 66) },
          a: { a: 0, k: [0, 0, 0] },
          s: { a: 1, k: pearlScale },
        },
        ao: 0,
        shapes: [
          { ty: 'el', d: 1, s: { a: 0, k: [30, 30] }, p: { a: 0, k: [0, 0] }, nm: 'pearl' },
          { ty: 'fl', c: { a: 0, k: [1, 1, 1, 1] }, o: { a: 0, k: 100 }, r: 1, nm: 'pearl fill' },
        ],
        ip: 0, op: 60, st: 0, bm: 0,
      },
    ],
    markers: [],
  };
}

console.log('Генерация ассетов VK →', OUT);
await renderSvg(576, join(OUT, 'icon-universal-576.png'));
await renderSvg(278, join(OUT, 'icon-catalog-278.png'));
await renderSvg(150, join(OUT, 'icon-small-150.png'));
await renderSvg(32, join(OUT, 'favicon-32.png'));
await renderSnippet();
await makeScreenshot(join(SHOTS, 'iphone-home.png'), 'screenshot-600x1200-1-home.png');
await makeScreenshot(join(SHOTS, 'iphone-moves.png'), 'screenshot-600x1200-2-moves.png');
await makeScreenshot(join(SHOTS, 'iphone-shop.png'), 'screenshot-600x1200-3-shop.png');
await makeScreenshot(join(SHOTS, 'iphone-shop-skin.png'), 'screenshot-600x1200-4-skins.png');
const lottie = buildLottie();
const lottieStr = JSON.stringify(lottie);
// VK принимает именно Lottie JSON с расширением .json (не контейнер .lottie)
writeFileSync(join(OUT, 'loading-animation.json'), lottieStr, 'utf8');
console.log('  OK Lottie 96×96 loading-animation.json', (globalThis.Buffer.byteLength(lottieStr, 'utf8') / 1024).toFixed(1), 'KB');
console.log('Готово.');
