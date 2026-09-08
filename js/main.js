// ======================== Инициализация и управление игрой ========================

import Game from './game.js';
import { applyPlatform, hapticLight, hapticHeavy } from './platform.js';
import { playMove, playMerge, playWin, playGameOver, suspendSound, resumeSound } from './sound.js';
import { stopMusic, playTrack, suspendMusic, resumeMusic, setOstContext } from './music.js';
import { OceanAtmosphere, computeIntensity } from './atmosphere.js';
import sdk from './platform-sdk.js';
import { applyLevelWin, applyLevelGameOver, isLevelUnlocked } from './progress.js';
import { resolveConflict, mergeBoardSaves } from './cloud-sync.js';
import { canRevive } from './rewards.js';
import { comboReward, STREAK_THRESHOLD } from './combo.js';
import { LEVELS, levelById, isLastLevel, tideConfigForLevel, movesConfigForLevel, sharkConfigForLevel, abilitiesConfigForLevel, eventsConfigForLevel, ebbtideConfigForLevel } from './levels.js';
import { ACHIEVEMENTS, evaluateAchievements } from './achievements.js';
import { puzzleStartBoard, ensureDailyPuzzle, recordPuzzleResult, puzzleInfo, makeRng, seedFromDate } from './daily-puzzle.js';
import {
    ensureTournament, recordTournamentResult, tournamentInfo,
    tournamentStartBoard, tournamentSeed,
    TOURNAMENT_MOVES,
} from './tournament.js';
import {
    ensureInvite, recordInvite, claimWelcomeBonus, inviteInfo,
    INVITE_REWARD, WELCOME_BONUS,
} from './invite.js';
import {
    ensureRequests, recordRequest, requestsInfo, buildChallengeText,
    REQUEST_REWARD,
} from './request.js';
import {
    ensureDuel, clearDuelPending, applyDuelChallenge, recordDuelResult, duelInfo,
    duelStartBoard, duelSeed, buildDuelRequestKey,
    DUEL_MOVES, DUEL_WIN_REWARD, DUEL_LOSE_REWARD,
} from './duel.js';
import { DEPTH_NODES, depthRewardFor, depthStatus, canClaimDepthReward, claimDepthReward, pendingDepthRewards } from './depths-map.js';
import { missionForLevel, missionProgress, isMissionComplete, isMissionClaimed, claimMissionReward } from './missions.js';
import { DAILY_TASKS, ensureDaily as ensureDailyState, dailyMetric as dailyMetricState, checkDaily as checkDailyState } from './daily.js';
import {
    CHALLENGES, challengeForLevel, ensureChallenges, recordChallengeResult, claimChallengeReward,
    challengeInfo, pendingChallengeRewards,
} from './challenge.js';
import { claimDailyLogin, dailyLoginInfo } from './daily-login.js';
import {
    weeklyInfo, ensureWeekly, recordWeeklyResult, claimWeeklyReward,
} from './weekly.js';
import {
    getShopItem, itemsByType, ownsItem, buyItem, useBoost, boostCount, ownsPerk,
    applyCoinReward, effectiveUndoLimit,
    appearanceScoreMultiplier, appearanceBonusPercent,
    skinLevel, upgradeSkin, hasSkinAbility, skinBonusForLevel, itemByKey,
    SETS, activeSet, ownsSet,
    SKIN_UPGRADE_COSTS, MAX_SKIN_LEVEL,
} from './shop.js';
import {
    openChest, exchangePointsForDoubloons, exchangeUsedToday, todayKey, DONATE_PACKS,
    creditGamePoints,
} from './chest.js';
import { makeLeaf, stepLeaf, shouldShowAutumn, AUTUMN_OPTIONS } from './autumn.js';
import { EffectPlayer } from './effects.js';

const STORAGE_KEY = 'ocean2048_v1';
const SAVE_KEY    = 'ocean2048_saves';

// ──────────────────────────────────────────────────────────
// Хранилище прогресса
// ──────────────────────────────────────────────────────────
function loadState() {
    const defaults = {
        currentLevel: 1,
        // Режим игры: 'depth' (Глубины) / 'classic' (Классика 2048)
        mode: 'depth',
        // Рекорд в режиме «Классика» (отдельный от уровней)
        classicBest: 0,
        unlockedLevels: [1],
        bestScores: {},
        bestTotal: 0,
        gamesPlayed: 0,
        bestTile: 0,
        sound: true,
        music: true,
        musicTrack: 'ost',      // по умолчанию — оригинальный саундтрек (Grand Dark Waltz / Ancient Mystery Waltz)
        theme: 'dark',
        skin: 'gold',
        infinity: false,
        // Фаза 5 «Полировка»: доступность — скорость анимаций и крупный текст
        animSpeed: 'normal',   // 'normal' | 'fast'
        largeText: false,
        achievements: {},
        hintsUsed: 0,
        undoCount: 0,
        // Жемчужины и кастомизация
        doubloons: 0,
        unlockedSkins: ['gold'],
        skinLevels: {},
        unlockedThemes: ['dark', 'autumn'],
        // Экономика: магазин, ежедневный вход
        inventory: {},
        perks: {},
        dailyStreak: { days: 0, lastClaim: '' },
        // Сокровищница: сундук, обмен очков и донат
        pointsBalance: 0,
        exchangeDaily: {},
        chestGuaranteed: 0,
        chestOpened: 0,
        // Ежедневные задания
        daily: { date: '', tasks: [], claimed: {} },
        dailyCounters: { moves: 0, merges: 0, wins: 0, hints: 0, undos: 0 },
        // Режим «Челлендж» ⏱️ (Фаза 3): «N ходов на цель» — результаты по уровням
        challenges: {},
        // Еженедельный челлендж 📅: одна задача на неделю (пн–вс)
        weekly: { week: '', done: false, bestScore: 0, bestMoves: 0, claimed: false },
        // Реклама: кулдаун interstitial
        lastAdTime: 0,
        // Фаза 2: одноразовые соц-бонусы за добавление в избранное / на главный экран
        socialBonuses: {},
        // Ежедневный турнир глубин 🏆: результат дня и выданные пороговые награды
        tournament: { date: '', best: 0, played: false, claimed: [] },
        // Приглашение с наградой 👥: дневной лимит наград и приветственный бонус
        invite: { date: '', count: 0, welcomeClaimed: false },
        // Сообщение-вызов 💪: дневной лимит наград за отправленные вызовы
        requests: { date: '', count: 0 },
        // Дуэль дня ⚔️: общая доска, результат против счёта соперника (из vk_request_key)
        duel: { date: '', best: 0, played: false, wins: 0, claimed: [], pendingScore: 0 },
        // Метка последнего изменения — для разрешения конфликтов облако/локально
        updatedAt: 0,
        // Онбординг уже показан
        tutorialSeen: false,
    };
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
            const state = { ...defaults, ...JSON.parse(raw) };
            // Осень — бесплатная сезонная тема: открываем даже для старых сохранений.
            if (!Array.isArray(state.unlockedThemes) || !state.unlockedThemes.includes('autumn')) {
                state.unlockedThemes = [...new Set([...(state.unlockedThemes || []), 'autumn'])];
            }
            // Музыка: процедурные темы удалены — любые их ключи ('dark', 'sakura', ...)
            // из старых сейвов трактуем как включённый OST; 'off' остаётся выключенным.
            if (state.musicTrack && state.musicTrack !== 'off') {
                state.musicTrack = 'ost';
            }
            return state;
        }
    } catch (_) {}
    return defaults;
}

function saveState(state) {
    state.updatedAt = Date.now();
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (_) {}
}

// ──────────────────────────────────────────────────────────
// Вспомогательные функции DOM
// ──────────────────────────────────────────────────────────
const $ = (id) => document.getElementById(id);

