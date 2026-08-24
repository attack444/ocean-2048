// ======================== Класс основной логики игры 2048 ========================

/**
 * Плитка: { id, value }
 * Доска — плоский массив [size*size], каждый элемент — плитка или null.
 */
export default class Game {
    constructor(config) {
        this.boardElement  = config.boardElement;
        this.size          = config.size          || 4;
        this.target        = config.target        || 2048;
        this.onWin         = config.onWin         || (() => {});
        this.onGameOver    = config.onGameOver    || (() => {});
        this.onScoreUpdate = config.onScoreUpdate || (() => {});
        this.onMove        = config.onMove        || null;
        this.onMerge       = config.onMerge       || null;
        this.onSave        = config.onSave        || null;
        this.onTarget      = config.onTarget      || null;
        this.onTide        = config.onTide        || null;
        this.onThreat      = config.onThreat      || null;
        this.infinity      = !!config.infinity;

        // Прилив 🌊 — конфиг механики «Глубины ядра» (null = выключено)
        this.tide          = this._normalizeTide(config.tide);

        // Ходы как ресурс 🧮 — конфиг механики «Глубины ядра» (null = выключено)
        this.movesConfig   = this._normalizeMoves(config.moves);

        // Множитель очков от скина/темы (+% за косметику, «Ценность покупок»)
        this.appearanceMultiplier = Math.max(1, Number(config.appearanceMultiplier) || 1);
        // Шанс выпадения плитки 4 вместо 2 (перк «Дух четвёрки», по умолчанию 10%)
        this.fourChance           = Math.min(1, Math.max(0, Number(config.fourChance) || 0.1));

        // Детерминированный генератор случайных чисел (для ежедневной головоломки с общим сидом).
        // Если передан function — используется он (seeded RNG), иначе Math.random.
        // Обёртка () => Math.random() (а не .bind) — читает текущую функцию в момент вызова,
        // поэтому тесты, подменяющие Math.random, продолжают работать.
        this._rng = (typeof config.random === 'function') ? config.random : () => Math.random();

        this.tiles         = [];
        this.score         = 0;
        this.won           = false;
        this.gameOver      = false;
        this.winCelebrated = false;

        // История для кнопки «Отменить ход» (Undo)
        this._history      = [];
        this._nextTileId   = 1;
        this._busy         = false;

        // Пауза (кнопка / авто-пауза при скрытии вкладки)
        this.paused        = false;

        // Статистика партии (для счётчика ходов и достижений)
        this.movesCount        = 0;
        this.totalMerges       = 0;
        this.maxMerge          = 0;
        this.movesWithoutMerge = 0;
        // Серия: ходы подряд, каждый из которых содержит хотя бы одно слияние
        this.streak            = 0;
        // Буст «Тройные очки»: сколько ходов со слиянием осталось и множитель (×2/×3)
        this.multiplierMoves   = 0;
        this.multiplierMult    = 2;

        // Прилив 🌊: состояние механики
        this.tideLevel          = 0;    // высота воды 0..depth (растёт перед приливом)
        this.tideMovesUntilRise = 0;    // сколько ходов осталось до прилива
        this.tideSwept          = 0;    // сколько плиток унесено течением
        this.tideSweptValue     = 0;    // суммарное значение унесённых плиток
        this.tideActive         = false; // вспышка «прилив» для UI

        // Ходы как ресурс 🧮: состояние механики
        this.threatStrikes      = 0;    // сколько раз сработал «водоворот»
        this.threatSwept        = 0;    // сколько плиток унёс водоворот
        this.threatSweptValue   = 0;    // суммарное значение унесённых плиток
        this.movesPenaltyActive = false; // вспышка «водоворот» для UI

        // Рендер (абсолютное позиционирование плиток)
        this._tileEls      = new Map();
        this._pad          = 8;
        this._gap          = 8;
        this._cell         = 100;

        // Touch state
        this._touchStartX = 0;
        this._touchStartY = 0;

        // Bound handlers (нужны для removeEventListener)
        this._keyHandler        = (e) => this._handleKeyPress(e);
        this._touchStartHandler = (e) => this._handleTouchStart(e);
        this._touchEndHandler   = (e) => this._handleTouchEnd(e);

        this.init();
        this._attachEventListeners();
    }

    // ──────────────────────────────────────────────────────────
    // Lifecycle
    // ──────────────────────────────────────────────────────────

    init() {
        this.tiles         = new Array(this.size * this.size).fill(null);
        this.score         = 0;
        this.won           = false;
        this.gameOver      = false;
        this.winCelebrated = false;
        this._history      = [];
        this._nextTileId   = 1;
        this._busy         = false;
        this.paused        = false;
        this.movesCount        = 0;
        this.totalMerges       = 0;
        this.maxMerge          = 0;
        this.movesWithoutMerge = 0;
        this.streak            = 0;
        this.multiplierMoves   = 0;
        this.multiplierMult    = 2;
        this.tideLevel          = 0;
        this.tideMovesUntilRise = this.tide ? this.tide.interval : 0;
        this.tideSwept          = 0;
        this.tideSweptValue     = 0;
        this.tideActive         = false;
        this.threatStrikes      = 0;
        this.threatSwept        = 0;
        this.threatSweptValue   = 0;
        this.movesPenaltyActive = false;

        this._addNewTile();
        this._addNewTile();

        this._updateGridCSS();
        this.render();
        this.onScoreUpdate(0);
    }

