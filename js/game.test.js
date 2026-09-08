/**
 * Unit tests for 2048 merge / win / lose / swipe (Node built-in test runner).
 * Uses a minimal DOM stub — no browser required.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// Game attaches keydown listeners on construction.
globalThis.document = {
    addEventListener() {},
    removeEventListener() {},
    createElement() {
        return {
            className: '',
            dataset: {},
            textContent: '',
        };
    },
    body: { classList: { contains: () => false }, dataset: {} },
};

const { default: Game } = await import('./game.js');

function stubBoard() {
    const listeners = new Map();
    return {
        style: {},
        className: '',
        classList: {
            toggle() {},
            add() {},
            remove() {},
            contains() { return false; },
        },
        innerHTML: '',
        addEventListener(type, fn) {
            listeners.set(type, fn);
        },
        removeEventListener(type, fn) {
            if (listeners.get(type) === fn) listeners.delete(type);
        },
        appendChild() {},
        _listeners: listeners,
    };
}

function makeGame(opts = {}) {
    const board = stubBoard();
    // Avoid random tiles / DOM during construction.
    const addTile = Game.prototype._addNewTile;
    const render = Game.prototype.render;
    const animate = Game.prototype._animateMove;
    Game.prototype._addNewTile = function () {};
    Game.prototype.render = function () {};
    // handleMove is async via _animateMove (setTimeout) — resolve synchronously in tests.
    Game.prototype._animateMove = function (moves, cb) { cb(); };
    const game = new Game({
        boardElement: board,
        size: opts.size || 4,
        target: opts.target || 2048,
        onWin: opts.onWin || (() => {}),
        onGameOver: opts.onGameOver || (() => {}),
        onScoreUpdate: opts.onScoreUpdate || (() => {}),
        appearanceMultiplier: opts.appearanceMultiplier,
        fourChance: opts.fourChance,
        moveLimit: opts.moveLimit,
        random: opts.random,
    });
    Game.prototype._addNewTile = addTile;
    Game.prototype.render = render;
    Game.prototype._animateMove = animate;
    game.tiles = new Array(game.size * game.size).fill(null);
    game.score = 0;
    game.won = false;
    game.gameOver = false;
    game.winCelebrated = false;
    return game;
}

describe('Game._move (left merge)', () => {
    it('merges a simple pair and scores the doubled value', () => {
        const g = makeGame();
        g.tiles = [
            { id: 1, value: 2 }, { id: 2, value: 2 }, null, null,
            null, null, null, null,
            null, null, null, null,
            null, null, null, null,
        ];
        const { moved, merges } = g._move('left');
        assert.equal(moved, true);
        assert.equal(merges, 1);
        assert.deepEqual(g.tiles.slice(0, 4).map(t => (t ? t.value : null)), [4, null, null, null]);
        assert.equal(g.score, 4);
    });

    it('merges from the left once per pair (classic 2048)', () => {
        const g = makeGame();
        g.tiles = [
            { id: 1, value: 2 }, { id: 2, value: 2 }, { id: 3, value: 2 }, null,
            null, null, null, null,
            null, null, null, null,
            null, null, null, null,
        ];
        const { merges } = g._move('left');
        assert.equal(merges, 1);
        assert.deepEqual(g.tiles.slice(0, 4).map(t => (t ? t.value : null)), [4, 2, null, null]);
        assert.equal(g.score, 4);
    });

    it('merges two pairs in one line', () => {
        const g = makeGame();
        g.tiles = [
            { id: 1, value: 4 }, { id: 2, value: 4 }, { id: 3, value: 8 }, { id: 4, value: 8 },
            null, null, null, null,
            null, null, null, null,
            null, null, null, null,
        ];
        const { merges } = g._move('left');
        assert.equal(merges, 2);
        assert.deepEqual(g.tiles.slice(0, 4).map(t => (t ? t.value : null)), [8, 16, null, null]);
        assert.equal(g.score, 24);
    });
});

describe('Game.handleMove', () => {
    it('slides left and spawns exactly once after a successful move', () => {
        const g = makeGame();
        g.tiles = [
            null, { id: 2, value: 2 }, null, { id: 4, value: 2 },
            null, null, null, null,
            null, null, null, null,
            null, null, null, null,
        ];
        let spawned = 0;
        g._addNewTile = () => { spawned++; };
        g._animateMove = (moves, cb) => cb();
        g.render = () => {};
        g.handleMove('left');
        assert.deepEqual(g.tiles.slice(0, 4).map(t => (t ? t.value : null)), [4, null, null, null]);
        assert.equal(g.score, 4);
        assert.equal(spawned, 1);
    });

    it('is a no-op when nothing can move (no spawn)', () => {
        const g = makeGame();
        g.tiles = [
            { id: 1, value: 2 }, { id: 2, value: 4 }, { id: 3, value: 8 }, { id: 4, value: 16 },
            null, null, null, null,
            null, null, null, null,
            null, null, null, null,
        ];
        const before = g.tiles.map(t => (t ? t.value : null));
        let spawned = 0;
        g._addNewTile = () => { spawned++; };
        g.render = () => {};
        g.handleMove('left');
        assert.deepEqual(g.tiles.map(t => (t ? t.value : null)), before);
        assert.equal(spawned, 0);
    });
});

describe('Game win / lose', () => {
    it('detects win when a tile reaches target', () => {
        const g = makeGame({ target: 16 });
        g.tiles[0] = { id: 1, value: 16 };
        assert.equal(g._checkWin(), true);
    });

    it('detects game over on a full board with no merges', () => {
        const g = makeGame();
        g.tiles = [
            { id: 1, value: 2 },   { id: 2, value: 4 },   { id: 3, value: 8 },   { id: 4, value: 16 },
            { id: 5, value: 4 },   { id: 6, value: 8 },   { id: 7, value: 16 },  { id: 8, value: 32 },
            { id: 9, value: 8 },   { id: 10, value: 16 }, { id: 11, value: 32 }, { id: 12, value: 64 },
            { id: 13, value: 16 }, { id: 14, value: 32 }, { id: 15, value: 64 }, { id: 16, value: 128 },
        ];
        assert.equal(g._checkGameOver(), true);
    });

    it('is not game over when a merge is still possible', () => {
        const g = makeGame();
        g.tiles = [
            { id: 1, value: 2 },   { id: 2, value: 4 },   { id: 3, value: 8 },   { id: 4, value: 16 },
            { id: 5, value: 4 },   { id: 6, value: 8 },   { id: 7, value: 16 },  { id: 8, value: 32 },
            { id: 9, value: 8 },   { id: 10, value: 16 }, { id: 11, value: 32 }, { id: 12, value: 64 },
            { id: 13, value: 16 }, { id: 14, value: 32 }, { id: 15, value: 64 }, { id: 16, value: 64 },
        ];
        assert.equal(g._checkGameOver(), false);
    });
});

describe('Game swipe threshold', () => {
    it('ignores short swipes and accepts horizontal/vertical past 40px', () => {
        const g = makeGame();
        const moves = [];
        g.handleMove = (dir) => moves.push(dir);

        g._handleTouchStart({
            touches: [{ clientX: 100, clientY: 100 }],
            preventDefault() {},
        });
        g._handleTouchEnd({
            changedTouches: [{ clientX: 139, clientY: 100 }],
            preventDefault() {},
        });
        assert.deepEqual(moves, []);

        g._handleTouchStart({
            touches: [{ clientX: 100, clientY: 100 }],
            preventDefault() {},
        });
        g._handleTouchEnd({
            changedTouches: [{ clientX: 140, clientY: 100 }],
            preventDefault() {},
        });
        assert.deepEqual(moves, ['right']);

        g._handleTouchStart({
            touches: [{ clientX: 100, clientY: 100 }],
            preventDefault() {},
        });
        g._handleTouchEnd({
            changedTouches: [{ clientX: 100, clientY: 50 }],
            preventDefault() {},
        });
        assert.deepEqual(moves, ['right', 'up']);
    });
});

describe('Game streak & addScore', () => {
    it('increments the streak on a merging move and resets on a plain move', () => {
        const g = makeGame();
        g._addNewTile = () => {};
        g._animateMove = (moves, cb) => cb();
        g.render = () => {};

        g.tiles = [
            { id: 1, value: 2 }, { id: 2, value: 2 }, null, null,
            null, null, null, null,
            null, null, null, null,
            null, null, null, null,
        ];
        g.handleMove('left');
        assert.equal(g.streak, 1);

        // Ход без слияния, но с перемещением — серия сбрасывается
        g.tiles = [
            null, { id: 3, value: 2 }, null, { id: 4, value: 4 },
            null, null, null, null,
            null, null, null, null,
            null, null, null, null,
        ];
        g.handleMove('left');
        assert.equal(g.streak, 0);
    });

    it('undo restores the streak of the previous position', () => {
        const g = makeGame();
        g._addNewTile = () => {};
        g._animateMove = (moves, cb) => cb();
        g.render = () => {};

        g.tiles = [
            { id: 1, value: 2 }, { id: 2, value: 2 }, null, null,
            null, null, null, null,
            null, null, null, null,
            null, null, null, null,
        ];
        g.handleMove('left');
        assert.equal(g.streak, 1);
        g.undo();
        assert.equal(g.streak, 0);
    });

    it('addScore adds bonus points and notifies the score callback', () => {
        const g = makeGame();
        let notified = null;
        g.onScoreUpdate = (s) => { notified = s; };
        g.score = 100;
        const added = g.addScore(50);
        assert.equal(added, 50);
        assert.equal(g.score, 150);
        assert.equal(notified, 150);
    });

    it('addScore ignores non-positive amounts', () => {
        const g = makeGame();
        g.score = 10;
        assert.equal(g.addScore(0), 0);
        assert.equal(g.addScore(-5), 0);
        assert.equal(g.score, 10);
    });

    it('tracks the streak in getStats', () => {
        const g = makeGame();
        g.streak = 4;
        assert.equal(g.getStats().streak, 4);
    });
});

describe('Game shuffle boost', () => {
    it('returns false when the board has fewer than 2 tiles', () => {
        const g = makeGame();
        g.tiles = [
            { id: 1, value: 2 }, null, null, null,
            null, null, null, null,
            null, null, null, null,
            null, null, null, null,
        ];
        assert.equal(g.shuffle(), false);
    });

    it('returns false when the game is over', () => {
        const g = makeGame();
        g.tiles = [
            { id: 1, value: 2 }, { id: 2, value: 4 }, null, null,
            null, null, null, null,
            null, null, null, null,
            null, null, null, null,
        ];
        g.gameOver = true;
        assert.equal(g.shuffle(), false);
    });

    it('preserves the multiset of tile values when shuffling', () => {
        const g = makeGame();
        g.render = () => {};
        g.tiles = [
            { id: 1, value: 2 }, { id: 2, value: 4 }, { id: 3, value: 8 }, null,
            null, null, null, null,
            null, null, null, null,
            null, null, null, null,
        ];
        const before = g.tiles.filter(Boolean).map(t => t.value).sort((a, b) => a - b);
        assert.equal(g.shuffle(), true);
        const after = g.tiles.filter(Boolean).map(t => t.value).sort((a, b) => a - b);
        assert.deepEqual(after, before);
    });

    it('reorders tiles deterministically when Math.random is fixed', () => {
        const g = makeGame();
        g.render = () => {};
        g.tiles = [
            { id: 1, value: 2 }, { id: 2, value: 4 }, { id: 3, value: 8 }, null,
            null, null, null, null,
            null, null, null, null,
            null, null, null, null,
        ];
        const orig = Math.random;
        Math.random = () => 0; // Фишер–Йетс с j = 0
        try {
            g.shuffle();
        } finally {
            Math.random = orig;
        }
        // [2,4,8] → i=2: меняем местами idx2 и idx0 → [8,4,2]; i=1: idx1 и idx0 → [4,8,2]
        assert.deepEqual(g.tiles.filter(Boolean).map(t => t.value), [4, 8, 2]);
    });
});

describe('Game bomb boost (removeLowestTile)', () => {
    it('removes the lowest-value tile (clears space, keeps progress) and returns its value', () => {
        const g = makeGame();
        g.render = () => {};
        g.tiles = [
            { id: 1, value: 2 }, { id: 2, value: 16 }, { id: 3, value: 4 }, null,
            null, null, null, null,
            null, null, null, null,
            null, null, null, null,
        ];
        assert.equal(g.removeLowestTile(), 2);
        const remaining = g.tiles.filter(Boolean).map(t => t.value);
        assert.ok(!remaining.includes(2));
        assert.ok(remaining.includes(16)); // большая плитка сохраняется
        assert.equal(remaining.length, 2);
    });

    it('removes a single tile when the minimum value appears twice', () => {
        const g = makeGame();
        g.render = () => {};
        g.tiles = [
            { id: 1, value: 8 }, { id: 2, value: 8 }, null, null,
            null, null, null, null,
            null, null, null, null,
            null, null, null, null,
        ];
        assert.equal(g.removeLowestTile(), 8);
        assert.equal(g.tiles.filter(Boolean).length, 1);
    });

    it('returns null when the board is empty', () => {
        const g = makeGame();
        g.tiles = Array(16).fill(null);
        assert.equal(g.removeLowestTile(), null);
    });
});

describe('Game lightning boost (removeLowestTiles)', () => {
    it('removes the n lowest tiles at once and returns their values', () => {
        const g = makeGame();
        g.render = () => {};
        g.tiles = [
            { id: 1, value: 2 }, { id: 2, value: 16 }, { id: 3, value: 4 }, { id: 4, value: 8 }, null,
            null, null, null, null,
            null, null, null, null,
            null, null, null, null,
        ];
        assert.deepEqual(g.removeLowestTiles(3), [2, 4, 8]);
        const remaining = g.tiles.filter(Boolean).map(t => t.value);
        assert.deepEqual(remaining, [16]);
    });

    it('removes fewer than n when the board has fewer tiles', () => {
        const g = makeGame();
        g.render = () => {};
        g.tiles = [
            { id: 1, value: 4 }, { id: 2, value: 8 }, null, null,
            null, null, null, null,
            null, null, null, null,
            null, null, null, null,
        ];
        assert.deepEqual(g.removeLowestTiles(3), [4, 8]);
        assert.equal(g.tiles.filter(Boolean).length, 0);
    });

    it('returns an empty array on an empty board', () => {
        const g = makeGame();
        g.tiles = Array(16).fill(null);
        assert.deepEqual(g.removeLowestTiles(3), []);
    });
});

describe('Game bonus tile perk (addBonusTile)', () => {
    it('spawns a tile of the requested value on a random empty cell', () => {
        const g = makeGame();
        g.render = () => {};
        g.tiles = Array(16).fill(null);
        assert.equal(g.addBonusTile(4), true);
        const filled = g.tiles.filter(Boolean);
        assert.equal(filled.length, 1);
        assert.equal(filled[0].value, 4);
        assert.equal(filled[0].justSpawned, true);
    });

    it('returns false when the board is full', () => {
        const g = makeGame();
        g.tiles = [
            { id: 1, value: 2 }, { id: 2, value: 4 }, { id: 3, value: 8 }, { id: 4, value: 16 },
            { id: 5, value: 4 }, { id: 6, value: 8 }, { id: 7, value: 16 }, { id: 8, value: 32 },
            { id: 9, value: 8 }, { id: 10, value: 16 }, { id: 11, value: 32 }, { id: 12, value: 64 },
            { id: 13, value: 16 }, { id: 14, value: 32 }, { id: 15, value: 64 }, { id: 16, value: 128 },
        ];
        assert.equal(g.addBonusTile(4), false);
        assert.equal(g.tiles.filter(Boolean).length, 16);
    });
});

describe('Game score multiplier boost (x2)', () => {
    it('starts with no active multiplier', () => {
        const g = makeGame();
        assert.equal(g.getScoreMultiplierMoves(), 0);
    });

    it('activateScoreMultiplier sets the remaining merging moves', () => {
        const g = makeGame();
        g.render = () => {};
        g.activateScoreMultiplier(3);
        assert.equal(g.getScoreMultiplierMoves(), 3);
        g.activateScoreMultiplier(0);
        assert.equal(g.getScoreMultiplierMoves(), 0);
    });

    it('doubles merge-gained score and spends a charge only on merging moves', () => {
        const g = makeGame();
        g._addNewTile = () => {};
        g._animateMove = (moves, cb) => cb();
        g.render = () => {};

        g.tiles = [
            { id: 1, value: 2 }, { id: 2, value: 2 }, null, null,
            null, null, null, null,
            null, null, null, null,
            null, null, null, null,
        ];
        g.activateScoreMultiplier(2);
        g.handleMove('left'); // слияние 2+2 → +4, ×2 → +8
        assert.equal(g.score, 8);
        assert.equal(g.getScoreMultiplierMoves(), 1);

        // Ход с перемещением, но без слияния — ×2 не тратится и очки не удваиваются
        g.tiles = [
            null, { id: 3, value: 4 }, null, null,
            null, null, null, null,
            null, null, null, null,
            null, null, null, null,
        ];
        g.handleMove('left');
        assert.equal(g.score, 8);
        assert.equal(g.getScoreMultiplierMoves(), 1);
    });

    it('resets the multiplier in init and loadState', () => {
        const g = makeGame();
        g.render = () => {};
        g.activateScoreMultiplier(2);
        g.init();
        assert.equal(g.getScoreMultiplierMoves(), 0);

        g.activateScoreMultiplier(2);
        g.loadState({ tiles: Array(16).fill(null), score: 0, moves: 0, nextTileId: 1 });
        assert.equal(g.getScoreMultiplierMoves(), 0);
    });

    it('triples merge-gained score when mult is 3 (x2 boost)', () => {
        const g = makeGame();
        g._addNewTile = () => {};
        g._animateMove = (moves, cb) => cb();
        g.render = () => {};
        g.tiles = [
            { id: 1, value: 2 }, { id: 2, value: 2 }, null, null,
            null, null, null, null,
            null, null, null, null,
            null, null, null, null,
        ];
        g.activateScoreMultiplier(1, 3); // ×3 на 1 ход со слиянием
        g.handleMove('left'); // слияние 2+2 → +4, ×3 → +12
        assert.equal(g.score, 12);
        assert.equal(g.getScoreMultiplierMoves(), 0);
    });

    it('getScoreMultiplierMult returns 2 by default and the updated mult', () => {
        const g = makeGame();
        g.render = () => {};
        assert.equal(g.getScoreMultiplierMult(), 2);
        g.activateScoreMultiplier(2, 3);
        assert.equal(g.getScoreMultiplierMult(), 3);
        g.activateScoreMultiplier(0, 1); // множитель не опускается ниже 2
        assert.equal(g.getScoreMultiplierMult(), 2);
    });
});

describe('Game appearance bonus and four-chance perks', () => {
    it('applies the skin/theme score bonus (+30%) on a merge', () => {
        const g = makeGame({ appearanceMultiplier: 1.3 });
        g._addNewTile = () => {};
        g._animateMove = (moves, cb) => cb();
        g.render = () => {};
        g.tiles = [
            { id: 1, value: 2 }, { id: 2, value: 2 }, null, null,
            null, null, null, null,
            null, null, null, null,
            null, null, null, null,
        ];
        g.handleMove('left'); // слияние 2+2 → +4, +30% → +round(4*0.3)=+1 → 5
        assert.equal(g.score, 5);
    });

    it('adds no bonus when appearanceMultiplier is 1 (base skin)', () => {
        const g = makeGame();
        g._addNewTile = () => {};
        g._animateMove = (moves, cb) => cb();
        g.render = () => {};
        g.tiles = [
            { id: 1, value: 2 }, { id: 2, value: 2 }, null, null,
            null, null, null, null,
            null, null, null, null,
            null, null, null, null,
        ];
        g.handleMove('left'); // слияние 2+2 → +4, без бонуса → 4
        assert.equal(g.score, 4);
    });

    it('spawns 4 when random is below fourChance', () => {
        const g = makeGame({ fourChance: 0.3 });
        g.tiles = Array(16).fill(null);
        const orig = Math.random;
        try {
            Math.random = () => 0; // idx 0 и 0 < 0.3 → 4
            g._addNewTile();
        } finally {
            Math.random = orig;
        }
        const filled = g.tiles.filter(Boolean);
        assert.equal(filled.length, 1);
        assert.equal(filled[0].value, 4);
    });

    it('spawns 2 when random is above fourChance', () => {
        const g = makeGame({ fourChance: 0.3 });
        g.tiles = Array(16).fill(null);
        const orig = Math.random;
        try {
            Math.random = () => 0.9; // 0.9 >= 0.3 → 2
            g._addNewTile();
        } finally {
            Math.random = orig;
        }
        const filled = g.tiles.filter(Boolean);
        assert.equal(filled.length, 1);
        assert.equal(filled[0].value, 2);
    });

    it('default four chance is 10%', () => {
        const g = makeGame();
        g.tiles = Array(16).fill(null);
        const orig = Math.random;
        try {
            Math.random = () => 0.05; // < 0.1 → 4
            g._addNewTile();
        } finally {
            Math.random = orig;
        }
        const filled = g.tiles.filter(Boolean);
        assert.equal(filled[0].value, 4);
    });

    it('uses an injected seeded RNG for tile placement (daily puzzle)', () => {
        // Детерминированный источник: каждая новая партия с одним сидом спавнит
        // плитки в одном и том же порядке — основа ежедневной головоломки с общим сидом.
        function mulberry(seed) {
            let a = seed >>> 0;
            return () => {
                a |= 0;
                a = (a + 0x6D2B79F5) | 0;
                let t = Math.imul(a ^ (a >>> 15), 1 | a);
                t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
                return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
            };
        }
        const build = (seed) => {
            const g = makeGame({ random: mulberry(seed) });
            g.tiles = Array(16).fill(null);
            g.render = () => {};
            return g;
        };
        // Доска после N спавнов (значения 0 для пустых клеток) — детерминированная.
        const boardAfter = (seed, n) => {
            const g = build(seed);
            for (let i = 0; i < n; i++) g._addNewTile();
            return g.tiles.map(t => (t ? t.value : 0));
        };

        // Один и тот же сид → одинаковая доска (общий сид дня).
        assert.deepEqual(boardAfter(777, 4), boardAfter(777, 4));
        // Разные сиды → разные доски.
        assert.notDeepEqual(boardAfter(777, 4), boardAfter(778, 4));
    });
});

describe('Game tide (Прилив 🌊)', () => {
    function makeTideGame(opts = {}) {
        const board = stubBoard();
        const addTile = Game.prototype._addNewTile;
        const render = Game.prototype.render;
        const animate = Game.prototype._animateMove;
        Game.prototype._addNewTile = function () {};
        Game.prototype.render = function () {};
        Game.prototype._animateMove = function (moves, cb) { cb(); };
        const game = new Game({
            boardElement: board,
            size: opts.size || 4,
            target: opts.target || 2048,
            tide: Object.assign({ enabled: true, interval: 3, depth: 1, scoreReturn: 0.5, warning: 2 }, opts.tide),
        });
        Game.prototype._addNewTile = addTile;
        Game.prototype.render = render;
        Game.prototype._animateMove = animate;
        game.tiles = new Array(game.size * game.size).fill(null);
        game.score = 0;
        return game;
    }

    it('is disabled when no tide config is passed', () => {
        const g = makeGame();
        assert.equal(g.getTide(), null);
    });

    it('initializes the countdown to the configured interval', () => {
        const g = makeTideGame({ tide: { interval: 5, depth: 1 } });
        assert.equal(g.tideMovesUntilRise, 5);
        assert.equal(g.getTide().movesUntilRise, 5);
    });

    it('sweeps the bottom row and returns half the value as score on tide', () => {
        const g = makeTideGame({ tide: { interval: 1, depth: 1, scoreReturn: 0.5 } });
        let swept = null;
        g.onTide = (s) => { swept = s; };
        g.tiles = [
            null, null, null, null,
            { id: 1, value: 4 }, null, null, null,
            null, null, null, null,
            { id: 2, value: 8 }, { id: 3, value: 2 }, null, null,
        ];
        // Счёт до смыва (добавлен вручную, чтобы проверить прибавку)
        g.score = 0;
        g._triggerTide();
        // Нижний ряд (индексы 12..15): 8 и 2 унесены, 4 на втором ряду остаётся
        assert.deepEqual(g.tiles.map(t => (t ? t.value : null)), [
            null, null, null, null,
            { id: 1, value: 4 }, null, null, null,
            null, null, null, null,
            null, null, null, null,
        ].map(t => (t ? t.value : null)));
        assert.equal(g.tideSwept, 2);
        assert.equal(g.tideSweptValue, 10);
        // 8*0.5 + 2*0.5 = 5
        assert.equal(g.score, 5);
        assert.equal(g.tideActive, true);
        assert.deepEqual(swept.map(s => ({ value: s.value, gain: s.gain })),
            [{ value: 8, gain: 4 }, { value: 2, gain: 1 }]);
    });

    it('counts down every move and sweeps when the interval elapses', () => {
        const g = makeTideGame({ tide: { interval: 2, depth: 1, scoreReturn: 0 } });
        g._addNewTile = () => {};
        g._animateMove = (moves, cb) => cb();
        g.render = () => {};
        // Горизонтальные ходы оставляют плитку в нижнем ряду — её и смывает прилив.
        g.tiles = [
            null, null, null, null,
            null, null, null, null,
            null, null, null, null,
            null, { id: 2, value: 8 }, null, null,
        ];
        g.handleMove('left'); // ход 1: 8 → нижний левый угол; отсчёт 2→1, прилива нет
        assert.equal(g.tideMovesUntilRise, 1);
        assert.equal(g.tideSwept, 0);

        g.handleMove('right'); // ход 2: 8 → нижний правый угол; отсчёт 1→0 → прилив
        assert.equal(g.tideMovesUntilRise, 2); // счётчик сброшен на интервал
        assert.equal(g.tideSwept, 1);          // плитка 8 унесена течением
        assert.equal(g.tiles[15], null);       // нижний ряд пуст после смыва
    });

    it('respects tide depth greater than 1', () => {
        const g = makeTideGame({ tide: { interval: 1, depth: 2, scoreReturn: 0 } });
        g.tiles = [
            null, null, null, null,
            null, null, null, null,
            { id: 1, value: 4 }, null, null, null,
            { id: 2, value: 8 }, { id: 3, value: 2 }, null, null,
        ];
        g._triggerTide();
        // Смыты два нижних ряда (строки 2 и 3)
        assert.equal(g.tideSwept, 3);
        assert.equal(g.tiles.filter(Boolean).length, 0);
    });

    it('caps tide depth to the board size', () => {
        const g = makeTideGame({ tide: { interval: 1, depth: 99, scoreReturn: 0 } });
        g.tiles = [
            { id: 1, value: 2 }, null, null, null,
            { id: 2, value: 4 }, null, null, null,
            { id: 3, value: 8 }, null, null, null,
            { id: 4, value: 16 }, null, null, null,
        ];
        g._triggerTide();
        assert.equal(g.tideSwept, 4); // не больше, чем 4 плитки на доске 4×4
    });

    it('undo restores the tide countdown and swept counters', () => {
        const g = makeTideGame({ tide: { interval: 2, depth: 1, scoreReturn: 0 } });
        g._addNewTile = () => {};
        g._animateMove = (moves, cb) => cb();
        g.render = () => {};
        g.tiles = [
            { id: 1, value: 2 }, null, null, null,
            null, null, null, null,
            null, null, null, null,
            { id: 2, value: 8 }, null, null, null,
        ];
        g.handleMove('up');
        assert.equal(g.tideMovesUntilRise, 1);
        g.undo();
        assert.equal(g.tideMovesUntilRise, 2);
    });

    it('resets tide counters in init', () => {
        const g = makeTideGame({ tide: { interval: 3, depth: 1, scoreReturn: 0 } });
        g.render = () => {};
        g.tideMovesUntilRise = 0;
        g.tideSwept = 5;
        g.tideSweptValue = 40;
        g.init();
        assert.equal(g.tideMovesUntilRise, 3);
        assert.equal(g.tideSwept, 0);
        assert.equal(g.tideSweptValue, 0);
    });

    it('persists tide state across loadState/saveState round-trip', () => {
        const g = makeTideGame({ tide: { interval: 3, depth: 1, scoreReturn: 0 } });
        g.tideMovesUntilRise = 1;
        g.tideSwept = 4;
        g.tideSweptValue = 30;
        const state = g.getState();
        assert.equal(state.tideMovesUntilRise, 1);
        assert.equal(state.tideSwept, 4);
        assert.equal(state.tideSweptValue, 30);

        const g2 = makeTideGame({ tide: { interval: 3, depth: 1, scoreReturn: 0 } });
        g2.render = () => {};
        g2.loadState(state);
        assert.equal(g2.tideMovesUntilRise, 1);
        assert.equal(g2.tideSwept, 4);
        assert.equal(g2.tideSweptValue, 30);
    });

    it('is unaffected by a non-tide game (regression check)', () => {
        const g = makeGame();
        g._addNewTile = () => {};
        g._animateMove = (moves, cb) => cb();
        g.render = () => {};
        g.tiles = [
            { id: 1, value: 2 }, null, null, null,
            null, null, null, null,
            null, null, null, null,
            { id: 2, value: 8 }, null, null, null,
        ];
        g.handleMove('up');
        assert.equal(g.tideSwept, 0);
        assert.equal(g.getTide(), null);
        // Плитка 8 не унесена течением — она просто сдвинулась ходом «вверх»
        assert.equal(g.tiles.some(t => t && t.value === 8), true);
    });
});

describe('Game moves-as-resource (Ходы как ресурс 🧮)', () => {
    function makeMovesGame(opts = {}) {
        const board = stubBoard();
        const addTile = Game.prototype._addNewTile;
        const render = Game.prototype.render;
        const animate = Game.prototype._animateMove;
        Game.prototype._addNewTile = function () {};
        Game.prototype.render = function () {};
        Game.prototype._animateMove = function (moves, cb) { cb(); };
        const game = new Game({
            boardElement: board,
            size: opts.size || 4,
            target: opts.target || 2048,
            tide: opts.tide || null,
            moves: Object.assign(
                { enabled: true, tideStep: 1, maxWithoutMerge: 4, depth: 1 },
                opts.moves
            ),
        });
        Game.prototype._addNewTile = addTile;
        Game.prototype.render = render;
        Game.prototype._animateMove = animate;
        game.tiles = new Array(game.size * game.size).fill(null);
        game.score = 0;
        return game;
    }

    it('is disabled when no moves config is passed', () => {
        const g = makeGame();
        assert.equal(g.getMovesPenalty(), null);
    });

    it('does not advance the tide on a merging move', () => {
        // Прилив выключен — штраф по шагам прилива не должен ничего ломать
        const g = makeMovesGame({ moves: { tideStep: 2, maxWithoutMerge: 10 } });
        g._addNewTile = () => {};
        g._animateMove = (moves, cb) => cb();
        g.render = () => {};
        g.tiles = [
            { id: 1, value: 2 }, { id: 2, value: 2 }, null, null,
            null, null, null, null,
            null, null, null, null,
            { id: 3, value: 8 }, null, null, null,
        ];
        g.handleMove('left'); // слияние 2+2
        assert.equal(g.movesWithoutMerge, 0);
        assert.equal(g.threatSwept, 0);
        assert.equal(g.getMovesPenalty().movesWithoutMerge, 0);
    });

    it('counts useless moves and never triggers without the threshold', () => {
        const g = makeMovesGame({ moves: { tideStep: 0, maxWithoutMerge: 4 } });
        g._addNewTile = () => {};
        g._animateMove = (moves, cb) => cb();
        g.render = () => {};
        g.tiles = [
            { id: 1, value: 2 }, { id: 2, value: 4 }, null, null,
            null, null, null, null,
            null, null, null, null,
            { id: 3, value: 8 }, null, null, null,
        ];
        // Бесполезный ход вверх не трогает нижний ряд — 2 и 4 сдвигаются
        g.handleMove('up');
        assert.equal(g.movesWithoutMerge, 1);
        assert.equal(g.threatSwept, 0);
        assert.equal(g.threatStrikes, 0);
        assert.equal(g.getMovesPenalty().movesWithoutMerge, 1);
    });

    it('triggers a whirlpool after the configured run of useless moves', () => {
        const g = makeMovesGame({ moves: { tideStep: 0, maxWithoutMerge: 2 } });
        g._addNewTile = () => {};
        g._animateMove = (moves, cb) => cb();
        g.render = () => {};
        let threats = [];
        g.onThreat = (s) => { threats = s; };
        g.tiles = [
            { id: 1, value: 2 }, null, { id: 2, value: 4 }, null,
            null, null, null, null,
            null, null, null, null,
            { id: 3, value: 8 }, null, null, null,
        ];
        // 1-й бесполезный ход влево: 4 сдвигается, слияний нет, нижний ряд не тронут
        g.handleMove('left');
        assert.equal(g.movesWithoutMerge, 1);
        assert.equal(g.threatSwept, 0);
        // 2-й бесполезный ход вправо: слияний нет, 8 остаётся в нижнем ряду → порог достигнут
        g.handleMove('right');
        assert.equal(g.threatSwept, 1);          // 8 затянута водоворотом
        assert.equal(g.threatSweptValue, 8);
        assert.equal(g.threatStrikes, 1);
        assert.equal(g.movesWithoutMerge, 0);    // счётчик сброшен после водоворота
        assert.equal(g.tiles[15], null);
        assert.equal(threats[0].value, 8);
        assert.equal(g.getMovesPenalty().strikes, 1);
    });

    it('useless moves advance the tide countdown when tide is enabled', () => {
        const g = makeMovesGame({
            tide: { enabled: true, interval: 6, depth: 1, scoreReturn: 0.5, warning: 3 },
            moves: { tideStep: 1, maxWithoutMerge: 99 },
        });
        g._addNewTile = () => {};
        g._animateMove = (moves, cb) => cb();
        g.render = () => {};
        g.tiles = [
            { id: 1, value: 2 }, { id: 2, value: 4 }, null, null,
            null, null, null, null,
            null, null, null, null,
            { id: 3, value: 8 }, null, null, null,
        ];
        // Бесполезный ход вверх: прилив 6→5 + шаг штрафа → 4
        g.handleMove('up');
        assert.equal(g.movesWithoutMerge, 1);
        assert.equal(g.tideMovesUntilRise, 4);
        assert.equal(g.tideSwept, 0); // прилив ещё не наступил
    });

    it('a merging move resets the useless-move counter', () => {
        const g = makeMovesGame({ moves: { tideStep: 0, maxWithoutMerge: 4 } });
        g._addNewTile = () => {};
        g._animateMove = (moves, cb) => cb();
        g.render = () => {};
        g.tiles = [
            { id: 1, value: 2 }, { id: 2, value: 2 }, null, null,
            null, null, null, null,
            null, null, null, null,
            { id: 3, value: 8 }, null, null, null,
        ];
        g.handleMove('up');  // без слияния
        assert.equal(g.movesWithoutMerge, 1);
        g.handleMove('left'); // слияние 2+2
        assert.equal(g.movesWithoutMerge, 0);
    });

    it('undo restores the whirlpool counters and the useless-move counter', () => {
        const g = makeMovesGame({ moves: { tideStep: 0, maxWithoutMerge: 2 } });
        g._addNewTile = () => {};
        g._animateMove = (moves, cb) => cb();
        g.render = () => {};
        g.tiles = [
            { id: 1, value: 2 }, { id: 2, value: 4 }, null, null,
            null, null, null, null,
            null, null, null, null,
            { id: 3, value: 8 }, null, null, null,
        ];
        g.handleMove('up');   // 1 бесполезный ход
        g.handleMove('down'); // 2-й → водоворот
        assert.equal(g.threatStrikes, 1);
        assert.equal(g.movesWithoutMerge, 0);
        g.undo();
        assert.equal(g.threatStrikes, 0);
        assert.equal(g.threatSwept, 0);
        assert.equal(g.movesWithoutMerge, 1);
    });

    it('resets moves-penalty counters in init', () => {
        const g = makeMovesGame({ moves: { tideStep: 0, maxWithoutMerge: 4 } });
        g.render = () => {};
        g.threatStrikes = 3;
        g.threatSwept = 5;
        g.threatSweptValue = 40;
        g.movesWithoutMerge = 2;
        g.init();
        assert.equal(g.threatStrikes, 0);
        assert.equal(g.threatSwept, 0);
        assert.equal(g.threatSweptValue, 0);
        assert.equal(g.movesWithoutMerge, 0);
    });

    it('persists moves-penalty state across loadState/saveState round-trip', () => {
        const g = makeMovesGame({ moves: { tideStep: 0, maxWithoutMerge: 4 } });
        g.threatStrikes = 2;
        g.threatSwept = 3;
        g.threatSweptValue = 20;
        g.movesWithoutMerge = 1;
        const state = g.getState();
        assert.equal(state.threatStrikes, 2);
        assert.equal(state.threatSwept, 3);
        assert.equal(state.threatSweptValue, 20);

        const g2 = makeMovesGame({ moves: { tideStep: 0, maxWithoutMerge: 4 } });
        g2.render = () => {};
        g2.loadState(state);
        assert.equal(g2.threatStrikes, 2);
        assert.equal(g2.threatSwept, 3);
        assert.equal(g2.threatSweptValue, 20);
    });

    it('respects whirlpool depth greater than 1', () => {
        const g = makeMovesGame({ moves: { tideStep: 0, maxWithoutMerge: 2, depth: 2 } });
        g.tiles = [
            { id: 1, value: 2 }, null, null, null,
            null, null, null, null,
            { id: 2, value: 4 }, null, null, null,
            { id: 3, value: 8 }, { id: 4, value: 16 }, null, null,
        ];
        g.movesWithoutMerge = 2; // уже накоплено
        g._triggerWhirlpool();
        // Смыты два нижних ряда (строки 2 и 3), верхний ряд (строка 0) остаётся
        assert.equal(g.threatSwept, 3);
        assert.equal(g.tiles.filter(Boolean).length, 1);
        assert.equal(g.tiles[0].value, 2);
    });
});

describe('Game shark (Акула-охотник 🦈)', () => {
    function makeSharkGame(opts = {}) {
        const board = stubBoard();
        const addTile = Game.prototype._addNewTile;
        const render = Game.prototype.render;
        const animate = Game.prototype._animateMove;
        Game.prototype._addNewTile = function () {};
        Game.prototype.render = function () {};
        Game.prototype._animateMove = function (moves, cb) { cb(); };
        const game = new Game({
            boardElement: board,
            size: opts.size || 4,
            target: opts.target || 2048,
            tide: opts.tide || null,
            moves: opts.moves || null,
            shark: Object.assign(
                { enabled: true, appearMoves: 3, stepInterval: 2, targetThreshold: 8, protectChance: 0 },
                opts.shark
            ),
            random: opts.random,
        });
        Game.prototype._addNewTile = addTile;
        Game.prototype.render = render;
        Game.prototype._animateMove = animate;
        game.tiles = new Array(game.size * game.size).fill(null);
        game.score = 0;
        return game;
    }

    it('is disabled when no shark config is passed', () => {
        const g = makeGame();
        assert.equal(g.getShark(), null);
        assert.equal(g.sharkPos, null);
    });

    it('normalizes shark config and starts the countdown to appearance', () => {
        const g = makeSharkGame({ shark: { appearMoves: 3, stepInterval: 2, targetThreshold: 8 } });
        assert.equal(g.sharkPos, null);
        assert.equal(g.sharkMovesUntilStep, 3);
        const s = g.getShark();
        assert.equal(s.enabled, true);
        assert.equal(s.appearMoves, 3);
        assert.equal(s.movesUntilStep, 3);
        assert.equal(s.pos, null);
    });

    it('spawns the shark on a random empty cell after the appear countdown', () => {
        const g = makeSharkGame({ shark: { appearMoves: 1, stepInterval: 2, targetThreshold: 8 } });
        // Фиксированный RNG: спавн выбирает первую пустую клетку
        g._rng = () => 0;
        g.tiles = [
            { id: 1, value: 4 }, null, null, null,
            null, null, null, null,
            null, null, null, null,
            null, null, null, null,
        ];
        const spawns = [];
        g.onSharkEat = (e) => { if (e.spawn !== undefined) spawns.push(e.spawn); };
        g._spawnShark();
        // Клетка 0 занята плиткой 4 — акула появляется на первой свободной (индекс 1)
        assert.equal(g.sharkPos, 1);
        assert.equal(g.sharkMovesUntilStep, 2); // интервал шага
        assert.deepEqual(spawns, [1]);
    });

    it('ticks the appear countdown on every move and spawns through handleMove', () => {
        const g = makeSharkGame({ shark: { appearMoves: 1, stepInterval: 2, targetThreshold: 8 } });
        g._addNewTile = () => {};
        g._animateMove = (moves, cb) => cb();
        g.render = () => {};
        g._rng = () => 0; // спавн всегда выбирает первую пустую клетку
        g.tiles = [
            { id: 1, value: 4 }, null, null, null,
            null, null, null, null,
            null, null, null, null,
            null, null, null, null,
        ];
        assert.equal(g.sharkMovesUntilStep, 1);
        g.handleMove('down'); // ход реальный: плитка 4 вниз; отсчёт 1→0 → спавн
        // После хода плитка 4 на индексе 12, первая пустая клетка — индекс 0
        assert.equal(g.sharkPos, 0);
        assert.equal(g.sharkMovesUntilStep, 2);
    });

    it('moves toward a target tile and eats it when reached', () => {
        const g = makeSharkGame({ shark: { appearMoves: 0, stepInterval: 1, targetThreshold: 8, protectChance: 0 } });
        g.sharkPos = 0; // акула в левом верхнем углу
        g.sharkMovesUntilStep = 1;
        g._rng = () => 0.999; // никогда не «не замечает» цель
        g.tiles = [
            null, null, null, null,
            null, null, null, null,
            { id: 1, value: 16 }, null, null, null,
            null, null, null, null,
        ];
        // Цель — 16 (индекс 8), путь чистый: первый шаг — только движение 0 → 4
        g._sharkStep();
        assert.equal(g.sharkPos, 4);
        assert.equal(g.sharkTarget, 8);
        assert.equal(g.tiles[8] !== null, true); // плитка пока не съедена — акула только подошла
        assert.equal(g.sharkEaten, 0);
        // Шаг 2: акула шагает на клетку с целью и съедает её
        g.sharkMovesUntilStep = 1;
        g._sharkStep();
        assert.equal(g.sharkPos, 8);
        assert.equal(g.tiles[8], null);
        assert.equal(g.sharkEaten, 1);
        assert.equal(g.sharkEatenValue, 16);
    });

    it('eats a tile in its path before reaching the target', () => {
        const g = makeSharkGame({ shark: { appearMoves: 0, stepInterval: 1, targetThreshold: 8, protectChance: 0 } });
        g.sharkPos = 0;
        g.sharkMovesUntilStep = 1;
        g._rng = () => 0.999;
        g.tiles = [
            null, null, null, null,
            { id: 1, value: 4 }, null, null, null,
            null, { id: 2, value: 16 }, null, null,
            null, null, null, null,
        ];
        // Цель — 16 (индекс 9); по пути (индекс 4) стоит плитка 4 — жертва по пути
        g._sharkStep();
        assert.equal(g.sharkPos, 4);
        assert.equal(g.tiles[4], null); // жертва по пути съедена
        assert.equal(g.sharkEaten, 1);
        assert.equal(g.sharkEatenValue, 4);
    });

    it('ignores tiles below the target threshold', () => {
        const g = makeSharkGame({ shark: { appearMoves: 0, stepInterval: 1, targetThreshold: 16, protectChance: 0 } });
        g.sharkPos = 0;
        g.sharkMovesUntilStep = 1;
        g.tiles = [
            null, null, null, null,
            { id: 1, value: 8 }, null, null, null,
            null, null, null, null,
            null, null, null, null,
        ];
        g._sharkStep();
        // Целей >= 16 нет — акула остаётся на месте, ничего не ест
        assert.equal(g.sharkPos, 0);
        assert.equal(g.sharkTarget, -1);
        assert.equal(g.sharkEaten, 0);
    });

    it('protectChance can make the shark miss its target (stays in place)', () => {
        const g = makeSharkGame({ shark: { appearMoves: 0, stepInterval: 1, targetThreshold: 8, protectChance: 0.5 } });
        g.sharkPos = 0;
        g.sharkMovesUntilStep = 1;
        g._rng = () => 0.1; // < 0.5 → «не заметила» цель
        g.tiles = [
            null, null, null, null,
            { id: 1, value: 16 }, null, null, null,
            null, null, null, null,
            null, null, null, null,
        ];
        g._sharkStep();
        assert.equal(g.sharkPos, 0); // не двинулась
        assert.equal(g.sharkTarget, 4); // цель всё же выбрана (для подсветки UI)
        assert.equal(g.sharkEaten, 0);
        assert.equal(g.sharkActive, true);
    });

    it('undo restores shark position, countdown and eaten counters', () => {
        const g = makeSharkGame({ shark: { appearMoves: 0, stepInterval: 2, targetThreshold: 8, protectChance: 0 } });
        g._addNewTile = () => {};
        g._animateMove = (moves, cb) => cb();
        g.render = () => {};
        g.sharkPos = 5;
        g.sharkMovesUntilStep = 1;
        g.sharkTarget = 9;
        g.sharkEaten = 2;
        g.sharkEatenValue = 24;
        g.tiles = [
            null, null, null, null,
            null, { id: 1, value: 16 }, null, null,
            null, null, null, null,
            { id: 2, value: 8 }, null, null, null,
        ];
        g.handleMove('up'); // ход двигает 16 и 8; акула: отсчёт 1→0 → шаг
        assert.notEqual(g.sharkPos, 5); // акула сдвинулась
        g.undo();
        assert.equal(g.sharkPos, 5);
        assert.equal(g.sharkTarget, 9);
        assert.equal(g.sharkEaten, 2);
        assert.equal(g.sharkEatenValue, 24);
        assert.equal(g.sharkActive, false);
    });

    it('resets shark state in init', () => {
        const g = makeSharkGame({ shark: { appearMoves: 3, stepInterval: 2, targetThreshold: 8 } });
        g.render = () => {};
        g.sharkPos = 4;
        g.sharkTarget = 8;
        g.sharkEaten = 5;
        g.sharkEatenValue = 40;
        g.sharkMovesUntilStep = 1;
        g.init();
        assert.equal(g.sharkPos, null);
        assert.equal(g.sharkTarget, -1);
        assert.equal(g.sharkEaten, 0);
        assert.equal(g.sharkEatenValue, 0);
        assert.equal(g.sharkMovesUntilStep, 3); // снова отсчёт до появления
    });

    it('persists shark state across loadState/saveState round-trip', () => {
        const g = makeSharkGame({ shark: { appearMoves: 3, stepInterval: 2, targetThreshold: 8 } });
        g.sharkPos = 6;
        g.sharkTarget = 10;
        g.sharkEaten = 3;
        g.sharkEatenValue = 32;
        g.sharkMovesUntilStep = 2;
        const state = g.getState();
        assert.equal(state.sharkPos, 6);
        assert.equal(state.sharkTarget, 10);
        assert.equal(state.sharkEaten, 3);
        assert.equal(state.sharkEatenValue, 32);

        const g2 = makeSharkGame({ shark: { appearMoves: 3, stepInterval: 2, targetThreshold: 8 } });
        g2.render = () => {};
        g2.loadState(state);
        assert.equal(g2.sharkPos, 6);
        assert.equal(g2.sharkTarget, 10);
        assert.equal(g2.sharkEaten, 3);
        assert.equal(g2.sharkEatenValue, 32);
        assert.equal(g2.sharkMovesUntilStep, 2);
    });

    it('does not tick when shark is disabled (regression check)', () => {
        const g = makeGame();
        g._addNewTile = () => {};
        g._animateMove = (moves, cb) => cb();
        g.render = () => {};
        g.tiles = [
            { id: 1, value: 2 }, null, null, null,
            null, null, null, null,
            null, null, null, null,
            null, { id: 2, value: 8 }, null, null,
        ];
        g.handleMove('left');
        assert.equal(g.sharkPos, null);
        assert.equal(g.sharkEaten, 0);
        assert.equal(g.getShark(), null);
        // Обычная игра не затронута — плитки на месте
        assert.equal(g.tiles.filter(Boolean).length, 2);
    });
});

describe('Game abilities (Плитки-способности ⚡)', () => {
    function makeAbilityGame(opts = {}) {
        const board = stubBoard();
        const addTile = Game.prototype._addNewTile;
        const render = Game.prototype.render;
        const animate = Game.prototype._animateMove;
        Game.prototype._addNewTile = function () {};
        Game.prototype.render = function () {};
        Game.prototype._animateMove = function (moves, cb) { cb(); };
        const game = new Game({
            boardElement: board,
            size: opts.size || 4,
            target: opts.target || 2048,
            tide: opts.tide || null,
            moves: opts.moves || null,
            shark: opts.shark || null,
            abilities: Object.assign(
                { enabled: true, spawnChance: 0, types: ['bomb', 'jelly', 'crab'] },
                opts.abilities
            ),
            random: opts.random,
        });
        Game.prototype._addNewTile = addTile;
        Game.prototype.render = render;
        Game.prototype._animateMove = animate;
        game.tiles = new Array(game.size * game.size).fill(null);
        game.score = 0;
        return game;
    }

    it('is disabled when no abilities config is passed', () => {
        const g = makeGame();
        assert.equal(g.getAbilities(), null);
        assert.equal(g.findAbility(), -1);
        g._rng = () => 0.99;
        g.tiles = new Array(16).fill(null);
        Game.prototype._addNewTile.call(g);
        assert.equal(g.abilitySpawned, 0);
        assert.equal(g.tiles.filter(Boolean).length, 1);
        const t = g.tiles[15]; // 0.99 → последняя пустая клетка
        assert.equal(t.value, 2);
        assert.equal(t.ability, undefined);
    });

    it('normalizes the config and reports state for the UI', () => {
        const g = makeAbilityGame({ abilities: { spawnChance: 2.5 } });
        assert.equal(g.getAbilities().spawnChance, 1);
        const g2 = makeAbilityGame({ abilities: { spawnChance: -1 } });
        assert.equal(g2.getAbilities().spawnChance, 0);
        const g3 = makeAbilityGame({ abilities: { types: ['bomb', 'nope'] } });
        assert.deepEqual(g3.getAbilities().types, ['bomb']);
        const g4 = makeAbilityGame({ abilities: { types: ['nope'] } });
        assert.deepEqual(g4.getAbilities().types, ['bomb', 'jelly', 'crab']);
        const g5 = makeAbilityGame({ abilities: { spawnChance: 0.03 } });
        assert.equal(g5.getAbilities().spawned, 0);
        assert.equal(g5.getAbilities().used, 0);
        assert.equal(g5.getAbilities().cleared, 0);
        assert.equal(g5.getAbilities().freeze, 0);
    });

    it('spawns an ability tile instead of a normal one when the chance hits', () => {
        const g = makeAbilityGame({ abilities: { spawnChance: 1 } });
        g._rng = () => 0; // первая пустая клетка + шанс 100%
        g.tiles = new Array(16).fill(null);
        g._addNewTile();
        assert.equal(g.tiles.filter(Boolean).length, 1);
        const t = g.tiles[0];
        assert.equal(t.value, 2);
        assert.equal(t.ability, 'bomb'); // types[0]
        assert.equal(g.abilitySpawned, 1);
        assert.equal(g.findAbility(), 0);
    });

    it('spawns a normal tile when the chance misses', () => {
        const g = makeAbilityGame({ abilities: { spawnChance: 0 } });
        g._rng = () => 0.99;
        g.tiles = new Array(16).fill(null);
        g._addNewTile();
        const t = g.tiles[15]; // последняя пустая клетка
        assert.equal(t.ability, undefined);
        assert.equal(t.value, 2);
        assert.equal(g.abilitySpawned, 0);
    });

    it('does not merge ability tiles with equal-value normal tiles (soft walls)', () => {
        const g = makeAbilityGame();
        g._addNewTile = () => {};
        g._animateMove = (moves, cb) => cb();
        g.render = () => {};
        g.tiles = [
            null, null, { id: 1, value: 2, ability: 'bomb' }, { id: 2, value: 2 },
            null, null, null, null,
            null, null, null, null,
            null, null, null, null,
        ];
        g.handleMove('left');
        assert.equal(g.score, 0); // слияния не было
        assert.equal(g.tiles[0].ability, 'bomb');
        assert.equal(g.tiles[1].value, 2);
        assert.equal(g.tiles[1].ability, undefined);
        assert.equal(g.tiles[2], null);
        assert.equal(g.tiles[3], null);
    });

    it('still merges two equal normal tiles (regression)', () => {
        const g = makeAbilityGame();
        g._addNewTile = () => {};
        g._animateMove = (moves, cb) => cb();
        g.render = () => {};
        g.tiles = [
            null, null, { id: 1, value: 2 }, { id: 2, value: 2 },
            null, null, null, null,
            null, null, null, null,
            null, null, null, null,
        ];
        g.handleMove('left');
        assert.equal(g.score, 4);
        assert.equal(g.tiles[0].value, 4);
        assert.equal(g.tiles[1], null);
    });

    it('bomb clears its row and column (cross) and reports via onAbility', () => {
        const g = makeAbilityGame();
        g.render = () => {};
        const calls = [];
        g.onAbility = (e) => calls.push(e);
        g.tiles = [
            null, null, null, null,
            null, { id: 1, value: 2, ability: 'bomb' }, { id: 2, value: 4 }, null,
            null, { id: 3, value: 8 }, null, null,
            null, null, null, { id: 4, value: 16 },
        ];
        const res = g.activateAbility(5);
        assert.equal(res.kind, 'bomb');
        assert.equal(res.cleared.length, 3);
        assert.equal(g.tiles[5], null);   // сама бомба убрана
        assert.equal(g.tiles[6], null);   // 4 в строке
        assert.equal(g.tiles[9], null);   // 8 в столбце
        assert.equal(g.tiles[15] !== null, true); // 16 вне креста цела
        assert.equal(g.abilityUsed, 1);
        assert.equal(g.abilityCleared, 3);
        assert.equal(calls.length, 1);
        assert.equal(calls[0].kind, 'bomb');
    });

    it('jelly freezes the tide for the next move', () => {
        const g = makeAbilityGame({ tide: { enabled: true, interval: 1, depth: 1, scoreReturn: 0 } });
        g._addNewTile = () => {};
        g._animateMove = (moves, cb) => cb();
        g.render = () => {};
        g.tiles = [
            null, null, null, null,
            null, { id: 1, value: 2, ability: 'jelly' }, null, null,
            null, null, null, null,
            null, { id: 2, value: 8 }, null, null,
        ];
        const res = g.activateAbility(5);
        assert.equal(res.freeze, 1);
        assert.equal(g.jellyFreeze, 1);

        // Ход: прилив пропущен (заморозка), отсчёт не двигался
        g.handleMove('left');
        assert.equal(g.jellyFreeze, 0);
        assert.equal(g.tideSwept, 0);
        assert.equal(g.tideMovesUntilRise, 1);

        // Следующий ход — прилив срабатывает как обычно
        g.handleMove('right');
        assert.equal(g.tideSwept, 1);
        assert.equal(g.tiles.some(t => t && t.value === 8), false);
    });

    it('crab merges the two largest non-ability tiles into their sum', () => {
        const g = makeAbilityGame();
        g.render = () => {};
        g.tiles = [
            null, { id: 1, value: 4 }, { id: 2, value: 8 }, null,
            null, { id: 3, value: 2 }, null, null,
            null, null, null, null,
            null, null, null, { id: 4, value: 2, ability: 'crab' },
        ];
        const res = g.activateAbility(15);
        assert.equal(res.kind, 'crab');
        assert.equal(res.value, 12);
        assert.deepEqual(res.from.slice().sort(), [1, 2]);
        assert.equal(res.to, 2);
        assert.equal(g.tiles[2].value, 12);
        assert.equal(g.tiles[1], null);
        assert.equal(g.tiles[5].value, 2); // третья плитка не тронута
        assert.equal(g.tiles[15], null);   // сам краб убран
        assert.equal(g.abilityUsed, 1);
    });

    it('crab does nothing when fewer than two regular tiles exist', () => {
        const g = makeAbilityGame();
        g.render = () => {};
        g.tiles = [
            null, { id: 1, value: 4 }, null, null,
            null, null, null, null,
            null, null, null, null,
            null, null, null, { id: 2, value: 2, ability: 'crab' },
        ];
        const res = g.activateAbility(15);
        assert.equal(res, null);
        assert.equal(g.tiles[15] !== null, true); // краб остаётся
        assert.equal(g.abilityUsed, 0);
    });

    it('undo restores ability tiles and the jelly freeze counter', () => {
        const g = makeAbilityGame({ tide: { enabled: true, interval: 2, depth: 1, scoreReturn: 0 } });
        g._addNewTile = () => {};
        g._animateMove = (moves, cb) => cb();
        g.render = () => {};
        g.tiles = [
            { id: 1, value: 2, ability: 'jelly' }, null, null, null,
            null, null, null, null,
            null, null, null, null,
            null, { id: 2, value: 8 }, null, null,
        ];
        g.jellyFreeze = 1;
        g.handleMove('up');
        assert.equal(g.jellyFreeze, 0);
        g.undo();
        assert.equal(g.jellyFreeze, 1);
        assert.equal(g.tiles[0].ability, 'jelly');
        assert.equal(g.tiles[0].value, 2);
    });

    it('persists ability tiles and counters across loadState/saveState round-trip', () => {
        const g = makeAbilityGame();
        g.render = () => {};
        g.tiles = [
            { id: 1, value: 2, ability: 'bomb' }, null, null, null,
            null, { id: 2, value: 8 }, null, null,
            null, null, null, null,
            null, null, null, null,
        ];
        g.jellyFreeze = 1;
        g.abilitySpawned = 3;
        g.abilityUsed = 1;
        g.abilityCleared = 5;
        const state = g.getState();
        assert.equal(state.tiles[0].ability, 'bomb');
        assert.equal(state.jellyFreeze, 1);
        assert.equal(state.abilitySpawned, 3);

        const g2 = makeAbilityGame();
        g2.render = () => {};
        g2.loadState(state);
        assert.equal(g2.tiles[0].ability, 'bomb');
        assert.equal(g2.jellyFreeze, 1);
        assert.equal(g2.abilitySpawned, 3);
        assert.equal(g2.abilityUsed, 1);
        assert.equal(g2.abilityCleared, 5);
    });

    it('an unactivated ability tile is a lifeline — no game over while it exists', () => {
        const g = makeAbilityGame();
        // Полная доска без ходов (шахматный узор 2/4), способностей нет
        g.tiles = [
            { id: 1, value: 2 }, { id: 2, value: 4 }, { id: 3, value: 2 }, { id: 4, value: 4 },
            { id: 5, value: 4 }, { id: 6, value: 2 }, { id: 7, value: 4 }, { id: 8, value: 2 },
            { id: 9, value: 2 }, { id: 10, value: 4 }, { id: 11, value: 2 }, { id: 12, value: 4 },
            { id: 13, value: 4 }, { id: 14, value: 2 }, { id: 15, value: 4 }, { id: 16, value: 2 },
        ];
        assert.equal(g._checkGameOver(), true); // без способности — конец игры
        g.tiles[15] = { id: 16, value: 2, ability: 'bomb' };
        assert.equal(g._checkGameOver(), false); // способность — «спасательный круг»
    });

    it('activateAbility returns null for non-ability tiles and while busy/game-over/paused', () => {
        const g = makeAbilityGame();
        g.render = () => {};
        g.tiles = [
            { id: 1, value: 2 }, null, null, null,
            { id: 2, value: 2, ability: 'bomb' }, null, null, null,
            null, null, null, null,
            null, null, null, null,
        ];
        assert.equal(g.activateAbility(0), null); // не способность
        g.gameOver = true;
        assert.equal(g.activateAbility(4), null);
        g.gameOver = false;
        g.paused = true;
        assert.equal(g.activateAbility(4), null);
        g.paused = false;
        g._busy = true;
        assert.equal(g.activateAbility(4), null);
        assert.equal(g.tiles[4].ability, 'bomb'); // плитка не тронута
    });

    it('findAbility returns the first ability tile index or -1', () => {
        const g = makeAbilityGame();
        g.tiles = new Array(16).fill(null);
        assert.equal(g.findAbility(), -1);
        g.tiles[7] = { id: 1, value: 2, ability: 'crab' };
        g.tiles[10] = { id: 2, value: 2, ability: 'jelly' };
        assert.equal(g.findAbility(), 7);
    });

    it('a normal game without abilities is unaffected (regression)', () => {
        const g = makeGame();
        g._addNewTile = () => {};
        g._animateMove = (moves, cb) => cb();
        g.render = () => {};
        g.tiles = [
            { id: 1, value: 2 }, null, null, null,
            null, null, null, null,
            null, null, null, null,
            null, { id: 2, value: 8 }, null, null,
        ];
        g.handleMove('left');
        assert.equal(g.getAbilities(), null);
        assert.equal(g.abilitySpawned, 0);
        assert.equal(g.jellyFreeze, 0);
        assert.equal(g.tiles.filter(Boolean).length, 2);
    });

    // ── Режим «Челлендж» ⏱️: лимит ходов (moveLimit) ─────────────

    // makeChallengeGame собирает игру с лимитом ходов; флаги onWin/onGameOver
    // срабатывают через setTimeout, поэтому проверяем синхронные g.won / g.gameOver.
    function makeChallengeGame({ limit = 1, target = 2048 } = {}) {
        const g = makeGame({
            target,
            moveLimit: limit,
            onWin: () => {},
            onGameOver: () => {},
        });
        g._addNewTile = () => {};
        g._animateMove = (moves, cb) => cb();
        g.render = () => {};
        g.winCelebrated = false;
        return g;
    }

    it('game over is triggered when the move limit is exhausted', () => {
        const g = makeChallengeGame({ limit: 1 });
        g.tiles = [
            null, { id: 1, value: 2 }, null, null,
            null, null, null, null,
            null, null, null, null,
            null, null, null, null,
        ];
        g.handleMove('left'); // 1-й (последний) ход
        assert.equal(g.movesCount, 1);
        assert.equal(g.gameOver, true);
    });

    it('a win on the last allowed move takes priority over the limit', () => {
        const g = makeChallengeGame({ limit: 1, target: 4 });
        g.tiles = [
            { id: 1, value: 2 }, { id: 2, value: 2 }, null, null,
            null, null, null, null,
            null, null, null, null,
            null, null, null, null,
        ];
        g.handleMove('left'); // слияние 2+2 → 4, цель достигнута на последнем ходу
        assert.equal(g.won, true);
        assert.equal(g.gameOver, false);
    });

    it('moves before the limit do not end the game', () => {
        const g = makeChallengeGame({ limit: 3 });
        g.tiles = [
            null, { id: 1, value: 2 }, null, null,
            null, null, null, null,
            null, null, null, null,
            null, null, null, null,
        ];
        g.handleMove('left'); // 1-й ход
        assert.equal(g.gameOver, false);
        g.handleMove('right'); // 2-й ход
        assert.equal(g.gameOver, false);
        assert.equal(g.movesCount, 2);
    });

    it('without a moveLimit the game behaves as before (regression)', () => {
        const g = makeGame();
        g._addNewTile = () => {};
        g._animateMove = (moves, cb) => cb();
        g.render = () => {};
        g.tiles = [
            null, { id: 1, value: 2 }, null, null,
            null, null, null, null,
            null, null, null, null,
            null, null, null, null,
        ];
        g.handleMove('left');
        g.handleMove('right');
        assert.equal(g.gameOver, false);
        assert.equal(g.movesCount, 2);
    });
describe('Infinity mode (классика: после цели игра продолжается)', () => {
    it('достижение цели не «залипает» won, и последующий тупик корректно завершает игру', () => {
        const g = makeGame({ target: 4 });
        g.infinity = true;
        g.onTarget = () => {};
        g._addNewTile = () => {};
        g._animateMove = (moves, cb) => cb();
        g.render = () => {};
        g.winCelebrated = false;

        // Шаг 1: достигли цели (2+2 → 4). onTarget уходит в setTimeout (async),
        // поэтому проверяем синхронные флаги: праздник отмечен, а won НЕ «залипает».
        g.tiles = [
            { id: 1, value: 2 }, { id: 2, value: 2 }, null, null,
            null, null, null, null,
            null, null, null, null,
            null, null, null, null,
        ];
        g.handleMove('left');
        assert.equal(g.winCelebrated, true);
        // Ключевое: без исправления won «залипало» true и тупик не наступал вовсе.
        assert.equal(g.won, false);

        // Шаг 2: партия продолжается; очередной ход приводит к тупику —
        // game over должен сработать (в отличие от старого поведения).
        const deadlock = [
            { id: 11, value: 2 }, { id: 12, value: 4 }, { id: 13, value: 2 }, { id: 14, value: 4 },
            { id: 15, value: 4 }, { id: 16, value: 2 }, { id: 17, value: 4 }, { id: 18, value: 2 },
            { id: 19, value: 2 }, { id: 20, value: 4 }, { id: 21, value: 2 }, { id: 22, value: 4 },
            { id: 23, value: 4 }, { id: 24, value: 2 }, { id: 25, value: 4 }, { id: 26, value: 2 },
        ];
        g.tiles = new Array(16).fill(null);
        g.tiles[0] = { id: 30, value: 2 };
        // После валидного хода имитируем заполнение доски тупиком.
        g.onMove = () => { g.tiles = deadlock.map(t => ({ ...t })); };
        g.handleMove('right'); // плитка 2 уезжает вправо → moved, затем onMove подменяет доску
        assert.equal(g.gameOver, true);
    });
});
});
