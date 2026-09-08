// ======================== Сообщение-вызов «Побей мой рекорд» ========================
// ВK VKWebAppShowRequestBox: игрок выбирает друга и отправляет ему сообщение-вызов
// с «умным текстом» (лучший результат, текущая глубина). Отправитель получает
// жемчужины за вызов (лимит N в день, чтобы не фармить экономику).
//
// Модуль чистый (pure): не обращается к window/localStorage — легко тестировать.
// Состояние хранится в state.requests = { date, count }.

import { dailyDateStr } from './daily.js';

export const REQUESTS_KEY = 'requests';

/** Жемчужины за одно отправленное сообщение-вызов. */
export const REQUEST_REWARD = 15;

/** Максимум наградных вызовов в день. */
export const REQUEST_DAILY_LIMIT = 5;

export function requestsDefault() {
    return { date: '', count: 0 };
}

/** Нормализует state.requests; при смене даты обнуляет дневной счётчик. */
export function ensureRequests(state, dateStr = dailyDateStr()) {
    if (!state.requests || typeof state.requests !== 'object') state.requests = requestsDefault();
    if (state.requests.date !== dateStr) {
        state.requests.date = dateStr;
        state.requests.count = 0;
    }
    return state.requests;
}

/** Текущее состояние механики для UI. */
export function requestsInfo(state, dateStr = dailyDateStr()) {
    const req = ensureRequests(state, dateStr);
    return {
        reward: REQUEST_REWARD,
        dailyLimit: REQUEST_DAILY_LIMIT,
        usedToday: req.count,
        remainingToday: Math.max(0, REQUEST_DAILY_LIMIT - req.count),
    };
}

/**
 * Начислить награду за отправленное сообщение-вызов.
 * Возвращает { rewarded, reward } — rewarded=false, если дневной лимит исчерпан.
 */
export function recordRequest(state, dateStr = dailyDateStr()) {
    const req = ensureRequests(state, dateStr);
    if (req.count >= REQUEST_DAILY_LIMIT) return { rewarded: false, reward: 0 };
    req.count += 1;
    return { rewarded: true, reward: REQUEST_REWARD };
}

/**
 * «Умный» текст сообщения-вызова — зависит от рекорда и текущей глубины.
 * score — лучший результат (state.bestTotal), level — текущая глубина.
 * Возвращает строку ≤ 200 символов (ограничение VK WebAppShowRequestBox).
 */
export function buildChallengeText(score = 0, level = 1) {
    const sc = Number(score) || 0;
    const lv = Math.max(1, Number(level) || 1);
    const s = sc.toLocaleString('ru');
    if (sc <= 0) {
        return `🌊 Присоединяйся к «Океан 2048» — я исследую глубины до ${lv} уровня! Сможешь пройти дальше?`;
    }
    return `🌊 Я набрал ${s} очков в «Океан 2048» (глубина ${lv}). Побей мой рекорд!`;
}
