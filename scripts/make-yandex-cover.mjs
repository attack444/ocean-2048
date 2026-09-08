// Генерация обложки для Яндекс Игр 800×470.
// Использует Playwright с собственным Chromium (не зависит от системного Chrome/CDP).
// Выход: store/shots/yandex-cover.png (800×470).
// Запуск:  node scripts/make-yandex-cover.mjs
/* global console */
import { chromium } from 'playwright';
import { readFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = join(ROOT, 'store', 'shots');
mkdirSync(OUT_DIR, { recursive: true });
const OUT = join(OUT_DIR, 'yandex-cover.png');

// Актуальная иконка из icons/ (не зависит от устаревшей сборки build/yandex)
const icon = readFileSync(join(ROOT, 'icons', 'icon-512.png')).toString('base64');

const html = `<!doctype html>
<html lang="ru"><head><meta charset="utf-8"><style>
  * { margin:0; padding:0; box-sizing:border-box; }
  html,body { width:800px; height:470px; overflow:hidden;
    font-family:'Segoe UI', Roboto, Arial, sans-serif; }
  body { background: radial-gradient(1200px 600px at 20% -10%, #2a5a85 0%, #1c3b5a 45%, #0f2233 100%); }
  .wrap { width:100%; height:100%; display:flex; flex-direction:column;
    align-items:center; justify-content:center; text-align:center; position:relative; }
  .tile { position:absolute; width:56px; height:56px; border-radius:12px;
    display:flex; align-items:center; justify-content:center;
    font-size:24px; font-weight:700; color:#fff; opacity:.92;
    box-shadow:0 6px 14px rgba(0,0,0,.35); z-index:0; }
  /* Плитки строго по углам — не пересекают центральный текст */
  .t1 { background:#e3b23c; left:34px; top:34px; transform:rotate(-10deg); }
  .t2 { background:#d27c2c; right:34px; top:34px; transform:rotate(9deg); }
  .t3 { background:#b0bec5; left:40px; bottom:36px; transform:rotate(7deg); }
  .t4 { background:#8d6e63; right:40px; bottom:36px; transform:rotate(-9deg); }
  .content { position:relative; z-index:1; display:flex; flex-direction:column;
    align-items:center; text-align:center; }
  .icon { width:130px; height:130px; border-radius:26px; box-shadow:0 14px 30px rgba(0,0,0,.45); margin-bottom:14px; }
  h1 { font-size:56px; font-weight:800; color:#ffd24a; letter-spacing:1px; text-shadow:0 3px 0 rgba(0,0,0,.4); }
  .sub { margin-top:6px; font-size:21px; color:#dce8f2; letter-spacing:.5px; }
  .badge { margin-top:14px; font-size:13px; color:#9fb6c9; letter-spacing:2px; text-transform:uppercase; }
</style></head><body>
  <div class="wrap">
    <div class="tile t1">2</div>
    <div class="tile t2">4</div>
    <div class="tile t3">8</div>
    <div class="tile t4">16</div>
    <div class="content">
      <img class="icon" src="data:image/png;base64,${icon}" alt=""/>
      <h1>Океан 2048</h1>
      <div class="sub">Головоломка в подводном стиле · 7 рангов · поля до 6×6</div>
      <div class="badge">Соединяй плитки · Стань Хозяином Моря</div>
    </div>
  </div>
</body></html>`;

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 800, height: 470 }, deviceScaleFactor: 1 });
await page.setContent(html, { waitUntil: 'load' });
await page.screenshot({ path: OUT });
await browser.close();
console.log('OK', OUT);
