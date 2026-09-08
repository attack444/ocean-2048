#!/usr/bin/env node
/**
 * Собирает build/yandex/ — веб-версию для публикации на Яндекс Играх.
 *
 * Отличие от scripts/build-www.js (нативный Capacitor-бандл):
 * - JS и CSS МИНИФИЦИРУЮТСЯ через esbuild (scripts/lib/minify.mjs) — пофайлово,
 *   без бандлинга (относительные ESM-импорты сохраняются). Это критично для
 *   Яндекс Игр: игра загружается ZIP-архивом целиком, каждое обновление =
 *   повторная загрузка всех файлов. Минификация ужимает JS ~в 2,5–3 раза.
 * - Исключаются магазинные ассеты, не нужные игрокам: icon-1024.png, screenshot-mobile.png.
 * - сохраняются manifest.json и sw.js (PWA для веб-сборки);
 * - НЕ копируются тесты (*.test.js), мусор слияния (board/config/utils/ui)
 *   и нативные точки входа (native-entry/native-plugins).
 *
 * Результат — папка build/yandex/, которую нужно заархивировать в ZIP
 * (например: powershell Compress-Archive build/yandex/* build/yandex.zip)
 * и загрузить в кабинет Яндекс Игр.
 */
import { cpSync, mkdirSync, rmSync, readdirSync, writeFileSync, readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { minifyJS, minifyCSS } from './lib/minify.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'build', 'yandex');

rmSync(out, { recursive: true, force: true });
mkdirSync(join(out, 'js'), { recursive: true });
mkdirSync(join(out, 'css'), { recursive: true });
mkdirSync(join(out, 'icons'), { recursive: true });

// ── Статика веб-версии (НЕ нативная, с manifest + sw) ─────────
// manifest.json копируем с вырезкой «screenshots»: screenshot-mobile.png —
// магазинный ассет, в веб-сборку не попадает (см. SKIP_ICONS ниже), и битая
// ссылка в манифесте ломала бы установку PWA.
function copyManifest() {
    const src = join(root, 'manifest.json');
    if (!existsSync(src)) { console.warn('skip missing: manifest.json'); return; }
    let m = readFileSync(src, 'utf8');
    m = m.replace(/,\s*"screenshots"\s*:\s*\[[\s\S]*?\]/, '');
    writeFileSync(join(out, 'manifest.json'), m);
}

const staticFiles = ['index.html', 'sw.js', 'privacy-policy.html'];
copyManifest();
for (const f of staticFiles) {
    const src = join(root, f);
    if (existsSync(src)) cpSync(src, join(out, f));
    else console.warn(`skip missing: ${f}`);
}

// CSS: только актуальный styles.css (минифицированный)
if (existsSync(join(root, 'css', 'styles.css'))) {
    const css = readFileSync(join(root, 'css', 'styles.css'), 'utf8');
    const min = await minifyCSS(css, 'styles.css');
    writeFileSync(join(out, 'css', 'styles.css'), min);
}

// Icons: все иконки PWA, кроме магазинных ассетов, не нужных в вебе
// (icon-1024.png и screenshot-mobile.png — для магазинов/кабинета, а не игроков).
const SKIP_ICONS = new Set(['icon-1024.png', 'screenshot-mobile.png']);
if (existsSync(join(root, 'icons'))) {
    mkdirSync(join(out, 'icons'), { recursive: true });
    for (const f of readdirSync(join(root, 'icons'))) {
        if (SKIP_ICONS.has(f)) {
            console.log(`  (пропуск магазинного ассета: icons/${f})`);
            continue;
        }
        cpSync(join(root, 'icons', f), join(out, 'icons', f));
    }
}

// Оригинальный саундтрек (OST): 2 MP3 Kevin MacLeod — копируем целиком.
const ostDir = join(root, 'audio', 'ost');
if (existsSync(ostDir)) {
    mkdirSync(join(out, 'audio', 'ost'), { recursive: true });
    for (const f of readdirSync(ostDir)) {
        if (f.endsWith('.mp3')) cpSync(join(ostDir, f), join(out, 'audio', 'ost', f));
    }
    console.log('  (OST: audio/ost/*.mp3 скопированы)');
} else {
    console.warn('skip missing: audio/ost');
}

// ── JS-модули веб-версии ──────────────────────────────────────
const jsDir = join(root, 'js');
const EXCLUDE = new Set([
    'board.js', 'config.js', 'utils.js', 'ui.js',      // мусор слияния
    'native-entry.js', 'native-plugins.js',            // только для нативного бандла
]);
const modules = readdirSync(jsDir)
    .filter((f) => f.endsWith('.js'))
    .filter((f) => !f.endsWith('.test.js'))
    .filter((f) => !EXCLUDE.has(f));

// ── Минификация JS-модулей через esbuild (пофайлово, без бандлинга) ──
// Относительные ESM-импорты (./game.js и т.п.) сохраняются — модули резолвятся
// как в исходниках, но код ужат. ВАЖНО: правила Яндекса — в архиве не должно
// оставаться URL внутренних хранилищ (даже в комментариях); minify вырезает
// комментарии (legalComments: 'none'), что дополнительно чистит архив.
let totalRaw = 0;
let totalMin = 0;
const minified = [];
for (const f of modules) {
    const srcPath = join(jsDir, f);
    const src = readFileSync(srcPath, 'utf8');
    const min = await minifyJS(src, f);
    totalRaw += src.length;
    totalMin += min.length;
    writeFileSync(join(out, 'js', f), min);
    minified.push(f);
}

writeFileSync(
    join(out, 'build.json'),
    JSON.stringify({ platform: 'yandex', version: '1.0.0', jsModules: modules.length, minified: true }, null, 2)
);

const savedPct = totalRaw ? Math.round((1 - totalMin / totalRaw) * 100) : 0;
console.log(`✓ build/yandex готов: статика + ${modules.length} JS-модулей + css + icons`);
console.log(`  JS: ${Math.round(totalRaw / 1024)} КБ → ${Math.round(totalMin / 1024)} КБ (минификация −${savedPct}%)`);
console.log(`  Файлы: ${minified.join(', ')}`);
