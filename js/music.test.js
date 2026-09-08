// ======================== Тесты музыки (js/music.test.js) ========================
// Музыка — только ОРИГИНАЛЬНЫЙ саундтрек (OST, js/ost.js). Процедурный
// Web Audio-синтез удалён (2026-09). В node нет DOM/HTMLAudio, поэтому тестируем
// чистые функции и API-фасад js/music.js без реального воспроизведения.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
    normalizeTrackKey,
    playTrack,
    stopMusic,
    setMusicEnabled,
    getMusicState,
} from './music.js';
import { OST_TRACK_KEY } from './ost.js';

test('normalizeTrackKey: "ost" → "ost"', () => {
    assert.equal(normalizeTrackKey('ost'), OST_TRACK_KEY);
    assert.equal(normalizeTrackKey(OST_TRACK_KEY), OST_TRACK_KEY);
});

test('normalizeTrackKey: off и пусто → off', () => {
    assert.equal(normalizeTrackKey('off'), 'off');
    assert.equal(normalizeTrackKey(null), 'off');
    assert.equal(normalizeTrackKey(undefined), 'off');
    assert.equal(normalizeTrackKey(''), 'off');
});

test('normalizeTrackKey: устаревшие процедурные темы → OST (легаси-сейвы)', () => {
    for (const key of ['dark', 'light', 'autumn', 'forest', 'sunset', 'abyss', 'sakura', 'bogus']) {
        assert.equal(normalizeTrackKey(key), OST_TRACK_KEY, `ключ ${key} должен стать OST`);
    }
});

test('playTrack("ost") включает OST-фасад', () => {
    stopMusic(); // сброс состояния между тестами
    playTrack('ost');
    const st = getMusicState();
    assert.equal(st.track, OST_TRACK_KEY);
    assert.equal(st.enabled, true);
});

test('playTrack с легаси-ключом процедурной темы включает OST', () => {
    stopMusic();
    playTrack('sakura');
    const st = getMusicState();
    assert.equal(st.track, OST_TRACK_KEY);
    assert.equal(st.enabled, true);
});

test('playTrack("off") выключает музыку', () => {
    playTrack('ost');
    playTrack('off');
    const st = getMusicState();
    assert.equal(st.track, null);
    assert.equal(st.enabled, false);
});

test('setMusicEnabled(false→true) переключает музыку без потери трека', () => {
    playTrack('ost');
    setMusicEnabled(false);
    assert.equal(getMusicState().enabled, false);
    setMusicEnabled(true);
    assert.equal(getMusicState().enabled, true);
    assert.equal(getMusicState().track, OST_TRACK_KEY);
    playTrack('off'); // финальный сброс
});
