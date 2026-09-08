/* global console */
/**
 * Генерация Android launcher-иконок «Океан 2048» из единого SVG (icons/icon.svg).
 *
 * Проблема, которую решает: launcher-иконка в нативном Android была дефолтной
 * заглушкой Capacitor (белый фон + робот), из-за чего RuStore отклонил модерацию
 * («иконка на витрине не совпадает с иконкой установленного приложения»).
 *
 * Этот скрипт заменяет launcher-иконки на реальную иконку игры (океан + плитка 2048),
 * чтобы установленное приложение выглядело так же, как на витрине магазина.
 *
 * Выход (перезаписывает в android/app/src/main/res):
 *   mipmap-{mdpi,hdpi,xhdpi,xxhdpi,xxxhdpi}/ic_launcher.png        (legacy, 48–192)
 *   mipmap-{mdpi,hdpi,xhdpi,xxhdpi,xxxhdpi}/ic_launcher_round.png  (legacy, 48–192)
 *   mipmap-anydpi-v26/ic_launcher.xml / ic_launcher_round.xml      (adaptive → фон = иконка)
 *   drawable/ic_launcher_foreground.xml                            (прозрачный foreground)
 *   drawable/ic_launcher_background.xml                            (фон = иконка игры)
 *   drawable-nodpi/ic_launcher_full.png                            (полная иконка для фона adaptive)
 *
 * Запуск: node scripts/gen-android-icons.mjs
 * Требует Playwright (как make-store-shots.mjs) и переменную
 * PLAYWRIGHT_BROWSERS_PATH (см. store/RUSTORE.md).
 */
import { chromium } from 'playwright';
import { readFileSync, mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const resDir = join(root, 'android', 'app', 'src', 'main', 'res');
const svg = readFileSync(join(root, 'icons', 'icon.svg'), 'utf8');

// Квадратная версия без скруглённых углов (rx=0) — для legacy-иконок и фона adaptive.
const svgSquare = svg.replace(/rx="96"/g, 'rx="0"');

// Плотности legacy-иконок: имя папки → размер в px.
const DENSITIES = {
  mdpi: 48,
  hdpi: 72,
  xhdpi: 96,
  xxhdpi: 144,
  xxxhdpi: 192,
};

async function renderSvg(source, size, out) {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: size, height: size }, deviceScaleFactor: 1 });
    const html = `<!doctype html><html><head><meta charset="utf-8"><style>
      * { margin:0; padding:0; }
      html,body { width:${size}px; height:${size}px; overflow:hidden; background:transparent; }
      svg { width:${size}px; height:${size}px; display:block; }
    </style></head><body>${source}</body></html>`;
    await page.setContent(html, { waitUntil: 'load' });
    await page.screenshot({ path: out, omitBackground: true });
    console.log('  OK', `${size}x${size}`, out.split(/[\\/]/).pop());
  } finally {
    await browser.close();
  }
}

// --- 1. Legacy-иконки (API < 26): полная квадратная иконка игры по плотностям ---
console.log('Legacy-иконки (ic_launcher / ic_launcher_round)…');
for (const [density, size] of Object.entries(DENSITIES)) {
  const dir = join(resDir, `mipmap-${density}`);
  mkdirSync(dir, { recursive: true });
  await renderSvg(svgSquare, size, join(dir, 'ic_launcher.png'));
  await renderSvg(svgSquare, size, join(dir, 'ic_launcher_round.png'));
}

// --- 2. Полная иконка для фона adaptive (drawable-nodpi) ---
// Adaptive-иконка: фон = полная иконка игры (full-bleed), foreground = прозрачный.
// Так launcher показывает реальную картинку игры (система лишь маскирует форму).
const nodpiDir = join(resDir, 'drawable-nodpi');
mkdirSync(nodpiDir, { recursive: true });
const fullPng = join(nodpiDir, 'ic_launcher_full.png');
await renderSvg(svgSquare, 432, fullPng); // 108dp * 4 (xxxhdpi) — достаточно для фона

// --- 3. Adaptive XML (API 26+): фон = иконка, foreground = прозрачный ---
const adaptiveXml = (name) => `<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@drawable/ic_launcher_background"/>
    <foreground android:drawable="@drawable/ic_launcher_foreground"/>
</adaptive-icon>
`;

const anydpiDir = join(resDir, 'mipmap-anydpi-v26');
mkdirSync(anydpiDir, { recursive: true });
writeFileSync(join(anydpiDir, 'ic_launcher.xml'), adaptiveXml('ic_launcher'));
writeFileSync(join(anydpiDir, 'ic_launcher_round.xml'), adaptiveXml('ic_launcher_round'));

// Фон adaptive — ссылка на полную иконку игры (bitmap-ресурс).
const bgXml = `<?xml version="1.0" encoding="utf-8"?>
<bitmap xmlns:android="http://schemas.android.com/apk/res/android"
    android:src="@drawable/ic_launcher_full"
    android:gravity="fill" />
`;
writeFileSync(join(resDir, 'drawable', 'ic_launcher_background.xml'), bgXml);

// Foreground adaptive — прозрачный (вся картинка уже в фоне).
const fgXml = `<?xml version="1.0" encoding="utf-8"?>
<vector xmlns:android="http://schemas.android.com/apk/res/android"
    android:width="108dp"
    android:height="108dp"
    android:viewportWidth="108"
    android:viewportHeight="108">
</vector>
`;
writeFileSync(join(resDir, 'drawable', 'ic_launcher_foreground.xml'), fgXml);

// Удаляем старый цвет фона ic_launcher_background (больше не нужен — фон теперь картинка).
const colorsPath = join(resDir, 'values', 'ic_launcher_background.xml');
if (existsSync(colorsPath)) {
  // Оставляем файл, но он больше не используется adaptive-иконкой. Не удаляем,
  // чтобы не ломать возможные ссылки; просто не трогаем.
  console.log('  (значение цвета ic_launcher_background больше не используется adaptive-иконкой)');
}

console.log('Готово. Android launcher-иконки заменены на иконку игры.');
console.log('Проверь в Android Studio: Build → Rebuild, затем Generate Signed Bundle.');