    detachEventListeners() {
        document.removeEventListener('keydown', this._keyHandler);
        this.boardElement.removeEventListener('touchstart', this._touchStartHandler);
        this.boardElement.removeEventListener('touchend',   this._touchEndHandler);
    }

    // ──────────────────────────────────────────────────────────
    // Public interface
    // ──────────────────────────────────────────────────────────

    /** Движение в направлении (D-pad, свайпы, клавиатура). */
    handleMove(direction) {
        if (this.paused || this.gameOver || this._busy) return;

        const prev = {
            tiles: this.tiles.map(t => (t ? { id: t.id, value: t.value } : null)),
            score: this.score,
            streak: this.streak,
            tideMoves: this.tideMovesUntilRise,
            tideSwept: this.tideSwept,
            tideSweptValue: this.tideSweptValue,
            threatStrikes: this.threatStrikes,
            threatSwept: this.threatSwept,
            threatSweptValue: this.threatSweptValue,
            movesWithoutMerge: this.movesWithoutMerge,
        };

        const scoreBefore = this.score;
        const { moved, moves, merges } = this._move(direction);
        if (!moved) return;

        // Буст «Тройные очки»: ходы со слиянием дают ×mult (по умолчанию ×3)
        const gained = this.score - scoreBefore;
        if (this.multiplierMoves > 0 && gained > 0) {
            this.score += Math.round(gained * (this.multiplierMult - 1));
            this.multiplierMoves--;
        }
        // Бонус скина/темы: +% очков за слияния (косметика теперь даёт эффект)
        if (this.appearanceMultiplier > 1 && gained > 0) {
            this.score += Math.round(gained * (this.appearanceMultiplier - 1));
        }

        this.movesCount++;
        if (merges === 0) this.movesWithoutMerge++;
        else this.movesWithoutMerge = 0;
        this.streak = merges > 0 ? this.streak + 1 : 0;
        this.totalMerges += merges;
        for (const m of moves) if (m.merge && m.value > this.maxMerge) this.maxMerge = m.value;

        if (this._history.length >= 20) this._history.shift();
        this._history.push(prev);

        this._busy = true;
        this._animateMove(moves, () => {
            this._busy = false;
            // Ходы как ресурс 🧮: штраф за «бесполезный» ход (до отсчёта прилива)
            this._tickMovesPenalty();
            // Прилив 🌊: отсчёт ходов и смыв нижних рядов (до спавна новой плитки)
            this._tickTide();
            this._addNewTile();
            this.render();
            this.onScoreUpdate(this.score);
            if (this.onMove) this.onMove();
            if (merges > 0 && this.onMerge) this.onMerge(merges);
            if (this.onSave) this.onSave();

            if (!this.winCelebrated && this._checkWin()) {
                this.won           = true;
                this.winCelebrated = true;
                if (this.infinity && this.onTarget) {
                    setTimeout(() => this.onTarget(this.score), 350);
                } else {
                    setTimeout(() => this.onWin(this.score), 350);
                }
            } else if (!this.won && this._checkGameOver()) {
                this.gameOver = true;
                setTimeout(() => this.onGameOver(this.score), 350);
            }
        });
    }

    /** Отменить последний ход. */
    undo() {
        if (this._busy) return false;
        const prev = this._history.pop();
        if (!prev) return false;

        this.tiles         = prev.tiles;
        this.score         = prev.score;
        this.streak        = prev.streak || 0;
        if (typeof prev.tideMoves === 'number') this.tideMovesUntilRise = prev.tideMoves;
        if (typeof prev.tideSwept === 'number') this.tideSwept = prev.tideSwept;
        if (typeof prev.tideSweptValue === 'number') this.tideSweptValue = prev.tideSweptValue;
        if (typeof prev.threatStrikes === 'number') this.threatStrikes = prev.threatStrikes;
        if (typeof prev.threatSwept === 'number') this.threatSwept = prev.threatSwept;
        if (typeof prev.threatSweptValue === 'number') this.threatSweptValue = prev.threatSweptValue;
        if (typeof prev.movesWithoutMerge === 'number') this.movesWithoutMerge = prev.movesWithoutMerge;
        this.tideActive    = false;
        this.movesPenaltyActive = false;
        this.won           = false;
        this.gameOver      = false;
        this.winCelebrated = false;
        if (this.movesCount > 0) this.movesCount--;

        this.render();
        this.onScoreUpdate(this.score);
        if (this.onSave) this.onSave();
        return true;
    }

