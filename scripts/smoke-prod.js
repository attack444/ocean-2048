#!/usr/bin/env node
/* global document, window */
/**
 * Smoke-тест продакшн-версии «Океан 2048».
 *
 * Проверяет:
 *  1. Загрузка страницы без console-ошибок и network-fail
 *  2. Появление игрового поля и плиток
 *  3. Ход влево/вправо — плитки двигаются (счётчик суммы плиток растёт)
 *  4. Открытие настроек и смена музыки (OST)
 *  5. Автополитика: после жеста HTMLAudio-саундтрек стартует (mp3 скачивается)
 *  6. Service Worker зарегистрирован (PWA)
 *
 * Запуск: node scripts/smoke-prod.js [URL]
 * Пример: node scripts/smoke-prod.js https://5mb2.ru/static/games/ocean-2048/index.html
 */
import { chromium } from 'playwright';

const URL = process.argv[2] || 'https://5mb2.ru/static/games/ocean-2048/index.html';
let failed = 0;
const report = [];

function check(name, ok, extra = '') {
    report.push(`${ok ? '  ✓' : '  ✖'} ${name}${extra ? ' — ' + extra : ''}`);
    if (!ok) failed++;
}

// ── Логирование ошибок ─────────────────────────────────────────────
const consoleErrors = [];
const consoleWarnings = [];
const httpErrors = [];    // ответы со статусом ≥400
const networkFails = [];

