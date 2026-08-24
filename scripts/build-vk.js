#!/usr/bin/env node
/**
 * Собирает build/vk/ — веб-версию для публикации в VK Mini Apps (раздел VK «Игры»).
 *
 * Ключевые отличия от scripts/build-yandex.js:
 * - VK загружает приложение НЕ архивом, а по HTTPS-URL (кабинет VK Mini Apps →
 *   «Загрузка» → URL приложения). Эта сборка — готовый набор файлов для деплоя
 *   на HTTPS-хостинг (например, 5mb2.ru) и указания URL в кабинете VK.
 * - Из index.html ВЫРЕЗАЕТСЯ тег <script async src="/sdk.js"> — он нужен только
 *   для Яндекс Игр; на VK путь не резолвится и даёт лишний 404. Мост VK Mini Apps
 *   (vk-bridge) на платформе внедряется автоматически; для локального предпросмотра
 *   вне VK js/platform-sdk.js сам подгрузит vk-bridge с unpkg (ensureBridge).
 * - Не копируются тесты (*.test.js), мусор слияния (board/config/utils/ui)
 *   и нативные точки входа (native-entry/native-plugins).
 * - Сохраняются manifest.json и sw.js (PWA-метаданные безвредны и полезны для VK).
 *
 * Результат — папка build/vk/, готовый комплект для заливки в public/games/<slug>/
 * на сервере (или любой HTTPS-хостинг) с последующим указанием URL в кабинете VK.
 */
import { cpSync, mkdirSync, rmSync, readdirSync, writeFileSync, readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'build', 'vk');

rmSync(out, { recursive: true, force: true });
mkdirSync(join(out, 'js'), { recursive: true });
mkdirSync(join(out, 'css'), { recursive: true });
mkdirSync(join(out, 'icons'), { recursive: true });

// ── Статика веб-версии ───────────────────────────────────────
// index.html копируется с вырезанным тегом /sdk.js (нужен только Яндекс Играм).
function copyIndexHtml() {
    const src = join(root, 'index.html');
    if (!existsSync(src)) {
        console.warn('skip missing: index.html');
        return;
    }
    let html = readFileSync(src, 'utf8');
    // Тег подключается в <head> с onload/onerror-маркерами для js/platform-sdk.js.
    // Для VK Mini Apps он не нужен: vk-bridge внедряется платформой автоматически,
    // а ensureBridge() подгрузит его сам для локального предпросмотра (?platform=vk).
    // Вырезаем только наш конкретный тег и сопровождающий комментарий про Яндекс,
    // чтобы в VK-сборке не оставалось упоминаний SDK/платформы Яндекса.
    html = html.replace(/\s*<!-- Yandex Games SDK:[\s\S]*?-->\s*/, '\n');
    html = html.replace(
        /\s*<script async src="\/sdk\.js"[^>]*><\/script>\s*/,
        '\n'
    );
    writeFileSync(join(out, 'index.html'), html);
}

const staticFiles = ['manifest.json', 'sw.js', 'privacy-policy.html'];
copyIndexHtml();
for (const f of staticFiles) {
    const src = join(root, f);
    if (existsSync(src)) cpSync(src, join(out, f));
    else console.warn(`skip missing: ${f}`);
}

// CSS: только актуальный styles.css
if (existsSync(join(root, 'css', 'styles.css'))) {
    cpSync(join(root, 'css', 'styles.css'), join(out, 'css', 'styles.css'));
}

// Icons: все иконки PWA
if (existsSync(join(root, 'icons'))) {
    cpSync(join(root, 'icons'), join(out, 'icons'), { recursive: true });
}

// ── JS-модули веб-версии ─────────────────────────────────────
const jsDir = join(root, 'js');
const EXCLUDE = new Set([
    'board.js', 'config.js', 'utils.js', 'ui.js',      // мусор слияния
    'native-entry.js', 'native-plugins.js',            // только для нативного бандла
]);
const modules = readdirSync(jsDir)
    .filter((f) => f.endsWith('.js'))
    .filter((f) => !f.endsWith('.test.js'))
    .filter((f) => !EXCLUDE.has(f));

for (const f of modules) {
    cpSync(join(jsDir, f), join(out, 'js', f));
}

writeFileSync(
    join(out, 'build.json'),
    JSON.stringify({ platform: 'vk', version: '1.0.0', jsModules: modules.length }, null, 2)
);

console.log(`✓ build/vk готов: статика (index.html без /sdk.js) + ${modules.length} JS-модулей + css + icons`);
console.log(`  Файлы: ${modules.join(', ')}`);