    canUndo() { return this._history.length > 0; }

    /** Приостановить / возобновить игру (блокирует ходы). */
    setPaused(paused) {
        this.paused = !!paused;
    }

    /** Сериализация текущей партии для сохранения. */
    getState() {
        return {
            tiles: this.tiles.map(t => (t ? { value: t.value } : null)),
            score: this.score,
            nextTileId: this._nextTileId,
            moves: this.movesCount,
            tideMovesUntilRise: this.tideMovesUntilRise,
            tideSwept: this.tideSwept,
            tideSweptValue: this.tideSweptValue,
            threatStrikes: this.threatStrikes,
            threatSwept: this.threatSwept,
            threatSweptValue: this.threatSweptValue,
        };
    }

    /** Восстановление сохранённой партии. */
    loadState(state) {
        this.tiles = (state.tiles || []).map(t =>
            t ? { id: this._nextTileId++, value: t.value } : null
        );
        if (this.tiles.length !== this.size * this.size) {
            this.init();
            return;
        }
        this.score         = state.score || 0;
        this.streak        = 0;
        this.multiplierMoves   = 0;
        this.multiplierMult    = 2;
        this.won           = false;
        this.gameOver      = false;
        this.winCelebrated = false;
        this._history      = [];
        this._nextTileId   = Math.max(this._nextTileId, state.nextTileId || this.tiles.length + 1);
        this.movesCount    = state.moves || 0;
        this.tideMovesUntilRise = (this.tide && typeof state.tideMovesUntilRise === 'number')
            ? state.tideMovesUntilRise : (this.tide ? this.tide.interval : 0);
        if (typeof state.tideSwept === 'number') this.tideSwept = state.tideSwept;
        if (typeof state.tideSweptValue === 'number') this.tideSweptValue = state.tideSweptValue;
        this.threatStrikes    = state.threatStrikes || 0;
        if (typeof state.threatSwept === 'number') this.threatSwept = state.threatSwept;
        if (typeof state.threatSweptValue === 'number') this.threatSweptValue = state.threatSweptValue;
        this.tideActive    = false;
        this.movesPenaltyActive = false;

        this._updateGridCSS();
        this.render();
        this.onScoreUpdate(this.score);
    }

    /** Максимальное значение плитки на доске. */
    getMaxTile() {
        let max = 0;
        for (const t of this.tiles) if (t && t.value > max) max = t.value;
        return max;
    }

    /**
     * Текущая доска (плоский массив размера size*size), каждый элемент —
     * плитка { value } или null. Для позиционных целей (Фаза 4.5
     * «Глубина ядра»): миссии проверяют расположение плиток на доске.
     */
    getBoard() {
        return this.tiles.map((t) => (t ? { value: t.value } : null));
    }

    /** Количество сделанных ходов в текущей партии. */
    getMoves() { return this.movesCount; }

    /** Начислить бонусные очки (комбо/серия) поверх счёта партии. */
    addScore(n) {
        if (!n || n <= 0) return 0;
        this.score += n;
        this.onScoreUpdate(this.score);
        if (this.onSave) this.onSave();
        return n;
    }

    // ──────────────────────────────────────────────────────────
    // Бусты и перки (магазин «Рынок у рифа»)
    // ──────────────────────────────────────────────────────────

    /** Буст «Перемешать»: случайно перемешивает плитки на доске. */
    shuffle() {
        if (this.gameOver || this._busy) return false;
        const filled = [];
        for (let i = 0; i < this.tiles.length; i++) {
            if (this.tiles[i] !== null) filled.push(this.tiles[i]);
        }
        if (filled.length < 2) return false;
        // Фишер–Йетс (используем инжектируемый RNG — детерминирован при общем сиде)
        for (let i = filled.length - 1; i > 0; i--) {
            const j = Math.floor(this._rng() * (i + 1));
            [filled[i], filled[j]] = [filled[j], filled[i]];
        }
        let k = 0;
        for (let i = 0; i < this.tiles.length; i++) {
            if (this.tiles[i] !== null) this.tiles[i] = filled[k++];
        }
        this.render();
        if (this.onSave) this.onSave();
        return true;
    }

    /** Буст «Бомба»: удаляет наименьшую плитку с доски (расчищает место, не трогая прогресс). */
    removeLowestTile() {
        if (this._busy) return null;
        let minIdx = -1;
        let minVal = Infinity;
        for (let i = 0; i < this.tiles.length; i++) {
            const t = this.tiles[i];
            if (t && t.value < minVal) { minVal = t.value; minIdx = i; }
        }
        if (minIdx === -1) return null;
        this.tiles[minIdx] = null;
        this.render();
        if (this.onSave) this.onSave();
        return minVal;
    }

