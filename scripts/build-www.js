#!/usr/bin/env node
/**
 * Собирает www/ для Capacitor (iOS / Android):
 * - копирует статику
 * - бандлит JS с Capacitor-плагинами через esbuild
 * - помечает body как is-native (без деревянного «окошка»)
 */
import { cpSync, mkdirSync, rmSync, writeFileSync, readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import { markHtmlAsNative } from './native-html.js';

const require = createRequire(import.meta.url);
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const www = join(root, 'www');

rmSync(www, { recursive: true, force: true });
mkdirSync(join(www, 'js'), { recursive: true });
mkdirSync(join(www, 'css'), { recursive: true });
mkdirSync(join(www, 'icons'), { recursive: true });

// Статика
for (const [from, to] of [
    ['css', 'css'],
    ['icons', 'icons'],
    ['privacy-policy.html', 'privacy-policy.html'],
    ['audio/ost', 'audio/ost'], // оригинальный саундтрек (2 MP3 Kevin MacLeod)
]) {
    const src = join(root, from);
    if (!existsSync(src)) {
        console.warn(`skip missing: ${from}`);
        continue;
    }
    cpSync(src, join(www, to), { recursive: true });
}

// HTML под натив
const html = markHtmlAsNative(readFileSync(join(root, 'index.html'), 'utf8'));
writeFileSync(join(www, 'index.html'), html);

// Бандл с Capacitor
// sourcemap: false — карта исходников (app.js.map, ~730 КБ) не нужна в прод-бандле;
// в релизе она только увеличивает размер и не отдаётся пользователям.
const esbuild = require('esbuild');
await esbuild.build({
    entryPoints: [join(root, 'js/native-entry.js')],
    bundle: true,
    outfile: join(www, 'js/app.js'),
    format: 'esm',
    platform: 'browser',
    target: ['es2020'],
    minify: true,
    sourcemap: false,
    logLevel: 'info',
});

writeFileSync(
    join(www, 'native.json'),
    JSON.stringify({ native: true, version: '1.0.0' }, null, 2)
);

console.log('✓ www/ готов для Capacitor (iOS / Android)');
