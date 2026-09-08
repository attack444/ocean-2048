// Генерация скриншотов для магазинов (Play / App Store / RuStore) и Яндекса.
// Использует Playwright с собственным Chromium (не зависит от системного Chrome/CDP).
// Требует: локальный сервер на :4173 (npm run serve) + npm i -D playwright + npx playwright install chromium
// Запуск:  node scripts/make-store-shots.mjs
//
// Выход (store/shots/):
//   yandex-home.png / yandex-moves.png / yandex-shop.png / yandex-shop-skin.png  → 1280×720 (требование Яндекса)
//   android-home.png / android-moves.png / android-shop.png / android-shop-skin.png  → 824×1830 (Play, 2x 412×915)
//   iphone-home.png  / iphone-moves.png  / iphone-shop.png  / iphone-shop-skin.png   → 1179×2556 (App Store, 3x 393×852)
//   rustore-home.png / rustore-moves.png / rustore-shop.png / rustore-shop-skin.png → 1080×1920 (RuStore, 3x 360×640)
/* global console, document, getComputedStyle, localStorage, setTimeout */
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { URL, fileURLToPath } from 'node:url';

const OUT = fileURLToPath(new URL('../store/shots/', import.meta.url));
mkdirSync(OUT, { recursive: true });

const BASE = 'http://localhost:4173';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitFor(page, fn, timeout = 15000, label = 'condition') {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    try {
      if (await page.evaluate(fn)) return true;
    } catch {
      /* DOM ещё не готов */
    }
    await sleep(120);
  }
  console.log(`  [warn] таймаут: ${label}`);
  return false;
}

async function visible(page, sel) {
  return page.evaluate((s) => {
    const el = document.querySelector(s);
    if (!el) return false;
    const r = el.getBoundingClientRect();
    const st = getComputedStyle(el);
    return st.display !== 'none' && st.visibility !== 'hidden' && r.width > 0 && r.height > 0;
  }, sel);
}

async function closeTutorial(page, waitForIt = true) {
  // Онбординг показывается сразу после скрытия загрузочного экрана (гонка),
  // поэтому при waitForIt=true ждём его появления. Кликаем «Далее»/«Понятно»
  // через page.evaluate — это обходит перехват pointer-events модалкой.
  for (let attempt = 0; attempt < 30; attempt++) {
    const res = await page.evaluate(() => {
      const modal = document.querySelector('#tutorial-modal');
      if (!modal) return { open: false };
      const st = getComputedStyle(modal);
      const r = modal.getBoundingClientRect();
      const open = st.display !== 'none' && st.visibility !== 'hidden' && r.width > 0 && r.height > 0;
      if (!open) return { open: false };
      const next = document.querySelector('#tutorial-next');
      if (next && !next.hidden) { next.click(); return { open: true, done: true }; }
      const ok = document.querySelector('#tutorial-ok');
      if (ok && !ok.hidden) { ok.click(); return { open: true, done: true }; }
      const skip = document.querySelector('#tutorial-skip');
      if (skip) { skip.click(); return { open: true, done: true }; }
      return { open: true, done: false };
    });
    if (!res.open) {
      if (!waitForIt) return;
      await sleep(100);
      continue;
    }
    if (!res.done) break;
    await sleep(150);
  }
  await sleep(300);
}

async function shot(page, path) {
  await sleep(250);
  const isJpg = path.toLowerCase().endsWith('.jpg');
  const opts = isJpg ? { path, fullPage: false, type: 'jpeg', quality: 90 } : { path, fullPage: false };
  await page.screenshot(opts);
  console.log('  shot:', path.split('/').pop());
}

async function runTarget(label, width, height, dsf, tag, ext = 'png') {
  const outW = width * dsf;
  const outH = height * dsf;
  console.log(`\n=== ${label} (${width}x${height} @${dsf}x → ${outW}x${outH}) ===`);
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: dsf,
    isMobile: dsf > 1,
    hasTouch: dsf > 1,
  });
  const page = await context.newPage();
  page.on('pageerror', (e) => console.log(`  [pageerror] ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error') console.log(`  [console.error] ${m.text()}`);
  });
  await page.addInitScript(() => localStorage.clear());

  await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 20000 });

  // Ждём готовности: загрузочный экран скрыт
  await waitFor(
    page,
    () => {
      const el = document.querySelector('#loading-screen');
      if (!el) return true;
      const st = getComputedStyle(el);
      return st.display === 'none' || st.opacity === '0';
    },
    20000,
    'скрытие #loading-screen'
  );

  // Закрыть онбординг (ждём его появления — показывается сразу после загрузки)
  await closeTutorial(page, true);

  // 1. Главная (виден баннер ежедневного входа)
  await shot(page, `${OUT}/${tag}-home.${ext}`);

  // 2. Забрать ежедневный вход (50 дублонов) + пара ходов для игрового вида
  if (await visible(page, '#daily-login')) {
    // Модалка туториала могла появиться снова — закрываем, если нужно
    await closeTutorial(page, false);
    await page.click('#dl-claim-btn');
    await sleep(500);
  }
  await closeTutorial(page, false);
  for (const key of ['ArrowLeft', 'ArrowUp', 'ArrowRight', 'ArrowDown']) {
    await page.keyboard.press(key);
    await sleep(320);
  }
  await shot(page, `${OUT}/${tag}-moves.${ext}`);

  // 3. Магазин — вкладка бустов
  await page.click('#shop-btn');
  await waitFor(
    page,
    () => document.querySelector('#shop-modal')?.classList.contains('visible'),
    8000,
    'открытие магазина'
  );
  await shot(page, `${OUT}/${tag}-shop.${ext}`);

  // 4. Магазин — вкладка скинов
  await page.click('.shop-tab[data-cat="skin"]');
  await sleep(500);
  await shot(page, `${OUT}/${tag}-shop-skin.${ext}`);

  await browser.close();
}

await runTarget('Яндекс 1280×720 (ландшафт)', 1280, 720, 1, 'yandex');
await runTarget('Android 412×915 @2x', 412, 915, 2, 'android');
await runTarget('iPhone 393×852 @3x', 393, 852, 3, 'iphone');
await runTarget('RuStore 360×640 @3x', 360, 640, 3, 'rustore');
await runTarget('RuStore 1920×1080 (ландшафт 16:9 JPG)', 1280, 720, 1.5, 'rustore-land', 'jpg');

console.log('\nГотово. Скриншоты: store/shots/{yandex,android,iphone,rustore}-*.png + rustore-land-*.jpg (1920×1080)');
