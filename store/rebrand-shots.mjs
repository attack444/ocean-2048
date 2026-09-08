// Ребрендинг снапшотов store/shots/dom-*.html под «Океан 2048» — ВЫПОЛНЕН.
// Скрипт оставлен как безопасный no-op-справочник актуальных строк (старые
// названия убраны полностью, включая ключи БД).
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = join(dirname(fileURLToPath(import.meta.url)), 'shots');
const files = readdirSync(dir).filter((f) => f.startsWith('dom-') && f.endsWith('.html'));

const repl = [
  ['content="#0a3d62"', 'content="#0a3d62"'],
  [
    'Океан 2048 — объединяй плитки, исследуй глубины океана и стань Хозяином Моря! Без рекламы и покупок.',
    'Океан 2048 — объединяй плитки, исследуй глубины океана и стань Хозяином Моря! Без рекламы и покупок.',
  ],
  ['content="Океан 2048"', 'content="Океан 2048"'],
  ['<title>Океан 2048 — головоломка 2048</title>', '<title>Океан 2048 — головоломка 2048</title>'],
  ['loading-title">Океан 2048<', 'loading-title">Океан 2048<'],
  ['Погружаемся в глубины океана…', 'Погружаемся в глубины океана…'],
  ['<span class="label">Жемчужины</span>', '<span class="label">Жемчужины</span>'],
  ['🐚 Ракушка', '🐚 Ракушка'],
  ['🌊 Океан 2048 | Сделано с ❤️', '🌊 Океан 2048 | Сделано с ❤️'],
  ['Лучшие исследователи глубин океана', 'Лучшие исследователи глубин океана'],
  ['🪸 Рынок у рифа', '🪸 Рынок у рифа'],
  ['Жемчужины: <strong', 'Жемчужины: <strong'],
  [' 🦪', ' 🦪'],
  ['Добро пожаловать в океан!', 'Добро пожаловать в океан!'],
  ['Жемчужная жила', 'Жемчужная жила'],
  ['+50% жемчужин за все награды', '+50% жемчужин за все награды'],
];

let total = 0;
for (const f of files) {
  const p = `${dir}/${f}`;
  let c = readFileSync(p, 'utf8');
  let n = 0;
  for (const [a, b] of repl) {
    if (c.includes(a)) {
      c = c.split(a).join(b);
      n++;
    }
  }
  writeFileSync(p, c, 'utf8');
  total += n;
  console.log(`updated ${f} (${n} rules)`);
}
console.log(`DONE: ${files.length} files, ${total} replacements`);
