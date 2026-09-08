/**
 * Минификация JS и CSS для веб/платформенных сборок (VK, Яндекс).
 *
 * Использует esbuild (уже в devDependencies, применяется в build-www.js).
 * Пофайловая минификация БЕЗ бандлинга: сохраняет относительные импорты
 * (./game.js и т.п.) — они не меняются, поэтому ES-модули продолжают
 * резолвиться как в исходниках.
 *
 * Экспорт:
 *  - minifyFile(filePath)  -> Promise<string>  минифицированное содержимое
 *  - minifyJS(source, name) -> Promise<string>
 *  - minifyCSS(source, name) -> Promise<string>
 */
import { readFile } from 'fs/promises';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

// Путь к esbuild (может понадобиться для логирования — имена файлов в ошибках)
const esbuild = require('esbuild');

/**
 * Минифицирует JS-модуль (без бандлинга), сохраняя ESM-импорты.
 * @param {string} source — исходный код
 * @param {string} name — имя файла для отчётов (необязательно)
 * @returns {Promise<string>}
 */
export async function minifyJS(source, name = 'module') {
    const result = await esbuild.transform(source, {
        loader: 'js',
        minify: true,
        target: ['es2020'],
        format: 'esm',
        sourcefile: name,
        legalComments: 'none',
    });
    return result.code;
}

/**
 * Минифицирует CSS.
 * @param {string} source — исходный CSS
 * @param {string} name — имя файла для отчётов (необязательно)
 * @returns {Promise<string>}
 */
export async function minifyCSS(source, name = 'styles.css') {
    const result = await esbuild.transform(source, {
        loader: 'css',
        minify: true,
        sourcefile: name,
    });
    return result.code;
}

/**
 * Читает файл и возвращает минифицированное содержимое (по расширению).
 * @param {string} filePath — абсолютный путь к файлу
 * @returns {Promise<string>}
 */
export async function minifyFile(filePath) {
    const source = await readFile(filePath, 'utf8');
    if (filePath.endsWith('.css')) {
        return minifyCSS(source, filePath);
    }
    return minifyJS(source, filePath);
}

export { esbuild };
