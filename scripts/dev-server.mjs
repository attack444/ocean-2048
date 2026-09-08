// Локальный статический dev-сервер для тестирования игры в браузере.
// Запуск: node scripts/dev-server.mjs [порт]  (по умолчанию 4173)
// Раздаёт корень проекта (index.html, js/, css/, ...) с правильными MIME-типами.
/* global URL, process, console */
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const PORT = Number(process.argv[2]) || 4173;

const MIME = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.mjs': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.webp': 'image/webp',
    '.ico': 'image/x-icon',
    '.mp3': 'audio/mpeg',
    '.ogg': 'audio/ogg',
    '.wav': 'audio/wav',
    '.m4a': 'audio/mp4',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.ttf': 'font/ttf',
    '.txt': 'text/plain; charset=utf-8',
    '.webmanifest': 'application/manifest+json',
};

function safeResolve(urlPath) {
    // Декодируем и нормализуем, не даём выйти за пределы корня.
    let decoded;
    try {
        decoded = decodeURIComponent(urlPath);
    } catch {
        return null;
    }
    const target = normalize(join(ROOT, decoded));
    if (!target.startsWith(ROOT)) return null;
    return target;
}

const server = createServer(async (req, res) => {
    try {
        let urlPath = (req.url || '/').split('?')[0];
        if (urlPath === '/') urlPath = '/index.html';

        let filePath = safeResolve(urlPath);
        if (!filePath) {
            res.writeHead(403);
            res.end('Forbidden');
            return;
        }

        // Если запросили директорию — пробуем index.html внутри неё.
        let info = await stat(filePath).catch(() => null);
        if (info && info.isDirectory()) {
            filePath = join(filePath, 'index.html');
            info = await stat(filePath).catch(() => null);
        }

        if (!info || !info.isFile()) {
            res.writeHead(404);
            res.end('Not Found');
            return;
        }

        const data = await readFile(filePath);
        const type = MIME[extname(filePath).toLowerCase()] || 'application/octet-stream';
        res.writeHead(200, {
            'Content-Type': type,
            'Cache-Control': 'no-store',
        });
        res.end(data);
    } catch (err) {
        res.writeHead(500);
        res.end('Server Error: ' + (err && err.message));
    }
});

server.listen(PORT, () => {
    console.log(`Океан 2048 dev-сервер запущен: http://localhost:${PORT}/`);
    console.log(`Корень: ${ROOT}`);
});