// ──────────────────────────────────────────────────────────
// Запуск приложения
// ──────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
    const platform = await applyPlatform();

    // DOM-элементы
    const boardEl        = $('board');
    const scoreEl        = $('score');
    const bestEl         = $('best-score');
    const levelNumEl     = $('level-display');
    const levelNameEl    = $('level-name');
    const levelTargetEl  = $('level-target');
    const restartBtn     = $('restart-btn');
    const levelSelectBtn = $('level-select-btn');
    // Режим игры: Глубины (основная игра) / Классика (чистый 2048)
    const modeDepthBtn   = $('mode-depth');
    const modeClassicBtn = $('mode-classic');
    const fullscreenBtn  = $('fullscreen-btn');
    const undoBtn        = $('undo-btn');
    const soundBtn       = $('sound-btn');
    const musicOptions   = $('music-options');
    const settingsMusic  = $('settings-music');
    const settingsBtn    = $('settings-btn');
    const hintBtn        = $('hint-btn');
    const movesEl        = $('moves');

    // Прилив 🌊 (Фаза 2.5 «Глубина ядра») — индикатор и счётчик
    const tideIndicator = $('tide-indicator');
    const tideBarFill   = $('tide-bar-fill');
    const tideCount     = $('tide-count');

    // «Ходы как ресурс» 🧮 (Фаза 2.5 «Глубина ядра») — индикатор «водоворота»
    const threatIndicator = $('threat-indicator');
    const threatBarFill   = $('threat-bar-fill');
    const threatCount     = $('threat-count');

    // «Акула-охотник» 🦈 (Фаза 4.5 «Глубина ядра») — индикатор
    const sharkIndicator = $('shark-indicator');
    const sharkBarFill   = $('shark-bar-fill');
    const sharkCount     = $('shark-count');

    // «Прилив и отлив» 🌊↔️ (Фаза 5.5 «Глубина ядра») — индикатор
    const ebbtideIndicator = $('ebbtide-indicator');
    const ebbtideEmoji     = $('ebbtide-emoji');
    const ebbtideLabel     = $('ebbtide-label');
    const ebbtideBarFill   = $('ebbtide-bar-fill');
    const ebbtideCount     = $('ebbtide-count');

    // Режим «Челлендж» ⏱️ (Фаза 3) — «N ходов на цель»: индикатор над доской
    const challengeIndicator = $('challenge-indicator');
    const challengeTargetEl  = $('challenge-target');
    const challengeBarFill   = $('challenge-bar-fill');
    const challengeCount     = $('challenge-count');
    // Блок «Челлендж» на карте уровней
    const chBlock  = $('challenge-block');
    const chGrid   = $('ch-grid');
    const chDesc   = $('ch-desc');
    const chBadge  = $('ch-badge');

    // Блок «Еженедельный челлендж» 📅 на карте уровней
    const weeklyBlock  = $('weekly-block');
    const weeklyWeek   = $('weekly-week');
    const weeklyDesc   = $('weekly-desc');
    const weeklyCard   = $('weekly-card');
    const weeklyTarget = $('weekly-target');
    const weeklyMoves  = $('weekly-moves');
    const weeklyReward = $('weekly-reward');
    const weeklyPlay   = $('weekly-play-btn');

    const gameModal      = $('game-modal');
    const modalIcon      = $('modal-icon');
    const modalTitle     = $('modal-title');
    const modalMessage   = $('modal-message');
    const modalScore     = $('modal-score-value');
    const modalActions   = $('modal-actions');

    const levelModal     = $('level-modal');
    const levelsGrid     = $('levels-grid');
    const closeLevelBtn  = $('close-level-modal');
    const depthsNodesEl  = $('dm-nodes');
    const depthsBadgeEl  = $('dm-badge');

    // Ежедневная головоломка 🧩 (Wordle-механика: одна доска на всех в день)
    const dpEl     = $('daily-puzzle');
    const dpDate   = $('dp-date');
    const dpDesc   = $('dp-desc');
    const dpTarget = $('dp-target');
    const dpBest   = $('dp-best');
    const dpDone   = $('dp-done');
    const dpPlay   = $('dp-play-btn');

    // Ежедневный турнир глубин 🏆 (онлайн: одна доска на всех в день)
    const tournamentBlock  = $('tournament-block');
    const tournamentDate   = $('tournament-date');
    const tournamentDesc   = $('tournament-desc');
    const tournamentMoves  = $('tournament-moves');
    const tournamentBest   = $('tournament-best');
    const tournamentRewards = $('tournament-rewards');
    const tournamentPlay   = $('tournament-play-btn');

    // Дуэль дня ⚔️ (асинхронная, общий сид): вызов друга на ту же доску
    const duelBlock   = $('duel-block');
    const duelDate    = $('duel-date');
    const duelDesc    = $('duel-desc');
    const duelMoves   = $('duel-moves');
    const duelBest    = $('duel-best');
    const duelStats   = $('duel-stats');
    const duelOpp     = $('duel-opponent');
    const duelPlay    = $('duel-play-btn');
    const duelChallengeBtn = $('duel-challenge-btn');

    // Сюжетная миссия глубины 🎯
    const missionBar    = $('mission-bar');
    const missionIcon   = $('mission-icon');
    const missionTitle  = $('mission-title');
    const missionFill   = $('mission-fill');
    const missionCaption= $('mission-caption');
    const missionClaim  = $('mission-claim');

    const settingsModal     = $('settings-modal');
    const closeSettingsBtn  = $('close-settings-btn');
    const themeOptions      = $('theme-options');
    const skinOptions       = $('skin-options');
    const settingsSound     = $('settings-sound');
    const settingsInfinity  = $('settings-infinity');
    const settingsAnimSpeed = $('settings-animspeed');
    const settingsLargeText = $('settings-large-text');
    const exportBtn         = $('export-btn');
    const importBtn         = $('import-btn');
    const importFile        = $('import-file');
    const installBtn        = $('install-btn');
    const achievementsGrid  = $('achievements-grid');

    // Загрузочный экран (VK / Yandex)
    const loadingScreen    = $('loading-screen');
    const loadingBarFill   = $('loading-bar-fill');
    const loadingHint      = $('loading-hint');
    // Пауза
    const pauseBtn         = $('pause-btn');
    const pauseOverlay     = $('pause-overlay');
    const resumeBtn        = $('resume-btn');
    const pauseRestartBtn  = $('pause-restart-btn');
    // Подтверждение перезапуска
    const confirmModal       = $('confirm-modal');
    const confirmRestartYes  = $('confirm-restart-yes');
    const confirmRestartNo   = $('confirm-restart-no');
    // Онбординг
    const tutorialModal   = $('tutorial-modal');
    const tutorialTitle   = $('tutorial-title');
    const tutorialIcon    = $('tutorial-icon');
    const tutorialBody    = $('tutorial-body');
    const tutorialDots    = $('tutorial-dots');
    const tutorialSkip    = $('tutorial-skip');
    const tutorialBack    = $('tutorial-back');
    const tutorialNext    = $('tutorial-next');
    const tutorialOk      = $('tutorial-ok');
    const tutorialSteps   = [
        {
            icon: '👆',
            title: 'Управление',
            body: 'Свайпай пальцем по доске или жми <b>стрелки</b> на клавиатуре, чтобы двигать плитки. Четыре плитки в ряд — уже достижение!'
        },
        {
            icon: '🔗',
            title: 'Слияние',
            body: 'Одинаковые плитки сливаются в одну — их значение <b>удваивается</b>. Планируй ходы так, чтобы большие числа оставались в углу.'
        },
        {
            icon: '🎯',
            title: 'Цель и уровни',
            body: 'Собери <b>целевую плитку</b>, чтобы перейти на следующий уровень. У каждого уровня своя цель и морская тематика.'
        },
        {
            icon: '💣',
            title: 'Бусты',
            body: 'Внизу экрана есть бусты: <b>💣 бомба</b> убирает самую маленькую плитку, <b>⚡ молния</b> — три плитки, <b>💫 x2</b> удваивает очки за слияния. Получай их в сундуке 🎁.'
        },
        {
            icon: '🛒',
            title: 'Магазин',
            body: 'В магазине 🛒 можно купить бусты, перки и <b>скины</b> с бонусами к очкам. Жемчужины 🦪 зарабатывай игрой и заданиями.'
        },
        {
            icon: '🌊',
            title: 'В путь!',
            body: 'Всё готово! Собери 2048 и покажи, кто тут король океана. Удачи!'
        }
    ];
    let tutorialIndex = 0;
    function renderTutorial() {
        if (!tutorialModal) return;
        const step = tutorialSteps[tutorialIndex];
        tutorialTitle.textContent = step.title;
        tutorialIcon.textContent = step.icon;
        tutorialBody.innerHTML = step.body;
        tutorialBack.hidden = tutorialIndex === 0;
        const isLast = tutorialIndex === tutorialSteps.length - 1;
        tutorialNext.hidden = isLast;
        tutorialOk.hidden = !isLast;
        tutorialDots.innerHTML = tutorialSteps.map((_, i) =>
            `<button class="tutorial-dot${i === tutorialIndex ? ' active' : ''}" data-i="${i}" aria-label="Шаг ${i + 1}"></button>`
        ).join('');
    }
    // Жемчужины / ежедневные задания / сообщество
    const doubloonsEl      = $('doubloons');
    const comboEl          = $('combo');
    const themePriceHint   = $('theme-price-hint');
    const skinPriceHint    = $('skin-price-hint');
    const dailyList        = $('daily-list');
    const leaderboardBtn   = $('leaderboard-btn');
    const leaderboardModal = $('leaderboard-modal');
    const leaderboardList  = $('leaderboard-list');
    const closeLeaderboardBtn = $('close-leaderboard-btn');
    const shareBtn         = $('share-btn');
    // Фаза 2: соцмеханики VK
    const inviteBtn       = $('invite-btn');
    const requestBtn      = $('request-btn');
    const storyBtn        = $('story-btn');
    const favoritesBtn    = $('favorites-btn');
    const homeScreenBtn   = $('home-screen-btn');
    // Магазин, ежедневный вход, бусты
    const shopBtn          = $('shop-btn');
    const shopModal        = $('shop-modal');
    const shopTabs         = $('shop-tabs');
    const shopGrid         = $('shop-grid');
    const shopDoubloons    = $('shop-doubloons');
    const closeShopBtn     = $('close-shop-btn');
    const dailyLoginEl     = $('daily-login');
    const dlClaimBtn       = $('dl-claim-btn');
    const dlDays           = $('dl-days');
    const dlWeek           = $('dl-week');
    const dlClose          = $('dl-close');
    const boostShuffleBtn  = $('boost-shuffle');
    const boostShuffleCount = $('boost-shuffle-count');
    const boostBombBtn     = $('boost-bomb');
    const boostBombCount   = $('boost-bomb-count');
    const boostX2Btn       = $('boost-x2');
    const boostX2Count     = $('boost-x2-count');
    const boostLightningBtn  = $('boost-lightning');
    const boostLightningCount = $('boost-lightning-count');

    // Сокровищница: сундук, обмен очков и донат
    const chestBtn        = $('chest-btn');
    const chestModal      = $('chest-modal');
    const chestCloseBtn   = $('close-chest-btn');
    const chestCostEl     = $('chest-cost');
    const chestGuaranteeEl = $('chest-guarantee');
    const chestOpenBtn    = $('open-chest-btn');
    const chestRewardEl   = $('chest-reward');
    const chestOpenedEl   = $('chest-opened');
    const exchangeScoreEl = $('exchange-score');
    const exchangeRateEl  = $('exchange-rate');
    const exchangeUsedEl  = $('exchange-used');
    const exchangeBtn     = $('exchange-btn');
    const donateGrid      = $('donate-grid');
    const donateInfo      = $('donate-info');

    const confettiEl    = $('confetti');

    let state = loadState();
    ensureChallenges(state); // Режим «Челлендж» ⏱️: гарантируем записи по уровням
    ensureWeekly(state);     // Еженедельный челлендж 📅: гарантируем запись текущей недели
    ensureTournament(state); // Ежедневный турнир глубин 🏆: гарантируем запись текущего дня
    ensureInvite(state);     // Приглашение с наградой 👥: обнуляем дневной лимит при смене даты
    ensureRequests(state);   // Сообщение-вызов 💪: обнуляем дневной лимит при смене даты
    ensureDuel(state);       // Дуэль дня ⚔️: гарантируем запись текущего дня
    let game  = null;
    // Текущий режим: 'depth' (Глубины — основная игра) или 'classic' (Классика 2048)
    let gameMode = state.mode === 'classic' ? 'classic' : 'depth';
    let lastScore = 0;
    // Сколько очков текущей партии уже зачислено в баланс обмена (pointsBalance).
    // Сбрасывается при каждом старте/перезапуске партии (beginRun), чтобы одна
    // партия не могла «задвоить» очки через повторные завершения.
    let runPointsCredited = 0;
    let cloudSaveTimer = null;
    // Тип текущей партии: 'depth' | 'classic' | 'puzzle' | 'tournament' |
    // 'duel' | 'challenge' | 'weekly'. Нужен, чтобы saveBoard() не писал
    // спец-режимы в чужие слоты сохранений (saves[levelId]/saves[0]),
    // а «Заново» перезапускал ТОТ ЖЕ режим (в спец-режимах с общей доской
    // дня нельзя пересоздавать доску через game.init() — ломается сид).
    let runKind = 'depth';

    // Режим «Челлендж» ⏱️: активна ли сейчас партия с лимитом ходов
    let challengeActive = false;
    // Еженедельный челлендж 📅: активна ли сейчас партия недельного челленджа
    let weeklyActive = false;
    // Ежедневный турнир глубин 🏆: активна ли сейчас турнирная партия
    let tournamentActive = false;
    // Дуэль дня ⚔️: активна ли сейчас дуэльная партия
    let duelActive = false;
    // «Спасение» после game over: счётчик использований в текущей партии,
    // защита от двойного нажатия и отложенный interstitial (отменяется при спасении)
    let reviveCount = 0;
    let reviveBusy = false;

    /**
     * Зачислить очки партии в баланс обмена (Обмен очков в Сокровищнице).
     * Вызывается из модалок окончания партии; защита от двойного начисления —
     * через runPointsCredited (начисляется только разница с уже зачтённым).
     */
    function creditGamePointsForRun(finalScore) {
        const res = creditGamePoints(state, finalScore, runPointsCredited);
        if (res.gained <= 0) return 0;
        runPointsCredited = res.total;
        saveState(state);
        pushCloudSave();
        return res.gained;
    }

    /**
     * Обновить глобальные рекорды партии (bestTotal/bestTile). Вызывается из
     * onScoreUpdate ВСЕХ режимов (глубины, классика, головоломка, турнир, дуэль,
     * челлендж, недельный): ежедневные задания «Собери плитку 256/512» и «5000
     * очков за партию» читают именно эти поля, поэтому рекорд должен расти
     * в любой игре, а не только на глубинах.
     */
    function updateRunBest(score) {
        if (score > (state.bestTotal || 0)) {
            state.bestTotal = score;
            saveState(state);
            // Пульс рекорда (в классике табло показывает classicBest — не пульсируем)
            if (bestEl && gameMode !== 'classic') {
                bestEl.classList.remove('best-pulse');
                void bestEl.offsetWidth;
                bestEl.classList.add('best-pulse');
            }
        }
        if (game) {
            const mt = game.getMaxTile();
            if (mt > (state.bestTile || 0)) {
                state.bestTile = mt;
                saveState(state);
            }
        }
    }

    /**
     * Какой уровень стартовать при входе в режим «Глубины».
     * Головоломка/турнир/дуэль сохраняют currentLevel = 0 как маркер «не уровень» —
     * в этом случае возвращаемся на самый глубокий из открытых.
     */
    function resolveStartLevel() {
        const cl = Number(state.currentLevel);
        const unlocked = Array.isArray(state.unlockedLevels) && state.unlockedLevels.length
            ? state.unlockedLevels.slice().sort((a, b) => a - b)
            : [1];
        return unlocked.includes(cl) ? cl : unlocked[unlocked.length - 1];
    }

    /** Общая точка старта партии (любой режим): сброс счётчика зачтённых очков. */
    function beginRun() {
        runPointsCredited = 0;
    }
    // Способности скинов «Вулкан»/«Кракен» (L3): бомба бесплатно 1 раз за партию
    let freeBombUsed = false;
    let pendingInterstitial = null;
    // Донат: защита от повторного нажатия, пока окно платежа открыто
    let donateBusy = false;
    // Донат: каталог товаров VK (id из кабинета VK → Платежи), загружается при открытии
    let vkCatalog = null;
    // Статистика текущей партии для сюжетной миссии 🎯 (сбрасывается при запуске уровня)
    let missionStats = { maxTile: 0, merges: 0, moves: 0, score: 0, bestCombo: 0, bestStreak: 0 };

    // Веб-версия: лимит бесплатных отмен хода в день, дальше — жемчужины
    const WEB_UNDO_LIMIT = 3;
    const UNDO_COST = 50;

    // Доступность: пользователь просит меньше анимаций
    const reduceMotion = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

    // Автоподгонка доски под свободную высоту экрана (п.2 модерации VK):
    // квадрат доски не должен вылезать за нижний край и обрезаться. Доступная
    // высота считается с учётом шапки, индикаторов, D-pad, кнопок и бустов.
    const mainEl    = document.querySelector('main');
    const boardWrap = $('board-wrap');
    const fitBoard = () => {
        if (!mainEl || !boardWrap || !boardEl) return;
        const availW = mainEl.clientWidth;
        const others = Array.from(mainEl.children).filter(el => el !== boardWrap && el.offsetHeight > 0);
        const otherH = others.reduce((s, el) => s + el.offsetHeight, 0);
        // Зазоры между видимыми элементами main (gap: 6px)
        const visibleCount = others.length + (boardWrap.offsetHeight > 0 ? 1 : 0);
        const gaps = Math.max(0, visibleCount - 1) * 6;
        const availH = Math.max(120, mainEl.clientHeight - otherH - gaps);
        const side = Math.min(availW, availH);
        boardWrap.style.width = side + 'px';
        boardEl.style.maxWidth = side + 'px';
        // Размер доски изменился — плитки на старых пиксельных координатах
        // «съезжают» с клеток. Пересчитываем позиции без пересоздания DOM.
        if (game && typeof game.relayout === 'function') game.relayout();
    };
    if (mainEl && boardWrap) {
        // Пересчёт при изменении размеров окна/контейнера и при появлении/скрытии
        // индикаторов в main (прилив 🌊, водоворот 🌪️, акула 🦈, челлендж ⏱️, миссия 🎯).
        new ResizeObserver(fitBoard).observe(mainEl);
        new MutationObserver(fitBoard).observe(mainEl, {
            subtree: true, attributes: true, attributeFilter: ['hidden', 'class'],
        });
    }

    // ── Осень: падающие листья (канвас-слой) ──────────────────
    // Листья видны в осенний сезон (август–ноябрь) или при включённой теме
    // «Осень». Чистая логика — js/autumn.js; здесь только канвас и rAF.
    const autumnLayer = document.createElement('canvas');
    autumnLayer.className = 'autumn-layer';
    autumnLayer.width = window.innerWidth;
    autumnLayer.height = window.innerHeight;
    document.body.appendChild(autumnLayer);
    const autumnCtx = autumnLayer.getContext('2d');
    let autumnLeaves = [];
    let autumnAnimId = 0;
    let autumnLastT = 0;

    function resizeAutumnCanvas() {
        autumnLayer.width = window.innerWidth;
        autumnLayer.height = window.innerHeight;
    }
    window.addEventListener('resize', resizeAutumnCanvas);

    function resetAutumnLeaves() {
        autumnLeaves = [];
        if (!autumnCtx) return;
        const count = AUTUMN_OPTIONS.count;
        for (let i = 0; i < count; i++) {
            autumnLeaves.push(makeLeaf(autumnLayer.width, autumnLayer.height));
        }
    }

    function autumnTick(t) {
        autumnAnimId = requestAnimationFrame(autumnTick);
        if (!autumnCtx || !autumnLeaves.length) return;
        const dt = Math.min(0.05, (t - autumnLastT) / 1000 || 0.016);
        autumnLastT = t;
        autumnCtx.clearRect(0, 0, autumnLayer.width, autumnLayer.height);
        autumnCtx.textAlign = 'center';
        autumnCtx.textBaseline = 'middle';
        const w = autumnLayer.width, h = autumnLayer.height;
        for (let i = 0; i < autumnLeaves.length; i++) {
            const leaf = autumnLeaves[i];
            const onScreen = stepLeaf(leaf, dt, w, h);
            if (!onScreen) {
                autumnLeaves[i] = makeLeaf(w, h);
                continue;
            }
            autumnCtx.globalAlpha = leaf.opacity;
            autumnCtx.font = `${leaf.size}px "Segoe UI", sans-serif`;
            autumnCtx.fillText(leaf.emoji, leaf.x, leaf.y);
        }
        autumnCtx.globalAlpha = 1;
    }

    function startAutumn() {
        if (autumnAnimId || reduceMotion || !autumnCtx) return;
        resetAutumnLeaves();
        autumnLastT = performance.now();
        autumnAnimId = requestAnimationFrame(autumnTick);
    }
    function stopAutumn() {
        if (autumnAnimId) cancelAnimationFrame(autumnAnimId);
        autumnAnimId = 0;
        autumnLeaves = [];
        if (autumnCtx) autumnCtx.clearRect(0, 0, autumnLayer.width, autumnLayer.height);
    }
    // Пауза листьев: замораживаем кадр (не очищая слой), при возобновлении — продолжаем.
    function pauseAutumn() {
        if (autumnAnimId) cancelAnimationFrame(autumnAnimId);
        autumnAnimId = 0;
    }
    function resumeAutumn() {
        if (autumnAnimId || !autumnLeaves.length || reduceMotion || !autumnCtx) return;
        autumnLastT = performance.now();
        autumnAnimId = requestAnimationFrame(autumnTick);
    }

    // Осенний сезон без включённой темы — листья поверх любого фона (но не «Осени»,
    // там они тоже уместны). При выключенной анимации и reduce-motion — не запускаем.
    if (shouldShowAutumn(state.theme || 'dark')) startAutumn();

    // ── «Живой океан»: процедурный фон-канвас под всеми темами ────────────
    // Один полноэкранный canvas, рисует градиент темы, обитателей (рыбы, планктон,
    // медузы, пузыри, лучи света, лепестки) и реагирует на геймплей через
    // setIntensity / setPulse — отклик на геймплей (музыка — готовая запись OST
    // и под партию не меняется).
    const atmosphereLayer = document.createElement('canvas');
    atmosphereLayer.className = 'atmosphere-layer';
    document.body.insertBefore(atmosphereLayer, document.body.firstChild);
    const ocean = new OceanAtmosphere(atmosphereLayer, { reduceMotion });
    ocean.setTheme(state.theme || 'dark', window.innerWidth < 480 ? 'mobile' : window.innerWidth < 900 ? 'tablet' : 'desktop');

    // ── Атака акулы при проигрыше (часть B) ─────────────────────────
    // Полноэкранный оверлей поверх доски (z-index 5000), под модалкой.
    // Создаётся один раз из JS, чтобы не трогать разметку index.html.
    const sharkAttackLayer = document.createElement('div');
    sharkAttackLayer.className = 'shark-attack-layer';
    sharkAttackLayer.innerHTML =
        '<div class="sa-vignette"></div>'
        + '<canvas></canvas>'
        + '<div class="sa-flash"></div>';
    document.body.appendChild(sharkAttackLayer);
    const sharkAttackCanvas = sharkAttackLayer.querySelector('canvas');
    const sharkAttackCtx = sharkAttackCanvas.getContext('2d');
    const sharkAttackFlash = sharkAttackLayer.querySelector('.sa-flash');
    let sharkAttackBusy = false;

    // ── Зрелищные визуализации событий и механик ─────────────────────
    // Единый canvas-оверлей (z-index 5000, pointer-events: none) поверх доски.
    // Переиспользует паттерн атаки акулы; логика событий уже применена в game.js,
    // здесь — только процедурная графика (вихрь, медузы, пузырь, волна, воронка).
    const effectLayer = document.createElement('div');
    effectLayer.className = 'effect-layer';
    effectLayer.innerHTML = '<canvas></canvas>';
    document.body.appendChild(effectLayer);
    const effectCanvas = effectLayer.querySelector('canvas');
    const effectCtx = effectCanvas.getContext('2d');
    const effectPlayer = new EffectPlayer(effectCanvas, effectCtx, { reduceMotion });

    // Единая точка входа: если reduce-motion или доска пуста — мгновенно (без оверлея).
    function playEffect(name, done, extra) {
        if (reduceMotion || effectPlayer.busy) { if (done) done(); return; }
        const tiles = boardEl ? boardEl.querySelectorAll(':scope > .tile') : [];
        if (!boardEl || tiles.length === 0) { if (done) done(); return; }
        effectPlayer.play(name, boardEl, done, extra);
    }

    // Синхронизация «живого океана» с геймплеем (интенсивность → насыщенность света,
    // скорость течения → суета обитателей).
    function syncAtmosphereToGame() {
        if (!game) return;
        const tide = game.getTide();
        const threat = game.getMovesPenalty();
        const shark = game.getShark();
        const intensity = computeIntensity({
            streak: game.streak || 0,
            movesWithoutMerge: threat ? threat.movesWithoutMerge : 0,
            maxWithoutMerge: threat ? threat.maxWithoutMerge : 1,
            tideLevel: tide ? tide.level : 0,
            sharkActive: !!(shark && typeof shark.pos === 'number'),
            threatLevel: threat ? threat.movesWithoutMerge / Math.max(1, threat.maxWithoutMerge) : 0,
        });
        ocean.setIntensity(intensity);
        // Скорость течения = базовое + серия (чем дольше серия, тем живее вода)
        const flow = Math.min(1, 0.4 + (game.streak || 0) * 0.08);
        ocean.setFlow(flow);
    }

    // Визуальный пульс-отклик на события геймплея.
    function atmospherePulse(kind) {
        ocean.setPulse(kind);
    }

    function setAtmosphereTheme(theme) {
        const size = window.innerWidth < 480 ? 'mobile' : window.innerWidth < 900 ? 'tablet' : 'desktop';
        ocean.setTheme(theme, size);
    }

    function startAtmosphere() {
        if (reduceMotion) return;
        ocean.start();
    }
    function pauseAtmosphere() { ocean.pause(); }
    function resumeAtmosphere() {
        if (reduceMotion) return;
        ocean.resume();
    }

    // ── Атака акулы при проигрыше (часть B) ─────────────────────────
    // Киношный «укус»: акула быстро выплывает, раскрывает пасть почти на
    // весь экран, плитки доски «втягиваются» в зев, пасть захлопывается,
    // и только потом показывается модалка с очками.

    // Рисует голову акулы в раскрытой пасти (профиль, нос вправо).
    // jaw: 0 = закрыто, 1 = пасть на весь экран. cx,cy — центр зева.
    function drawSharkHead(ctx, W, H, t, jaw, cx, cy, scale) {
        ctx.save();
        ctx.translate(cx, cy);
        ctx.scale(scale, scale);

        const gap = jaw * H * 0.42;          // раскрытие челюстей (в px сцены)
        const headLen = W * 0.5;             // длина головы
        const bodyH = headLen * 0.34;

        // --- Тёмный зев (глубина рта) — рисуется первым, за челюстями ---
        const maw = ctx.createRadialGradient(0, 0, 10, 0, 0, Math.max(W, H) * 0.5);
        maw.addColorStop(0, '#1a0508');
        maw.addColorStop(0.6, '#3a0a10');
        maw.addColorStop(1, 'rgba(60,10,16,0)');
        ctx.fillStyle = maw;
        ctx.beginPath();
        ctx.ellipse(0, 0, headLen * 0.62, gap + bodyH * 0.5, 0, 0, Math.PI * 2);
        ctx.fill();

        // --- Верхняя челюсть (с носом) ---
        ctx.fillStyle = '#2e4a5e';
        ctx.beginPath();
        ctx.moveTo(headLen * 0.5, -bodyH * 0.2);            // нос
        ctx.quadraticCurveTo(headLen * 0.45, -bodyH * 1.1, headLen * 0.1, -bodyH * 1.0);
        ctx.quadraticCurveTo(-headLen * 0.3, -bodyH * 0.9, -headLen * 0.5, -bodyH * 0.4);
        // линия рта вверх (раскрытие)
        ctx.lineTo(-headLen * 0.5, -gap * 0.9);
        ctx.quadraticCurveTo(-headLen * 0.2, -gap * 0.95, headLen * 0.1, -gap * 0.9);
        ctx.quadraticCurveTo(headLen * 0.35, -gap * 0.8, headLen * 0.5, -gap * 0.55);
        ctx.closePath();
        ctx.fill();

        // --- Нижняя челюсть ---
        ctx.beginPath();
        ctx.moveTo(headLen * 0.5, bodyH * 0.2);             // подбородок
        ctx.quadraticCurveTo(headLen * 0.4, bodyH * 1.0, headLen * 0.05, bodyH * 0.95);
        ctx.quadraticCurveTo(-headLen * 0.35, bodyH * 0.85, -headLen * 0.5, bodyH * 0.35);
        // линия рта вниз (раскрытие)
        ctx.lineTo(-headLen * 0.5, gap * 0.9);
        ctx.quadraticCurveTo(-headLen * 0.2, gap * 0.95, headLen * 0.1, gap * 0.9);
        ctx.quadraticCurveTo(headLen * 0.35, gap * 0.8, headLen * 0.5, gap * 0.55);
        ctx.closePath();
        ctx.fill();

        // --- Зубья (треугольники) по верхней и нижней челюсти ---
        ctx.fillStyle = '#e8eef2';
        const teeth = 9;
        for (let i = 0; i < teeth; i++) {
            const f = i / (teeth - 1);
            const x = headLen * (0.42 - f * 0.85);
            const yTop = -gap * (0.55 + f * 0.35) - bodyH * 0.05;
            const yBot = gap * (0.55 + f * 0.35) + bodyH * 0.05;
            const th = bodyH * (0.5 + f * 0.5);
            // верхние зубы (вниз)
            ctx.beginPath();
            ctx.moveTo(x - headLen * 0.035, yTop);
            ctx.lineTo(x, yTop + th);
            ctx.lineTo(x + headLen * 0.035, yTop);
            ctx.closePath();
            ctx.fill();
            // нижние зубы (вверх)
            ctx.beginPath();
            ctx.moveTo(x - headLen * 0.035, yBot);
            ctx.lineTo(x, yBot - th);
            ctx.lineTo(x + headLen * 0.035, yBot);
            ctx.closePath();
            ctx.fill();
        }

        // --- Спинной плавник ---
        ctx.fillStyle = '#2e4a5e';
        ctx.beginPath();
        ctx.moveTo(-headLen * 0.05, -bodyH * 0.7);
        ctx.lineTo(-headLen * 0.18, -bodyH * 1.9);
        ctx.lineTo(-headLen * 0.4, -bodyH * 0.8);
        ctx.closePath();
        ctx.fill();

        // --- Глаз (злой, с бликом) ---
        ctx.fillStyle = '#f5f7f8';
        ctx.beginPath();
        ctx.arc(headLen * 0.28, -bodyH * 0.55, bodyH * 0.16, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#0a0a0a';
        ctx.beginPath();
        ctx.arc(headLen * 0.29, -bodyH * 0.55, bodyH * 0.09, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(headLen * 0.32, -bodyH * 0.6, bodyH * 0.03, 0, Math.PI * 2);
        ctx.fill();

        // --- Жабры ---
        ctx.strokeStyle = 'rgba(10,20,30,.5)';
        ctx.lineWidth = Math.max(1, bodyH * 0.05);
        for (let i = 0; i < 3; i++) {
            const gx = -headLen * 0.05 - i * headLen * 0.06;
            ctx.beginPath();
            ctx.moveTo(gx, -bodyH * 0.5);
            ctx.quadraticCurveTo(gx + headLen * 0.02, 0, gx, bodyH * 0.5);
            ctx.stroke();
        }

        ctx.restore();
    }

    // Запускает анимацию атаки. По завершении вызывает done() → модалка.
    function runSharkAttack(done) {
        if (sharkAttackBusy) { done(); return; }
        sharkAttackBusy = true;

        // Собрать клоны плиток в их текущих экранных позициях.
        const tiles = boardEl ? Array.from(boardEl.querySelectorAll(':scope > .tile')) : [];
        const clones = [];
        const vw = window.innerWidth;
        const vh = window.innerHeight;

        // Скрыть реальные плитки на время атаки (доска «пустеет»).
        tiles.forEach((el) => { el.style.opacity = '0'; });

        // Клоны — точные копии (сохраняют тему/глиф/цвет), позиционируются по экрану.
        tiles.forEach((el) => {
            const r = el.getBoundingClientRect();
            const clone = el.cloneNode(true);
            clone.className = 'sa-tile';
            clone.removeAttribute('style');
            clone.style.width = r.width + 'px';
            clone.style.height = r.height + 'px';
            clone.style.transform = `translate(${r.left}px, ${r.top}px)`;
            clone.style.opacity = '1';
            sharkAttackLayer.appendChild(clone);
            clones.push({ el: clone, cx: r.left + r.width / 2, cy: r.top + r.height / 2, w: r.width, h: r.height });
        });

        // Размер canvas под viewport (DPR).
        const dpr = Math.min(2, window.devicePixelRatio || 1);
        sharkAttackCanvas.width = vw * dpr;
        sharkAttackCanvas.height = vh * dpr;
        sharkAttackCanvas.style.width = vw + 'px';
        sharkAttackCanvas.style.height = vh + 'px';
        sharkAttackCtx.setTransform(dpr, 0, 0, dpr, 0, 0);

        sharkAttackLayer.classList.add('active');
        sharkAttackFlash.classList.remove('go');

        // Направление атаки: акула выплывает снизу-сбоку к центру доски.
        const fromLeft = Math.random() > 0.5;
        const boardRect = boardEl ? boardEl.getBoundingClientRect() : { left: vw / 2, top: vh / 2, width: vw * 0.6, height: vh * 0.6 };
        const targetX = boardRect.left + boardRect.width / 2;
        const targetY = boardRect.top + boardRect.height / 2;

        const T0 = performance.now();
        const DUR = 1500; // мс — вся сцена

        // Таймлайн (доли 0..1):
        //   0.00-0.18  акула выплывает и приближается
        //   0.18-0.42  челюсти раскрываются до максимума
        //   0.42-0.78  плитки втягиваются в зев (волной)
        //   0.78-0.90  челюсти захлопываются
        //   0.90-1.00  вспышка + затухание

        function frame() {
            const p = Math.min(1, (performance.now() - T0) / DUR);
            const ctx = sharkAttackCtx;
            ctx.clearRect(0, 0, vw, vh);

            // Фазы раскрытия пасти (jaw/scale всегда задаются одной из веток ниже)
            let jaw;
            let scale;
            let cx = targetX;
            let cy = targetY;
            if (p < 0.18) {
                const k = p / 0.18;
                scale = 0.4 + k * 0.7;              // растёт, приближаясь
                jaw = k * 0.15;
                // акула едет от края к центру
                cx = fromLeft ? (vw * 0.1 + (targetX - vw * 0.1) * k) : (vw * 0.9 + (targetX - vw * 0.9) * k);
                cy = vh * 0.9 + (targetY - vh * 0.9) * k;
            } else if (p < 0.42) {
                const k = (p - 0.18) / 0.24;
                scale = 1.1 + k * 0.5;
                jaw = 0.15 + k * 0.85;              // пасть раскрывается почти на весь экран
            } else if (p < 0.78) {
                scale = 1.6;
                jaw = 1;
            } else if (p < 0.9) {
                const k = (p - 0.78) / 0.12;
                jaw = 1 - k;                        // захлопывание
                scale = 1.6 - k * 0.3;
            } else {
                const k = (p - 0.9) / 0.1;
                jaw = Math.max(0, 1 - k * 3);
                scale = 1.3 - k * 0.4;
            }

            // Рисуем акулу (нос вправо; если справа — отражаем по X).
            ctx.save();
            if (!fromLeft) {
                ctx.translate(vw, 0);
                ctx.scale(-1, 1);
                drawSharkHead(ctx, vw, vh, p, jaw, vw - cx, cy, scale);
            } else {
                drawSharkHead(ctx, vw, vh, p, jaw, cx, cy, scale);
            }
            ctx.restore();

            // Плитки-клоны втягиваются в зев (центр пасти ~ targetX,targetY).
            const suckStart = 0.42;
            const suckEnd = 0.78;
            if (p >= suckStart) {
                const sp = Math.min(1, (p - suckStart) / (suckEnd - suckStart));
                clones.forEach((c, i) => {
                    // волна: каждая плитка стартует со своей задержкой
                    const delay = i / Math.max(1, clones.length) * 0.5;
                    const cp = Math.max(0, Math.min(1, (sp - delay) / (1 - 0.5)));
                    if (cp <= 0) return;
                    const ease = 1 - Math.pow(1 - cp, 3);
                    const dx = targetX - c.cx;
                    const dy = targetY - c.cy;
                    const x = c.cx + dx * ease;
                    const y = c.cy + dy * ease;
                    const s = 1 - ease * 0.92;
                    const rot = ease * (fromLeft ? -1 : 1) * 0.6;
                    c.el.style.transform =
                        `translate(${x - c.w / 2}px, ${y - c.h / 2}px) scale(${s}) rotate(${rot}rad)`;
                    c.el.style.opacity = String(Math.max(0, 1 - ease * 1.4));
                });
            }

            if (p < 1) {
                requestAnimationFrame(frame);
            } else {
                finishAttack(done);
            }
        }

        function finishAttack(done) {
            // Вспышка при захлопывании
            sharkAttackFlash.classList.remove('go');
            void sharkAttackFlash.offsetWidth;
            sharkAttackFlash.classList.add('go');
            // Убрать клоны и оверлей
            setTimeout(() => {
                clones.forEach((c) => c.el.remove());
                sharkAttackLayer.classList.remove('active');
                // Вернуть плитки (на случай, если модалка закрыта без перезапуска)
                tiles.forEach((el) => { el.style.opacity = ''; });
                sharkAttackBusy = false;
                done();
            }, 380);
        }

        requestAnimationFrame(frame);
    }

    // Единая точка входа: вместо мгновенной модалки — атака акулы.
    function playSharkGameOver(score, showFn) {
        if (reduceMotion || sharkAttackBusy) { showFn(); return; }
        // Не запускаем, если доска пуста или нет плиток (нечего «съедать»).
        const tiles = boardEl ? boardEl.querySelectorAll(':scope > .tile') : [];
        if (!boardEl || tiles.length === 0) { showFn(); return; }
        runSharkAttack(() => showFn());
    }

    // Фаза 1: пузырьки-фон за доской (создаются один раз, GPU-анимация)
    const bubblesEl = $('bubbles');
    const BUBBLE_COUNT = 14;
    function spawnBubbles() {
        if (!bubblesEl || reduceMotion) return;
        if (bubblesEl.children.length) return; // уже созданы
        const frag = document.createDocumentFragment();
        for (let i = 0; i < BUBBLE_COUNT; i++) {
            const b = document.createElement('i');
            b.className = 'bub';
            const size = 10 + Math.random() * 34;
            b.style.width  = size + 'px';
            b.style.height = size + 'px';
            b.style.left   = (Math.random() * 100) + '%';
            b.style.setProperty('--bo', (0.25 + Math.random() * 0.4).toFixed(2));
            b.style.setProperty('--sway', (Math.random() * 60 - 30).toFixed(0) + 'px');
            b.style.animationDuration = (7 + Math.random() * 9) + 's';
            b.style.animationDelay    = (-Math.random() * 12) + 's'; // сразу «в полёте»
            frag.appendChild(b);
        }
        bubblesEl.appendChild(frag);
    }

    // Фаза 1: счёт-вверх (count-up). Плавно «докручивает» число от prev до score,
    // при reduce-motion или нулевой разнице сразу ставит итог.
    let scoreAnimTimer = null;
    function animateScore(prev, next) {
        const from = Number(prev) || 0;
        const to   = Number(next) || 0;
        if (reduceMotion || to <= from || !scoreEl) {
            scoreEl.textContent = to.toLocaleString('ru');
            return;
        }
        clearTimeout(scoreAnimTimer);
        const dur = Math.min(450, 120 + (to - from) * 0.6);
        const start = performance.now();
        const step = (now) => {
            const t = Math.min(1, (now - start) / dur);
            const eased = 1 - Math.pow(1 - t, 3); // easeOutCubic
            const val = Math.round(from + (to - from) * eased);
            scoreEl.textContent = val.toLocaleString('ru');
            if (t < 1) scoreAnimTimer = requestAnimationFrame(step);
        };
        scoreAnimTimer = requestAnimationFrame(step);
    }

    // Подтверждение перезапуска: откуда вызвано (из паузы или с кнопки «Новая игра»)
    let confirmRestartFromPause = false;

    // Сохранение текущей партии (доска + очки) — отдельно для каждого уровня.
    // Живут здесь, т.к. используют game/state из замыкания.
    function loadSaves() {
        try { return JSON.parse(localStorage.getItem(SAVE_KEY)) || {}; } catch (_) { return {}; }
    }

    function saveBoard() {
        if (!game) return;
        // Только партии ГЛУБИН сохраняют доску. Спец-режимы (головоломка,
        // турнир, дуэль, челлендж, недельный) используют currentLevel как
        // контекст (0 или levelId) — их доска детерминированная (общий сид дня),
        // и она НЕ должна затирать слот сохранения реального уровня глубины.
        // Маркер режима — runKind (сравнение с currentLevel недостаточно:
        // челлендж/недельник ставят currentLevel в настоящий levelId 1..7).
        if (runKind !== 'depth') return;
        const lvl = Number(state.currentLevel);
        if (!Number.isInteger(lvl) || lvl < 1 || lvl > 7) return;
        const saves = loadSaves();
        saves[lvl] = { board: game.getState(), ts: Date.now() };
        try { localStorage.setItem(SAVE_KEY, JSON.stringify(saves)); } catch (_) {}
    }

    function clearBoardSave(levelId) {
        const saves = loadSaves();
        delete saves[levelId];
        try { localStorage.setItem(SAVE_KEY, JSON.stringify(saves)); } catch (_) {}
    }

    function restoreBoardIfAny() {
        const saves = loadSaves();
        const saved = saves[state.currentLevel];
        if (!saved || !saved.board || !saved.board.tiles) return false;
        game.loadState(saved.board);
        return true;
    }

    // ── SDK площадок: инициализация + загрузочный экран ──────
    if (loadingBarFill) loadingBarFill.style.width = '10%';
    sdk.setLoadingProgress(10);
    await sdk.init();
    // П. 2.14: автоопределение языка — при запуске (не в процессе игры).
    const detectedLang = sdk.getLang();
    if (detectedLang) document.documentElement.lang = detectedLang;
    if (loadingHint) loadingHint.textContent = 'Открываем глубины океана…';
    if (loadingBarFill) loadingBarFill.style.width = '40%';
    sdk.setLoadingProgress(40);
    if (sdk.isPlatform()) {
        const cloud = await sdk.loadCloud();
        if (cloud) {
            // Единая стратегия: локальное ∪ облачное, настройки — последняя запись.
            // Результат сохраняем локально и возвращаем обратно в облако (сходимость).
            state = resolveConflict(state, cloud.state);
            saveState(state);
            const mergedSaves = mergeBoardSaves(loadSaves(), cloud.saves);
            try { localStorage.setItem(SAVE_KEY, JSON.stringify(mergedSaves)); } catch (_) {}
            pushCloudSave();
        }
    }
    if (loadingHint) loadingHint.textContent = 'Готовим корабль к плаванию…';
    if (loadingBarFill) loadingBarFill.style.width = '70%';
    sdk.setLoadingProgress(70);

    // ── Разметка геймплея (Yandex GameplayAPI, п. 1.19.3) ─────
    // gameplayActive — идёт ли игровой процесс (для GameplayAPI.start()/stop());
    // gameplayWasActive — был ли геймплей активен до паузы платформы (game_api_pause);
    // platformPaused — пауза, вызванная платформой (реклама, сворачивание окна);
    // gameplayStartPending — старт отложен до game_api_resume (стартовая реклама).
    let gameplayActive = false;
    let gameplayWasActive = false;
    let platformPaused = false;
    let gameplayStartPending = false;

    function markGameplayStart() {
        if (gameplayActive) return;
        // Стартовая полноэкранная реклама: если платформа на паузе, откладываем
        // GameplayAPI.start() до game_api_resume (см. пример в документации).
        if (platformPaused) { gameplayStartPending = true; return; }
        gameplayStartPending = false;
        gameplayActive = true;
        sdk.gameplayStart();
    }
    function markGameplayStop() {
        gameplayStartPending = false;
        if (!gameplayActive) return;
        gameplayActive = false;
        sdk.gameplayStop();
    }

    // П. 1.19.4 + стартовая полноэкранная реклама (см. «Пауза и возобновление»).
    // При game_api_pause глушим звук и ставим геймплей на паузу, при
    // game_api_resume — возобновляем. Если геймплей был остановлен игроком
    // (меню/пауза) до срабатывания game_api_pause, после resume не запускаем.
    const onPlatformPause = () => {
        suspendSound();
        suspendMusic();
        pauseAutumn();
        pauseAtmosphere();
        platformPaused = true;
        if (gameplayActive) {
            gameplayWasActive = true;
            if (game && !game.gameOver && !game.won && !game.paused) setPaused(true);
            markGameplayStop();
        }
    };
    const onPlatformResume = () => {
        resumeSound();
        resumeMusic();
        resumeAutumn();
        resumeAtmosphere();
        platformPaused = false;
        if (gameplayWasActive) {
            gameplayWasActive = false;
            if (game && !game.gameOver && !game.won && game.paused) setPaused(false);
        }
        if (gameplayStartPending) {
            gameplayStartPending = false;
            markGameplayStart();
        }
    };
    sdk.onPause(onPlatformPause);
    sdk.onResume(onPlatformResume);

    // На нативных приложениях кнопка fullscreen не нужна — уже полный экран
    if (platform.isNative && fullscreenBtn) {
        fullscreenBtn.hidden = true;
    }

    // ── Helpers ──────────────────────────────────────────────

    function currentLevelDef() {
        return levelById(state.currentLevel);
    }

    function updateStats() {
        // В режиме «Классика» показываем отдельный рекорд классики
        if (bestEl) {
            const best = gameMode === 'classic' ? (state.classicBest || 0) : (state.bestTotal || 0);
            bestEl.textContent = best.toLocaleString('ru');
        }
        const gp = $('games-played'); if (gp) gp.textContent = (state.gamesPlayed || 0).toLocaleString('ru');
        const bt = $('best-tile');    if (bt) bt.textContent = (state.bestTile || 0).toLocaleString('ru');
        if (soundBtn) soundBtn.textContent = state.sound === false ? '🔇' : '🔊';
        // Музыка: чекбокс и подсветка активного трека (OST / Выкл)
        if (settingsMusic) settingsMusic.checked = state.music !== false;
        if (musicOptions) musicOptions.querySelectorAll('.music-btn').forEach(b => {
            b.classList.toggle('active', b.dataset.track === (state.musicTrack || 'ost'));
        });
        updateDoubloons();
    }

    // Последняя показанная серия (для триггера комбо-эффекта на доске)
    let lastComboShown = 0;
    function renderCombo() {
        if (!comboEl) return;
        const s = game ? (game.streak || 0) : 0;
        comboEl.textContent = s.toLocaleString('ru');
        comboEl.classList.toggle('active', s >= STREAK_THRESHOLD);
        // Комбо-эффект на доске: при росте серии слияний — вспышка + «Комбо ×N»
        if (s === 0) lastComboShown = 0;
        if (s >= 2 && s > lastComboShown) comboBurstOnBoard(s);
        lastComboShown = s;
    }

    /** Вспышка доски + всплывающий текст «Комбо ×N» при росте серии слияний. */
    function comboBurstOnBoard(s) {
        if (!boardEl || !boardEl.isConnected) return;
        if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
        // Золотое свечение рамки доски
        boardEl.classList.remove('combo-glow');
        void boardEl.offsetWidth;
        boardEl.classList.add('combo-glow');
        setTimeout(() => boardEl.classList.remove('combo-glow'), 700);
        // Всплывающий текст над доской
        let pop = boardEl.querySelector(':scope > .combo-pop');
        if (!pop) {
            pop = document.createElement('div');
            pop.className = 'combo-pop';
            boardEl.appendChild(pop);
        }
        pop.textContent = 'Комбо ×' + s;
        pop.classList.remove('pop');
        void pop.offsetWidth;
        pop.classList.add('pop');
    }

    function updateMoves() {
        if (movesEl) movesEl.textContent = (game ? game.getMoves() : 0).toLocaleString('ru');
        renderCombo();
    }

    // ── Сюжетная миссия глубины 🎯 (Фаза 2: «Цель ≠ набери N»; Фаза 4.5:
    //    позиционные цели 🪸 — миссии привязаны к месту на доске) ──
    function missionStatsForLevel() {
        const mt = game ? game.getMaxTile() : 0;
        const combo = game ? game.streak : 0;
        return {
            maxTile: Math.max(missionStats.maxTile, mt),
            merges:  missionStats.merges,
            moves:   missionStats.moves,
            score:   missionStats.score,
            bestCombo:  Math.max(missionStats.bestCombo, combo),
            bestStreak: Math.max(missionStats.bestStreak, combo),
        };
    }

    /** Текущая доска партии (для позиционных целей) или null вне партии. */
    function missionBoard() {
        return game ? game.getBoard() : null;
    }

    function renderMission() {
        if (!missionBar) return;
        const mission = missionForLevel(state.currentLevel);
        if (!mission) { missionBar.hidden = true; return; }

        const stats = missionStatsForLevel();
        const board = missionBoard();
        const done = isMissionComplete(mission, stats, board);
        const claimed = isMissionClaimed(state, mission.id);
        const progress = missionProgress(mission, stats, board);

        missionBar.hidden = false;
        missionBar.classList.toggle('done', done && !claimed);
        if (missionIcon) missionIcon.textContent = mission.icon;
        if (missionTitle) missionTitle.textContent = done && !claimed ? `Миссия выполнена! ${mission.title}` : mission.title;
        if (mission.type === 'position') {
            // Позиционная цель: прогресс-бар «выполнена/нет» (0/1) + текст без числителя
            if (missionFill) missionFill.style.width = progress === 1 ? '100%' : '0%';
            if (missionCaption) {
                missionCaption.textContent = claimed
                    ? 'Награда получена 🎁'
                    : done
                        ? `Забери награду: +${mission.reward} 🦪`
                        : mission.desc;
            }
        } else {
            const target = Number(mission.target) || 1;
            if (missionFill) missionFill.style.width = Math.round((progress / target) * 100) + '%';
            if (missionCaption) {
                missionCaption.textContent = claimed
                    ? 'Награда получена 🎁'
                    : done
                        ? `Забери награду: +${mission.reward} 🦪`
                        : `${mission.desc} (${progress.toLocaleString('ru')} / ${target.toLocaleString('ru')})`;
            }
        }
        if (missionClaim) {
            missionClaim.hidden = !(done && !claimed);
            missionClaim.disabled = false;
        }
    }

    function claimMission() {
        const mission = missionForLevel(state.currentLevel);
        if (!mission) return;
        const got = claimMissionReward(state, mission.id, missionStatsForLevel(), missionBoard());
        if (got > 0) {
            saveState(state);
            updateDoubloons();
            showToast(`+${got} 🦪 за миссию «${mission.title}»`, mission.icon);
            renderMission();
            checkAchievements();
        }
    }

    /** Обновить индикатор прилива: высота воды + сколько ходов до смыва. */
    function updateTideIndicator() {
        if (!tideIndicator) return;
        const t = game ? game.getTide() : null;
        if (!t) {
            tideIndicator.hidden = true;
            return;
        }
        tideIndicator.hidden = false;
        if (tideBarFill) tideBarFill.style.width = (t.level * 100).toFixed(0) + '%';
        if (tideCount) tideCount.textContent = String(t.movesUntilRise);
        // Тревожный режим: осталось меньше warning ходов
        tideIndicator.classList.toggle('warning', t.movesUntilRise <= t.warning);
    }

    /** Вспышка индикатора в момент смыва нижних рядов. */
    function flashTideSweep() {
        if (!tideIndicator || tideIndicator.hidden) return;
        tideIndicator.classList.remove('sweep');
        void tideIndicator.offsetWidth;
        tideIndicator.classList.add('sweep');
    }

    /** Обновить индикатор «водоворота»: заполнение + сколько ходов до штрафа. */
    function updateThreatIndicator() {
        if (!threatIndicator) return;
        const m = game ? game.getMovesPenalty() : null;
        if (!m) {
            threatIndicator.hidden = true;
            return;
        }
        threatIndicator.hidden = false;
        // Полоса растёт по мере накопления бесполезных ходов подряд
        const ratio = Math.min(1, m.movesWithoutMerge / m.maxWithoutMerge);
        if (threatBarFill) threatBarFill.style.width = (ratio * 100).toFixed(0) + '%';
        if (threatCount) threatCount.textContent = String(m.maxWithoutMerge - m.movesWithoutMerge);
        // Тревожный режим: до водоворота остался 1 ход
        threatIndicator.classList.toggle('warning', m.movesWithoutMerge >= m.maxWithoutMerge - 1);
    }

    /** Вспышка индикатора в момент срабатывания «водоворота». */
    function flashThreatSweep() {
        if (!threatIndicator || threatIndicator.hidden) return;
        threatIndicator.classList.remove('sweep');
        void threatIndicator.offsetWidth;
        threatIndicator.classList.add('sweep');
    }

    /**
     * Обновить индикатор «Акула-охотник»: отсчёт до появления/шага + сколько съедено.
     * Пока акула не появилась — полоса показывает приближение появления;
     * после появления — ходы до следующего шага, счётчик — съеденные плитки.
     */
    function updateSharkIndicator() {
        if (!sharkIndicator) return;
        const s = game ? game.getShark() : null;
        if (!s) {
            sharkIndicator.hidden = true;
            return;
        }
        sharkIndicator.hidden = false;
        if (s.pos === null) {
            // Акула ещё не появилась: полная шкала = приближение появления
            const ratio = Math.max(0, 1 - s.movesUntilStep / s.appearMoves);
            if (sharkBarFill) sharkBarFill.style.width = (ratio * 100).toFixed(0) + '%';
            if (sharkCount) sharkCount.textContent = String(Math.max(0, s.movesUntilStep));
            sharkIndicator.classList.toggle('warning', s.movesUntilStep <= 1);
        } else {
            // Акула на доске: полная шкала = ходы до шага
            const ratio = Math.max(0, 1 - s.movesUntilStep / s.stepInterval);
            if (sharkBarFill) sharkBarFill.style.width = (ratio * 100).toFixed(0) + '%';
            if (sharkCount) sharkCount.textContent = s.eaten > 0 ? String(s.eaten) : '–';
            sharkIndicator.classList.toggle('warning', s.movesUntilStep <= 1);
        }
    }

    /** Вспышка индикатора при появлении / шаге / укусе акулы. */
    function flashShark() {
        if (!sharkIndicator || sharkIndicator.hidden) return;
        sharkIndicator.classList.remove('sweep');
        void sharkIndicator.offsetWidth;
        sharkIndicator.classList.add('sweep');
    }

    /**
     * Обновить индикатор «Прилив и отлив»: какая фаза наступит следующей
     * и через сколько ходов. Полоса показывает прогресс до смены фазы.
     */
    function updateEbbtideIndicator() {
        if (!ebbtideIndicator) return;
        const e = game ? game.getEbbtide() : null;
        if (!e) {
            ebbtideIndicator.hidden = true;
            return;
        }
        ebbtideIndicator.hidden = false;
        const isFlow = e.phase === 'flow';
        // Фаза, которая применится следующей: прилив (×2) или отлив (÷2)
        if (ebbtideEmoji) ebbtideEmoji.textContent = isFlow ? '🌊' : '⬇️';
        if (ebbtideLabel) ebbtideLabel.textContent = isFlow ? 'Прилив' : 'Отлив';
        // Полоса растёт по мере приближения смены фазы
        const ratio = Math.max(0, 1 - e.movesUntilFlip / e.interval);
        if (ebbtideBarFill) ebbtideBarFill.style.width = (ratio * 100).toFixed(0) + '%';
        if (ebbtideCount) ebbtideCount.textContent = String(e.movesUntilFlip);
        // Класс фазы для палитры + тревожный режим при приближении смены
        ebbtideIndicator.classList.toggle('flow', isFlow);
        ebbtideIndicator.classList.toggle('ebb', !isFlow);
        ebbtideIndicator.classList.toggle('warning', e.movesUntilFlip <= 1);
    }

    /** Вспышка индикатора в момент смены фазы «Прилив и отлив». */
    function flashEbbtide() {
        if (!ebbtideIndicator || ebbtideIndicator.hidden) return;
        ebbtideIndicator.classList.remove('sweep');
        void ebbtideIndicator.offsetWidth;
        ebbtideIndicator.classList.add('sweep');
    }

    // ── «Живой океан»: синхронизация с геймплеем ────────────────────────────────
    // Процедурная музыка удалена: саундтрек (js/ost.js) — готовая запись и под
    // геймплей не меняется. Атмосфера по-прежнему реагирует на партию через
    // syncAtmosphereToGame() (вызывается в onSave каждого режима).

    /** Пульс-событие геймплея → визуальный отклик океана (свет/частицы). */
    function gamePulse(kind) {
        atmospherePulse(kind);
    }

    /** Обновить индикатор «Челлендж» ⏱️/📅: цель и сколько ходов осталось из лимита. */
    function updateChallengeIndicator() {
        if (!challengeIndicator) return;
        // Недельный челлендж 📅 или челлендж уровня ⏱️ — индикатор общий.
        let ch = null;
        if (weeklyActive) {
            const w = weeklyInfo(state);
            ch = { target: w.target, movesLimit: w.movesLimit };
        } else if (challengeActive) {
            ch = challengeForLevel(state.currentLevel);
        }
        if (!ch) {
            challengeIndicator.hidden = true;
            return;
        }
        challengeIndicator.hidden = false;
        if (challengeTargetEl) challengeTargetEl.textContent = ch.target.toLocaleString('ru');
        const used = game ? game.getMoves() : 0;
        const left = Math.max(0, ch.movesLimit - used);
        const ratio = Math.min(1, used / ch.movesLimit);
        if (challengeBarFill) challengeBarFill.style.width = (ratio * 100).toFixed(0) + '%';
        if (challengeCount) challengeCount.textContent = String(left);
        challengeIndicator.classList.toggle('warning', left <= 3);
    }

    function updateHeader() {
        if (gameMode === 'classic') {
            // Режим «Классика»: чистый 2048 — без уровня и цели-числа
            levelNumEl.textContent    = '–';
            levelNameEl.textContent   = '🎮 Классика 2048';
            levelTargetEl.textContent = '2048';
            // Скрываем элементы уровней через класс body
            document.body.classList.add('mode-classic');
            document.body.classList.remove('mode-depth');
        } else {
            const lv = currentLevelDef();
            levelNumEl.textContent    = lv.id;
            levelNameEl.textContent   = `${lv.rank} ${lv.name}`;
            levelTargetEl.textContent = lv.target.toLocaleString('ru');
            document.body.classList.add('mode-depth');
            document.body.classList.remove('mode-classic');
        }
        updateStats();
        updateMoves();
    }

    function updateUndoState() {
        if (undoBtn) undoBtn.disabled = !(game && game.canUndo());
    }

    // Внешний вид: тема и скин
    const THEME_CLASSES = ['theme-dark', 'theme-light', 'theme-autumn', 'theme-forest', 'theme-sunset', 'theme-abyss', 'theme-sakura'];
    const SKIN_CLASSES  = ['skin-gold', 'skin-wood', 'skin-gem', 'skin-ice', 'skin-fire', 'skin-storm', 'skin-pearl', 'skin-abyss', 'skin-kraken'];
    function applyAppearance() {
        document.body.classList.remove(...THEME_CLASSES, ...SKIN_CLASSES);
        document.body.classList.add('theme-' + (state.theme || 'dark'));
        document.body.classList.add('skin-' + (state.skin || 'gold'));
        // Осенний сезон: класс на body, чтобы тёплый загрузочный экран и листья
        // были видны даже без включённой темы «Осень» (август–ноябрь).
        if (shouldShowAutumn(state.theme || 'dark')) {
            document.body.classList.add('autumn-season');
        } else {
            document.body.classList.remove('autumn-season');
        }
        // «Живой океан»: переключаем канвас-фон на тему
        setAtmosphereTheme(state.theme || 'dark');
    }

    /** Стартовая плитка новой партии с учётом перков «Бонусная плитка» / «Глубокий старт». */
    function startingBonusTile() {
        if (ownsPerk(state, 'bonusTile8')) return 8;
        if (ownsPerk(state, 'bonusTile'))  return 4;
        return 0;
    }

    /** Текущий суммарный бонус скина + темы в процентах. */
    function currentAppearanceBonus() {
        return appearanceBonusPercent(state);
    }

    /** Конфиг прилива с учётом перка «Спокойные воды»: прилив наступает на 1 ход позже. */
    function tideConfigWithPerks(id) {
        const cfg = tideConfigForLevel(id);
        if (!cfg) return null;
        let interval = cfg.interval || 10;
        if (ownsPerk(state, 'tideSlow')) interval += 1;
        // Скин «Бездна» (L3): +1 ход к приливу — прилив наступает позже.
        if (hasSkinAbility(state, 'abyss')) interval += 1;
        return { ...cfg, interval };
    }

    function settingLabel(btn) {
        return btn.dataset.orig || (btn.dataset.orig = btn.textContent.trim().replace(/\s*🔒\s*$/, ''));
    }

    // Фаза 5: применение настроек доступности на body (скорость анимаций, крупный текст)
    function applyAccessibility() {
        document.body.classList.toggle('anim-fast', state.animSpeed === 'fast');
        document.body.classList.toggle('large-text', !!state.largeText);
    }

    function updateSettingsUI() {
        if (settingsSound)    settingsSound.checked    = state.sound !== false;
        if (settingsMusic)    settingsMusic.checked    = state.music !== false;
        if (settingsInfinity) settingsInfinity.checked = !!state.infinity;
        if (settingsLargeText) settingsLargeText.checked = !!state.largeText;
        if (settingsAnimSpeed) {
            settingsAnimSpeed.classList.toggle('active', state.animSpeed === 'fast');
        }
        applyAccessibility();
        if (themeOptions) themeOptions.querySelectorAll('.setting-btn').forEach(b => {
            const price = Number(b.dataset.price) || 0;
            const unlocked = price === 0 || (state.unlockedThemes || []).includes(b.dataset.theme);
            b.classList.toggle('locked', !unlocked);
            b.classList.toggle('active', b.dataset.theme === (state.theme || 'dark') && unlocked);
            b.textContent = settingLabel(b) + (unlocked ? '' : ' 🔒');
        });
        if (skinOptions) skinOptions.querySelectorAll('.setting-btn').forEach(b => {
            const price = Number(b.dataset.price) || 0;
            const key = b.dataset.skin;
            const unlocked = price === 0 || (state.unlockedSkins || []).includes(key);
            b.classList.toggle('locked', !unlocked);
            b.classList.toggle('active', key === (state.skin || 'gold') && unlocked);
            let label = settingLabel(b) + (unlocked ? '' : ' 🔒');
            // Показываем уровень прокачки купленного скина
            if (unlocked && key && key !== 'gold') {
                const lv = skinLevel(state, key);
                label += ` L${lv}`;
            }
            b.textContent = label;
        });
        if (themePriceHint) {
            const cur = state.theme || 'dark';
            const b = themeOptions ? themeOptions.querySelector(`.setting-btn[data-theme="${cur}"]`) : null;
            const p = Number(b && b.dataset.price) || 0;
            themePriceHint.textContent = p > 0 ? `· ${p} 🪙` : '';
        }
        if (skinPriceHint) {
            const cur = state.skin || 'gold';
            const b = skinOptions ? skinOptions.querySelector(`.setting-btn[data-skin="${cur}"]`) : null;
            const p = Number(b && b.dataset.price) || 0;
            skinPriceHint.textContent = p > 0 ? `· ${p} 🪙` : '';
        }
        // Подсветка активного музыкального трека (OST / Выкл)
        if (musicOptions) musicOptions.querySelectorAll('.music-btn').forEach(b => {
            b.classList.toggle('active', b.dataset.track === (state.musicTrack || 'ost'));
        });
        if (installBtn) {
            installBtn.hidden = !installBtn.dataset.available;
        }
    }

    // ── Жемчужины — валюта для скинов и тем ──────────────────
    function updateDoubloons() {
        if (doubloonsEl) doubloonsEl.textContent = (state.doubloons || 0).toLocaleString('ru');
    }

    function addDoubloons(n, text, icon = '🦪') {
        // Перк «Жемчужная жила» (+50%) применяется ко всем наградам
        const gained = applyCoinReward(state, n);
        if (gained <= 0) return;
        state.doubloons = (state.doubloons || 0) + gained;
        saveState(state);
        updateDoubloons();
        pushCloudSave();
        showToast(`+${gained} жемчужин${text ? ' — ' + text : ''}`, icon);
    }

    // ── Способности скинов (уникальные пассивки) ─────────────
    // Каждая активна только если соответствующий скин прокачан до 3-го уровня.
    // Реализованы через чистые функции shop.js; здесь — точки применения.

    /** Способность «Коралл» (L3): +1 жемчужина с каждой партии. */
    function woodAbilityBonus() {
        return hasSkinAbility(state, 'wood') ? 1 : 0;
    }

    /** Способность «Кристаллы» (L3): +2 жемчужины за победу над уровнем. */
    function gemAbilityWinBonus() {
        return hasSkinAbility(state, 'gem') ? 2 : 0;
    }

    /** Способность «Айсберг» (L3): +1 бесплатная отмена в день. */
    function iceAbilityUndoBonus() {
        return hasSkinAbility(state, 'ice') ? 1 : 0;
    }

    /** Способность «Вулкан» (L3): первая бомба в партии бесплатно. */
    function fireAbilityFreeBombUsed() {
        return hasSkinAbility(state, 'fire') ? 1 : 0;
    }

    /** Способность «Буря» (L3): +10 очков за каждый ход. */
    function stormAbilityMoveBonus() {
        return hasSkinAbility(state, 'storm') ? 10 : 0;
    }

    /** Способность «Жемчужина глубин» (L3): +1 жемчужина за слияние. */
    function pearlAbilityMergeBonus() {
        return hasSkinAbility(state, 'pearl') ? 1 : 0;
    }

    /** Способность «Кракен» (L3): 1 раз в партию — бомба бесплатно. */
    function krakenAbilityFreeBombPerGame() {
        return hasSkinAbility(state, 'kraken') ? 1 : 0;
    }

    // ── Облачные сохранения (VK / Yandex) ────────────────────
    function pushCloudSave() {
        if (!sdk.isPlatform()) return;
        clearTimeout(cloudSaveTimer);
        cloudSaveTimer = setTimeout(() => {
            sdk.saveCloud({ state, saves: loadSaves(), ts: Date.now() });
        }, 1500);
    }

    function mergeArr(a, b, fallback) {
        const set = new Set([...(a || []), ...(b || []), ...(fallback || [])]);
        return [...set];
    }


    function escapeHtml(str) {
        return String(str).replace(/[&<>"']/g, (c) => {
            if (c === '&') return '&' + 'amp;';
            if (c === '<') return '&' + 'lt;';
            if (c === '>') return '&' + 'gt;';
            if (c === '"') return '&' + 'quot;';
            return '&' + '#39;';
        });
    }

    // ── Ежедневные задания ───────────────────────────────────
    // Чистая логика (выдача, счётчики, прогресс) — в daily.js.
    function ensureDaily() {
        if (ensureDailyState(state)) saveState(state);
    }

    function checkDaily() {
        ensureDaily();
        checkDailyState(state);
        saveState(state);
        renderDaily();
    }

    function renderDaily() {
        if (!dailyList) return;
        ensureDaily();
        dailyList.innerHTML = '';
        const metrics = dailyMetricState(state);
        for (const t of state.daily.tasks) {
            const def = DAILY_TASKS.find(d => d.id === t.id);
            if (!def) continue;
            const val = Math.min(metrics[def.metric] || 0, def.goal);
            const pct = Math.round((val / def.goal) * 100);
            const el = document.createElement('div');
            el.className = 'daily-task' + (t.done ? ' done' : '');
            el.innerHTML = `
                <div class="daily-head">
                    <span class="daily-icon">${def.icon}</span>
                    <span class="daily-name">${def.name}</span>
                    <span class="daily-reward">+${def.reward} 🪙</span>
                </div>
                <div class="daily-desc">${def.desc}</div>
                <div class="daily-progress"><div class="daily-progress-fill" style="width:${pct}%"></div></div>
                <div class="daily-bottom">
                    <span class="daily-count">${val.toLocaleString('ru')} / ${def.goal.toLocaleString('ru')}</span>
                    ${t.done && !t.claimed
                        ? `<button class="btn btn-small daily-claim" data-daily-id="${t.id}">Забрать</button>`
                        : (t.claimed ? '<span class="daily-claimed">✓ Получено</span>' : '')}
                </div>
            `;
            dailyList.appendChild(el);
        }
        dailyList.querySelectorAll('.daily-claim').forEach(b => {
            b.addEventListener('click', () => claimDaily(b.dataset.dailyId));
        });
    }

    function claimDaily(id) {
        const t = state.daily.tasks.find(x => x.id === id);
        if (!t || !t.done || t.claimed) return;
        const def = DAILY_TASKS.find(d => d.id === id);
        t.claimed = true;
        saveState(state);
        addDoubloons(def ? def.reward : 0, 'ежедневное задание', '📅');
        renderDaily();
    }

    // ── Ежедневный вход (награда за визит) ───────────────────
    function renderDailyLogin() {
        if (!dailyLoginEl) return;
        const info = dailyLoginInfo(state);
        if (!info.canClaim) {
            dailyLoginEl.hidden = true;
            return;
        }
        dailyLoginEl.hidden = false;
        if (dlDays) dlDays.textContent = `День ${info.days + 1}`;
        if (dlWeek) {
            dlWeek.innerHTML = info.rewards.map((r, i) => {
                const filled = i < info.claimedInCycle;
                const next = i === info.currentIndex;
                return `<span class="dl-day${filled ? ' filled' : ''}${next ? ' next' : ''}">${i + 1}: ${r}</span>`;
            }).join('');
        }
        if (dlClaimBtn) {
            dlClaimBtn.disabled = false;
            dlClaimBtn.textContent = `Забрать +${info.nextReward} 🪙`;
        }
    }

    function claimDailyLoginReward() {
        const res = claimDailyLogin(state);
        if (!res.ok) return;
        // claimDailyLogin добавляет награду напрямую в state.doubloons,
        // поэтому перк «Жемчужная жила» (+50%) применяем вручную.
        const bonus = applyCoinReward(state, res.reward) - res.reward;
        if (bonus > 0) state.doubloons = (state.doubloons || 0) + bonus;
        saveState(state);
        updateDoubloons();
        pushCloudSave();
        renderDailyLogin();
        showToast(`+${res.reward + bonus} жемчужин (день ${res.days})`, '🎁');
    }

    // ── Рынок у рифа (магазин) ───────────────────────────────
    let shopCategory = 'boost';

    function updateShopBalance() {
        if (shopDoubloons) shopDoubloons.textContent = (state.doubloons || 0).toLocaleString('ru');
    }

    function renderShop() {
        if (!shopGrid) return;
        shopGrid.innerHTML = '';
        const items = itemsByType(shopCategory);
        for (const item of items) {
            const owned = ownsItem(state, item);
            const canBuy = (state.doubloons || 0) >= (item.price || 0);
            const el = document.createElement('div');
            el.className = 'shop-item' + (owned ? ' owned' : '');
            let badge = '';
            let desc = item.desc || '';
            let extra = '';
            if (item.type === 'boost') {
                badge = `В запасе: ${boostCount(state, item.key)}`;
            } else if (item.type === 'perk') {
                if (owned) badge = '✓ Куплен';
            } else if (item.type === 'skin' || item.type === 'theme') {
                const total = currentAppearanceBonus();
                const active = item.type === 'skin'
                    ? (state.skin || 'gold') === item.key
                    : (state.theme || 'dark') === item.key;
                if (item.type === 'skin' && owned) {
                    const lv = skinLevel(state, item.key);
                    desc = `+${skinBonusForLevel(item.bonus, lv)}% очков за слияния (L${lv})`;
                    badge = active ? '✓ Активен' : '✓ Открыт';
                    if (active && total > 0) badge += ` · всего +${total}%`;
                    if (item.ability) {
                        const on = hasSkinAbility(state, item.key);
                        extra = `<div class="shop-ability${on ? ' on' : ''}">${item.ability}</div>`;
                        if (lv < MAX_SKIN_LEVEL) {
                            const cost = SKIN_UPGRADE_COSTS[lv];
                            const afford = (state.doubloons || 0) >= cost;
                            extra += `<button class="btn btn-small shop-upgrade${afford ? '' : ' disabled'}" data-upgrade-key="${item.key}">→ L${lv + 1} · ${cost} 🦪</button>`;
                        } else {
                            extra += `<div class="shop-ability on">★ Макс. уровень</div>`;
                        }
                    }
                } else if (item.type === 'theme' && owned) {
                    badge = active ? `✓ Активен · +${item.bonus || 0}% очков${total > (item.bonus || 0) ? ` (всего +${total}%)` : ''}` : `✓ Открыт · +${item.bonus || 0}% очков`;
                }
            }
            el.innerHTML = `
                <div class="shop-icon">${item.icon}</div>
                <div class="shop-info">
                    <div class="shop-name">${item.name}</div>
                    <div class="shop-desc">${desc}</div>
                    ${badge ? `<div class="shop-base">${badge}</div>` : ''}
                    ${extra}
                </div>
                ${owned && item.type !== 'boost'
                    ? '<div class="shop-buy owned">✓</div>'
                    : `<button class="btn btn-small shop-buy${canBuy ? '' : ' disabled'}" data-shop-id="${item.id}">${item.price} 🦪</button>`}
            `;
            shopGrid.appendChild(el);
        }
        // Показываем наборы-синергии в лавке (внизу), чтобы игрок знал о бонусах
        if (shopCategory === 'skin' || shopCategory === 'theme') {
            const setsEl = document.createElement('div');
            setsEl.className = 'shop-sets';
            setsEl.innerHTML = '<div class="shop-sets-title">Наборы-синергии</div>';
            for (const s of SETS) {
                const ownedBoth = ownsSet(state, s);
                const isActive = activeSet(state) === s;
                const skinItem = itemByKey('skin', s.skin);
                const themeItem = itemByKey('theme', s.theme);
                setsEl.innerHTML += `
                    <div class="shop-set${isActive ? ' active' : ''}${ownedBoth ? ' owned' : ''}">
                        <span class="shop-set-icon">${s.icon}</span>
                        <span class="shop-set-name">${s.name}</span>
                        <span class="shop-set-parts">${skinItem.icon} ${skinItem.name} + ${themeItem.icon} ${themeItem.name}</span>
                        <span class="shop-set-bonus">+${s.bonus}%</span>
                    </div>`;
            }
            shopGrid.appendChild(setsEl);
        }
        shopGrid.querySelectorAll('.shop-buy[data-shop-id]').forEach(btn => {
            btn.addEventListener('click', () => buyFromShop(btn.dataset.shopId));
        });
        shopGrid.querySelectorAll('.shop-upgrade[data-upgrade-key]').forEach(btn => {
            btn.addEventListener('click', () => upgradeSkinFromShop(btn.dataset.upgradeKey));
        });
    }

    function upgradeSkinFromShop(key) {
        const res = upgradeSkin(state, key);
        if (!res.ok) {
            if (res.reason === 'not_owned') showToast('Сначала купи скин', '🛒');
            else if (res.reason === 'not_enough') {
                const lv = skinLevel(state, key);
                showToast(`Не хватает жемчужин — нужно ${SKIN_UPGRADE_COSTS[lv]}`, '🦪');
            } else if (res.reason === 'max') showToast('Скин уже максимального уровня', '⭐');
            return;
        }
        saveState(state);
        updateDoubloons();
        updateShopBalance();
        updateBoostBar();
        renderShop();
        showToast(`Скин прокачан до L${res.level}!`, '⬆️');
    }

    function buyFromShop(id) {
        const item = getShopItem(id);
        if (!item) return;
        const res = buyItem(state, item);
        if (!res.ok) {
            if (res.reason === 'not_enough') showToast(`Не хватает жемчужин — нужно ${item.price}`, '🦪');
            else if (res.reason === 'owned') showToast('Уже куплено', '✅');
            return;
        }
        saveState(state);
        updateDoubloons();
        updateShopBalance();
        updateBoostBar();
        updateSettingsUI();
        pushCloudSave();
        if (item.type === 'skin') { state.skin = item.key; applyAppearance(); updateSettingsUI(); }
        if (item.type === 'theme') { state.theme = item.key; applyAppearance(); updateSettingsUI(); }
        renderShop();
        showToast(`${item.name} — куплено!`, '🛍️');
    }

    function openShopModal() {
        shopCategory = 'boost';
        if (shopTabs) shopTabs.querySelectorAll('.shop-tab').forEach(b => b.classList.toggle('active', b.dataset.cat === 'boost'));
        updateShopBalance();
        renderShop();
        showModal(shopModal);
    }

    // ── Панель бустов ─────────────────────────────────────────
    function updateBoostBar() {
        const defs = [
            ['shuffle',   boostShuffleBtn,   boostShuffleCount],
            ['bomb',      boostBombBtn,      boostBombCount],
            ['x2',        boostX2Btn,        boostX2Count],
            ['lightning', boostLightningBtn, boostLightningCount],
        ];
        for (const [key, btn, cntEl] of defs) {
            const c = boostCount(state, key);
            if (cntEl) cntEl.textContent = c.toLocaleString('ru');
            if (!btn) continue;
            const disabled = c <= 0 || !game || game.gameOver || game.won || game._busy;
            btn.disabled = disabled;
            btn.classList.toggle('has-count', c > 0);
            btn.classList.toggle('active', key === 'x2' && !!game && game.getScoreMultiplierMoves() > 0);
        }
    }

    /**
     * Взрыв на доске в клетках удалённых плиток (буст «Бомба»/«Молния» и плитка 💣).
     * Создаёт вспышку + расходящееся кольцо + разлетающиеся осколки в каждой клетке.
     */
    function spawnBoardBoom(indices, kind = 'bomb') {
        if (!boardEl || !boardEl.isConnected) return;
        if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
        const cells = boardEl.querySelectorAll(':scope > .cell');
        const boardRect = boardEl.getBoundingClientRect();
        const palette = kind === 'lightning'
            ? { flash: 'rgba(180,230,255,.9)', ring: 'rgba(120,200,255,.85)', shard: 'rgba(160,220,255,.95)' }
            : { flash: 'rgba(255,210,120,.95)', ring: 'rgba(255,170,60,.9)', shard: 'rgba(255,200,90,.95)' };
        indices.forEach((idx, k) => {
            const cell = cells[idx];
            if (!cell) return;
            const cr = cell.getBoundingClientRect();
            const cx = cr.left - boardRect.left + cr.width / 2;
            const cy = cr.top - boardRect.top + cr.height / 2;
            // Вспышка
            const flash = document.createElement('div');
            flash.className = 'boom-flash';
            flash.style.left = (cx - cr.width * 0.9) + 'px';
            flash.style.top = (cy - cr.height * 0.9) + 'px';
            flash.style.width = (cr.width * 1.8) + 'px';
            flash.style.height = (cr.height * 1.8) + 'px';
            flash.style.background = `radial-gradient(circle, ${palette.flash}, rgba(0,0,0,0) 70%)`;
            boardEl.appendChild(flash);
            // Расходящееся кольцо
            const ring = document.createElement('div');
            ring.className = 'boom-ring';
            ring.style.left = (cx - cr.width * 0.5) + 'px';
            ring.style.top = (cy - cr.height * 0.5) + 'px';
            ring.style.width = cr.width + 'px';
            ring.style.height = cr.height + 'px';
            ring.style.borderColor = palette.ring;
            boardEl.appendChild(ring);
            // Осколки (8 штук, разлетаются в стороны)
            const shards = document.createElement('div');
            shards.className = 'boom-shards';
            shards.style.left = cx + 'px';
            shards.style.top = cy + 'px';
            for (let i = 0; i < 8; i++) {
                const sh = document.createElement('i');
                const ang = (i / 8) * Math.PI * 2 + (k * 0.4);
                sh.style.setProperty('--ang', ang + 'rad');
                sh.style.background = palette.shard;
                shards.appendChild(sh);
            }
            boardEl.appendChild(shards);
        });
        // Доска «вздрагивает» от взрыва
        boardEl.classList.remove('boom-shake');
        void boardEl.offsetWidth;
        boardEl.classList.add('boom-shake');
        setTimeout(() => boardEl.classList.remove('boom-shake'), 500);
        // Сильная вибрация на нативных платформах
        if (platform.isNative) hapticHeavy();
        // Убираем эффекты после анимации
        setTimeout(() => {
            boardEl.querySelectorAll('.boom-flash, .boom-ring, .boom-shards').forEach(el => el.remove());
        }, 900);
    }

    function useBoostFromBar(key) {
        if (!game || game.gameOver || game.won || game._busy) return;
        // Скины «Вулкан» и «Кракен» (L3): первая бомба в партии — бесплатно.
        const freeBomb = key === 'bomb' && !freeBombUsed &&
            (fireAbilityFreeBombUsed() > 0 || krakenAbilityFreeBombPerGame() > 0);
        if (!freeBomb && !useBoost(state, key)) {
            showToast('Буста нет — купи в лавке', '🛒');
            return;
        }
        let ok = false;
        let boomIndices = [];
        if (key === 'shuffle') {
            ok = game.shuffle() === true;
        } else if (key === 'bomb') {
            const det = game.removeLowestTileDetailed();
            ok = det !== null;
            if (det) boomIndices = [det.idx];
        } else if (key === 'lightning') {
            const det = game.removeLowestTilesDetailed(3);
            ok = det.length > 0;
            boomIndices = det.map(d => d.idx);
        } else if (key === 'x2') {
            game.activateScoreMultiplier(3, 3);
            ok = true;
        }
        if (!ok) {
            // Возвращаем буст, если применить не удалось
            if (!freeBomb) {
                state.inventory = state.inventory || {};
                state.inventory[key] = (state.inventory[key] || 0) + 1;
            }
            showToast('Сейчас нельзя использовать буст', '⚠️');
            updateBoostBar();
            return;
        }
        if (freeBomb) {
            freeBombUsed = true;
            showToast('Бомба от способности скина!', '💣');
        }
        saveState(state);
        updateBoostBar();
        updateDoubloons();
        pushCloudSave();
        const msgs = {
            shuffle:   'Плитки перемешаны!',
            bomb:      'Наименьшая плитка убрана!',
            lightning: 'Молния убрала 3 плитки!',
            x2:        'Тройные очки на 3 хода со слиянием!',
        };
        showToast(msgs[key], { shuffle: '🔄', bomb: '💣', lightning: '💫', x2: '⚡' }[key]);
        if (state.sound !== false) playMove();
        // Взрыв на доске для бомбы и молнии
        if (boomIndices.length) spawnBoardBoom(boomIndices, key);
    }

    // ── Сокровищница: сундук, обмен очков, донат ─────────────
    const CHEST_CONFIG = {
        price: 1500,
        legendaryChance: 0.06,
        legendaryGuaranteeStep: 0.02,
        tiers: [
            { tier: 'common',    kind: 'doubloons', amount: 600,  name: '600 жемчужин',        icon: '🦪' },
            { tier: 'common',    kind: 'boost',     key: 'shuffle', amount: 3, name: '3× Перемешать', icon: '🔄' },
            { tier: 'common',    kind: 'boost',     key: 'bomb',    amount: 2, name: '2× Бомба',       icon: '💣' },
            { tier: 'uncommon',  kind: 'doubloons', amount: 1200, name: '1200 жемчужин',       icon: '💰' },
            { tier: 'uncommon',  kind: 'boost',     key: 'x2',      amount: 2, name: '2× Тройные очки', icon: '⚡' },
            { tier: 'uncommon',  kind: 'perk',      key: 'bonusTile', name: 'Перк: Бонусная плитка', icon: '📦' },
            { tier: 'rare',      kind: 'perk',      key: 'fourChance', name: 'Перк: Дух четвёрки',   icon: '🎲' },
            { tier: 'rare',      kind: 'boost',     key: 'lightning', amount: 2, name: '2× Молния',    icon: '💫' },
            { tier: 'epic',      kind: 'theme',     key: 'sunset', name: 'Тема: Закат',             icon: '🌅' },
            { tier: 'epic',      kind: 'skin',      key: 'pearl',  name: 'Скин: Жемчужина глубин',  icon: '🐚' },
            { tier: 'legendary', kind: 'skin',      key: 'abyss',  name: 'Скин: Бездна',            icon: '🕳️' },
            { tier: 'legendary', kind: 'skin',      key: 'kraken', name: 'Скин: Кракен',            icon: '🐙' },
            { tier: 'legendary', kind: 'theme',     key: 'abyss',  name: 'Тема: Глубина',           icon: '🌌' },
        ],
    };

    function renderChest() {
        if (!chestCostEl) return;
        chestCostEl.textContent = CHEST_CONFIG.price.toLocaleString('ru');
        if (chestGuaranteeEl) {
            const g = state.chestGuaranteed || 0;
            const chance = Math.min(1, CHEST_CONFIG.legendaryChance + g * CHEST_CONFIG.legendaryGuaranteeStep);
            chestGuaranteeEl.textContent = `Легендарка: ${Math.round(chance * 100)}%`;
        }
        if (chestOpenedEl) chestOpenedEl.textContent = (state.chestOpened || 0).toLocaleString('ru');
        if (chestOpenBtn) chestOpenBtn.disabled = (state.doubloons || 0) < CHEST_CONFIG.price;
        if (exchangeScoreEl) exchangeScoreEl.textContent = (state.pointsBalance || 0).toLocaleString('ru');
        if (exchangeRateEl) exchangeRateEl.textContent = '500 очков = 1 жемчужина';
        if (exchangeUsedEl) {
            const limit = 3;
            const used = exchangeUsedToday(state, todayKey());
            exchangeUsedEl.textContent = `Сегодня: ${used} из ${limit}`;
        }
        // Обмен доступен, когда есть очки и не исчерпан дневной лимит
        if (exchangeBtn) exchangeBtn.disabled = usedTodayExceeded() || (state.pointsBalance || 0) < 500;
        renderDonate();
    }

    function usedTodayExceeded() {
        return exchangeUsedToday(state, todayKey()) >= 3;
    }

    function openChestModal() {
        renderChest();
        showModal(chestModal);
    }

    function handleOpenChest() {
        const res = openChest(state, { chest: CHEST_CONFIG });
        if (!res.ok) {
            showToast('Не хватает жемчужин для сундука', '🦪');
            return;
        }
        state.chestOpened = (state.chestOpened || 0) + 1;
        saveState(state);
        updateDoubloons();
        updateShopBalance();
        updateBoostBar();
        pushCloudSave();
        const label = res.reward.icon + ' ' + res.reward.name + (res.reward.amount ? ` ×${res.reward.amount}` : '');
        if (chestRewardEl) {
            chestRewardEl.textContent = res.legendary
                ? `✨ Легендарный сундук: ${label}!`
                : `Сундук: ${label}`;
            chestRewardEl.classList.add('show');
            setTimeout(() => chestRewardEl.classList.remove('show'), 4500);
        }
        if (res.legendary) spawnConfetti(90, true);
        renderChest();
        showToast(res.legendary ? `✨ Легендарка: ${res.reward.name}!` : `Сундук: ${res.reward.name}`, res.reward.icon || '🎁');
    }

    function handleExchange() {
        const rate = 500;
        const res = exchangePointsForDoubloons(state, 1, { rate, limit: 3, day: todayKey() });
        if (!res.ok) {
            if (res.reason === 'limit') showToast('Дневной лимит обмена исчерпан', '⏳');
            else showToast('Не хватает очков для обмена', '🏅');
            return;
        }
        saveState(state);
        updateDoubloons();
        renderChest();
        updateStats();
        pushCloudSave();
        showToast(`Обмен: −${res.spent} очков → +${res.gained} жемчужина`, '🔄');
    }

    // На VK цена показывается в голосах (VK), на остальных платформах — в рублях.
    function donatePriceLabel(pack) {
        if (sdk.host === 'vk') return `${pack.votes} 🎮`;
        return `${pack.priceRub} ₽`;
    }

    // Загружает каталог товаров VK (id из кабинета VK → Платежи) и сопоставляет
    // с локальными наборами DONATE_PACKS по названию/цене. Возвращает Map
    // pack.id → реальный id товара VK. Вне VK или при ошибке — пустой Map.
    async function loadVkCatalog() {
        if (sdk.host !== 'vk') return new Map();
        try {
            const items = await sdk.getDonateCatalog();
            const map = new Map();
            for (const it of items) {
                // Сопоставляем по названию товара (title) с локальным набором.
                const pack = DONATE_PACKS.find(p => p.name === it.title);
                if (pack) map.set(pack.id, it.id);
            }
            return map;
        } catch (_) {
            return new Map();
        }
    }

    function renderDonate() {
        if (!donateGrid) return;
        donateGrid.innerHTML = '';
        const canDonate = sdk.isPlatform();
        if (donateInfo) {
            donateInfo.textContent = canDonate
                ? (sdk.host === 'vk'
                    ? 'Покупка жемчужин за голоса VK (тестовый режим до публикации в каталоге)'
                    : 'Донат активируется после публикации на платформе')
                : 'Покупка жемчужин за деньги станет доступна на платформах VK / Яндекс';
        }
        for (const pack of DONATE_PACKS) {
            const el = document.createElement('div');
            el.className = 'donate-item';
            el.innerHTML = `
                <div class="donate-icon">${pack.icon}</div>
                <div class="donate-info2">
                    <div class="donate-name">${pack.name}</div>
                    <div class="donate-desc">${pack.pearls.toLocaleString('ru')} жемчужин</div>
                </div>
                <button class="btn btn-small shop-buy${canDonate ? '' : ' disabled'}" data-donate-id="${pack.id}">
                    ${donatePriceLabel(pack)}
                </button>
            `;
            el.querySelector('.shop-buy[data-donate-id]').addEventListener('click', async () => {
                if (!canDonate) {
                    showToast('Донат станет доступен на платформе', '💬');
                    return;
                }
                await handleDonate(pack);
            });
            donateGrid.appendChild(el);
        }
        // Асинхронно подгружаем каталог VK, чтобы к моменту клика id были известны.
        loadVkCatalog().then(map => { vkCatalog = map; });
    }

    // ── Донат: реальный платёж платформы ──────────────────────
    // VK: VKWebAppShowOrderBox (за голоса). После подтверждения списания
    // голосов зачисляем жемчужины. На вебе/Яндексе донат не работает.
    async function handleDonate(pack) {
        if (sdk.host !== 'vk') {
            showToast('Донат пока недоступен на этой платформе', '💬');
            return;
        }
        if (donateBusy) return;
        donateBusy = true;
        try {
            // Реальный id товара берём из каталога VK (кабинет VK → Платежи).
            // Если каталог ещё не загружен — подгружаем сейчас.
            if (!vkCatalog) vkCatalog = await loadVkCatalog();
            const itemId = vkCatalog.get(pack.id) || pack.id;
            const res = await sdk.buyDonate(itemId);
            if (res && res.ok) {
                state.doubloons = (state.doubloons || 0) + pack.pearls;
                saveState(state);
                updateDoubloons();
                renderChest();
                pushCloudSave();
                showToast(`+${pack.pearls.toLocaleString('ru')} жемчужин за голоса`, pack.icon);
            } else {
                showToast('Платёж не завершён', '⚠️');
            }
        } catch (_) {
            showToast('Ошибка платежа — попробуй ещё', '⚠️');
        } finally {
            donateBusy = false;
        }
    }

    // ── Уведомления (тосты) ──────────────────────────────────

    function showToast() {
        // Тосты отключены: плашки перекрывали доску. Обратная связь в игре —
        // на доске: всплывающий текст «Комбо ×N» (белый шрифт поверх плиток).
    }

    // ── Конфетти (победа / праздник) ─────────────────────────

    function spawnConfetti(count = 80, isBig = false) {
        if (!confettiEl || reduceMotion) return;
        confettiEl.innerHTML = '';
        const colors = ['#ffd700', '#ff6b6b', '#4ecdc4', '#ffe66d', '#ff9f43', '#54a0ff', '#f368e0', '#fffa65'];
        const frag = document.createDocumentFragment();
        for (let i = 0; i < count; i++) {
            const p = document.createElement('i');
            p.className = 'confetti-piece';
            p.style.left = (Math.random() * 100) + 'vw';
            p.style.background = colors[i % colors.length];
            p.style.animationDelay = (Math.random() * 0.9) + 's';
            p.style.animationDuration = (2.4 + Math.random() * 2) + 's';
            if (Math.random() < 0.5) p.style.borderRadius = '50%';
            if (isBig) {
                p.style.width  = (8 + Math.random() * 8) + 'px';
                p.style.height = (8 + Math.random() * 8) + 'px';
            }
            frag.appendChild(p);
        }
        confettiEl.appendChild(frag);
        setTimeout(() => { confettiEl.innerHTML = ''; }, 5500);
    }

    // ── Достижения ───────────────────────────────────────────

    function refreshAchievements() {
        if (!achievementsGrid) return;
        achievementsGrid.innerHTML = '';
        for (const a of ACHIEVEMENTS) {
            const unlocked = !!state.achievements[a.id];
            const el = document.createElement('div');
            el.className = 'achievement' + (unlocked ? ' unlocked' : '');
            el.innerHTML = `
                <span class="ach-icon">${unlocked ? a.icon : '🔒'}</span>
                <span class="ach-name">${a.name}</span>
                <span class="ach-desc">${a.desc}</span>
            `;
            achievementsGrid.appendChild(el);
        }
    }

    function checkAchievements() {
        const gs = game ? game.getStats() : null;
        const newly = evaluateAchievements(state, gs);
        if (!newly.length) return;
        saveState(state);
        for (const a of newly) showToast(`${a.name} — ${a.desc}`, a.icon);
        refreshAchievements();
        if (state.sound !== false) playWin();
    }

    // ── Экспорт / импорт сохранений ──────────────────────────

    function exportData() {
        const data = { app: 'ocean2048', version: 1, exported: Date.now(), state, saves: loadSaves() };
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'ocean2048-save.json';
        a.click();
        URL.revokeObjectURL(url);
        showToast('Прогресс сохранён в файл', '💾');
    }

    function importData(file) {
        const reader = new FileReader();
        reader.onload = () => {
            try {
                const data = JSON.parse(reader.result);
                if (!data || data.app !== 'ocean2048' || !data.state) throw new Error('bad file');
                state = { ...loadState(), ...data.state };
                saveState(state);
                if (data.saves) {
                    try { localStorage.setItem(SAVE_KEY, JSON.stringify(data.saves)); } catch (_) {}
                }
                applyAppearance();
                updateSettingsUI();
                renderDailyLogin();
                // Музыка: восстановить трек из импортированного сейва
                applyMusic();
                updateBoostBar();
                refreshAchievements();
                // Восстанавливаем и режим игры (Глубины / Классика)
                gameMode = state.mode === 'classic' ? 'classic' : 'depth';
                if (modeClassicBtn) modeClassicBtn.classList.toggle('active', gameMode === 'classic');
                if (modeDepthBtn) modeDepthBtn.classList.toggle('active', gameMode === 'depth');
                if (gameMode === 'classic') startClassic();
                else startLevel(resolveStartLevel());
                showToast('Прогресс загружен из файла', '📂');
            } catch (_) {
                showToast('Не удалось прочитать файл', '⚠️');
            }
        };
        reader.readAsText(file);
    }

    // ── Модальные окна ───────────────────────────────────────

    function showModal(el) {
        if (el) el.classList.add('visible');
        // П. 1.19.3: при открытии любого окна игровой процесс приостанавливается.
        markGameplayStop();
    }
    function hideModal(el) {
        if (el) el.classList.remove('visible');
        // П. 1.19.3: при закрытии окна, если партия продолжается, геймплей возобновляется.
        if (game && !game.gameOver && !game.won && !game.paused) markGameplayStart();
    }

    // ── Запуск уровня ────────────────────────────────────────

    function startLevel(levelId) {
        if (game) game.detachEventListeners();
        if (pauseOverlay) pauseOverlay.classList.remove('visible');

        runKind = 'depth'; // партия глубин: доска сохраняется в saves[levelId]
        setOstContext(runKind);
        state.currentLevel = levelId;
        lastScore = 0;
        beginRun(); // новая партия — сброс счётчика зачтённых очков обмена
        reviveCount = 0;
        reviveBusy = false;
        freeBombUsed = false;
        challengeActive = false; // обычный уровень — не «Челлендж»
        weeklyActive = false;    // и не «Еженедельный челлендж» 📅
        tournamentActive = false; // и не «Ежедневный турнир» 🏆
        duelActive = false;       // и не «Дуэль дня» ⚔️
        // Статистика партии для сюжетной миссии 🎯 — сбрасывается при запуске уровня
        missionStats = { maxTile: 0, merges: 0, moves: 0, score: 0, bestCombo: 0, bestStreak: 0 };
        saveState(state);
        updateHeader();
        renderMission();
        updateChallengeIndicator();

        const lv = currentLevelDef();

        game = new Game({
            boardElement:  boardEl,
            size:          lv.size,
            target:        lv.target,
            infinity:      state.infinity === true,
            tide:          tideConfigWithPerks(state.currentLevel),
            moves:         movesConfigForLevel(state.currentLevel),
            shark:         sharkConfigForLevel(state.currentLevel),
            abilities:     abilitiesConfigForLevel(state.currentLevel),
            events:        eventsConfigForLevel(state.currentLevel),
            ebbtide:       ebbtideConfigForLevel(state.currentLevel),
            // Ценность покупок: скин+тема дают +% очков, перк «Дух четвёрки» повышает шанс 4,
            // перк «Спокойные воды» отодвигает прилив на 1 ход.
            appearanceMultiplier: appearanceScoreMultiplier(state),
            fourChance:     ownsPerk(state, 'fourChance') ? 0.3 : 0.1,
            onScoreUpdate: (score) => {
                const prev = lastScore;
                lastScore = score;
                // Фаза 1: счёт-вверх (count-up)
                animateScore(prev, score);
                updateRunBest(score); // глобальные рекорды (задания/достижения)
                updateStats();
                // Сюжетная миссия 🎯: очки за партию для прогресса
                missionStats.score = Math.max(missionStats.score, score);
                renderMission();
                // Вибрация только при слиянии (рост очков) — iOS/Android
                if (platform.isNative && score > prev) hapticLight();
            },
            onMove:  () => {
                if (state.sound !== false) playMove();
                // Скин «Буря» (L3): +10 очков за каждый ход
                if (stormAbilityMoveBonus() > 0) game.addScore(stormAbilityMoveBonus());
                state.dailyCounters.moves = (state.dailyCounters.moves || 0) + 1;
                // Сюжетная миссия 🎯: ходы за партию
                missionStats.moves = (missionStats.moves || 0) + 1;
                updateTideIndicator();
                updateThreatIndicator();
                updateSharkIndicator();
                updateEbbtideIndicator();
                renderMission();
            },
            onTide:  (swept) => {
                // Прилив смыл нижние ряды: вспышка индикатора + уведомление о возврате очков
                flashTideSweep();
                gamePulse('tide');
                // Зрелищная волна прокатывается по доске сверху вниз (прилив).
                playEffect('tide', null, { dir: 'down' });
                const total = swept.reduce((acc, s) => acc + s.gain, 0);
                if (total > 0) showToast(`Прилив унёс плитки! +${total} очков`, '🌊');
                else if (swept.length > 0) showToast('Прилив очистил нижний ряд', '🌊');
            },
            onThreat: (swept) => {
                // «Водоворот» за серию бесполезных ходов: смыв без возврата очков
                flashThreatSweep();
                gamePulse('threat');
                // Воронка-водоворот затягивает плитки в центре доски.
                playEffect('whirlpool', null);
                const total = swept.reduce((acc, s) => acc + s.value, 0);
                if (total > 0) showToast(`Водоворот унёс плитки (−${total})`, '🌪️');
                else if (swept.length > 0) showToast('Водоворот очистил нижний ряд', '🌪️');
            },
            onSharkEat: (ev) => {
                // Акула появилась / шагнула / укусила: вспышка индикатора + уведомление
                flashShark();
                gamePulse('shark');
                if (typeof ev.idx === 'number' && typeof ev.value === 'number') {
                    showToast(`🦈 Акула съела плитку ${ev.value}!`, '🦈');
                } else if (typeof ev.spawn === 'number') {
                    showToast('🦈 Акула вышла на охоту!', '🦈');
                }
            },
            onAbility: (ev) => {
                // Плитка-способность ⚡ активирована: эффект + уведомление
                if (ev.kind === 'bomb') {
                    showToast(`💣 Взрыв! Убрано ${ev.cleared.length} плиток`, '💣');
                    if (ev.cleared && ev.cleared.length) {
                        spawnBoardBoom(ev.cleared.map(c => c.idx), 'bomb');
                    }
                } else if (ev.kind === 'jelly') {
                    showToast('🪼 Прилив заморожен на ход!', '🪼');
                } else if (ev.kind === 'crab') {
                    showToast(`🦀 Слияние в ${ev.value}!`, '🦀');
                }
            },
            onEvent: (ev) => {
                // Случайное событие 🎲 сработало: зрелищная визуализация + уведомление.
                gamePulse('event');
                // Логика уже применена в game.js — оверлей лишь «разыгрывает» её.
                if (ev.kind === 'storm') {
                    playEffect('storm', null);
                    showToast('🌪️ Шторм перемешал плитки!', '🌪️');
                } else if (ev.kind === 'jelly') {
                    playEffect('jelly', null, { count: ev.count });
                    showToast(`🪼 Медузий дождь: +${ev.count} плиток`, '🪼');
                } else if (ev.kind === 'bubble') {
                    playEffect('bubble', null);
                    showToast(`🫧 Пузырь: плитка ×${ev.value}!`, '🫧');
                }
            },
            onEbbtide: (info) => {
                // Смена фазы «Прилив и отлив» 🌊↔️: вспышка + уведомление.
                flashEbbtide();
                gamePulse('tide');
                // Волна: прилив (flow) идёт сверху вниз, отлив (ebb) — снизу вверх.
                playEffect('tide', null, { dir: info.phase === 'flow' ? 'down' : 'up' });
                if (info.phase === 'flow') {
                    showToast(`🌊 Прилив: все плитки ×2 (${info.changed})`, '🌊');
                } else {
                    showToast('⬇️ Отлив: плитки уменьшились вдвое', '⬇️');
                }
            },
            onMerge: (n) => {
                if (state.sound !== false) playMerge();
                // Скин «Жемчужина глубин» (L3): +1 жемчужина за слияние
                if (pearlAbilityMergeBonus() > 0) addDoubloons(pearlAbilityMergeBonus() * (n || 1), 'слияние (Жемчужина)');
                state.dailyCounters.merges = (state.dailyCounters.merges || 0) + (n || 1);
                // Серии и комбо: бонус за множественные слияния в ходе и ходы подряд
                const reward = comboReward({ merges: n, streak: game.streak });
                if (reward.score > 0) {
                    game.addScore(reward.score);
                    showToast(`Комбо ×${reward.mult}! +${reward.score} очков`, '⚡');
                }
                if (reward.doubloons > 0) {
                    addDoubloons(reward.doubloons, reward.mult > 1 ? `комбо ×${reward.mult}` : 'серия');
                }
                gamePulse('merge');
                // Сюжетная миссия 🎯: слияния, лучший комбо и лучшая серия за партию
                missionStats.merges = (missionStats.merges || 0) + (n || 1);
                missionStats.bestCombo = Math.max(missionStats.bestCombo, n || 0);
                missionStats.bestStreak = Math.max(missionStats.bestStreak, game.streak || 0);
                renderMission();
            },
            onSave:  () => { saveBoard(); saveState(state); updateUndoState(); updateMoves(); updateTideIndicator(); updateThreatIndicator(); updateSharkIndicator(); updateEbbtideIndicator(); updateBoostBar(); checkAchievements(); checkDaily(); pushCloudSave(); renderMission(); syncAtmosphereToGame(); },
            onTarget: (_score) => {
                // Бесконечный режим: цель достигнута — празднуем и продолжаем
                if (state.sound !== false) playWin();
                spawnConfetti(90, true);
            },
            onWin: (score) => {
                const isNewBest = !state.bestScores[state.currentLevel] || score > state.bestScores[state.currentLevel];
                state = applyLevelWin(state, score);
                // Жемчужины за победу
                addDoubloons(100, 'победа');
                // Способности скинов: «Кристаллы» (+2 за победу), «Коралл» (+1 за партию)
                if (gemAbilityWinBonus() > 0) addDoubloons(gemAbilityWinBonus(), 'победа (Кристаллы)');
                if (woodAbilityBonus() > 0) addDoubloons(woodAbilityBonus(), 'партия (Коралл)');
                if (isNewBest) addDoubloons(200, 'новый рекорд уровня', '🏆');
                state.dailyCounters.wins = (state.dailyCounters.wins || 0) + 1;
                saveState(state);
                checkAchievements();
                checkDaily();
                pushCloudSave();
                if (sdk.isPlatform()) sdk.submitScore(score, state.currentLevel);
                // VK: запись очков идёт сервером (secure.addAppEvent, Фаза 4);
                // на клиенте после партии показываем системную таблицу с результатом.
                if (sdk.host === 'vk') sdk.showLeaderboard(score, state.currentLevel);
                if (state.sound !== false) playWin();
                gamePulse('win');
                const isLast = isLastLevel(state.currentLevel);
                spawnConfetti(isLast ? 140 : 80, true);
                showWinModal(score, isLast);
            },
            onGameOver: (score) => {
                const next = applyLevelGameOver(state, score);
                if (next !== state) {
                    state = next;
                    saveState(state);
                }
                checkAchievements();
                checkDaily();
                pushCloudSave();
                if (sdk.isPlatform()) sdk.submitScore(score, state.currentLevel);
                // VK: системная таблица после партии (смотри, кого обошёл / кто впереди).
                if (sdk.host === 'vk') sdk.showLeaderboard(score, state.currentLevel);
                if (state.sound !== false) playGameOver();
                gamePulse('gameover');
                showGameOverModal(score);
                // Реклама при проигрыше (interstitial) с кулдауном 4 минуты
                const now = Date.now();
                if (sdk.isPlatform() && now - (state.lastAdTime || 0) > 4 * 60 * 1000) {
                    state.lastAdTime = now;
                    saveState(state);
                    pendingInterstitial = setTimeout(() => { runWithAdPause(() => sdk.showInterstitial()); }, 1200);
                }
            },
        });

        const restored = restoreBoardIfAny();
        if (restored) {
            lastScore = game.score;
        } else {
            state.gamesPlayed = (state.gamesPlayed || 0) + 1;
            saveState(state);
            updateStats();
            // Перки «Бонусная плитка» / «Глубокий старт»: новая партия начинается с плиткой 4 или 8
            const startTile = startingBonusTile();
            if (startTile > 0) {
                game.addBonusTile(startTile);
                saveBoard();
            }
        }
        updateUndoState();
        updateMoves();
        updateTideIndicator();
        updateThreatIndicator();
        updateSharkIndicator();
        updateEbbtideIndicator();
        updateBoostBar();
        // П. 1.19.3: запуск уровня — начало игрового процесса.
        if (!loadingScreen || loadingScreen.classList.contains('hidden')) markGameplayStart();
        // Индикаторы выше могли изменить размер main → доска изменилась →
        // плитки позиционируются заново по актуальному clientWidth.
        fitBoard();
    }

    // ── Режим «Классика»: чистый 2048 без уровней, приливов и ходов ──
    // 4×4, цель 2048, бесконечный режим (после цели игра продолжается),
    // отдельный рекорд classicBest, сохранение — под ключ 'classic'.
    function startClassic() {
        if (game) game.detachEventListeners();
        if (pauseOverlay) pauseOverlay.classList.remove('visible');

        runKind = 'classic'; // классика: отдельный слот сохранения 'classic'
        setOstContext(runKind);
        lastScore = 0;
        beginRun(); // новая партия — сброс счётчика зачтённых очков обмена
        reviveCount = 0;
        reviveBusy = false;
        freeBombUsed = false;
        challengeActive = false;
        weeklyActive = false;
        tournamentActive = false;
        duelActive = false;
        missionStats = { maxTile: 0, merges: 0, moves: 0, score: 0, bestCombo: 0, bestStreak: 0 };
        saveState(state);
        updateHeader();
        renderMission();

        game = new Game({
            boardElement:  boardEl,
            size:          4,
            target:        2048,
            infinity:      true,
            tide:          null,      // без прилива 🌊
            moves:         null,      // без «ходов как ресурс» 🧮
            shark:         null,      // без акулы 🦈
            abilities:     null,      // без плиток-способностей ⚡
            events:        null,      // без случайных событий 🎲
            appearanceMultiplier: 1,  // без бонуса косметики за очки
            fourChance:    0.1,
            onScoreUpdate: (score) => {
                const prev = lastScore;
                lastScore = score;
                animateScore(prev, score);
                updateStats();
                renderMission();
                // Глобальные рекорды: классика — полноценный режим 2048, задания
                // «Собери плитку 256/512» и «5000 очков за партию» должны двигаться.
                updateRunBest(score);
                if (platform.isNative && score > prev) hapticLight();
            },
            onMove: () => {
                if (state.sound !== false) playMove();
                updateMoves();
                renderMission();
            },
            onMerge: (n) => {
                if (state.sound !== false) playMerge();
                gamePulse('merge');
                missionStats.merges = (missionStats.merges || 0) + (n || 1);
                missionStats.bestCombo = Math.max(missionStats.bestCombo, n || 0);
                missionStats.bestStreak = Math.max(missionStats.bestStreak, game.streak || 0);
                renderMission();
            },
            onSave: () => { saveClassicBoard(); saveState(state); updateUndoState(); updateMoves(); updateBoostBar(); checkAchievements(); checkDaily(); pushCloudSave(); renderMission(); syncAtmosphereToGame(); },
            onTarget: (_score) => {
                // Бесконечный режим: цель 2048 достигнута — празднуем и продолжаем
                if (state.sound !== false) playWin();
                gamePulse('win');
                spawnConfetti(90, true);
            },
            onWin: (_score) => {
                // В классике нет «следующего уровня» — празднуем и продолжаем играть
                if (state.sound !== false) playWin();
                gamePulse('win');
                spawnConfetti(90, true);
                showToast('Ты собрал 2048! Играй дальше', '🏆');
            },
            onGameOver: (score) => {
                // Отдельный рекорд классики
                if (score > (state.classicBest || 0)) {
                    state.classicBest = score;
                    saveState(state);
                }
                // Глобальные рекорды тоже растут в классике (задания/достижения)
                updateRunBest(score);
                checkAchievements();
                checkDaily();
                pushCloudSave();
                if (sdk.isPlatform()) sdk.submitScore(score, 0);
                if (state.sound !== false) playGameOver();
                gamePulse('gameover');
                showClassicGameOverModal(score);
            },
        });

        // Восстановление сохранённой классики (если была)
        const saved = loadSaves().classic;
        if (saved && saved.board && saved.board.tiles) {
            game.loadState(saved.board);
            lastScore = game.score;
        } else {
            state.gamesPlayed = (state.gamesPlayed || 0) + 1;
            saveState(state);
            updateStats();
        }
        updateUndoState();
        updateMoves();
        updateBoostBar();
        if (!loadingScreen || loadingScreen.classList.contains('hidden')) markGameplayStart();
        fitBoard();
    }

    function saveClassicBoard() {
        if (!game) return;
        const saves = loadSaves();
        saves.classic = { board: game.getState(), ts: Date.now() };
        try { localStorage.setItem(SAVE_KEY, JSON.stringify(saves)); } catch (_) {}
    }

    function clearClassicBoard() {
        const saves = loadSaves();
        delete saves.classic;
        try { localStorage.setItem(SAVE_KEY, JSON.stringify(saves)); } catch (_) {}
    }

    function showClassicGameOverModal(score) {
        // Очки партии → в баланс обмена (Сокровищница); повторные завершения не дублируются
        const pts = creditGamePointsForRun(score);
        if (pts > 0) showToast(`+${pts.toLocaleString('ru')} очков — можно обменять на жемчужины`, '🏅');
        modalIcon.textContent    = '💀';
        modalTitle.textContent   = 'Игра окончена';
        modalMessage.textContent = 'Нет доступных ходов. Попробуй ещё!';
        modalScore.textContent   = score.toLocaleString('ru');

        clearModalActions();
        addModalBtn('🔄 Попробовать снова', 'btn-primary', () => {
            hideModal(gameModal);
            clearClassicBoard();
            startClassic();
        });
        addModalBtn('📣 Поделиться', 'btn-ghost', () => shareResult(score));
        if (sdk.host === 'vk') {
            addModalBtn('🏆 Таблица', 'btn-ghost', () => sdk.showLeaderboard(score, 0));
        }
        // Киношная атака акулы перед показом модалки (часть B фичи «Акула»).
        playSharkGameOver(score, () => showModal(gameModal));
    }

    function resetCurrentGame() {
        if (!game) return;
        // Сбрасываем active-флаги: start* защищены guard'ами («уже идёт партия»),
        // а при перезапуске мы сознательно начинаем новую партию.
        challengeActive = false;
        weeklyActive = false;
        tournamentActive = false;
        duelActive = false;
        // «Заново» перезапускает ТЕКУЩИЙ режим. В спец-режимах (головоломка,
        // турнир, дуэль, челлендж, недельный) нельзя просто сделать game.init():
        // их стартовая доска детерминированная (общий сид дня) и задаётся через
        // start*, поэтому перезапускаем через ту же точку входа.
        switch (runKind) {
            case 'classic':
                clearClassicBoard();
                startClassic();
                return;
            case 'puzzle':
                startDailyPuzzle();
                return;
            case 'tournament':
                startTournament();
                return;
            case 'duel':
                startDuel();
                return;
            case 'challenge':
                startChallenge(state.currentLevel || 1);
                return;
            case 'weekly':
                startWeekly();
                return;
        }
        // Партия глубин (runKind === 'depth'): обычный сброс на том же уровне
        clearBoardSave(state.currentLevel);
        lastScore = 0;
        beginRun(); // перезапуск — новый счёт зачтённых очков партии
        reviveCount = 0;
        reviveBusy = false;
        freeBombUsed = false;
        // Новая партия на том же уровне — статистика сюжетной миссии сбрасывается
        missionStats = { maxTile: 0, merges: 0, moves: 0, score: 0, bestCombo: 0, bestStreak: 0 };
        game.init();
        renderMission();
        // Перк «Бонусная плитка»: новая партия начинается с плиткой 4
        if (ownsPerk(state, 'bonusTile')) {
            game.addBonusTile(4);
            saveBoard();
        }
        scoreEl.textContent = '0';
        state.gamesPlayed = (state.gamesPlayed || 0) + 1;
        saveState(state);
        updateStats();
        updateUndoState();
        updateMoves();
        updateTideIndicator();
        updateThreatIndicator();
        updateSharkIndicator();
        updateEbbtideIndicator();
        updateChallengeIndicator();
        updateBoostBar();
        checkAchievements();
        // П. 1.19.3: перезапуск партии — игровой процесс снова активен.
        markGameplayStart();
    }

    // ── Модальные окна: победа / конец игры ──────────────────

    function clearModalActions() { modalActions.innerHTML = ''; }

    function addModalBtn(text, cls, onClick) {
        const btn = document.createElement('button');
        btn.className = `btn ${cls}`;
        btn.textContent = text;
        btn.addEventListener('click', onClick);
        modalActions.appendChild(btn);
    }

    function showWinModal(score, isLast) {
        // Очки партии → в баланс обмена (Сокровищница); повторные завершения не дублируются
        const pts = creditGamePointsForRun(score);
        if (pts > 0) showToast(`+${pts.toLocaleString('ru')} очков — можно обменять на жемчужины`, '🏅');
        modalIcon.textContent    = isLast ? '👑' : '🎉';
        modalTitle.textContent   = isLast ? 'Ты — Хозяин Моря!' : 'Уровень пройден!';
        modalMessage.textContent = isLast
            ? 'Все 7 уровней позади. Ты — легенда океана!'
            : `Ты достиг ${currentLevelDef().target.toLocaleString('ru')}! Поздравляем!`;
        modalScore.textContent   = score.toLocaleString('ru');

        clearModalActions();

        if (runKind !== 'depth') {
            // Спец-режим (головоломка/челлендж/недельный): «Следующий уровень»
            // здесь недействителен — currentLevel может быть 0 (головоломка) или
            // levelId режима. Вместо этого возвращаем на карту уровней.
            addModalBtn('🗺️ Карта глубин', 'btn-primary', () => {
                hideModal(gameModal);
                openLevelModal();
            });
        } else if (!isLast) {
            addModalBtn('🐬 Следующий уровень', 'btn-primary', () => {
                hideModal(gameModal);
                startLevel(state.currentLevel + 1);
            });
        } else {
            addModalBtn('🔄 Играть сначала', 'btn-primary', () => {
                hideModal(gameModal);
                clearBoardSave(1);
                startLevel(1);
            });
        }

        if (runKind === 'depth' || runKind === 'classic') {
            // «Продолжить игру» имеет смысл только в бесконечных партиях
            // (глубины с infinity / классика). В спец-режимах (головоломка,
            // турнир, дуэль, челлендж, недельный) партия конечна — после
            // победы играть дальше нечего (лимит ходов/цель достигнута).
            addModalBtn('▶ Продолжить игру', 'btn-secondary', () => {
                hideModal(gameModal);
                game.won = false;
                // П. 1.19.3: партия продолжается — геймплей возобновляется.
                markGameplayStart();
            });
        }

        addModalBtn('🔄 Заново', 'btn-ghost', () => {
            hideModal(gameModal);
            resetCurrentGame();
        });

        addModalBtn('📣 Поделиться', 'btn-secondary', () => shareResult(score));

        // VK: кнопка системной таблицы результатов (друзья/все).
        if (sdk.host === 'vk') {
            addModalBtn('🏆 Таблица', 'btn-secondary', () => sdk.showLeaderboard(score, state.currentLevel));
        }

        // VK: пригласить друзей сыграть (retention-механика, Фаза 2).
        if (sdk.host === 'vk') {
            addModalBtn('👥 Пригласить друзей', 'btn-secondary', () => runSocial(() => sdk.showInvite('ocean2048_invite')));
        }

        showModal(gameModal);
    }

    function showGameOverModal(score) {
        // Очки партии → в баланс обмена (Сокровищница); повторные завершения не дублируются
        const pts = creditGamePointsForRun(score);
        if (pts > 0) showToast(`+${pts.toLocaleString('ru')} очков — можно обменять на жемчужины`, '🏅');
        modalIcon.textContent    = '💀';
        modalTitle.textContent   = 'Игра окончена';
        modalMessage.textContent = 'Нет доступных ходов. Попробуй ещё!';
        modalScore.textContent   = score.toLocaleString('ru');

        clearModalActions();

        // Награда: после game over на площадках — rewarded-ролик, дающий ОДИН шанс
        // продолжить партию с предыдущей позиции (game.undo()).
        if (canRevive({
            platform:   sdk.isPlatform(),
            canUndo:    !!(game && game.canUndo()),
            reviveCount,
            gameOver:   !!(game && game.gameOver),
            won:        !!(game && game.won),
        })) {
            addModalBtn('🎬 Шанс на спасение', 'btn-primary', async () => {
                if (reviveBusy) return;
                reviveBusy = true;
                // Отменяем отложенный interstitial, чтобы не было двух роликов подряд
                clearTimeout(pendingInterstitial);
                const ok = await runWithAdPause(() => sdk.showRewarded());
                if (!ok) {
                    reviveBusy = false;
                    showToast('Реклама не показана — попробуй ещё', '⚠️');
                    return;
                }
                reviveCount += 1;
                hideModal(gameModal);
                if (game.undo()) {
                    updateUndoState();
                    updateMoves();
                    // П. 1.19.3: после спасения партия продолжается — геймплей активен.
                    markGameplayStart();
                    showToast('Шанс использован — продолжаем плавание!', '🎬');
                } else {
                    // Крайний случай: история опустела — начинаем партию заново
                    resetCurrentGame();
                }
                reviveBusy = false;
            });
        }

        addModalBtn('🔄 Попробовать снова', 'btn-primary', () => {
            hideModal(gameModal);
            resetCurrentGame();
        });

        addModalBtn('📜 Выбор уровня', 'btn-secondary', () => {
            hideModal(gameModal);
            openLevelModal();
        });

        addModalBtn('📣 Поделиться', 'btn-ghost', () => shareResult(score));

        // VK: кнопка системной таблицы результатов (друзья/все).
        if (sdk.host === 'vk') {
            addModalBtn('🏆 Таблица', 'btn-ghost', () => sdk.showLeaderboard(score, state.currentLevel));
        }

        // VK: пригласить друзей сыграть (retention-механика, Фаза 2).
        if (sdk.host === 'vk') {
            addModalBtn('👥 Пригласить друзей', 'btn-ghost', () => runSocial(() => sdk.showInvite('ocean2048_invite')));
        }

        // Киношная атака акулы перед показом модалки (часть B фичи «Акула»).
        playSharkGameOver(score, () => showModal(gameModal));
    }

    // ── Выбор уровня ─────────────────────────────────────────

    // ── Карта глубин 🗺️ (визуальный выбор уровня вместо списка) ──
    function renderDepthsMap() {
        if (!depthsNodesEl) return;

        // Бейдж «есть награды за глубины»
        const pending = pendingDepthRewards(state);
        if (depthsBadgeEl) {
            depthsBadgeEl.hidden = pending === 0;
            depthsBadgeEl.textContent = `🎁 +${pending} награды`;
        }

        depthsNodesEl.innerHTML = '';
        DEPTH_NODES.forEach((node) => {
            const lv = levelById(node.id);
            const status = depthStatus(state, node.id);
            const unlocked = status !== 'locked';

            const el = document.createElement('div');
            el.className = ['dm-node', status].filter(Boolean).join(' ');
            el.style.left = node.x + '%';
            el.style.top  = node.y + '%';
            el.title = `${lv.name} · ${lv.size}×${lv.size} → ${lv.target.toLocaleString('ru')}`;

            const reward = canClaimDepthReward(state, node.id)
                ? `<button class="dm-reward" type="button">🎁 ${depthRewardFor(node.id)}</button>`
                : '';
            const best = state.bestScores[node.id]
                ? `<span class="dm-best">🏆 ${state.bestScores[node.id].toLocaleString('ru')}</span>`
                : '';

            el.innerHTML = `
                <div class="dm-dot">${status === 'locked' ? '🔒' : lv.rank}</div>
                <div class="dm-label">${lv.name}</div>
                ${best}
                ${reward}
            `;

            if (unlocked) {
                el.addEventListener('click', () => {
                    hideModal(levelModal);
                    startLevel(node.id);
                });
            }

            // Забрать награду за глубину (клик по кнопке не запускает уровень)
            const claimBtn = el.querySelector('.dm-reward');
            if (claimBtn) {
                claimBtn.addEventListener('click', (ev) => {
                    ev.stopPropagation();
                    const got = claimDepthReward(state, node.id);
                    saveState(state);
                    updateDoubloons();
                    if (got > 0) showToast(`+${got} жемчужин за глубину!`, '🎁');
                    renderDepthsMap();
                });
            }

            depthsNodesEl.appendChild(el);
        });
    }

    function buildLevelsGrid() {
        levelsGrid.innerHTML = '';

        LEVELS.forEach(lv => {
            const unlocked  = isLevelUnlocked(state, lv.id);
            const best      = state.bestScores[lv.id];
            const completed = best !== undefined;
            const isCurrent = lv.id === state.currentLevel;

            const card = document.createElement('div');
            card.className = [
                'level-card',
                unlocked  ? 'unlocked'  : 'locked',
                isCurrent ? 'current'   : '',
                completed ? 'completed' : '',
            ].filter(Boolean).join(' ');

            card.innerHTML = `
                <div class="lc-header">
                    <span class="lc-num">${unlocked ? lv.id : '🔒'}</span>
                    ${completed ? '<span class="lc-check">✓</span>' : ''}
                </div>
                <div class="lc-rank">${lv.rank}</div>
                <div class="lc-name">${lv.name}</div>
                <div class="lc-grid">${lv.size}×${lv.size}</div>
                <div class="lc-target">→ ${lv.target.toLocaleString('ru')}</div>
                ${best ? `<div class="lc-best">🏆 ${best.toLocaleString('ru')}</div>` : ''}
            `;

            if (unlocked) {
                card.addEventListener('click', () => {
                    hideModal(levelModal);
                    startLevel(lv.id);
                });
            }

            levelsGrid.appendChild(card);
        });
    }

    function openLevelModal() {
        buildLevelsGrid();
        renderDepthsMap();
        renderDailyPuzzle();
        renderTournament();
        renderDuel();
        renderChallenge();
        renderWeekly();
        showModal(levelModal);
    }

    // ── Ежедневная головоломка 🧩 (Wordle-механика: одна доска на всех в день) ──
    function renderDailyPuzzle() {
        if (!dpEl) return;
        const info = puzzleInfo(state);
        if (dpDate)   dpDate.textContent = info.date;
        if (dpTarget) dpTarget.textContent = info.target.toLocaleString('ru');
        if (dpBest)   dpBest.textContent = (info.best || 0).toLocaleString('ru');
        if (dpDone)   dpDone.hidden = !info.completed;
        if (dpDesc)   dpDesc.textContent = info.completed
            ? 'Головоломка сегодня пройдена. Новая доска завтра!'
            : `Собери плитку ${info.target.toLocaleString('ru')}. Одна и та же доска у всех игроков сегодня — сравни результат с друзьями!`;
        if (dpPlay) {
            dpPlay.disabled = false;
            dpPlay.textContent = info.completed ? '🌊 Сыграть снова' : '🌊 Играть';
        }
    }

    /** Запустить ежедневную головоломку с детерминированной доской (общий сид). */
    function startDailyPuzzle() {
        if (game) game.detachEventListeners();
        if (pauseOverlay) pauseOverlay.classList.remove('visible');
        hideModal(levelModal);

        ensureDailyPuzzle(state);
        saveState(state);

        const info = puzzleInfo(state);
        runKind = 'puzzle'; // доска дня детерминированная — НЕ сохраняем в saves
        setOstContext(runKind);
        state.currentLevel = 0; // маркер «ежедневная головоломка» (не уровень)
        lastScore = 0;
        beginRun(); // новая партия — сброс счётчика зачтённых очков обмена
        reviveCount = 0;
        reviveBusy = false;
        freeBombUsed = false;
        challengeActive = false; // головоломка — не «Челлендж»
        weeklyActive = false;    // и не «Еженедельный челлендж» 📅
        tournamentActive = false; // и не «Ежедневный турнир» 🏆
        duelActive = false;       // и не «Дуэль дня» ⚔️
        saveState(state);
        updateHeader();
        // В ежедневной головоломке сюжетной миссии нет — скрываем прогресс-бар
        renderMission();
        updateChallengeIndicator();

        // Детерминированная стартовая доска дня (одна у всех игроков)
        const startTiles = puzzleStartBoard();
        game = new Game({
            boardElement:  boardEl,
            size:          info.size,
            target:        info.target,
            infinity:      false,
            tide:          null, // в головоломке — чистый 2048, без прилива
            moves:         null,
            shark:         null, // и без акулы
            abilities:     null, // и без плиток-способностей
            events:        null, // и без случайных событий 🎲
            appearanceMultiplier: 1,
            fourChance:    0.1,
            // Общий сид: все последующие плитки выпадают детерминированно.
            random:        makeRng(seedFromDate()),
            onScoreUpdate: (score) => {
                const prev = lastScore;
                lastScore = score;
                animateScore(prev, score);
                updateStats();
                updateRunBest(score); // 512 в головоломке — тоже глобальная плитка
                if (platform.isNative && score > prev) hapticLight();
            },
            onMove:  () => {
                if (state.sound !== false) playMove();
                if (stormAbilityMoveBonus() > 0) game.addScore(stormAbilityMoveBonus());
                state.dailyCounters.moves = (state.dailyCounters.moves || 0) + 1;
            },
            onTide:  null,
            onThreat: null,
            onSharkEat: null,
            onAbility: null,
            onEvent: null,
            onMerge: (n) => {
                if (state.sound !== false) playMerge();
                gamePulse('merge');
                if (pearlAbilityMergeBonus() > 0) addDoubloons(pearlAbilityMergeBonus() * (n || 1), 'слияние (Жемчужина)');
                state.dailyCounters.merges = (state.dailyCounters.merges || 0) + (n || 1);
                const reward = comboReward({ merges: n, streak: game.streak });
                if (reward.score > 0) {
                    game.addScore(reward.score);
                    showToast(`Комбо ×${reward.mult}! +${reward.score} очков`, '⚡');
                }
                if (reward.doubloons > 0) {
                    addDoubloons(reward.doubloons, reward.mult > 1 ? `комбо ×${reward.mult}` : 'серия');
                }
            },
            onSave:  () => { saveBoard(); saveState(state); updateUndoState(); updateMoves(); syncAtmosphereToGame(); },
            onTarget: () => {},
            onWin: (score) => {
                // Награда — ОДИН раз за прохождение дня, а не за каждый новый
                // рекорд: доска дня детерминированная, иначе реплеи фармили бы +150 🦪.
                const wasCompleted = puzzleInfo(state).completed;
                recordPuzzleResult(state, { score, maxTile: game.getMaxTile() });
                const completed = puzzleInfo(state).completed;
                if (completed && !wasCompleted) {
                    addDoubloons(info.reward, 'ежедневная головоломка', '🧩');
                    state.dailyCounters.wins = (state.dailyCounters.wins || 0) + 1;
                }
                saveState(state);
                checkAchievements();
                checkDaily();
                pushCloudSave();
                if (state.sound !== false) playWin();
                gamePulse('win');
                spawnConfetti(90, true);
                showWinModal(score, false);
                // Переопределим заголовок модалки под головоломку
                modalIcon.textContent  = completed ? '🧩' : '🎉';
                modalTitle.textContent = completed ? 'Головоломка пройдена!' : 'Плитка собрана!';
                modalMessage.textContent = completed
                    // Первое прохождение дня: награда ещё не получена
                    ? (wasCompleted
                        ? `Собери ${info.target.toLocaleString('ru')} — цель дня достигнута! Награда уже получена ранее.`
                        : `Собери ${info.target.toLocaleString('ru')} — цель дня достигнута! +${info.reward} жемчужин.`)
                    : `Ты собрал ${info.target.toLocaleString('ru')}! Приходи завтра за новой доской.`;
            },
            onGameOver: (score) => {
                recordPuzzleResult(state, { score, maxTile: game.getMaxTile() });
                updateRunBest(score); // финальный счёт тоже рекорд (если нет onScore)
                saveState(state);
                checkAchievements();
                checkDaily();
                pushCloudSave();
                if (state.sound !== false) playGameOver();
                gamePulse('gameover');
                showGameOverModal(score);
            },
        });

        // Устанавливаем детерминированную стартовую доску дня
        game.tiles = startTiles.map((t) => {
            if (!t) return null;
            return { id: game._nextTileId++, value: t.value, justSpawned: true };
        });
        game._updateGridCSS();
        game.render();

        state.gamesPlayed = (state.gamesPlayed || 0) + 1;
        saveState(state);
        updateStats();
        updateUndoState();
        updateMoves();
        updateTideIndicator();
        updateThreatIndicator();
        updateSharkIndicator();
        updateEbbtideIndicator();
        updateBoostBar();
        // П. 1.19.3: запуск головоломки — начало игрового процесса.
        if (!loadingScreen || loadingScreen.classList.contains('hidden')) markGameplayStart();
    }

    // ── Ежедневный турнир глубин 🏆 (онлайн) ────────────────
    /** Отобразить блок «Турнир глубин» на карте уровней: призы и статус дня. */
    function renderTournament() {
        if (!tournamentBlock) return;
        const info = tournamentInfo(state);
        if (tournamentDate)   tournamentDate.textContent = info.date;
        if (tournamentMoves)  tournamentMoves.textContent = String(info.moves);
        if (tournamentBest)   tournamentBest.textContent = (info.best || 0).toLocaleString('ru');
        if (tournamentDesc) {
            tournamentDesc.textContent = info.completedToday
                ? `Сыграно! Лучший результат дня: ${(info.best || 0).toLocaleString('ru')}. Новая доска — завтра.`
                : `Одна и та же доска у всех игроков сегодня. ${info.moves} ходов на максимум очков — результат уходит в рейтинг!`;
        }
        if (tournamentRewards) {
            tournamentRewards.innerHTML = info.rewards.map((r) => {
                const reached = (info.best || 0) >= r.threshold;
                const claimed = reached; // порог учтён, если результат его достиг
                return `<span class="tournament-reward${claimed ? ' claimed' : ''}">${r.threshold.toLocaleString('ru')}+ 🦪 ${r.reward}</span>`;
            }).join('');
        }
        if (tournamentPlay) {
            tournamentPlay.textContent = info.completedToday ? '🌊 Сыграть снова' : '🌊 Участвовать';
        }
    }

    /** Запустить турнирную партию: детерминированная доска дня, 50 ходов на максимум очков. */
    function startTournament() {
        if (tournamentActive) return; // турнирная партия уже идёт — не запускаем повторно
        if (game) game.detachEventListeners();
        if (pauseOverlay) pauseOverlay.classList.remove('visible');
        hideModal(levelModal);

        ensureTournament(state);
        saveState(state);

        const info = tournamentInfo(state);
        runKind = 'tournament'; // детерминированная доска дня — НЕ сохраняем
        setOstContext(runKind);
        state.currentLevel = 0; // маркер «турнир» (не уровень)
        lastScore = 0;
        beginRun(); // новая партия — сброс счётчика зачтённых очков обмена
        reviveCount = 0;
        reviveBusy = false;
        freeBombUsed = false;
        challengeActive = false;
        weeklyActive = false;
        tournamentActive = true;
        duelActive = false; // и не «Дуэль дня» ⚔️
        saveState(state);
        updateHeader();
        renderMission();
        updateChallengeIndicator();

        const startTiles = tournamentStartBoard();
        game = new Game({
            boardElement:  boardEl,
            size:          info.size,
            target:        info.target,
            infinity:      false,
            tide:          null, // в турнире — чистый 2048, без прилива
            moves:         null, // и без «водоворота» (честное соревнование)
            shark:         null, // без акулы
            abilities:     null, // и без плиток-способностей
            events:        null, // и без случайных событий 🎲
            appearanceMultiplier: 1, // бонусы скина/темы НЕ влияют на рейтинг (честно)
            fourChance:    0.1,
            moveLimit:     TOURNAMENT_MOVES, // 50 ходов — фиксированная партия
            random:        makeRng(tournamentSeed()), // общий сид дня у всех игроков
            onScoreUpdate: (score) => {
                const prev = lastScore;
                lastScore = score;
                animateScore(prev, score);
                updateStats();
                updateRunBest(score);
                if (platform.isNative && score > prev) hapticLight();
            },
            onMove:  () => {
                if (state.sound !== false) playMove();
                state.dailyCounters.moves = (state.dailyCounters.moves || 0) + 1;
            },
            onTide:  null,
            onThreat: null,
            onSharkEat: null,
            onAbility: null,
            onEvent: null,
            onMerge: (n) => {
                if (state.sound !== false) playMerge();
                gamePulse('merge');
                state.dailyCounters.merges = (state.dailyCounters.merges || 0) + (n || 1);
                const reward = comboReward({ merges: n, streak: game.streak });
                if (reward.score > 0) {
                    game.addScore(reward.score);
                    showToast(`Комбо ×${reward.mult}! +${reward.score} очков`, '⚡');
                }
                if (reward.doubloons > 0) {
                    addDoubloons(reward.doubloons, reward.mult > 1 ? `комбо ×${reward.mult}` : 'серия');
                }
            },
            onSave:  () => { saveBoard(); saveState(state); updateUndoState(); updateMoves(); syncAtmosphereToGame(); },
            onTarget: () => {}, // цель 2048 недостижима за 50 ходов — формально
            onWin: (score) => {
                gamePulse('win');
                finishTournamentRun(score);
            },
            onGameOver: (score) => {
                gamePulse('gameover');
                finishTournamentRun(score);
            },
        });

        // Устанавливаем детерминированную стартовую доску дня
        game.tiles = startTiles.map((t) => {
            if (!t) return null;
            return { id: game._nextTileId++, value: t.value, justSpawned: true };
        });
        game._updateGridCSS();
        game.render();

        state.gamesPlayed = (state.gamesPlayed || 0) + 1;
        saveState(state);
        updateStats();
        updateUndoState();
        updateMoves();
        updateTideIndicator();
        updateThreatIndicator();
        updateSharkIndicator();
        updateEbbtideIndicator();
        updateBoostBar();
        // П. 1.19.3: запуск турнира — начало игрового процесса.
        if (!loadingScreen || loadingScreen.classList.contains('hidden')) markGameplayStart();
    }

    /** Завершить турнирную партию: записать результат, выдать пороговые награды, отправить в рейтинг. */
    async function finishTournamentRun(score) {
        tournamentActive = false;
        const res = recordTournamentResult(state, { score });
        saveState(state);
        // Пороговые награды — только те, что достигнуты этой партией
        for (const r of res.newRewards) {
            addDoubloons(r.reward, `турнир: ${r.threshold.toLocaleString('ru')}+ очков`, '🏆');
        }
        // Результат дня уходит в платформенный лидерборд (Яндекс setScore / VK системная таблица)
        if (sdk.isPlatform() && score > 0) {
            sdk.submitScore(score);
        }
        if (res.isNewBest) {
            showToast(`Турнир: новый рекорд дня — ${score.toLocaleString('ru')}!`, '🏆');
        }
        updateRunBest(score);
        checkAchievements();
        checkDaily();
        pushCloudSave();
        if (state.sound !== false) playGameOver();
        showGameOverModal(score);
    }

    // ── Дуэль дня ⚔️ (асинхронная, общий сид) ────────────────
    // Вирусная механика: вызови друга на ту же доску дня (50 ходов на максимум
    // очков). Счёт соперника приходит через vk_request_key, победитель определяется
    // сравнением очков локально — без серверного бэкенда.

    /** Отобразить блок «Дуэль дня» на карте уровней: статус, счёт соперника, награды. */
    function renderDuel() {
        if (!duelBlock) return;
        const info = duelInfo(state);
        if (duelDate) duelDate.textContent = info.date;
        if (duelMoves) duelMoves.textContent = String(info.moves);

        const bestText = (info.best || 0).toLocaleString('ru');
        if (duelBest) duelBest.textContent = bestText;

        // Строка со счётом соперника: входящий вызов / сыграно / тренировка
        if (duelOpp) {
            if (info.pendingScore > 0) {
                duelOpp.hidden = false;
                duelOpp.textContent = `⚔️ Соперник: ${info.pendingScore.toLocaleString('ru')} — победи его!`;
            } else if (info.completedToday) {
                duelOpp.hidden = false;
                duelOpp.textContent = `Твой результат: ${bestText}. Победы сегодня: ${info.wins}`;
            } else {
                duelOpp.hidden = true;
            }
        }

        if (duelStats) {
            const winClaimed = info.claimedWin ? '✓' : `+${DUEL_WIN_REWARD}`;
            const loseClaimed = info.claimedLose ? '✓' : `+${DUEL_LOSE_REWARD}`;
            duelStats.innerHTML = `
                <span class="duel-stat">Победа: <strong>${winClaimed} 🦪</strong></span>
                <span class="duel-stat">Участие: <strong>${loseClaimed} 🦪</strong></span>
            `;
        }

        if (duelDesc) {
            duelDesc.textContent = info.completedToday
                ? `Сыграно! Лучший результат дня: ${bestText}. Новая доска — завтра.`
                : (info.pendingScore > 0
                    ? 'Друг бросил тебе вызов! Сыграй ту же доску и сравни очки. Победа — жемчужины!'
                    : 'Та же доска дня у всех. Вызови друга или прими вызов — победитель получает жемчужины!');
        }
        if (duelPlay) {
            duelPlay.textContent = info.completedToday ? '🌊 Сыграть снова' : '🌊 Играть';
        }
        if (duelChallengeBtn) {
            duelChallengeBtn.hidden = !info.completedToday; // вызов открыт после результата дня
        }
    }

    /** Запустить дуэльную партию: детерминированная доска дня, 50 ходов на максимум очков. */
    function startDuel() {
        if (duelActive) return; // дуэльная партия уже идёт — не запускаем повторно
        if (game) game.detachEventListeners();
        if (pauseOverlay) pauseOverlay.classList.remove('visible');
        hideModal(levelModal);

        ensureDuel(state);
        saveState(state);

        const info = duelInfo(state);
        // Счёт соперника фиксируем ДО очистки — он пригодится при подведении итога
        const opponentScore = info.pendingScore;
        clearDuelPending(state); // входящий вызов «съеден» — партия началась

        state.currentLevel = 0; // маркер «дуэль» (не уровень)
        lastScore = 0;
        beginRun(); // новая партия — сброс счётчика зачтённых очков обмена
        reviveCount = 0;
        runKind = 'duel'; // детерминированная доска дня — НЕ сохраняем
        setOstContext(runKind);
        reviveBusy = false;
        freeBombUsed = false;
        challengeActive = false;
        weeklyActive = false;
        tournamentActive = false;
        duelActive = true;
        saveState(state);
        updateHeader();
        renderMission();
        updateChallengeIndicator();

        const startTiles = duelStartBoard();
        game = new Game({
            boardElement:  boardEl,
            size:          info.size,
            target:        info.target,
            infinity:      false,
            tide:          null, // в дуэли — чистый 2048, без прилива
            moves:         null, // и без «водоворота» (честное соревнование)
            shark:         null, // без акулы
            abilities:     null, // и без плиток-способностей
            events:        null, // и без случайных событий 🎲
            appearanceMultiplier: 1, // бонусы скина/темы НЕ влияют на результат (честно)
            fourChance:    0.1,
            moveLimit:     DUEL_MOVES, // 50 ходов — фиксированная партия
            random:        makeRng(duelSeed()), // общий сид дня у всех игроков
            onScoreUpdate: (score) => {
                const prev = lastScore;
                lastScore = score;
                animateScore(prev, score);
                updateStats();
                updateRunBest(score);
                if (platform.isNative && score > prev) hapticLight();
            },
            onMove:  () => {
                if (state.sound !== false) playMove();
                state.dailyCounters.moves = (state.dailyCounters.moves || 0) + 1;
            },
            onTide:  null,
            onThreat: null,
            onSharkEat: null,
            onAbility: null,
            onEvent: null,
            onMerge: (n) => {
                if (state.sound !== false) playMerge();
                gamePulse('merge');
                state.dailyCounters.merges = (state.dailyCounters.merges || 0) + (n || 1);
                const reward = comboReward({ merges: n, streak: game.streak });
                if (reward.score > 0) {
                    game.addScore(reward.score);
                    showToast(`Комбо ×${reward.mult}! +${reward.score} очков`, '⚡');
                }
                if (reward.doubloons > 0) {
                    addDoubloons(reward.doubloons, reward.mult > 1 ? `комбо ×${reward.mult}` : 'серия');
                }
            },
            onSave:  () => { saveBoard(); saveState(state); updateUndoState(); updateMoves(); syncAtmosphereToGame(); },
            onTarget: () => {}, // цель 2048 недостижима за 50 ходов — формально
            onWin: (score) => {
                gamePulse('win');
                finishDuelRun(score, opponentScore);
            },
            onGameOver: (score) => {
                gamePulse('gameover');
                finishDuelRun(score, opponentScore);
            },
        });

        // Устанавливаем детерминированную стартовую доску дня
        game.tiles = startTiles.map((t) => {
            if (!t) return null;
            return { id: game._nextTileId++, value: t.value, justSpawned: true };
        });
        game._updateGridCSS();
        game.render();

        state.gamesPlayed = (state.gamesPlayed || 0) + 1;
        saveState(state);
        updateStats();
        updateUndoState();
        updateMoves();
        updateTideIndicator();
        updateThreatIndicator();
        updateSharkIndicator();
        updateEbbtideIndicator();
        updateBoostBar();
        // П. 1.19.3: запуск дуэли — начало игрового процесса.
        if (!loadingScreen || loadingScreen.classList.contains('hidden')) markGameplayStart();
    }

    /** Завершить дуэльную партию: определить победителя против счёта соперника, выдать награду. */
    async function finishDuelRun(score, opponentScore) {
        duelActive = false;
        const res = recordDuelResult(state, { score, opponentScore });
        saveState(state);
        if (res.reward > 0) {
            addDoubloons(res.reward, res.won ? 'победа в дуэли' : 'участие в дуэли', res.won ? '⚔️' : '🤝');
        }
        if (opponentScore > 0) {
            if (res.won) {
                showToast(`Дуэль: ты победил — ${score.toLocaleString('ru')} против ${opponentScore.toLocaleString('ru')}!`, '⚔️');
                if (res.reward > 0) spawnConfetti(60, true);
            } else if (res.draw) {
                showToast(`Дуэль: ничья — ${score.toLocaleString('ru')} против ${opponentScore.toLocaleString('ru')}`, '🤝');
            } else {
                showToast(`Дуэль: соперник сильнее — ${opponentScore.toLocaleString('ru')} против ${score.toLocaleString('ru')}`, '💪');
            }
        } else if (res.isNewBest) {
            showToast(`Новый рекорд дуэли — ${score.toLocaleString('ru')}!`, '⚔️');
        }
        updateRunBest(score);
        checkAchievements();
        checkDaily();
        pushCloudSave();
        if (state.sound !== false) playGameOver();
        showGameOverModal(score);
    }

    // ── Режим «Челлендж» ⏱️ (Фаза 3): «N ходов на цель» ─────

    /** Отобразить блок «Челлендж» на карте уровней: карточки + бейдж наград. */
    function renderChallenge() {
        if (!chGrid || !chBlock) return;

        // Бейдж «есть не забранные награды за челленджи»
        const pending = pendingChallengeRewards(state);
        if (chBadge) {
            chBadge.hidden = pending === 0;
            chBadge.textContent = pending > 0 ? `🎁 +${pending} награды` : '';
        }

        if (chDesc) {
            chDesc.textContent = CHALLENGES.length
                ? 'Собери целевую плитку за ограниченное число ходов. Награда — жемчужины за первое прохождение!'
                : '';
        }

        chGrid.innerHTML = '';
        CHALLENGES.forEach((ch) => {
            const info = challengeInfo(state, ch.levelId);
            if (!info) return;
            const lv = levelById(ch.levelId);
            const unlocked = isLevelUnlocked(state, ch.levelId);

            const card = document.createElement('div');
            card.className = ['ch-card', info.done ? 'done' : ''].filter(Boolean).join(' ');
            card.title = `${lv.name}: собери ${info.target.toLocaleString('ru')} за ${info.movesLimit} ходов`;

            const claim = info.done && !info.claimed
                ? `<button class="ch-claim" type="button">🎁 ${info.reward}</button>`
                : '';

            card.innerHTML = `
                <div class="ch-num">Ур. ${info.levelId} · ${lv.name}</div>
                <div class="ch-goal">Цель: <strong>${info.target.toLocaleString('ru')}</strong></div>
                <div class="ch-moves">Ходов: ${info.movesLimit}${info.bestMoves ? ` · рекорд ${info.bestMoves}` : ''}</div>
                <div class="ch-reward">${info.done ? (info.claimed ? '✓ Получено' : `🎁 +${info.reward} жемчужин`) : `Награда: +${info.reward}`}</div>
                ${claim}
            `;

            // Клик по карточке (не по кнопке «Забрать») запускает челлендж
            if (unlocked) {
                card.addEventListener('click', () => {
                    hideModal(levelModal);
                    startChallenge(ch.levelId);
                });
            }

            // Забрать награду
            const claimBtn = card.querySelector('.ch-claim');
            if (claimBtn) {
                claimBtn.addEventListener('click', (ev) => {
                    ev.stopPropagation();
                    const got = claimChallengeReward(state, ch.levelId);
                    saveState(state);
                    updateDoubloons();
                    if (got > 0) showToast(`+${got} жемчужин за челлендж!`, '⏱️');
                    renderChallenge();
                });
            }

            chGrid.appendChild(card);
        });
    }

    /** Запустить челлендж уровня: цель и лимит ходов, без прилива/акулы/способностей. */
    function startChallenge(levelId) {
        const challenge = challengeForLevel(levelId);
        if (!challenge) return;
        if (game) game.detachEventListeners();
        if (pauseOverlay) pauseOverlay.classList.remove('visible');
        hideModal(levelModal);

        const lv = levelById(challenge.levelId);
        ensureChallenges(state);
        runKind = 'challenge'; // лимит ходов и своя цель — НЕ сохраняем доску
        setOstContext(runKind);
        state.currentLevel = challenge.levelId; // челлендж использует уровень как контекст
        lastScore = 0;
        beginRun(); // новая партия — сброс счётчика зачтённых очков обмена
        reviveCount = 0;
        reviveBusy = false;
        freeBombUsed = false;
        challengeActive = true;
        weeklyActive = false;
        tournamentActive = false; // турнирная партия — не «Челлендж»
        duelActive = false;       // и не «Дуэль дня» ⚔️
        saveState(state);
        updateHeader();
        renderMission();
        updateChallengeIndicator();

        game = new Game({
            boardElement:  boardEl,
            size:          lv.size,
            target:        challenge.target,
            infinity:      false,
            tide:          null, // в челлендже — чистый 2048, без прилива
            moves:         null,
            shark:         null, // и без акулы
            abilities:     null, // и без плиток-способностей
            events:        null, // и без случайных событий 🎲
            moveLimit:     challenge.movesLimit, // ⏱️ «N ходов на цель»
            appearanceMultiplier: 1,
            fourChance:    0.1,
            onScoreUpdate: (score) => {
                const prev = lastScore;
                lastScore = score;
                animateScore(prev, score);
                updateStats();
                updateRunBest(score);
                if (platform.isNative && score > prev) hapticLight();
            },
            onMove:  () => {
                if (state.sound !== false) playMove();
                if (stormAbilityMoveBonus() > 0) game.addScore(stormAbilityMoveBonus());
                state.dailyCounters.moves = (state.dailyCounters.moves || 0) + 1;
                updateChallengeIndicator();
            },
            onTide:  null,
            onThreat: null,
            onSharkEat: null,
            onAbility: null,
            onEvent: null,
            onMerge: (n) => {
                if (state.sound !== false) playMerge();
                gamePulse('merge');
                if (pearlAbilityMergeBonus() > 0) addDoubloons(pearlAbilityMergeBonus() * (n || 1), 'слияние (Жемчужина)');
                state.dailyCounters.merges = (state.dailyCounters.merges || 0) + (n || 1);
                const reward = comboReward({ merges: n, streak: game.streak });
                if (reward.score > 0) {
                    game.addScore(reward.score);
                    showToast(`Комбо ×${reward.mult}! +${reward.score} очков`, '⚡');
                }
            },
            onSave:  () => { saveBoard(); saveState(state); updateUndoState(); updateMoves(); updateChallengeIndicator(); syncAtmosphereToGame(); },
            onTarget: () => {},
            onWin: (score) => {
                const res = recordChallengeResult(state, challenge.levelId, {
                    completed: true,
                    score,
                    movesUsed: game ? game.getMoves() : 0,
                });
                if (res.isNewDone) {
                    addDoubloons(challenge.reward, 'челлендж', '⏱️');
                    state.dailyCounters.wins = (state.dailyCounters.wins || 0) + 1;
                }
                saveState(state);
                checkAchievements();
                checkDaily();
                pushCloudSave();
                if (state.sound !== false) playWin();
                gamePulse('win');
                spawnConfetti(90, true);
                showWinModal(score, false);
                // Переопределим заголовок модалки под челлендж
                modalIcon.textContent  = '⏱️';
                modalTitle.textContent = 'Челлендж пройден!';
                modalMessage.textContent = res.isNewDone
                    ? `Собрал ${challenge.target.toLocaleString('ru')} за ${challenge.movesLimit} ходов! +${challenge.reward} жемчужин.`
                    : `Собрал ${challenge.target.toLocaleString('ru')} за ${challenge.movesLimit} ходов!`;
            },
            onGameOver: (score) => {
                recordChallengeResult(state, challenge.levelId, {
                    completed: false,
                    score,
                    movesUsed: game ? game.getMoves() : 0,
                });
                saveState(state);
                checkAchievements();
                checkDaily();
                pushCloudSave();
                if (state.sound !== false) playGameOver();
                gamePulse('gameover');
                showGameOverModal(score);
                // Переопределим текст: челлендж закончился из-за лимита ходов или тупика
                modalIcon.textContent  = '⏱️';
                modalTitle.textContent = 'Челлендж не пройден';
                modalMessage.textContent = game && game.getMoves() >= challenge.movesLimit
                    ? `Ходы закончились (${challenge.movesLimit}). Цель ${challenge.target.toLocaleString('ru')} не собрана. Попробуй ещё!`
                    : `Нет доступных ходов. До цели ${challenge.target.toLocaleString('ru')} не хватило. Попробуй ещё!`;
            },
        });

        state.gamesPlayed = (state.gamesPlayed || 0) + 1;
        saveState(state);
        updateStats();
        updateUndoState();
        updateMoves();
        updateTideIndicator();
        updateThreatIndicator();
        updateSharkIndicator();
        updateEbbtideIndicator();
        updateChallengeIndicator();
        updateBoostBar();
        // П. 1.19.3: запуск челленджа — начало игрового процесса.
        if (!loadingScreen || loadingScreen.classList.contains('hidden')) markGameplayStart();
    }

    // ── Еженедельный челлендж 📅 (раз в неделю, пн–вс) ───────

    /** Отобразить блок «Еженедельный челлендж» 📅 на карте уровней. */
    function renderWeekly() {
        if (!weeklyBlock || !weeklyCard) return;
        const info = weeklyInfo(state);
        if (!info) return;

        if (weeklyWeek) weeklyWeek.textContent = `неделя ${info.week}`;
        if (weeklyDesc) {
            weeklyDesc.textContent = info.done
                ? 'Недельный челлендж пройден! Новая задача — в понедельник.'
                : `Одна задача на неделю для всех игроков: собери ${info.target.toLocaleString('ru')} за ${info.movesLimit} ходов. Успей до воскресенья!`;
        }
        if (weeklyTarget) weeklyTarget.textContent = info.target.toLocaleString('ru');
        if (weeklyMoves) {
            weeklyMoves.textContent = `Ходов: ${info.movesLimit}${info.bestMoves ? ` · рекорд ${info.bestMoves}` : ''}`;
        }
        if (weeklyReward) {
            weeklyReward.textContent = info.done
                ? (info.claimed ? '✓ Награда получена' : `🎁 +${info.reward} жемчужин`)
                : `Награда: +${info.reward} жемчужин`;
        }
        if (weeklyPlay) {
            weeklyPlay.disabled = false;
            weeklyPlay.textContent = info.done ? '🌊 Сыграть снова' : '🌊 Играть';
        }
        weeklyCard.classList.toggle('done', info.done);
    }

    /** Запустить недельный челлендж 📅: одна задача недели, лимит ходов. */
    function startWeekly() {
        const info = weeklyInfo(state);
        if (!info) return;
        if (game) game.detachEventListeners();
        if (pauseOverlay) pauseOverlay.classList.remove('visible');
        hideModal(levelModal);

        const lv = levelById(info.levelId);
        ensureWeekly(state);
        runKind = 'weekly'; // лимит ходов и своя цель — НЕ сохраняем доску
        setOstContext(runKind);
        state.currentLevel = info.levelId; // недельный челлендж использует уровень как контекст
        lastScore = 0;
        beginRun(); // новая партия — сброс счётчика зачтённых очков обмена
        reviveCount = 0;
        reviveBusy = false;
        freeBombUsed = false;
        challengeActive = false; // недельный челлендж — не обычный «Челлендж» уровня
        weeklyActive = true;
        tournamentActive = false; // и не «Ежедневный турнир» 🏆
        duelActive = false;       // и не «Дуэль дня» ⚔️
        saveState(state);
        updateHeader();
        renderMission();
        updateChallengeIndicator();

        game = new Game({
            boardElement:  boardEl,
            size:          lv.size,
            target:        info.target,
            infinity:      false,
            tide:          null, // чистый 2048, без прилива
            moves:         null,
            shark:         null, // и без акулы
            abilities:     null, // и без плиток-способностей
            events:        null, // и без случайных событий 🎲
            moveLimit:     info.movesLimit, // 📅 «N ходов на цель»
            appearanceMultiplier: 1,
            fourChance:    0.1,
            onScoreUpdate: (score) => {
                const prev = lastScore;
                lastScore = score;
                animateScore(prev, score);
                updateStats();
                updateRunBest(score);
                if (platform.isNative && score > prev) hapticLight();
            },
            onMove:  () => {
                if (state.sound !== false) playMove();
                if (stormAbilityMoveBonus() > 0) game.addScore(stormAbilityMoveBonus());
                state.dailyCounters.moves = (state.dailyCounters.moves || 0) + 1;
                updateChallengeIndicator();
            },
            onTide:  null,
            onThreat: null,
            onSharkEat: null,
            onAbility: null,
            onEvent: null,
            onMerge: (n) => {
                if (state.sound !== false) playMerge();
                gamePulse('merge');
                if (pearlAbilityMergeBonus() > 0) addDoubloons(pearlAbilityMergeBonus() * (n || 1), 'слияние (Жемчужина)');
                state.dailyCounters.merges = (state.dailyCounters.merges || 0) + (n || 1);
                const reward = comboReward({ merges: n, streak: game.streak });
                if (reward.score > 0) {
                    game.addScore(reward.score);
                    showToast(`Комбо ×${reward.mult}! +${reward.score} очков`, '⚡');
                }
            },
            onSave:  () => { saveBoard(); saveState(state); updateUndoState(); updateMoves(); updateChallengeIndicator(); syncAtmosphereToGame(); },
            onTarget: () => {},
            onWin: (score) => {
                const res = recordWeeklyResult(state, {
                    completed: true,
                    score,
                    movesUsed: game ? game.getMoves() : 0,
                });
                let got = 0;
                if (res.isNewDone) {
                    got = claimWeeklyReward(state); // награда выдаётся один раз за неделю
                    state.dailyCounters.wins = (state.dailyCounters.wins || 0) + 1;
                    saveState(state);
                    updateDoubloons();
                    if (got > 0) showToast(`+${got} жемчужин — еженедельный челлендж!`, '📅');
                }
                saveState(state);
                checkAchievements();
                checkDaily();
                pushCloudSave();
                if (state.sound !== false) playWin();
                gamePulse('win');
                spawnConfetti(90, true);
                showWinModal(score, false);
                // Переопределим заголовок модалки под недельный челлендж
                modalIcon.textContent  = '📅';
                modalTitle.textContent = 'Еженедельный челлендж пройден!';
                modalMessage.textContent = res.isNewDone
                    ? `Собрал ${info.target.toLocaleString('ru')} за ${info.movesLimit} ходов! +${got} жемчужин.`
                    : `Собрал ${info.target.toLocaleString('ru')} за ${info.movesLimit} ходов!`;
            },
            onGameOver: (score) => {
                recordWeeklyResult(state, {
                    completed: false,
                    score,
                    movesUsed: game ? game.getMoves() : 0,
                });
                saveState(state);
                checkAchievements();
                checkDaily();
                pushCloudSave();
                if (state.sound !== false) playGameOver();
                gamePulse('gameover');
                showGameOverModal(score);
                // Переопределим текст: недельный челлендж закончился
                modalIcon.textContent  = '📅';
                modalTitle.textContent = 'Еженедельный челлендж не пройден';
                modalMessage.textContent = game && game.getMoves() >= info.movesLimit
                    ? `Ходы закончились (${info.movesLimit}). Цель ${info.target.toLocaleString('ru')} не собрана. Попробуй ещё!`
                    : `Нет доступных ходов. До цели ${info.target.toLocaleString('ru')} не хватило. Попробуй ещё!`;
            },
        });

        state.gamesPlayed = (state.gamesPlayed || 0) + 1;
        saveState(state);
        updateStats();
        updateUndoState();
        updateMoves();
        updateTideIndicator();
        updateThreatIndicator();
        updateSharkIndicator();
        updateEbbtideIndicator();
        updateChallengeIndicator();
        updateBoostBar();
        // П. 1.19.3: запуск недельного челленджа — начало игрового процесса.
        if (!loadingScreen || loadingScreen.classList.contains('hidden')) markGameplayStart();
    }

    // ── Настройки ────────────────────────────────────────────

    function openSettingsModal() {
        updateSettingsUI();
        refreshAchievements();
        updateDoubloons();
        renderDaily();
        showModal(settingsModal);
    }

    // ── Полный экран ─────────────────────────────────────────

    function toggleFullscreen() {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(() => {});
        } else {
            document.exitFullscreen().catch(() => {});
        }
    }

    document.addEventListener('fullscreenchange', () => {
        const fs = !!document.fullscreenElement;
        document.body.classList.toggle('is-fullscreen', fs);
        fullscreenBtn.textContent = fs ? '⊡' : '⛶';
        fullscreenBtn.title       = fs ? 'Выйти из полного экрана' : 'Полный экран';
    });

    // ── PWA: установка приложения ────────────────────────────

    let deferredPrompt = null;
    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredPrompt = e;
        if (installBtn) installBtn.dataset.available = '1';
        updateSettingsUI();
    });

    window.addEventListener('appinstalled', () => {
        deferredPrompt = null;
        if (installBtn) { delete installBtn.dataset.available; }
        updateSettingsUI();
        showToast('Приложение установлено!', '📲');
    });

    // ── Кнопки управления ────────────────────────────────────

    restartBtn.addEventListener('click', () => openRestartConfirm(false));

    levelSelectBtn.addEventListener('click', openLevelModal);
    fullscreenBtn.addEventListener('click',  toggleFullscreen);

    soundBtn.addEventListener('click', () => {
        state.sound = state.sound === false ? true : false;
        saveState(state);
        updateStats();
        updateSettingsUI();
        if (state.sound !== false) playMerge();
    });

    settingsBtn.addEventListener('click', openSettingsModal);
    closeSettingsBtn.addEventListener('click', () => hideModal(settingsModal));
    settingsModal.addEventListener('click', (e) => {
        if (e.target === settingsModal) hideModal(settingsModal);
    });

    // Тема
    themeOptions.addEventListener('click', (e) => {
        const btn = e.target.closest('.setting-btn');
        if (!btn || !btn.dataset.theme) return;
        const theme = btn.dataset.theme;
        const price = Number(btn.dataset.price) || 0;
        if (price > 0 && !(state.unlockedThemes || []).includes(theme)) {
            if ((state.doubloons || 0) < price) {
                showToast(`Не хватает жемчужин — нужно ${price}`, '🦪');
                return;
            }
            state.doubloons -= price;
            state.unlockedThemes = mergeArr(state.unlockedThemes, [theme], ['dark']);
            updateDoubloons();
            saveState(state);
            pushCloudSave();
            showToast('Тема куплена!', '🛍️');
        }
        state.theme = theme;
        saveState(state);
        applyAppearance();
        updateSettingsUI();
        // Осенние листья: показываем на теме «Осень» и в осенний сезон,
        // скрываем на остальных темах вне сезона.
        if (shouldShowAutumn(theme)) startAutumn();
        else stopAutumn();
        // Музыка при смене темы НЕ меняется: саундтрек один на всю игру
        // (OST не привязан к теме — это готовые треки, а не процедурные темы).
    });

    // ── Фоновая музыка: оригинальный саундтрек ─────────────────
    // Единственный трек — OST (js/ost.js): 2 MP3 Kevin MacLeod,
    // контекст main/versus выбирается по runKind через setOstContext.
    // (Процедурные «темы» удалены — см. git-историю js/music.js.)
    function applyMusic() {
        if (state.music === false) { stopMusic(); return; }
        playTrack('ost'); // любые легаси-ключи процедурных тем нормализуются в 'ost'
        // Сообщаем OST текущий игровой контекст (runKind), чтобы при старте
        // играл правильный трек (versus в турнире/дуэли).
        setOstContext(runKind);
    }
    if (musicOptions) musicOptions.addEventListener('click', (e) => {
        const btn = e.target.closest('.music-btn');
        if (!btn) return;
        const track = btn.dataset.track; // 'ost' | 'off'
        state.musicTrack = track;
        state.musicManual = track !== 'off';
        saveState(state);
        updateSettingsUI();
        // Первый жест пользователя — можно стартовать воспроизведение.
        if (track === 'off') { stopMusic(); showToast('Музыка выключена', '🔇'); }
        else { playTrack(track); setOstContext(runKind); showToast('Музыка: ' + (track === 'ost' ? 'Оригинальный саундтрек' : track), '🎵'); }
    });
    if (settingsMusic) settingsMusic.addEventListener('change', () => {
        state.music = settingsMusic.checked;
        saveState(state);
        updateSettingsUI();
        applyMusic();
        if (state.music) showToast('Музыка включена', '🎵');
        else showToast('Музыка выключена', '🔇');
    });

    // Скин плиток
    skinOptions.addEventListener('click', (e) => {
        const btn = e.target.closest('.setting-btn');
        if (!btn || !btn.dataset.skin) return;
        const skin = btn.dataset.skin;
        const price = Number(btn.dataset.price) || 0;
        if (price > 0 && !(state.unlockedSkins || []).includes(skin)) {
            if ((state.doubloons || 0) < price) {
                showToast(`Не хватает жемчужин — нужно ${price}`, '🦪');
                return;
            }
            state.doubloons -= price;
            state.unlockedSkins = mergeArr(state.unlockedSkins, [skin], ['gold']);
            updateDoubloons();
            saveState(state);
            pushCloudSave();
            showToast('Скин куплен!', '🛍️');
        }
        state.skin = skin;
        saveState(state);
        applyAppearance();
        updateSettingsUI();
        if (state.sound !== false) playMerge();
    });

    // Звук (в настройках)
    settingsSound.addEventListener('change', () => {
        state.sound = settingsSound.checked;
        saveState(state);
        updateStats();
        updateSettingsUI();
        if (state.sound !== false) playMerge();
    });

    // Бесконечный режим
    settingsInfinity.addEventListener('change', () => {
        state.infinity = settingsInfinity.checked;
        saveState(state);
        updateSettingsUI();
    });

    // Фаза 5: скорость анимаций (переключатель «быстрые анимации»)
    if (settingsAnimSpeed) {
        settingsAnimSpeed.addEventListener('click', () => {
            state.animSpeed = state.animSpeed === 'fast' ? 'normal' : 'fast';
            saveState(state);
            updateSettingsUI();
        });
    }

    // Фаза 5: крупный текст
    if (settingsLargeText) {
        settingsLargeText.addEventListener('change', () => {
            state.largeText = settingsLargeText.checked;
            saveState(state);
            updateSettingsUI();
        });
    }

    // Экспорт / импорт
    exportBtn.addEventListener('click', exportData);
    importBtn.addEventListener('click', () => importFile && importFile.click());
    importFile.addEventListener('change', () => {
        if (importFile.files && importFile.files[0]) importData(importFile.files[0]);
        importFile.value = '';
    });

    // Установка приложения
    installBtn.addEventListener('click', async () => {
        if (!deferredPrompt) return;
        deferredPrompt.prompt();
        await deferredPrompt.userChoice;
        deferredPrompt = null;
        if (installBtn) { delete installBtn.dataset.available; }
        updateSettingsUI();
    });

    // ── Дельфин-навигатор 🐬 (Фаза 7): стрелка оптимального хода + предупреждение ──
    const navArrow = $('nav-arrow');

    // Показывает стрелку направления оптимального хода поверх доски.
    function showNavArrow(direction) {
        if (!navArrow) return;
        if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
        navArrow.classList.remove('dir-up', 'dir-down', 'dir-left', 'dir-right', 'show');
        void navArrow.offsetWidth;
        navArrow.classList.add('dir-' + direction, 'show');
        clearTimeout(showNavArrow._t);
        showNavArrow._t = setTimeout(() => navArrow.classList.remove('show'), 1400);
    }

    // Всплывающее предупреждение навигатора над доской (по образцу combo-pop).
    function showNavWarning(text, type) {
        if (!boardEl || !boardEl.isConnected) return;
        if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
        let pop = boardEl.querySelector(':scope > .nav-warning');
        if (!pop) {
            pop = document.createElement('div');
            pop.className = 'nav-warning';
            boardEl.appendChild(pop);
        }
        pop.textContent = text;
        pop.classList.remove('warn', 'crit', 'pop');
        void pop.offsetWidth;
        if (type === 'critical') pop.classList.add('crit');
        else if (type === 'warning') pop.classList.add('warn');
        pop.classList.add('pop');
    }

    // Подсказка / Дельфин-навигатор
    hintBtn.addEventListener('click', async () => {
        if (!game || game.paused) return;
        // На площадках после 3 бесплатных подсказок — реклама за награду
        if (sdk.isPlatform() && (state.hintsUsed || 0) >= 3) {
            showToast('За подсказку — реклама', '🎬');
            const ok = await runWithAdPause(() => sdk.showRewarded());
            if (!ok) { showToast('Реклама не показана — попробуй ещё', '⚠️'); return; }
        }
        const h = game.navigate();
        if (!h) return;

        state.hintsUsed = (state.hintsUsed || 0) + 1;
        state.dailyCounters.hints = (state.dailyCounters.hints || 0) + 1;
        saveState(state);

        boardEl.querySelectorAll('.tile.hint-flash').forEach(el => el.classList.remove('hint-flash'));
        for (const idx of h.fromIndices) {
            const tile = game.tiles[idx];
            if (!tile) continue;
            const el = boardEl.querySelector(`.tile[data-id="${tile.id}"]`);
            if (el) el.classList.add('hint-flash');
        }
        setTimeout(() => {
            boardEl.querySelectorAll('.tile.hint-flash').forEach(el => el.classList.remove('hint-flash'));
        }, 1100);

        // Дельфин-навигатор: стрелка оптимального хода + предупреждение о тупике
        showNavArrow(h.direction);
        if (h.dangerLevel === 'critical') {
            showNavWarning('⚠️ Остался 1 ход до тупика!', 'critical');
        } else if (h.dangerLevel === 'warning') {
            showNavWarning('Осторожно: ходов осталось мало', 'warning');
        }

        checkAchievements();
        checkDaily();
        if (state.sound !== false) playMove();
    });

    undoBtn.addEventListener('click', async () => {
        if (!game) return;
        // На площадках отмена хода — за rewarded-рекламу
        if (sdk.isPlatform()) {
            showToast('За отмену хода — реклама', '🎬');
            const ok = await runWithAdPause(() => sdk.showRewarded());
            if (!ok) { showToast('Реклама не показана', '⚠️'); return; }
        } else {
            // Веб: N бесплатных отмен в день, дальше — дублоны
            // (защита от «прочитывания» партии бесконечными отменами)
            ensureDaily();
            const used = state.dailyCounters.undos || 0;
            // Скин «Айсберг» (L3): +1 бесплатная отмена в день
            const undoLimit = effectiveUndoLimit(state, WEB_UNDO_LIMIT) + iceAbilityUndoBonus();
            if (used >= undoLimit) {
                if ((state.doubloons || 0) < UNDO_COST) {
                    showToast(`Лимит бесплатных отмен: ${undoLimit}/день. Дальше — ${UNDO_COST} 🪙`, '⚠️');
                    return;
                }
                state.doubloons -= UNDO_COST;
                updateDoubloons();
                showToast(`Отмена за ${UNDO_COST} 🪙`, '🪙');
            } else {
                state.dailyCounters.undos = used + 1;
            }
        }
        if (game.undo()) {
            state.undoCount = (state.undoCount || 0) + 1;
            saveState(state);
            checkAchievements();
        }
        updateUndoState();
        updateMoves();
    });

    closeLevelBtn.addEventListener('click', () => hideModal(levelModal));
    levelModal.addEventListener('click', (e) => {
        if (e.target === levelModal) hideModal(levelModal);
    });
    // Ежедневная головоломка 🧩 — кнопка в карте уровней
    if (dpPlay) dpPlay.addEventListener('click', startDailyPuzzle);

    // Ежедневный турнир глубин 🏆 — кнопка в карте уровней
    if (tournamentPlay) tournamentPlay.addEventListener('click', startTournament);

    // Дуэль дня ⚔️ — кнопка «Играть» (партия) и «Вызвать друга» (отправка вызова)
    if (duelPlay) duelPlay.addEventListener('click', startDuel);
    if (duelChallengeBtn) duelChallengeBtn.addEventListener('click', () => runSocial(async () => {
        const info = duelInfo(state);
        if (!info.completedToday || (info.best || 0) <= 0) {
            showToast('Сначала сыграй дуэль дня', '⚔️');
            return;
        }
        // Вызов на дуэль: requestKey содержит дату и счёт — получателю он придёт
        // как vk_request_key, и он сможет сыграть ту же доску и сравнить очки.
        const key = buildDuelRequestKey(info.best);
        const msg = `⚔️ Я набрал ${(info.best || 0).toLocaleString('ru')} в «Океан 2048» на доске дуэли. Сможешь побить? Та же доска, 50 ходов!`;
        const ok = await sdk.showRequest(undefined, msg, key);
        showToast(ok ? 'Вызов на дуэль отправлен!' : 'Не удалось отправить вызов', ok ? '⚔️' : '⚠️');
    }));

    // Еженедельный челлендж 📅 — кнопка в карте уровней
    if (weeklyPlay) weeklyPlay.addEventListener('click', startWeekly);

    gameModal.addEventListener('click', (e) => {
        if (e.target === gameModal) hideModal(gameModal);
    });

    // ── Лидерборды ───────────────────────────────────────────
    async function openLeaderboard() {
        if (!leaderboardModal || !leaderboardList) return;
        // VK: клиентского чтения таблицы нет — открываем системную таблицу
        // (друзья/все) через VKWebAppShowLeaderBoardBox с текущим результатом.
        // Если таблица не открылась (например, ещё нет записи secure.addAppEvent) —
        // показываем локальную таблицу как фолбэк.
        if (sdk.host === 'vk') {
            const ok = await sdk.showLeaderboard(state.bestTotal || 0, state.currentLevel);
            if (ok) return;
            showToast('Системная таблица недоступна — показываем локальный рейтинг', '🏆');
        }
        showModal(leaderboardModal);
        leaderboardList.innerHTML = '<div class="lb-loading">⏳ Загружаем рейтинг…</div>';
        let rows = [];
        if (sdk.isPlatform()) rows = await sdk.getLeaderboard();
        if (!rows.length) {
            // Фолбэк для веба: локальный рекорд + рекорды уровней
            const best = state.bestTotal || 0;
            if (best > 0) rows.push({ name: 'Ты (локально)', score: best, isMe: true });
            for (const [id, sc] of Object.entries(state.bestScores || {})) {
                rows.push({ name: `Уровень ${id}`, score: sc, isMe: false });
            }
            rows.sort((a, b) => b.score - a.score);
        }
        if (!rows.length) {
            leaderboardList.innerHTML = '<div class="lb-empty">Пока пусто. Сыграй и побей рекорд! 🌊</div>';
            return;
        }
        leaderboardList.innerHTML = '';
        rows.slice(0, 50).forEach((r, i) => {
            const el = document.createElement('div');
            el.className = 'leaderboard-row' + (r.isMe ? ' me' : '');
            el.innerHTML = `
                <span class="lb-pos">${i + 1}</span>
                <span class="lb-name">${r.isMe ? '⭐ ' : ''}${escapeHtml(r.name)}</span>
                <span class="lb-score">${Number(r.score).toLocaleString('ru')}</span>
            `;
            leaderboardList.appendChild(el);
        });
    }

    leaderboardBtn.addEventListener('click', openLeaderboard);
    closeLeaderboardBtn.addEventListener('click', () => hideModal(leaderboardModal));
    leaderboardModal.addEventListener('click', (e) => {
        if (e.target === leaderboardModal) hideModal(leaderboardModal);
    });

    // ── Поделиться результатом ───────────────────────────────
    async function shareResult(score) {
        const text = `🌊 Я набрал ${(score || 0).toLocaleString('ru')} очков в «Океан 2048»! Сможешь больше?`;
        const ok = await sdk.share(text);
        if (ok) {
            if (!sdk.isPlatform()) showToast('Ссылка скопирована — отправь друзьям!', '📣');
        } else {
            showToast('Не удалось поделиться', '⚠️');
        }
    }

    shareBtn.addEventListener('click', () => shareResult(state.bestTotal || 0));

    // ── Соцмеханики VK (Фаза 2) ───────────────────────────────
    // Показываем кнопки только на платформе VK. По требованиям VK между раундами
    // открываем не чаще одного диалога — кнопки живут в настройках (меню), где
    // игрок сознательно открывает соц-действие.

    // Одноразовый бонус жемчужинами за соц-действие (избранное / главный экран).
    // Ключ хранится в state.socialBonuses, чтобы награда начислялась один раз.
    function grantSocialBonus(key, amount, text, icon) {
        const bonuses = state.socialBonuses || {};
        if (bonuses[key]) return false; // уже получал
        bonuses[key] = true;
        state.socialBonuses = bonuses;
        saveState(state);
        addDoubloons(amount, text, icon);
        return true;
    }

    // Защита от двойного нажатия: пока диалог открыт — кнопка «занята».
    let socialBusy = false;
    async function runSocial(action) {
        if (socialBusy) return;
        socialBusy = true;
        try { await action(); } finally { socialBusy = false; }
    }

    if (sdk.host === 'vk') {
        if (inviteBtn) inviteBtn.hidden = false;
        if (requestBtn) requestBtn.hidden = false;
        if (storyBtn) storyBtn.hidden = false;
        if (favoritesBtn) favoritesBtn.hidden = false;
        if (homeScreenBtn) homeScreenBtn.hidden = false;
    }

    // Приглашение с наградой 👥: лимит N наград в день (INVITE_DAILY_LIMIT),
    // за каждое отправленное приглашение — +INVITE_REWARD жемчужин.
    // В тексте кнопки показываем остаток дня.
    function renderInviteBtn() {
        if (!inviteBtn) return;
        const info = inviteInfo(state);
        const left = info.remainingToday;
        const label = `👥 Пригласить друзей (${left}/${info.dailyLimit})`;
        inviteBtn.textContent = left > 0 ? `${label} +${INVITE_REWARD} 🦪` : label;
    }

    if (inviteBtn) inviteBtn.addEventListener('click', () => runSocial(async () => {
        const info = inviteInfo(state);
        if (info.remainingToday <= 0) {
            showToast(`Лимит приглашений на сегодня (${info.dailyLimit}) исчерпан`, '👥');
            return;
        }
        const ok = await sdk.showInvite('ocean2048_invite');
        if (!ok) { showToast('Не удалось пригласить', '⚠️'); return; }
        const res = recordInvite(state);
        saveState(state);
        if (res.rewarded) {
            addDoubloons(res.reward, 'приглашение друга', '👥');
        }
        renderInviteBtn();
    }));
    renderInviteBtn();

    // Сообщение-вызов «Побей мой рекорд» 💪: «умный текст» (рекорд + глубина),
    // награда отправителю с дневным лимитом (REQUEST_DAILY_LIMIT).
    function renderRequestBtn() {
        if (!requestBtn) return;
        const info = requestsInfo(state);
        const left = info.remainingToday;
        const label = `💪 Вызвать друга (${left}/${info.dailyLimit})`;
        requestBtn.textContent = left > 0 ? `${label} +${REQUEST_REWARD} 🦪` : label;
    }

    if (requestBtn) requestBtn.addEventListener('click', () => runSocial(async () => {
        const info = requestsInfo(state);
        if (info.remainingToday <= 0) {
            showToast(`Лимит вызовов на сегодня (${info.dailyLimit}) исчерпан`, '💪');
            return;
        }
        const msg = buildChallengeText(state.bestTotal || 0, state.currentLevel || 1);
        const ok = await sdk.showRequest(undefined, msg, 'ocean2048_challenge');
        if (!ok) { showToast('Не удалось отправить вызов', '⚠️'); return; }
        const res = recordRequest(state);
        saveState(state);
        if (res.rewarded) {
            addDoubloons(res.reward, 'вызов друга', '💪');
        }
        renderRequestBtn();
    }));
    renderRequestBtn();

    if (storyBtn) storyBtn.addEventListener('click', () => runSocial(async () => {
        const best = state.bestTotal || 0;
        // Фон истории: на VK нельзя хостить истории по URL из мини-приложения,
        // поэтому используем однотонный фон + текст-стикер от первого лица.
        const ok = await sdk.showStory({
            text: `Я набрал ${best.toLocaleString('ru')} очков в «Океан 2048»! Сможешь больше? 🌊`,
            link: location.href.split('#')[0].split('?')[0],
        });
        showToast(ok ? 'История опубликована!' : 'Не удалось открыть истории', ok ? '📸' : '⚠️');
    }));

    if (favoritesBtn) favoritesBtn.addEventListener('click', () => runSocial(async () => {
        const ok = await sdk.addToFavorites();
        if (!ok) { showToast('Не удалось добавить в избранное', '⚠️'); return; }
        // Награду (с тостом «+50 жемчужин») показывает addDoubloons один раз
        const gained = grantSocialBonus('favorites', 50, 'добавление в избранное', '⭐');
        if (!gained) showToast('Уже в избранном', '⭐');
    }));

    if (homeScreenBtn) homeScreenBtn.addEventListener('click', () => runSocial(async () => {
        const ok = await sdk.addToHomeScreen();
        if (!ok) { showToast('Не удалось добавить на главный экран', '⚠️'); return; }
        const gained = grantSocialBonus('homeScreen', 50, 'добавление на главный экран', '📱');
        if (!gained) showToast('Уже добавлено', '📱');
    }));

    // ── Контексты запуска (диплинки VK, Фаза 2) ────────────────
    // vk_request_key — игрок пришёл по приглашению/запросу друга. Приветствуем
    // и выдаём одноразовый приветственный бонус (WELCOME_BONUS жемчужин).
    const launchParams = sdk.getLaunchParams();
    if (launchParams.vk_request_key) {
        showToast('Друг позвал тебя в океан! 🌊', '🐬');
        const welcomed = claimWelcomeBonus(state);
        if (welcomed) {
            saveState(state);
            addDoubloons(WELCOME_BONUS, 'приветственный подарок от друга', '🎁');
        }
        // Дуэль ⚔️: если друг отправил вызов на дуэль (requestKey ocean2048_duel_*),
        // сохраняем его счёт — на карте уровней появится соперник.
        const duelChallenge = applyDuelChallenge(state, launchParams.vk_request_key);
        if (duelChallenge.accepted) {
            saveState(state);
            showToast(`Друг набрал ${duelChallenge.score.toLocaleString('ru')} — побей его!`, '⚔️');
        }
    }

    // ── Магазин / ежедневный вход / бусты ────────────────────
    if (shopBtn) shopBtn.addEventListener('click', openShopModal);
    if (closeShopBtn) closeShopBtn.addEventListener('click', () => hideModal(shopModal));
    if (shopModal) shopModal.addEventListener('click', (e) => {
        if (e.target === shopModal) hideModal(shopModal);
    });
    if (shopTabs) shopTabs.addEventListener('click', (e) => {
        const btn = e.target.closest('.shop-tab');
        if (!btn || !btn.dataset.cat) return;
        shopCategory = btn.dataset.cat;
        shopTabs.querySelectorAll('.shop-tab').forEach(b => b.classList.toggle('active', b === btn));
        renderShop();
    });
    if (boostShuffleBtn)   boostShuffleBtn.addEventListener('click', () => useBoostFromBar('shuffle'));
    if (boostBombBtn)      boostBombBtn.addEventListener('click', () => useBoostFromBar('bomb'));
    if (boostX2Btn)        boostX2Btn.addEventListener('click', () => useBoostFromBar('x2'));
    if (boostLightningBtn) boostLightningBtn.addEventListener('click', () => useBoostFromBar('lightning'));
    if (chestBtn)          chestBtn.addEventListener('click', openChestModal);
    if (chestCloseBtn)     chestCloseBtn.addEventListener('click', () => hideModal(chestModal));
    if (chestModal)        chestModal.addEventListener('click', (e) => {
        if (e.target === chestModal) hideModal(chestModal);
    });
    if (chestOpenBtn)      chestOpenBtn.addEventListener('click', handleOpenChest);
    if (exchangeBtn)       exchangeBtn.addEventListener('click', handleExchange);
    // Сюжетная миссия 🎯: кнопка «Забрать» за выполнение
    if (missionClaim)      missionClaim.addEventListener('click', claimMission);
    if (dlClaimBtn)        dlClaimBtn.addEventListener('click', claimDailyLoginReward);
    if (dlClose) dlClose.addEventListener('click', () => {
        if (dailyLoginEl) dailyLoginEl.hidden = true;
    });

    // ── Пауза ────────────────────────────────────────────────
    function setPaused(paused) {
        if (game) game.setPaused(paused);
        if (pauseOverlay) pauseOverlay.classList.toggle('visible', !!paused);
        // П. 1.19.3: пауза — стоп геймплея, снятие паузы — возобновление.
        if (paused) markGameplayStop();
        else if (game && !game.gameOver && !game.won) markGameplayStart();
        // Осенние листья и «живой океан» тоже останавливаются на паузе.
        if (paused) pauseAutumn();
        else resumeAutumn();
        if (paused) pauseAtmosphere();
        else resumeAtmosphere();
    }

    // ── Показ полноэкранной рекламы: звук и геймплей на паузу (п. 4.7) ──
    // Перед показом глушим звук и приостанавливаем игру, после закрытия — возвращаем.
    async function runWithAdPause(action) {
        const wasPaused = !!(game && game.paused);
        suspendSound();
        pauseAtmosphere();
        // П. 1.19.3: перед рекламой игровой процесс останавливается.
        markGameplayStop();
        if (game && !game.gameOver && !game.won && !game.paused) {
            game.setPaused(true);
        }
        try {
            return await action();
        } finally {
            resumeSound();
            resumeAtmosphere();
            if (game && !wasPaused && !game.gameOver && !game.won) {
                game.setPaused(false);
                // П. 1.19.3: после рекламы геймплей возобновляется.
                markGameplayStart();
            }
        }
    }

    // ── Переключатель режима: Глубины / Классика ─────────────
    function setGameMode(mode) {
        // Если мы УЖЕ в базовом режиме (не в спец-режиме puzzle/tournament/duel/
        // challenge/weekly, которые запускаются поверх «Глубины/Классики») — клик
        // по активной кнопке игнорируем (не рестартуем партию без нужды).
        // Если же активен спец-режим — клик по кнопке режима выводит из него
        // в соответствующий базовый режим.
        if (mode === gameMode && runKind === gameMode) return;
        // Спасаем текущую партию (доска сохраняется в своём слоте). Ориентируемся
        // на runKind, а не gameMode: спец-режимы (puzzle/tournament/duel/
        // challenge/weekly) запускаются ПОВЕРХ режима «Глубины/Классика» и не
        // должны сохранять свою доску в слот классики или уровня.
        if (game && runKind === 'classic') saveClassicBoard();
        else if (game && runKind === 'depth') saveBoard();
        if (pauseOverlay) pauseOverlay.classList.remove('visible');
        if (confirmModal) confirmModal.classList.remove('visible');

        gameMode = mode;
        state.mode = mode;
        saveState(state);

        // Подсветка активной кнопки
        if (modeDepthBtn) modeDepthBtn.classList.toggle('active', mode === 'depth');
        if (modeClassicBtn) modeClassicBtn.classList.toggle('active', mode === 'classic');
        if (modeDepthBtn) modeDepthBtn.setAttribute('aria-selected', String(mode === 'depth'));
        if (modeClassicBtn) modeClassicBtn.setAttribute('aria-selected', String(mode === 'classic'));

        if (mode === 'classic') startClassic();
        else startLevel(resolveStartLevel());
    }

    if (modeDepthBtn) modeDepthBtn.addEventListener('click', () => setGameMode('depth'));
    if (modeClassicBtn) modeClassicBtn.addEventListener('click', () => setGameMode('classic'));

    pauseBtn.addEventListener('click', () => {
        if (!game || game.won || game.gameOver) return;
        setPaused(!game.paused);
    });

    resumeBtn.addEventListener('click', () => setPaused(false));

    pauseRestartBtn.addEventListener('click', () => openRestartConfirm(true));

    // Авто-пауза при скрытии вкладки / переключении приложения (п. 1.3):
    // звук глушится сразу, игра ставится на паузу, при возврате — возобновляется.
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            suspendSound();
            pauseAutumn();
            pauseAtmosphere();
            // На Яндекс Играх паузу при сворачивании/смене вкладки ставит сама
            // платформа через событие game_api_pause (п. 1.19.4) — обработчик
            // onPlatformPause. Для VK и веба оставляем резервный механизм.
            if (sdk.host !== 'yandex' && game && !game.paused && !game.gameOver && !game.won
                && !document.querySelector('.modal-overlay.visible')) {
                setPaused(true);
            }
        } else {
            resumeSound();
            resumeMusic();
            resumeAutumn();
            resumeAtmosphere();
        }
    });

    // Потеря фокуса окна/iframe — звук и анимации фона останавливаются (п. 1.3),
    // при возврате — возобновляются.
    window.addEventListener('blur', () => { suspendSound(); suspendMusic(); pauseAtmosphere(); });
    window.addEventListener('focus', () => { resumeSound(); resumeMusic(); resumeAtmosphere(); });

    // Запрет контекстного меню на игровом поле (п. 1.6.1.8 / 1.6.2.7):
    // правый клик на десктопе и долгое нажатие на мобильных не открывают меню.
    document.addEventListener('contextmenu', (e) => {
        if (e.target.closest && e.target.closest('.board')) e.preventDefault();
    });

    // Esc — выход из паузы
    document.addEventListener('keydown', (e) => {
        if (e.key !== 'Escape') return;
        if (confirmModal && confirmModal.classList.contains('visible')) {
            confirmRestartNo.click();
            return;
        }
        if (pauseOverlay && pauseOverlay.classList.contains('visible')) {
            setPaused(false);
        }
    });

    // ── Подтверждение перезапуска ────────────────────────────
    function openRestartConfirm(fromPause) {
        confirmRestartFromPause = !!fromPause;
        if (!game) return;
        game.setPaused(true);
        showModal(confirmModal);
    }

    confirmRestartYes.addEventListener('click', () => {
        hideModal(confirmModal);
        if (pauseOverlay) pauseOverlay.classList.remove('visible');
        if (game) game.setPaused(false);
        resetCurrentGame();
    });

    confirmRestartNo.addEventListener('click', () => {
        hideModal(confirmModal);
        // Если подтверждение открыто не из паузы — возвращаем игру (и геймплей).
        if (!confirmRestartFromPause) setPaused(false);
    });

    confirmModal.addEventListener('click', (e) => {
        if (e.target === confirmModal) confirmRestartNo.click();
    });

    // ── Онбординг (первый запуск) ────────────────────────────
    function closeTutorial() {
        hideModal(tutorialModal);
        // П. 1.19.3: после онбординга игровой процесс возобновляется.
        if (game) setPaused(false);
    }

    function showTutorial() {
        if (!tutorialModal) return;
        // Всегда начинаем с первого шага.
        tutorialIndex = 0;
        renderTutorial();
        // П. 1.19.3: онбординг приостанавливает игровой процесс.
        if (game) setPaused(true);
        showModal(tutorialModal);
    }

    tutorialNext.addEventListener('click', () => {
        if (tutorialIndex < tutorialSteps.length - 1) {
            tutorialIndex++;
            renderTutorial();
        }
    });
    tutorialBack.addEventListener('click', () => {
        if (tutorialIndex > 0) {
            tutorialIndex--;
            renderTutorial();
        }
    });
    tutorialSkip.addEventListener('click', closeTutorial);
    tutorialOk.addEventListener('click', closeTutorial);
    tutorialDots.addEventListener('click', (e) => {
        const dot = e.target.closest('.tutorial-dot');
        if (!dot) return;
        tutorialIndex = Number(dot.dataset.i);
        renderTutorial();
    });
    tutorialModal.addEventListener('click', (e) => {
        if (e.target === tutorialModal) closeTutorial();
    });

    // ── Service Worker (только standalone-веб / PWA) ─────────
    // На площадках (VK / Яндекс) SW не регистрируем: там свой кэш/подгрузка,
    // и service worker в iframe не нужен.

    if (platform.isWeb && sdk.host === 'web' && 'serviceWorker' in navigator) {
        // Авто-перезагрузка при смене активного service worker: новый SW
        // (свежий кэш) активируется → controllerchange → страница обновляется,
        // чтобы пользователь сразу получил новые файлы вместо устаревшего кэша.
        let swRefreshing = false;
        navigator.serviceWorker.addEventListener('controllerchange', () => {
            if (swRefreshing) return;
            swRefreshing = true;
            window.location.reload();
        });
        navigator.serviceWorker.register('./sw.js').catch(() => {});
    }

    // ── Перерисовка при изменении размеров (полный экран / поворот) ──

    let resizeTimer = null;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
            // «Живой океан»: пересчитываем размер канваса и плотность обитателей
            ocean.resize();
            ocean.setTheme(state.theme || 'dark',
                window.innerWidth < 480 ? 'mobile' : window.innerWidth < 900 ? 'tablet' : 'desktop');
            if (game && typeof game.relayout === 'function') game.relayout();
            else if (game) game.render();
        }, 120);
    });

    // ── Старт ────────────────────────────────────────────────

    // Dev-режим: выдача жемчужин для тестирования.
    // URL-параметр `?doubloons=N` на localhost добавляет N жемчужин
    // к личному сейву. Работает только на локальной разработке
    // (localhost/127.0.0.1) — в проде параметр игнорируется.
    // Выдача идемпотентна: state.devGranted помнит последний выданный
    // объём, повторное открытие той же ссылки не даёт двойную выдачу.
    (function applyDevGrant() {
        const isLocal = /^localhost$|^127\.0\.0\.1$|^\[::1\]$/.test(location.hostname);
        if (!isLocal) return;
        const q = new URLSearchParams(location.search);
        const amount = Math.floor(Number(q.get('doubloons')));
        if (!Number.isFinite(amount) || amount <= 0) return;
        if ((state.devGranted || 0) >= amount) return;
        state.doubloons = (state.doubloons || 0) + amount;
        state.devGranted = amount;
        saveState(state);
        updateDoubloons();
        showToast(`Dev: +${amount} жемчужин 🦪`, '🦪');
        console.log(`🦪 Dev-режим: выдано ${amount} жемчужин (итого ${state.doubloons})`);
    })();

    // Dev-режим: точная установка баланса для тестов.
    // URL-параметр `?setdoubloons=N` на localhost УСТАНАВЛИВАЕТ баланс ровно в N
    // жемчужин (перезаписывает текущий). Удобно для проверки дорогих покупок:
    // `?setdoubloons=100000`. Работает только на локальной разработке.
    (function applyDevSetBalance() {
        const isLocal = /^localhost$|^127\.0\.0\.1$|^\[::1\]$/.test(location.hostname);
        if (!isLocal) return;
        const q = new URLSearchParams(location.search);
        const amount = Math.floor(Number(q.get('setdoubloons')));
        if (!Number.isFinite(amount) || amount < 0) return;
        state.doubloons = amount;
        saveState(state);
        updateDoubloons();
        showToast(`Dev: баланс = ${amount} жемчужин 🦪`, '🦪');
        console.log(`🦪 Dev-режим: баланс установлен в ${amount} жемчужин`);
    })();

    // Dev-режим: ручное тестирование «Плиток-способностей» ⚡ (только localhost).
    // window.__game — текущий экземпляр Game; window.__placeAbility(kind, idx)
    // ставит плитку-способность на клетку idx (или на первую пустую, если idx
    // опущен). В проде (не localhost) недоступно — как и applyDevGrant выше.
    (function applyDevAbilityTools() {
        const isLocal = /^localhost$|^127\.0\.0\.1$|^\[::1\]$/.test(location.hostname);
        if (!isLocal) return;
        Object.defineProperty(window, '__game', {
            configurable: true,
            get: () => game,
        });
        window.__placeAbility = (kind, idx) => {
            if (!game || !game.abilities) {
                return { ok: false, reason: 'механика выключена на этом уровне' };
            }
            if (!['bomb', 'jelly', 'crab'].includes(kind)) {
                return { ok: false, reason: 'kind должен быть bomb | jelly | crab' };
            }
            let i = idx;
            if (i === undefined) i = game.tiles.findIndex(t => t === null);
            if (i < 0 || i >= game.tiles.length) return { ok: false, reason: 'клетка вне доски' };
            game.tiles[i] = { id: game._nextTileId++, value: 2, ability: kind, justSpawned: true };
            game.abilitySpawned++;
            if (typeof game.render === 'function') game.render();
            return { ok: true, idx: i, kind };
        };
        console.log('🛠️ Dev-режим: доступны window.__game и window.__placeAbility(kind, idx)');
    })();

    // Фаза 1: пузырьки-фон сразу (если анимации разрешены)
    spawnBubbles();

    // Живой океан: стартуем канвас-атмосферу (тема уже применена в applyAppearance)
    startAtmosphere();

    applyAppearance();
    // Режим по умолчанию: Глубины (основная игра); Классика — если сохранена
    gameMode = state.mode === 'classic' ? 'classic' : 'depth';
    if (modeClassicBtn) modeClassicBtn.classList.toggle('active', gameMode === 'classic');
    if (modeDepthBtn) modeDepthBtn.classList.toggle('active', gameMode === 'depth');
    if (modeClassicBtn) modeClassicBtn.setAttribute('aria-selected', String(gameMode === 'classic'));
    if (modeDepthBtn) modeDepthBtn.setAttribute('aria-selected', String(gameMode === 'depth'));
    updateHeader();
    updateDoubloons();
    ensureDaily();
    renderDaily();
    renderDailyLogin();
    if (gameMode === 'classic') startClassic();
    else startLevel(resolveStartLevel());
    updateBoostBar();

    // Фоновая музыка: стартуем (без жеста не зазвучит — OST через HTMLAudio тоже
    // стартует по первому клику; трек сохраняется в state.musicTrack).
    // Играет только оригинальный саундтрек; легаси-ключи процедурных тем
    // из старых сейвов нормализуются в 'ost' внутри playTrack().
    if (state.music !== false) {
        playTrack(state.musicTrack || 'ost');
        setOstContext(runKind); // при старте runKind уже установлен (depth/classic)
    }

    // Загрузочный экран завершён
    if (loadingBarFill) loadingBarFill.style.width = '100%';
    sdk.setLoadingProgress(100);
    if (loadingScreen) loadingScreen.classList.add('hidden');
    sdk.loadingReady();

    // Доступность: убираем анимации, если пользователь запросил это
    if (reduceMotion) document.body.classList.add('reduce-motion');

    // Онбординг при первом запуске — после загрузочного экрана
    if (!state.tutorialSeen) {
        state.tutorialSeen = true;
        saveState(state);
        showTutorial();
    } else {
        // П. 1.19.3: игра готова и загрузочный экран скрыт — начинаем геймплей.
        markGameplayStart();
    }

    console.log(`🌊 Океан 2048 — платформа: ${platform.name}, SDK: ${sdk.host}`);
});
