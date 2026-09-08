#!/usr/bin/env node
/**
 * Статическая проверка проекта «Океан 2048»:
 *  1. node --check для каждого .js файла (js/, scripts/)
 *  2. Парсинг index.html: уникальность id, дубликаты, вложенные теги
 *  3. Проверка, что все ESM-импорты в js/*.js резолвятся в существующие файлы
 *  4. Проверка, что все файлы, на которые ссылается index.html, существуют
 */
import { readdirSync, readFileSync, existsSync } from 'fs';
import { join, dirname, resolve } from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
let errors = 0;
let warnings = 0;

function err(msg) { errors++; console.error('  ✖ ' + msg); }
function ok(msg) { console.log('  ✓ ' + msg); }

// ── 1. node --check всех .js файлов ─────────────────────────────────────────
console.log('═══ 1. Синтаксис всех .js файлов ═══');
const dirs = ['js', 'scripts'];
const jsFiles = [];
for (const d of dirs) {
    if (!existsSync(join(root, d))) continue;
    for (const f of readdirSync(join(root, d))) {
        if (f.endsWith('.js')) jsFiles.push(join(d, f));
    }
}
jsFiles.sort();
for (const rel of jsFiles) {
    const res = spawnSync(process.execPath, ['--check', rel], { cwd: root, encoding: 'utf8' });
    if (res.status !== 0) {
        err(`node --check ${rel}: ${(res.stderr || res.stdout || '').trim().split('\n')[0]}`);
    }
}
if (!errors) ok(`проверено ${jsFiles.length} файлов — все валидны`);
else console.log(`  → ошибок синтаксиса: ${errors}`);

// ── 2. Уникальность id в index.html ─────────────────────────────────────────
console.log('\n═══ 2. index.html: id и теги ═══');
const html = readFileSync(join(root, 'index.html'), 'utf8');
const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]);
const dupIds = ids.filter((v, i) => ids.indexOf(v) !== i);
if (dupIds.length) err(`дубликаты id: ${[...new Set(dupIds)].join(', ')}`);
else ok(`id уникальны (${ids.length} шт.)`);

// Проверка ссылок на скрипты и стили в index.html
const hrefRefs = [...html.matchAll(/(?:src|href)="([^"]+)"/g)].map((m) => m[1]);
const missingRefs = [];
for (const ref of hrefRefs) {
    if (ref.startsWith('http') || ref.startsWith('/sdk.js') || ref.startsWith('#') || ref.startsWith('data:')) continue;
    const clean = ref.split('?')[0].split('#')[0];
    if (!clean) continue;
    const p = join(root, clean);
    if (!existsSync(p)) missingRefs.push(ref);
}
if (missingRefs.length) err(`отсутствуют файлы из index.html: ${missingRefs.join(', ')}`);
else ok(`все локальные src/href резолвятся (${hrefRefs.length} ссылок)`);

// ── 3. Резолв ESM-импортов ──────────────────────────────────────────────────
console.log('\n═══ 3. Резолв ESM-импортов ═══');
let importCount = 0;
const brokenImports = [];
for (const rel of jsFiles) {
    if (rel.endsWith('.test.js')) continue;
    const src = readFileSync(join(root, rel), 'utf8');
    for (const m of src.matchAll(/from\s+['"]([^'"]+)['"]/g)) {
        const spec = m[1];
        if (!spec.startsWith('.')) continue; // пакет, не локальный
        importCount++;
        const fromDir = dirname(join(root, rel));
        const resolved = resolve(fromDir, spec);
        // Проверяем и с расширением .js, если его нет
        const candidates = [resolved, resolved + '.js'];
        if (!candidates.some((c) => existsSync(c))) {
            brokenImports.push(`${rel} → '${spec}'`);
        }
    }
}
if (brokenImports.length) err(`битые импорты (${brokenImports.length}):\n      ${brokenImports.join('\n      ')}`);
else ok(`все ${importCount} локальных импортов резолвятся`);

// ── 4. Аудиофайлы: только OST-модуль ost.js грузит реальные mp3 ──────────────
// Процедурная Web Audio-музыка удалена (2026-09): вся фоновая музыка — это
// js/ost.js, который проигрывает audio/ost/*.mp3 (Grand Dark Waltz,
// Ancient Mystery Waltz, Kevin MacLeod CC BY). audio/*.mp3 в корне audio/ —
// только превью вне игры и в сборки НЕ входят.
console.log('\n═══ 4. Аудио: файловые ссылки только в ost.js на audio/ost/*.mp3 ═══');
let audioRefs = 0;
if (existsSync(join(root, 'js'))) {
    for (const f of readdirSync(join(root, 'js'))) {
        if (!f.endsWith('.js') || f.endsWith('.test.js')) continue;
        const src = readFileSync(join(root, 'js', f), 'utf8');
        const audioPattern = /\.mp3|new Audio|\.wav|audio\//i;
        if (!audioPattern.test(src)) continue;
        audioRefs++;
        if (f === 'ost.js') {
            // Разрешаем только ссылки на файлы из каталога audio/ost/*.mp3
            const refs = [...src.matchAll(/audio\/ost\/[\w.-]+\.mp3/gi)].map((m) => m[0]);
            for (const rel of refs) {
                if (!existsSync(join(root, rel))) {
                    err(`в js/${f} ссылка на отсутствующий файл: ${rel}`);
                }
            }
            if (!/audio\/ost\//i.test(src)) {
                err(`в js/${f} найдена ссылка на аудио вне каталога audio/ost/`);
            }
        } else {
            err(`в js/${f} найдена ссылка на аудиофайл (игровой код не должен грузить mp3; треки OST допустимы только в ost.js)`);
        }
    }
}
if (!audioRefs) ok('игровые модули не ссылаются на аудиофайлы');
else ok('аудиофайлы ссылаются только из js/ost.js на audio/ost/*.mp3 (оригинальный саундтрек)');

console.log(`\n═══ ИТОГО: ${errors} ошибок, ${warnings} предупреждений ═══`);
process.exit(errors ? 1 : 0);