    /** Буст «Молния»: удаляет n наименьших плиток разом. Возвращает массив удалённых значений. */
    removeLowestTiles(n = 3) {
        if (this._busy) return [];
        const filled = [];
        for (let i = 0; i < this.tiles.length; i++) {
            const t = this.tiles[i];
            if (t) filled.push({ idx: i, value: t.value });
        }
        filled.sort((a, b) => a.value - b.value);
        const removed = filled.slice(0, Math.max(0, Math.floor(Number(n) || 0)));
        for (const r of removed) this.tiles[r.idx] = null;
        if (removed.length > 0) {
            this.render();
            if (this.onSave) this.onSave();
        }
        return removed.map(r => r.value);
    }

    /** Перк «Бонусная плитка»: добавляет плитку value на случайную свободную клетку. */
    addBonusTile(value = 4) {
        const empty = [];
        for (let i = 0; i < this.tiles.length; i++) {
            if (this.tiles[i] === null) empty.push(i);
        }
        if (empty.length === 0) return false;
        const idx = empty[Math.floor(Math.random() * empty.length)];
        this.tiles[idx] = { id: this._nextTileId++, value, justSpawned: true };
        this.render();
        return true;
    }

    /** Буст «Тройные очки»: включает ×mult к очкам на N следующих ходов со слиянием. */
    activateScoreMultiplier(moves = 3, mult = 2) {
        this.multiplierMoves = Math.max(0, Math.floor(Number(moves)) || 0);
        this.multiplierMult  = Math.max(2, Math.floor(Number(mult)) || 2);
        this.render();
        if (this.onSave) this.onSave();
    }

    /** Сколько ходов со слиянием осталось с бонусом очков. */
    getScoreMultiplierMoves() {
        return this.multiplierMoves || 0;
    }

    /** Текущий множитель буста очков (×2/×3). */
    getScoreMultiplierMult() {
        return this.multiplierMult || 2;
    }

    /** Статистика партии для достижений. */
    getStats() {
        return {
            moves:       this.movesCount,
            merges:      this.totalMerges,
            maxMerge:    this.maxMerge,
            movesWithoutMerge: this.movesWithoutMerge,
            streak:      this.streak,
        };
    }

    // ──────────────────────────────────────────────────────────
    // Прилив 🌊 (механика «Глубины ядра»)
    // ──────────────────────────────────────────────────────────

    /** Нормализация конфига прилива (null — механика выключена). */
    _normalizeTide(cfg) {
        if (!cfg || !cfg.enabled) return null;
        const num = (v, fallback) => {
            const n = Number(v);
            return Number.isFinite(n) ? n : fallback;
        };
        return {
            interval:    Math.max(1, Math.floor(num(cfg.interval, 8))),
            depth:       Math.min(this.size, Math.max(1, Math.floor(num(cfg.depth, 1)))),
            scoreReturn: Math.min(1, Math.max(0, num(cfg.scoreReturn, 0.5))),
            warning:     Math.max(1, Math.floor(num(cfg.warning, 3))),
        };
    }

    /** Отсчёт ходов до прилива; при достижении 0 — смыв нижних рядов. */
    _tickTide() {
        if (!this.tide) return;
        this.tideMovesUntilRise--;
        this.tideLevel = this.tide.depth * (1 - this.tideMovesUntilRise / this.tide.interval);
        if (this.tideMovesUntilRise > 0) return;

        this.tideMovesUntilRise = this.tide.interval;
        this.tideLevel = 0;
        this._triggerTide();
    }

    /** Смыв: плитки нижних рядов «уносит течением», за них возвращается доля очков. */
    _triggerTide() {
        const depth = Math.min(this.tide.depth, this.size);
        const swept = [];
        for (let d = 0; d < depth; d++) {
            const row = this.size - 1 - d;
            const rowStart = row * this.size;
            for (let c = 0; c < this.size; c++) {
                const idx = rowStart + c;
                const t = this.tiles[idx];
                if (!t) continue;
                const gain = Math.floor(t.value * this.tide.scoreReturn);
                if (gain > 0) this.score += gain;
                this.tideSwept++;
                this.tideSweptValue += t.value;
                swept.push({ row, col: c, value: t.value, gain });
                this.tiles[idx] = null;
            }
        }
        this.tideActive = true;
        if (this.onTide) this.onTide(swept);
    }

    /** Состояние прилива для UI (null — механика выключена). */
    getTide() {
        if (!this.tide) return null;
        return {
            enabled: true,
            interval: this.tide.interval,
            depth: this.tide.depth,
            warning: this.tide.warning,
            movesUntilRise: this.tideMovesUntilRise,
            level: this.tideLevel,
            swept: this.tideSwept,
            sweptValue: this.tideSweptValue,
        };
    }

    // ──────────────────────────────────────────────────────────
    // Ходы как ресурс 🧮 (механика «Глубины ядра»)
    // ──────────────────────────────────────────────────────────

