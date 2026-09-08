// Сквозной авто-тест UI экономики (ежедневный вход, магазин, буст-бар)
// Запуск: node store/ui-check.mjs   (требует: npm run serve + puppeteer-core --no-save)
import puppeteer from 'puppeteer-core';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = join(dirname(fileURLToPath(import.meta.url)), 'shots');
mkdirSync(OUT, { recursive: true });

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const BASE = 'http://localhost:4173';

const results = [];
const log = [];
function check(name, cond, extra = '') {
  results.push({ ok: !!cond });
  const line = `${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? '  — ' + extra : ''}`;
  console.log(line);
  log.push(line);
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function runViewport(label, width, height, tag) {
  console.log(`\n=== ${label} (${width}x${height}) ===`);
  const userDataDir = `${OUT}/.chrome-${label}-${Date.now()}`;
  rmSync(userDataDir, { recursive: true, force: true });
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: 'new',
    userDataDir,
    defaultViewport: { width, height, isMobile: true, hasTouch: true, deviceScaleFactor: 2 },
  });
  const page = await browser.newPage();
  page.on('pageerror', (e) => log.push(`  [pageerror] ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error') log.push(`  [console.error] ${m.text()}`); });
  await page.evaluateOnNewDocument(() => localStorage.clear());
  await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 20000 });
  await sleep(1600);

  // Закрыть онбординг, если виден
  const tutorialVisible = await page.evaluate(() => {
    const el = document.querySelector('#tutorial-modal');
    if (!el) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && getComputedStyle(el).display !== 'none';
  });
  if (tutorialVisible) {
    await page.click('#tutorial-ok');
    await sleep(400);
  }

  const visible = (sel) => page.evaluate((s) => {
    const el = document.querySelector(s);
    if (!el) return false;
    const r = el.getBoundingClientRect();
    const st = getComputedStyle(el);
    return st.display !== 'none' && st.visibility !== 'hidden' && r.width > 0 && r.height > 0;
  }, sel);
  const text = (sel) => page.evaluate((s) => (document.querySelector(s)?.textContent || '').trim(), sel);

  const grp = `${label} · `;

  // ── Базовая структура
  check(grp + 'кнопка магазина #shop-btn', !!(await page.$('#shop-btn')));
  check(grp + 'модалка #shop-modal', !!(await page.$('#shop-modal')));
  check(grp + 'баннер #daily-login', !!(await page.$('#daily-login')));
  check(grp + 'буст-бар #boost-shuffle', !!(await page.$('#boost-shuffle')));

  // ── Ежедневный вход
  const dlVis = await visible('#daily-login');
  check(grp + 'баннер входа виден на старте', dlVis);
  if (dlVis) await page.screenshot({ path: `${OUT}/${tag}-daily-login.png` });

  const claimDisabled = await page.evaluate(() => document.querySelector('#dl-claim-btn')?.disabled);
  check(grp + 'кнопка «Забрать» активна', claimDisabled === false);
  await page.click('#dl-claim-btn');
  await sleep(400);
  const doubloonsAfterClaim = await text('#doubloons');
  check(grp + 'жемчужины после входа = 50', doubloonsAfterClaim === '50', `факт: ${doubloonsAfterClaim}`);
  check(grp + 'баннер скрыт после входа', !(await visible('#daily-login')));

  // ── Магазин
  await page.click('#shop-btn');
  await sleep(300);
  check(grp + 'модалка магазина открыта', await visible('#shop-modal'));
  const bal = await text('#shop-doubloons');
  check(grp + 'баланс в магазине = 50', bal === '50', `факт: ${bal}`);

  const catMin = { boost: [3, 3], perk: [3, 3], skin: [3, 6], theme: [2, 3] };
  for (const [cat, [min, max]] of Object.entries(catMin)) {
    await page.click(`.shop-tab[data-cat="${cat}"]`);
    await sleep(250);
    const n = await page.evaluate(() => document.querySelectorAll('#shop-grid .shop-item').length);
    check(grp + `вкладка ${cat}: товаров ${min}–${max}`, n >= min && n <= max, `факт: ${n}`);
    await page.screenshot({ path: `${OUT}/${tag}-shop-${cat}.png` });
  }

  // Покупка буста shuffle (30)
  await page.click('.shop-tab[data-cat="boost"]');
  await sleep(250);
  const buyBtn = await page.$('.shop-buy[data-shop-id="shuffle"]');
  check(grp + 'кнопка покупки shuffle', !!buyBtn);
  if (buyBtn) {
    const disabled = await page.evaluate(() => document.querySelector('.shop-buy[data-shop-id="shuffle"]')?.disabled);
    check(grp + 'shuffle можно купить (цена 30 ≤ 50)', !disabled);
    await page.click('.shop-buy[data-shop-id="shuffle"]');
    await sleep(350);
    const balAfter = await text('#shop-doubloons');
    check(grp + 'баланс после покупки = 20', balAfter === '20', `факт: ${balAfter}`);
    await page.screenshot({ path: `${OUT}/${tag}-shop-after-buy.png` });
  }

  await page.click('#close-shop-btn');
  await sleep(300);
  check(grp + 'модалка магазина закрыта', !(await visible('#shop-modal')));

  // Буст-бар после покупки
  const shuffleCount = await text('#boost-shuffle-count');
  check(grp + 'счётчик shuffle = 1', shuffleCount === '1', `факт: ${shuffleCount}`);
  const shuffleDisabled = await page.evaluate(() => document.querySelector('#boost-shuffle')?.disabled);
  check(grp + 'кнопка shuffle активна', shuffleDisabled === false);
  await page.screenshot({ path: `${OUT}/${tag}-home-final.png` });

  await browser.close();
  rmSync(userDataDir, { recursive: true, force: true });
}

await runViewport('iPhone', 390, 844, 'iphone');
await runViewport('Android', 412, 915, 'android');

const pass = results.filter((r) => r.ok).length;
const fail = results.filter((r) => !r.ok).length;
console.log(`\nИТОГО: ${pass} PASS, ${fail} FAIL`);
log.push(`\nИТОГО: ${pass} PASS, ${fail} FAIL`);
writeFileSync(join(dirname(fileURLToPath(import.meta.url)), 'ui-check-report.txt'), log.join('\n'));
console.log('Отчёт: store/ui-check-report.txt');
