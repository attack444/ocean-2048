/* global self, caches, fetch, URL */
// ======================== Service Worker — Океан 2048 ========================
// Версию кэша меняй при каждом релизе (принудительно обновит файлы у пользователей)
const CACHE = 'ocean-2048-v22';

const ASSETS = [
    './',
    './index.html',
    './css/styles.css',
    // Модули, которые импортирует js/main.js (27 шт.)
    './js/main.js',
    './js/game.js',
    './js/platform.js',
    './js/sound.js',
    './js/music.js',
    './js/ost.js',
    './js/atmosphere.js',
    './js/platform-sdk.js',
    './js/progress.js',
    './js/cloud-sync.js',
    './js/rewards.js',
    './js/combo.js',
    './js/levels.js',
    './js/achievements.js',
    './js/daily.js',
    './js/daily-login.js',
    './js/daily-puzzle.js',
    './js/shop.js',
    './js/tournament.js',
    './js/invite.js',
    './js/request.js',
    './js/duel.js',
    './js/depths-map.js',
    './js/missions.js',
    './js/challenge.js',
    './js/weekly.js',
    './js/chest.js',
    './js/autumn.js',
    './manifest.json',
    './icons/icon.svg',
    './icons/icon-192.png',
    './icons/icon-512.png',
    './icons/icon-maskable-192.png',
    './icons/icon-maskable-512.png',
    './icons/icon-32.png',
    './icons/apple-touch-icon.png',
    // screenshots/screenshot-mobile.png НЕ кэшируем: build:vk пропускает магазинные
    // ассеты (icon-1024.png, screenshot-mobile.png) — 404 в cache.addAll уронил бы
    // установку service worker (SW зависал в installing, PWA не работал).
    // Оригинальный саундтрек (OST): 2 MP3 Kevin MacLeod — кэшируем для офлайна.
    // Процедурной Web Audio-музыки больше нет (удалена 2026-09): играет только
    // OST через js/ost.js (звуки js/sound.js файлов не требуют).
    './audio/ost/grand-dark-waltz.mp3',
    './audio/ost/ancient-mystery-waltz.mp3',
];

// ── Установка: кэшируем все статические файлы ──────────────
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE)
            .then((cache) => cache.addAll(ASSETS))
            .then(() => self.skipWaiting())
    );
});

// ── Активация: удаляем устаревшие кэши ─────────────────────
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys()
            .then((keys) => Promise.all(
                keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))
            ))
            .then(() => self.clients.claim())
    );
});

// ── Fetch: код (html/js/css) — сеть в приоритете, медиа — кэш в приоритете ──
// Так обновления игры не «застревают» в кэше у пользователей, а в офлайне
// всё по-прежнему работает из кэша (фолбэк).
self.addEventListener('fetch', (event) => {
    // Только GET-запросы, не трогаем chrome-extension и прочее
    if (event.request.method !== 'GET') return;
    if (!event.request.url.startsWith('http')) return;

    const url = new URL(event.request.url);

    // Privacy Policy НЕ кэшируем: всегда network-first (юридический документ
    // должен быть актуальным; при офлайне — фолбэк на кэш)
    if (url.pathname.includes('privacy-policy')) {
        event.respondWith(
            fetch(event.request).catch(() => caches.match(event.request))
        );
        return;
    }

    const isNavigation = event.request.mode === 'navigate';
    const isCode = url.pathname.endsWith('.js') || url.pathname.endsWith('.css') || url.pathname === '/';

    if (isNavigation || isCode) {
        // Network-first: свежий код приходит сразу, кэш — офлайн-фолбэк
        event.respondWith(
            fetch(event.request)
                .then((response) => {
                    if (response && response.status === 200 && response.type === 'basic') {
                        const clone = response.clone();
                        caches.open(CACHE).then((cache) => cache.put(event.request, clone));
                    }
                    return response;
                })
                .catch(() => caches.match(event.request).then((cached) => {
                    if (cached) return cached;
                    if (isNavigation) return caches.match('./index.html');
                }))
        );
        return;
    }

    // Медиа (иконки, аудио, картинки): cache-first — скорость и офлайн
    event.respondWith(
        caches.match(event.request).then((cached) => {
            if (cached) return cached;

            return fetch(event.request).then((response) => {
                // Кэшируем только успешные ответы нашего origin
                if (response && response.status === 200 && response.type === 'basic') {
                    const clone = response.clone();
                    caches.open(CACHE).then((cache) => cache.put(event.request, clone));
                }
                return response;
            }).catch(() => {
                // Офлайн-фолбэк: возвращаем index.html для навигации
                if (event.request.mode === 'navigate') {
                    return caches.match('./index.html');
                }
            });
        })
    );
});