    /**
     * Нормализация конфига «Ходы как ресурс» (null — механика выключена).
     * - tideStep: на сколько ходов ускоряет прилив один «бесполезный» ход;
     * - maxWithoutMerge: порог бесполезных ходов подряд, после которого
     *   срабатывает «водоворот» (смыв нижнего ряда без возврата очков);
     * - depth: сколько нижних рядов смывает водоворот.
     */
    _normalizeMoves(cfg) {
        if (!cfg || !cfg.enabled) return null;
        const num = (v, fallback) => {
            const n = Number(v);
            return Number.isFinite(n) ? n : fallback;
        };
        return {
            tideStep:        Math.max(0, Math.floor(num(cfg.tideStep, 1))),
            maxWithoutMerge: Math.max(2, Math.floor(num(cfg.maxWithoutMerge, 4))),
            depth:           Math.min(this.size, Math.max(1, Math.floor(num(cfg.depth, 1)))),
        };
    }

    /**
     * Штраф за «бесполезный» ход (без единого слияния): прибавляет шаг
     * прилива (ускоряет прилив) и/или накапливает напряжение до порога,
     * после которого срабатывает «водоворот» (усиление угрозы).
     * Вызывается до _tickTide(), чтобы смывы не накладывались.
     */
    _tickMovesPenalty() {
        if (!this.movesConfig || this.movesWithoutMerge === 0) return;

        // 1) Прибавляем шаг прилива: каждый бесполезный ход уменьшает отсчёт
        if (this.tide && this.movesConfig.tideStep > 0) {
            const extra = this.movesConfig.tideStep;
            this.tideMovesUntilRise = Math.max(1, this.tideMovesUntilRise - extra);
        }

        // 2) Накопитель «напряжения»: N бесполезных ходов подряд → водоворот
        if (this.movesWithoutMerge < this.movesConfig.maxWithoutMerge) return;
        this._triggerWhirlpool();
    }

    /**
     * «Водоворот» — усиление угрозы: нижние ряды затягивает без возврата очков.
     * Наказание за серию бесполезных ходов; счётчик бесполезных ходов сбрасывается.
     */
    _triggerWhirlpool() {
        const depth = this.movesConfig.depth;
        const swept = [];
        for (let d = 0; d < depth; d++) {
            const row = this.size - 1 - d;
            const rowStart = row * this.size;
            for (let c = 0; c < this.size; c++) {
                const idx = rowStart + c;
                const t = this.tiles[idx];
                if (!t) continue;
                this.threatSwept++;
                this.threatSweptValue += t.value;
                swept.push({ row, col: c, value: t.value, gain: 0 });
                this.tiles[idx] = null;
            }
        }
        this.threatStrikes++;
        this.movesPenaltyActive = true;
        this.movesWithoutMerge  = 0;
        if (this.onThreat) this.onThreat(swept);
    }

    /** Состояние механики «Ходы как ресурс» для UI (null — выключено). */
    getMovesPenalty() {
        if (!this.movesConfig) return null;
        return {
            enabled: true,
            tideStep: this.movesConfig.tideStep,
            maxWithoutMerge: this.movesConfig.maxWithoutMerge,
            depth: this.movesConfig.depth,
            movesWithoutMerge: this.movesWithoutMerge,
            strikes: this.threatStrikes,
            swept: this.threatSwept,
            sweptValue: this.threatSweptValue,
        };
    }

    /**
     * Подсказка: оценивает все 4 направления и возвращает лучший ход.
     * @returns {{direction:string, fromIndices:number[]} | null}
     */
    hint() {
        if (this.gameOver || this._busy) return null;

        const dirs         = ['up', 'down', 'left', 'right'];
        const original     = this.tiles;
        const originalScore = this.score;
        const snapshot     = () => original.map(t => (t ? { id: t.id, value: t.value } : null));

        let bestDir  = null;
        let bestEval = -Infinity;

        for (const dir of dirs) {
            this.tiles = snapshot();
            this.score = 0;
            const { moved } = this._move(dir);
            if (!moved) {
                this.tiles  = original;
                this.score  = originalScore;
                continue;
            }
            const ev = this._evalBoard(this.tiles);
            this.tiles = original;
            this.score = originalScore;
            if (ev > bestEval) { bestEval = ev; bestDir = dir; }
        }

        if (!bestDir) return null;

        // Индексы плиток, которые сдвинутся/сольются при лучшем ходе
        const after = snapshot();
        this.tiles = after;
        this.score = 0;
        this._move(bestDir);
        this.tiles = original;
        this.score = originalScore;

        const fromIndices = [];
        for (let i = 0; i < original.length; i++) {
            if (original[i] && (!after[i] || after[i].value !== original[i].value)) {
                fromIndices.push(i);
            }
        }

        return { direction: bestDir, fromIndices };
    }

