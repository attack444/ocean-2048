// Запись видео геймплея «Океан 2048» через Playwright recordVideo.
// 1) Открывает игру на http://localhost:4173 (нужен `npm run serve`).
// 2) Играет серию ходов по таймеру (реалистичный геймплей).
// 3) Playwright пишет .webm в store/trailer/.
// 4) ffmpeg конвертирует .webm → .mp4 (H.264) и делает .gif (превью).
//
// Запуск:  node scripts/make-trailer.mjs
// Требует: локальный сервер :4173 + playwright + ffmpeg (уже установлен в PATH,
//          иначе используется полный путь D:\tools\ffmpeg\ffmpeg-9.0.1-essentials_build\bin).
/* global console, setTimeout, document, getComputedStyle, localStorage, process */
import { chromium } from 'playwright';
import { mkdirSync, existsSync, readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'store', 'trailer');
mkdirSync(OUT_DIR, { recursive: true });

const BASE = 'http://localhost:4173';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ffmpeg: полный путь из установки (PATH текущей сессии может ещё не обновиться)
const FFMPEG_CANDIDATES = [
  'D:/tools/ffmpeg/ffmpeg-9.0.1-essentials_build/bin/ffmpeg.exe',
  'ffmpeg',
];
function findFfmpeg() {
  for (const c of FFMPEG_CANDIDATES) {
    const r = spawnSync(c, ['-version'], { encoding: 'utf8', timeout: 10000 });
    if (r.status === 0) return c;
  }
  throw new Error('ffmpeg не найден. Установите ffmpeg или проверьте PATH.');
}
const FFMPEG = findFfmpeg();
console.log('ffmpeg:', FFMPEG);

// Последовательность ходов (стрелки). Повторяем циклы, пока не наберём нужную длину.
const MOVES = ['ArrowLeft', 'ArrowUp', 'ArrowRight', 'ArrowDown'];
const STEP_MS = 420; // пауза между ходами, мс

async function waitFor(page, fn, timeout = 20000, label = 'condition') {
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

// Резолвим путь к видео (Playwright кладёт .webm в подпапку с хэшем).
function findWebm() {
  const files = [];
  const walk = (dir) => {
    for (const f of readdirSync(dir, { withFileTypes: true })) {
      const p = `${dir}/${f.name}`;
      if (f.isDirectory()) walk(p);
      else if (f.name.endsWith('.webm')) files.push(p);
    }
  };
  walk(OUT_DIR);
  files.sort((a, b) => (a < b ? 1 : -1)); // новейший по имени (хэш не сортируется по времени, берём последний записанный)
  return files[files.length - 1];
}

async function main() {
  const seconds = Number(process.argv[2] || 20);
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    recordVideo: { dir: OUT_DIR, size: { width: 1280, height: 720 } },
  });
  const page = await context.newPage();
  page.on('pageerror', (e) => console.log(`  [pageerror] ${e.message}`));
  await page.addInitScript(() => localStorage.clear());

  await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 20000 });
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

  if (await visible(page, '#tutorial-modal')) {
    await page.click('#tutorial-ok');
    await sleep(500);
  }
  if (await visible(page, '#daily-login')) {
    await page.click('#dl-claim-btn');
    await sleep(500);
  }

  console.log(`Снимаю геймплей ~${seconds}с (${MOVES.length} направлений, шаг ${STEP_MS}мс)...`);
  const startTs = Date.now();
  let i = 0;
  while (Date.now() - startTs < seconds * 1000) {
    await page.keyboard.press(MOVES[i % MOVES.length]);
    await sleep(STEP_MS);
    i++;
  }
  console.log(`Сделано ходов: ${i}`);

  await context.close(); // финализирует .webm
  await browser.close();

  const webm = findWebm();
  if (!webm) throw new Error('Видео .webm не найдено в ' + OUT_DIR);
  console.log('Сырьё (.webm):', webm);

  // 1) Конвертация в MP4 (H.264 + AAC, 30fps)
  const mp4 = `${OUT_DIR}/trailer.mp4`;
  const r1 = spawnSync(FFMPEG, [
    '-y', '-i', webm,
    '-vf', 'fps=30',
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '20',
    '-pix_fmt', 'yuv420p',
    '-c:a', 'aac', '-b:a', '128k',
    '-movflags', '+faststart',
    mp4,
  ], { encoding: 'utf8' });
  if (r1.status !== 0) {
    console.error('MP4-конвертация не удалась:', r1.stderr);
    process.exitCode = 1;
  } else {
    console.log('Готово MP4:', mp4);
  }

  // 2) Превью-GIF (первые 5 секунд, 12fps, палитра)
  const gif = `${OUT_DIR}/trailer-preview.gif`;
  const r2 = spawnSync(FFMPEG, [
    '-y', '-i', webm,
    '-t', '5',
    '-vf', 'fps=12,scale=480:-1:flags=lanczos,split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse',
    gif,
  ], { encoding: 'utf8' });
  if (r2.status !== 0) {
    console.error('GIF-конвертация не удалась:', r2.stderr);
    process.exitCode = 1;
  } else {
    console.log('Готово GIF:', gif);
  }

  console.log('\nРезультаты:');
  if (existsSync(mp4)) console.log('  MP4 :', mp4);
  if (existsSync(gif)) console.log('  GIF :', gif);
  console.log('  raw :', webm);
}

main().catch((e) => {
  console.error('Ошибка:', e.message);
  process.exit(1);
});
