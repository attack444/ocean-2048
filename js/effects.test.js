/**
 * Unit tests for the cinematic effects module (Node built-in test runner).
 * Tests pure math helpers, the EFFECTS registry, and that draw functions are
 * callable with a minimal canvas-context stub (no browser required).
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
    lerp, easeOut, easeIn, easeInOut, clamp, seeded,
    EFFECTS, EffectPlayer,
} from './effects.js';

// Минимальный стаб 2d-контекста: все методы — no-op, градиенты — объекты.
function stubCtx() {
    const gradient = { addColorStop() {} };
    const ctx = {
        save() {}, restore() {}, translate() {}, scale() {}, rotate() {},
        beginPath() {}, closePath() {}, moveTo() {}, lineTo() {},
        arc() {}, ellipse() {}, fill() {}, stroke() {}, clearRect() {},
        fillRect() {}, setTransform() {},
        createRadialGradient() { return gradient; },
        createLinearGradient() { return gradient; },
        fillStyle: '', strokeStyle: '', lineWidth: 1, globalAlpha: 1,
    };
    return ctx;
}

describe('effects math helpers', () => {
    it('lerp interpolates linearly', () => {
        assert.equal(lerp(0, 10, 0), 0);
        assert.equal(lerp(0, 10, 0.5), 5);
        assert.equal(lerp(0, 10, 1), 10);
    });

    it('clamp bounds values', () => {
        assert.equal(clamp(5, 0, 10), 5);
        assert.equal(clamp(-3, 0, 10), 0);
        assert.equal(clamp(15, 0, 10), 10);
    });

    it('easing functions stay within [0,1] and respect endpoints', () => {
        for (const fn of [easeOut, easeIn, easeInOut]) {
            assert.equal(fn(0), 0);
            assert.equal(fn(1), 1);
            for (let i = 0; i <= 10; i++) {
                const v = fn(i / 10);
                assert.ok(v >= 0 && v <= 1, `easing out of range at ${i / 10}: ${v}`);
            }
        }
    });

    it('seeded generator is deterministic and in [0,1)', () => {
        const a = seeded(42);
        const b = seeded(42);
        const samples = [];
        for (let i = 0; i < 20; i++) {
            const va = a();
            const vb = b();
            assert.equal(va, vb, 'same seed must give same sequence');
            assert.ok(va >= 0 && va < 1);
            samples.push(va);
        }
        // Не все значения одинаковы (псевдослучайность).
        assert.ok(new Set(samples).size > 1);
    });
});

describe('EFFECTS registry', () => {
    it('exposes all five existing-event visualizers', () => {
        const names = Object.keys(EFFECTS).sort();
        assert.deepEqual(names, ['bubble', 'jelly', 'storm', 'tide', 'whirlpool']);
    });

    it('each effect has a positive duration and a draw function', () => {
        for (const [name, def] of Object.entries(EFFECTS)) {
            assert.ok(def.duration > 0, `${name} duration must be positive`);
            assert.equal(typeof def.draw, 'function', `${name} must have draw`);
        }
    });
});

describe('effect draw functions', () => {
    it('all draw functions run without throwing on a stub context', () => {
        const ctx = stubCtx();
        const opts = { cx: 100, cy: 100, radius: 80, seed: 1, dir: 'down', count: 6 };
        for (const [name, def] of Object.entries(EFFECTS)) {
            // Прогоняем несколько моментов времени (включая края 0 и 1).
            for (const t of [0, 0.25, 0.5, 0.75, 1]) {
                assert.doesNotThrow(() => def.draw(ctx, t, 400, 400, opts),
                    `${name} draw at t=${t} must not throw`);
            }
        }
    });
});

describe('EffectPlayer', () => {
    it('skips immediately when reduceMotion is enabled', () => {
        const canvas = { width: 0, height: 0, style: {}, parentElement: null };
        const player = new EffectPlayer(canvas, stubCtx(), { reduceMotion: true });
        let called = false;
        player.play('storm', null, () => { called = true; });
        assert.equal(called, true, 'done must fire synchronously under reduce-motion');
        assert.equal(player.busy, false);
    });

    it('skips immediately for an unknown effect name', () => {
        const canvas = { width: 0, height: 0, style: {}, parentElement: null };
        const player = new EffectPlayer(canvas, stubCtx(), { reduceMotion: false });
        let called = false;
        player.play('does-not-exist', null, () => { called = true; });
        assert.equal(called, true);
        assert.equal(player.busy, false);
    });
});
