#!/usr/bin/env node
/* Расширенная диагностика Service Worker на проде. */
import { chromium } from 'playwright';
import { writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'deploy-tmp', 'smoke-diag2.txt');
const lines = [];

const browser = await chromium.launch({ headless: true });
try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    page.on('console', (m) => lines.push(`[console] ${m.type()} ${m.text().slice(0, 200)}`));
    page.on('pageerror', (e) => lines.push(`[pageerror] ${String(e).slice(0, 200)}`));

    await page.goto('https://5mb2.ru/static/games/ocean-2048/index.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(6000);
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(6000);

    const probe = await page.evaluate(async () => {
        const out = { swInNav: 'serviceWorker' in navigator, controller: !!navigator.serviceWorker?.controller };
        // Попытка регистрации с полным разбором результата
        try {
            const reg = await navigator.serviceWorker.register('./sw.js');
            out.regOk = true;
            out.regScope = reg.scope;
            out.regActive = !!reg.active;
            out.regInstalling = !!reg.installing;
            out.regWaiting = !!reg.waiting;
            // подождать установки
            const r = await Promise.race([
                navigator.serviceWorker.ready.then(() => 'ready'),
                new Promise((res) => setTimeout(() => res('timeout'), 8000)),
            ]);
            out.ready = r;
            const regs = await navigator.serviceWorker.getRegistrations();
            out.regs = regs.map((x) => ({
                scope: x.scope,
                active: !!x.active,
                installing: !!x.installing,
                waiting: !!x.waiting,
            }));
        } catch (e) {
            out.regErr = String(e);
        }
        return out;
    });
    lines.push(`PROBE ${JSON.stringify(probe, null, 2)}`);
} catch (e) {
    lines.push(`FATAL ${String(e).slice(0, 500)}`);
} finally {
    writeFileSync(out, lines.join('\n'), 'utf8');
    await browser.close();
}
console.log('done → ' + out);