    /** Эвристическая оценка доски: пустые клетки, слияния, монотонность. */
    _evalBoard(tiles) {
        const n = this.size;
        let s = 0;
        for (const t of tiles) if (t === null) s += 60;
        for (const t of tiles) if (t) s += t.value * 0.8;
        for (let r = 0; r < n; r++) {
            for (let c = 0; c < n; c++) {
                const v = tiles[r * n + c] ? tiles[r * n + c].value : 0;
                if (c + 1 < n) {
                    const v2 = tiles[r * n + c + 1] ? tiles[r * n + c + 1].value : 0;
                    if (v && v === v2) s += v * 1.6;
                }
                if (r + 1 < n) {
                    const v2 = tiles[(r + 1) * n + c] ? tiles[(r + 1) * n + c].value : 0;
                    if (v && v === v2) s += v * 1.6;
                }
            }
        }
        s += this._monotonicScore(tiles);
        return s;
    }

    /** Поощряем «лестницы» значений в строках и столбцах. */
    _monotonicScore(tiles) {
        const n = this.size;
        let score = 0;
        for (let r = 0; r < n; r++) {
            for (let c = 0; c < n - 1; c++) {
                const a = tiles[r * n + c] ? tiles[r * n + c].value : 0;
                const b = tiles[r * n + c + 1] ? tiles[r * n + c + 1].value : 0;
                if (a >= b) score += (a - b) + 1;
                else score -= (b - a) * 0.1;
            }
        }
        for (let c = 0; c < n; c++) {
            for (let r = 0; r < n - 1; r++) {
                const a = tiles[r * n + c] ? tiles[r * n + c].value : 0;
                const b = tiles[(r + 1) * n + c] ? tiles[(r + 1) * n + c].value : 0;
                if (a >= b) score += (a - b) + 1;
                else score -= (b - a) * 0.1;
            }
        }
        return score;
    }

    // ──────────────────────────────────────────────────────────
    // Event handling
    // ──────────────────────────────────────────────────────────

    _attachEventListeners() {
        document.addEventListener('keydown', this._keyHandler);
        this.boardElement.addEventListener('touchstart', this._touchStartHandler, { passive: false });
        this.boardElement.addEventListener('touchend',   this._touchEndHandler,   { passive: false });
    }

    _handleKeyPress(e) {
        // Ctrl+Z / Cmd+Z или Backspace — отменить ход
        if ((e.key === 'z' || e.key === 'Z') && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            this.undo();
            return;
        }
        if (e.key === 'Backspace') {
            e.preventDefault();
            this.undo();
            return;
        }

        const map = {
            ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
            w: 'up', W: 'up', s: 'down', S: 'down', a: 'left', A: 'left', d: 'right', D: 'right',
        };
        const dir = map[e.key];
        if (dir) {
            e.preventDefault();
            this.handleMove(dir);
        }
    }

    _handleTouchStart(e) {
        if (e.touches.length !== 1) return;
        this._touchStartX = e.touches[0].clientX;
        this._touchStartY = e.touches[0].clientY;
        e.preventDefault();
    }

    _handleTouchEnd(e) {
        if (e.changedTouches.length !== 1) return;
        const dx = e.changedTouches[0].clientX - this._touchStartX;
        const dy = e.changedTouches[0].clientY - this._touchStartY;
        const MIN_SWIPE = 40;

        if (Math.abs(dx) > Math.abs(dy)) {
            if (Math.abs(dx) >= MIN_SWIPE) {
                // Фаза 1: визуальный отклик тача (микропульс доски)
                this._flashBoardTap();
                this.handleMove(dx > 0 ? 'right' : 'left');
            }
        } else {
            if (Math.abs(dy) >= MIN_SWIPE) {
                this._flashBoardTap();
                this.handleMove(dy > 0 ? 'down' : 'up');
            }
        }
        e.preventDefault();
    }

