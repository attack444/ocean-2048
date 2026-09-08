// ======================== Приглашение с наградой ========================
// Виральность:
//   - отправитель получает жемчужины за приглашение (лимит N в день, чтобы
//     не фармить экономику);
//   - пришедший по приглашению (vk_request_key / ссылке) получает
//     приветственный бонус (один раз за всё время).
//
// Модуль чистый (pure): не обращается к window/localStorage — легко тестировать.
// Состояние хранится в state.invite = { date, count, welcomeClaimed }.

import { dailyDateStr } from './daily.js';

export const INVITE_KEY = 'invite';

/** Жемчужины за одно отправленное приглашение. */
export const INVITE_REWARD = 25;

/** Максимум наградных приглашений в день. */
export const INVITE_DAILY_LIMIT = 5;

/** Приветственный бонус для пришедшего по приглашению. */
export const WELCOME_BONUS = 100;

export function inviteDefault() {
    return { date: '', count: 0, welcomeClaimed: false };
}

/** Нормализует state.invite; при смене даты обнуляет дневной счётчик. */
export function ensureInvite(state, dateStr = dailyDateStr()) {
    if (!state.invite || typeof state.invite !== 'object') state.invite = inviteDefault();
    if (state.invite.date !== dateStr) {
        state.invite.date = dateStr;
        state.invite.count = 0;
    }
    return state.invite;
}

/** Текущее состояние механики для UI. */
export function inviteInfo(state, dateStr = dailyDateStr()) {
    const inv = ensureInvite(state, dateStr);
    return {
        reward: INVITE_REWARD,
        dailyLimit: INVITE_DAILY_LIMIT,
        usedToday: inv.count,
        remainingToday: Math.max(0, INVITE_DAILY_LIMIT - inv.count),
        welcomeAvailable: !inv.welcomeClaimed,
    };
}

/**
 * Начислить награду за отправленное приглашение.
 * Возвращает { rewarded, reward } — rewarded=false, если дневной лимит исчерпан.
 */
export function recordInvite(state, dateStr = dailyDateStr()) {
    const inv = ensureInvite(state, dateStr);
    if (inv.count >= INVITE_DAILY_LIMIT) return { rewarded: false, reward: 0 };
    inv.count += 1;
    return { rewarded: true, reward: INVITE_REWARD };
}

/**
 * Забрать приветственный бонус (только один раз за всё время).
 * Возвращает true, если бонус выдан.
 */
export function claimWelcomeBonus(state) {
    if (!state.invite || typeof state.invite !== 'object') state.invite = inviteDefault();
    if (state.invite.welcomeClaimed) return false;
    state.invite.welcomeClaimed = true;
    return true;
}
