// ======================== Тесты OST (js/ost.test.js) ========================
// Чистые данные и функции: реестр треков, маппинг runKind → контекст,
// атрибуция CC BY. Плеер (HTMLAudio) здесь не тестируется — это browser-only.

import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
    OST_TRACKS,
    OST_KEYS,
    OST_MAIN,
    OST_VERSUS,
    OST_CREDITS,
    ostTrackFor,
    ostModeForRunKind,
} from './ost.js';

test('OST_TRACKS содержит ровно 2 трека (main и versus)', () => {
    assert.deepEqual([...OST_KEYS].sort(), [OST_MAIN, OST_VERSUS].sort());
});

test('OST_TRACKS: каждый трек имеет файл, автора, лицензию CC BY', () => {
    for (const key of OST_KEYS) {
        const t = OST_TRACKS[key];
        assert.ok(t.file && t.file.startsWith('audio/ost/') && t.file.endsWith('.mp3'), `file у ${key}`);
        assert.ok(t.composer, `composer у ${key}`);
        assert.ok(t.license.includes('CC BY'), `лицензия у ${key}`);
        assert.ok(t.source, `source у ${key}`);
    }
});

test('OST файлы существуют на диске (интеграция со сборкой)', () => {
    // Пути в OST_TRACKS относительные к корню проекта (js/ost.js → корень = ../).
    const root = join(dirname(fileURLToPath(import.meta.url)), '..');
    for (const key of OST_KEYS) {
        assert.ok(existsSync(join(root, OST_TRACKS[key].file)), `нет файла: ${OST_TRACKS[key].file}`);
    }
});

test('ostTrackFor: неизвестный контекст безопасно даёт main', () => {
    assert.equal(ostTrackFor('main').context, OST_MAIN);
    assert.equal(ostTrackFor('versus').context, OST_VERSUS);
    assert.equal(ostTrackFor('bogus').context, OST_MAIN);
    assert.equal(ostTrackFor(undefined).context, OST_MAIN);
    assert.equal(ostTrackFor(null).context, OST_MAIN);
});

test('ostTrackFor: файлы двух контекстов различны', () => {
    assert.notEqual(OST_TRACKS[OST_MAIN].file, OST_TRACKS[OST_VERSUS].file);
});

test('ostModeForRunKind: турнир и дуэль → versus, остальное → main', () => {
    assert.equal(ostModeForRunKind('tournament'), OST_VERSUS);
    assert.equal(ostModeForRunKind('duel'), OST_VERSUS);
    // Одиночные режимы — главный трек
    for (const kind of ['depth', 'classic', 'puzzle', 'challenge', 'weekly', null, undefined, '']) {
        assert.equal(ostModeForRunKind(kind), OST_MAIN, `runKind=${kind}`);
    }
});

test('OST_CREDITS содержит имя автора, источник и лицензию', () => {
    assert.ok(OST_CREDITS.includes('Kevin MacLeod'));
    assert.ok(OST_CREDITS.includes('incompetech'));
    assert.ok(OST_CREDITS.includes('CC BY'));
    assert.ok(OST_CREDITS.includes('Grand Dark Waltz'));
});