const browser = await chromium.launch({ headless: true });
try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });

    page.on('console', (msg) => {
        if (msg.type() === 'error') consoleErrors.push(msg.text());
        if (msg.type() === 'warning') consoleWarnings.push(msg.text());
    });
    page.on('pageerror', (err) => consoleErrors.push(String(err)));
    // Ответы 4xx/5xx — Chrome логирует их в консоль без URL
    // («Failed to load resource»), поэтому ловим статусы напрямую.
    page.on('response', (res) => {
        if (res.status() >= 400) {
            const url = res.url();
            if (!url.includes('favicon')) httpErrors.push(`${res.status()} ${url}`);
        }
    });
    page.on('requestfailed', (req) => {
        const url = req.url();
        if (!url.includes('favicon')) networkFails.push(url + ' → ' + (req.failure()?.errorText || '?'));
    });

    console.log(`═══ Smoke-тест: ${URL} ═══`);

    // 1. Первый заход — «прогреваем» Service Worker (первый визит может
    //    закончиться reload'ом из-за controllerchange в main.js).
    const resp = await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
    check('Страница отвечает HTTP 200', resp && resp.status() === 200, resp ? `status=${resp.status()}` : 'no response');
    await page.waitForTimeout(4000); // дать SW зарегистрироваться/активироваться

    // 2. Перезагружаемся — теперь SW контролирует страницу, reload не случится.
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {});
    await page.waitForTimeout(3000);

    await page.waitForSelector('#board', { timeout: 30000 }).catch(() => {});
    const boardVisible = await page.locator('#board').isVisible().catch(() => false);
    check('Игровое поле видно', boardVisible);
    const tiles = await page.locator('.tile').count();
    check('Есть плитки (≥2)', tiles >= 2, `tiles=${tiles}`);

    // 3. Ход — сумма плиток должна вырасти (движение + новая плитка).
    //    Текст плитки вида «🐟2» (глиф+число) — берём data-value.
    const sumTiles = async () => page.evaluate(() => {
        return [...document.querySelectorAll('#board .tile')]
            .map((t) => Number(t.dataset.value) || 0)
            .reduce((a, b) => a + b, 0);
    });
    const sumBefore = await sumTiles();
    await page.keyboard.press('ArrowLeft');
    await page.waitForTimeout(500);
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(500);
    const sumAfter = await sumTiles();
    check('Ход обрабатывается (плитки двигаются)', sumAfter > sumBefore, `сумма плиток ${sumBefore}→${sumAfter}`);

    // 4. Настройки
    const settingsBtn = page.locator('#settings-btn');
    const openedSettings = await settingsBtn.click({ timeout: 5000 }).then(() => true).catch(() => false);
    await page.waitForTimeout(600);
    check('Открываются настройки', openedSettings);
    const modalVisible = await page.locator('#settings-modal.visible').isVisible().catch(() => false);
    check('Модалка настроек видна', modalVisible);

    // 5. Музыка: клик по «Оригинальному саундтреку» — жест, после которого
    //    должен стартовать OST (HTMLAudio с mp3 Kevin MacLeod; процедурный
    //    Web Audio-синтез удалён).
    const musicBtn = page.locator('.music-btn[data-track="ost"]');
    const clickedMusic = await musicBtn.click({ timeout: 5000 }).then(() => true).catch(() => false);
    await page.waitForTimeout(2500);
    check('Кнопка «Оригинальный саундтрек» кликабельна', clickedMusic);
    const music = await page.evaluate(() => {
        const m = window.__music;
        return m ? { track: m.track, enabled: m.enabled, ost: m.ost } : null;
    });
    const ostOk = music && music.track === 'ost' && music.enabled && music.ost && music.ost.playing;
    check('OST играет после жеста (HTMLAudio playing)', ostOk,
        music ? `track=${music.track} enabled=${music.enabled} ost=${JSON.stringify(music.ost)}` : 'window.__music недоступен');

    // 6. SW зарегистрирован (PWA) — ждём появления регистрации (до 12 с)
    //    На платформенных хостах (VK / OK: vk-apps.ru, vk.ru, ok.ru, vk.com)
    //    Service Worker НЕ регистрируется намеренно (main.js: условие
    //    platform.isWeb && sdk.host === 'web') — там это ожидаемо.
    const isPlatformHost = /vk-apps\.ru|\.vk\.ru|ok\.ru|vk\.com|m\.vk\.ru/.test(URL);
    let swOk = false;
    try {
        await page.evaluate(async () => {
            if (!('serviceWorker' in navigator)) return false;
            for (let i = 0; i < 24; i++) {
                const regs = await navigator.serviceWorker.getRegistrations();
                if (regs.length > 0) return true;
                await new Promise((r) => setTimeout(r, 500));
            }
            return false;
        }).then((v) => { swOk = v; });
    } catch (_) { swOk = false; }
    if (isPlatformHost) {
        check('Service Worker (PWA) — на платформенном хосте не используется (ожидаемо)',
            !swOk, swOk ? 'неожиданная регистрация' : 'SW не регистрируется — соответствует логике');
    } else {
        check('Service Worker зарегистрирован', swOk);
    }

    // 7. Закрытие настроек
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);

    // /sdk.js — Яндекс Games SDK: подключается по относительному пути,
    // но существует только в Яндекс-сборке. В вебе/VK/локально его
    // отсутствие — ожидаемый 404.
    const isExpected404 = (u) => u.includes('/sdk.js');

    console.log('\n── HTTP-ошибки (4xx/5xx) ──');
    const realHttpErrors = httpErrors.filter((e) => !isExpected404(e));
    if (realHttpErrors.length === 0) console.log('  ✓ нет HTTP-ошибок');
    else { failed++; for (const e of realHttpErrors) console.log('  ✖ ' + e); }

    // Chrome дублирует 4xx/5xx в консоль как «Failed to load resource» (без URL) —
    // они уже учтены в httpErrors, поэтому игнорируем такие общие сообщения.
    const realConsoleErrors = consoleErrors.filter((e) =>
        !e.includes('Failed to load resource'));
    if (realConsoleErrors.length === 0) console.log('  ✓ нет прочих ошибок в консоли');
    else { failed++; for (const e of realConsoleErrors) console.log('  ✖ ' + e); }

    // Автополитика: музыка — HTMLAudio (OST), но SFX-звуки js/sound.js используют
    // AudioContext; после первого жеста предупреждений быть не должно.
    const autoplayWarnings = consoleWarnings.filter((w) => w.includes('AudioContext'));
    check('Нет предупреждений AudioContext (автополитика)', autoplayWarnings.length === 0,
        autoplayWarnings.length ? `${autoplayWarnings.length} warning` : '');

    console.log('\n── Network fail ──');
    const realFails = networkFails.filter((f) => !isExpected404(f));
    if (realFails.length === 0) console.log('  ✓ нет сетевых ошибок');
    else { failed++; for (const f of realFails) console.log('  ✖ ' + f); }

    console.log('\n── Результаты ──');
    console.log(report.join('\n'));
    console.log(`\nИТОГО: ${failed} ошибок`);
} finally {
    await browser.close();
}
process.exit(failed ? 1 : 0);