    /** Фаза 1: короткий «микропульс» доски при свайпе (тач-отклик). */
    _flashBoardTap() {
        if (!this.boardElement) return;
        if (typeof window !== 'undefined'
            && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
        const el = this.boardElement;
        el.classList.remove('tap');
        void el.offsetWidth; // перезапуск анимации
        el.classList.add('tap');
    }

    // ──────────────────────────────────────────────────────────
    // Grid helpers
    // ──────────────────────────────────────────────────────────

    _updateGridCSS() {
        this.boardElement.style.gridTemplateColumns = `repeat(${this.size}, 1fr)`;
        this.boardElement.style.gridTemplateRows    = `repeat(${this.size}, 1fr)`;
        this.boardElement.className = `board size-${this.size}`;
    }

    /** Линии чтения по направлению: массив массивов индексов. */
    _getLines(direction) {
        const lines = [];
        for (let a = 0; a < this.size; a++) {
            const line = [];
            for (let b = 0; b < this.size; b++) {
                let idx;
                if (direction === 'left')  idx = a * this.size + b;
                if (direction === 'right') idx = a * this.size + (this.size - 1 - b);
                if (direction === 'up')    idx = b * this.size + a;
                if (direction === 'down')  idx = (this.size - 1 - b) * this.size + a;
                line.push(idx);
            }
            lines.push(line);
        }
        return lines;
    }

    /**
     * Перемещение и слияние. Мутирует this.tiles.
     * @returns {{moved:boolean, moves:Array, merges:number}}
     * moves: { id, from, to, consumed, merge, value }
     */
    _move(direction) {
        const lines  = this._getLines(direction);
        const moves  = [];
        let moved    = false;
        let merges   = 0;

        for (const indices of lines) {
            const items = [];
            for (const idx of indices) {
                const t = this.tiles[idx];
                if (t !== null) items.push({ from: idx, tile: t });
            }

            let wi = 0; // курсор записи в линии
            for (let k = 0; k < items.length; k++) {
                const { from, tile } = items[k];
                const to   = indices[wi];
                const next = items[k + 1];

                if (next && next.tile.value === tile.value) {
                    const survivor = { id: tile.id, value: tile.value * 2 };
                    this.tiles[to] = survivor;
                    moves.push({ id: tile.id, from, to, consumed: false, merge: true, value: survivor.value });
                    moves.push({ id: next.tile.id, from: next.from, to, consumed: true, merge: true, value: survivor.value });
                    this.score += survivor.value;
                    merges++;
                    k++; // поглощённая плитка пропускается
                } else {
                    this.tiles[to] = tile;
                    if (from !== to) moved = true;
                    moves.push({ id: tile.id, from, to, consumed: false, merge: false, value: tile.value });
                }
                wi++;
            }

            while (wi < indices.length) {
                const idx = indices[wi];
                if (this.tiles[idx] !== null) moved = true;
                this.tiles[idx] = null;
                wi++;
            }
        }

        return { moved, moves, merges };
    }

    // ──────────────────────────────────────────────────────────
    // Tile spawning
    // ──────────────────────────────────────────────────────────

    _addNewTile() {
        const empty = [];
        for (let i = 0; i < this.tiles.length; i++) if (this.tiles[i] === null) empty.push(i);
        if (empty.length === 0) return;
        const idx = empty[Math.floor(this._rng() * empty.length)];
        // Перк «Дух четвёрки»: шанс плитки 4 выше стандартных 10% (fourChance)
        const chance = Math.min(1, Math.max(0, Number(this.fourChance) || 0.1));
        this.tiles[idx] = { id: this._nextTileId++, value: this._rng() < chance ? 4 : 2, justSpawned: true };
    }

    // ──────────────────────────────────────────────────────────
    // Win / loss checks
    // ──────────────────────────────────────────────────────────

    _checkWin() {
        return this.tiles.some(t => t !== null && t.value >= this.target);
    }

    _checkGameOver() {
        if (this.tiles.some(t => t === null)) return false;

        for (let r = 0; r < this.size; r++) {
            for (let c = 0; c < this.size; c++) {
                const cur = this.tiles[r * this.size + c];
                if (c + 1 < this.size && this.tiles[r * this.size + c + 1].value === cur.value) return false;
                if (r + 1 < this.size && this.tiles[(r + 1) * this.size + c].value  === cur.value) return false;
            }
        }
        return true;
    }

    // ──────────────────────────────────────────────────────────
    // Rendering (плитки позиционируются абсолютно внутри .board)
    // ──────────────────────────────────────────────────────────

    render() {
        this._ensureCells();
        this.boardElement.querySelectorAll('.tile').forEach(el => el.remove());
        this._tileEls.clear();
        this._layout();

        this.tiles.forEach((tile, i) => {
            if (!tile) return;
            const appear = !!tile.justSpawned;
            tile.justSpawned = false;
            this._createTileEl(tile, i, appear);
        });

        this.boardElement.classList.toggle('won', this.won);
    }

    _ensureCells() {
        const count = this.size * this.size;
        const cells = this.boardElement.querySelectorAll(':scope > .cell');
        if (cells.length !== count) {
            this.boardElement.innerHTML = '';
            this._tileEls.clear();
            for (let i = 0; i < count; i++) {
                const cell = document.createElement('div');
                cell.className = 'cell';
                this.boardElement.appendChild(cell);
            }
        }
    }

    _layout() {
        const style = getComputedStyle(this.boardElement);
        const pad   = parseFloat(style.paddingLeft) || 8;
        const gap   = parseFloat(style.columnGap)   || 8;
        const inner = this.boardElement.clientWidth - pad * 2;
        const cell  = (inner - gap * (this.size - 1)) / this.size;
        this._pad  = pad;
        this._gap  = gap;
        this._cell = Math.max(cell, 1);
    }

    _posForIndex(i) {
        const r = Math.floor(i / this.size);
        const c = i % this.size;
        return {
            x: this._pad + c * (this._cell + this._gap),
            y: this._pad + r * (this._cell + this._gap),
        };
    }

    _createTileEl(tile, i, appear) {
        const el = document.createElement('div');
        el.className = 'tile' + (appear ? ' new' : '');
        el.dataset.value = tile.value;
        el.dataset.id = tile.id;
        el.dataset.glyph = this._tileGlyph(tile.value);

        // Обитатель (глиф) крупным + компактное значение под ним.
        el.innerHTML = '<span class="tile-glyph">' + this._tileGlyph(tile.value) + '</span>'
            + '<span class="tile-num">' + tile.value + '</span>';

        const { x, y } = this._posForIndex(i);
        el.style.width  = this._cell + 'px';
        el.style.height = this._cell + 'px';
        el.style.setProperty('--tx', x + 'px');
        el.style.setProperty('--ty', y + 'px');

        this._tileEls.set(tile.id, el);
        this.boardElement.appendChild(el);
        return el;
    }

    /** Обитатель океана для значения плитки (сложность растёт с числом). */
    _tileGlyph(value) {
        const GLYPHS = {
            2: '🐟', 4: '🐠', 8: '🐡', 16: '🐙', 32: '🦑', 64: '🦀',
            128: '🐚', 256: '🐢', 512: '🐬', 1024: '🦈', 2048: '🐉',
            4096: '👑', 8192: '🌋',
        };
        return GLYPHS[value] || '🌊';
    }

    /** Анимация скольжения + «отскок» слитых плиток, затем финальный рендер. */
    _animateMove(moves, cb) {
        this._layout();

        const affected = [];
        for (const m of moves) {
            const el = this._tileEls.get(m.id);
            if (!el) continue;
            affected.push({ el, m });
            el.style.transition = 'none';
            const p = this._posForIndex(m.from);
            el.style.transform = `translate(${p.x}px, ${p.y}px)`;
        }

        // Force reflow — «from»-позиции должны примениться до начала перехода
        void this.boardElement.offsetWidth;

        for (const { el, m } of affected) {
            const p = this._posForIndex(m.to);
            el.style.transition = 'transform 140ms ease-in-out, opacity 140ms ease-in-out';
            if (m.consumed) {
                el.style.opacity = '0';
            } else if (m.merge) {
                const numEl = el.querySelector('.tile-num');
                const glyEl = el.querySelector('.tile-glyph');
                if (numEl) numEl.textContent = m.value;
                el.dataset.value = m.value;
                el.dataset.glyph = this._tileGlyph(m.value);
                if (glyEl) glyEl.textContent = this._tileGlyph(m.value);
                this._spawnMergeParticles(p.x, p.y, m.value);
                el.style.transform = `translate(${p.x}px, ${p.y}px) scale(1.18)`;
            } else {
                el.style.transform = `translate(${p.x}px, ${p.y}px)`;
            }
        }

        // «Отскок» слитых плиток к нормальному размеру
        const mergedEls = affected.filter(({ m }) => m.merge && !m.consumed);
        setTimeout(() => {
            for (const { el, m } of mergedEls) {
                const p = this._posForIndex(m.to);
                el.style.transition = 'transform 130ms ease-in-out';
                el.style.transform = `translate(${p.x}px, ${p.y}px) scale(1)`;
            }
        }, 70);

        setTimeout(() => {
            for (const { el } of affected) el.remove();
            cb();
        }, 220);
    }

    /** Всплеск / брызги при слиянии плиток. GPU-анимация (transform/opacity),
     *  максимум 40 частиц на доску, отключается при prefers-reduced-motion. */
    _spawnMergeParticles(x, y, value) {
        if (!this.boardElement || !this.boardElement.isConnected) return;
        if (typeof window === 'undefined') return;
        if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

        // Переиспользуем один слой частиц на доску
        let layer = this.boardElement.querySelector(':scope > .particles-layer');
        if (!layer) {
            layer = document.createElement('div');
            layer.className = 'particles-layer';
            this.boardElement.appendChild(layer);
        }
        // Лимит: не больше 40 частиц в слое (GPU-дружелюбно)
        if (layer.querySelectorAll('.merge-particle').length >= 40) return;

        const count = value >= 1024 ? 12 : value >= 128 ? 8 : 5;
        const colors = ['#4af7ff', '#ffd700', '#ff8a6b', '#8ee7f7'];
        const frag = document.createDocumentFragment();
        for (let i = 0; i < count; i++) {
            const p = document.createElement('i');
            p.className = 'merge-particle';
            const size = 4 + Math.random() * 6;
            const ang  = Math.random() * Math.PI * 2;
            const dist = 18 + Math.random() * 26;
            p.style.left   = (x + this._cell / 2) + 'px';
            p.style.top    = (y + this._cell / 2) + 'px';
            p.style.width  = size + 'px';
            p.style.height = size + 'px';
            p.style.background = colors[i % colors.length];
            p.style.setProperty('--dx', (Math.cos(ang) * dist).toFixed(1) + 'px');
            p.style.setProperty('--dy', (Math.sin(ang) * dist).toFixed(1) + 'px');
            frag.appendChild(p);
        }
        layer.appendChild(frag);
        // Убираем отжившие частицы после анимации (900мс)
        setTimeout(() => {
            if (layer.isConnected) layer.querySelectorAll('.merge-particle').forEach(el => el.remove());
        }, 950);
    }
}
