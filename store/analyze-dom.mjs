// Анализ DOM-дампов Chrome (--dump-dom) по этапам тест-драйвера.
// Читает store/shots/dom-{stage}.html и печатает состояние ключевых элементов.
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = join(dirname(fileURLToPath(import.meta.url)), 'shots');

// Открывающий тег элемента по id (возвращает класс, disabled и т.п.)
function openTag(html, id) {
  const m = html.match(new RegExp(`<[a-z0-9-]+[^>]*id=["']${id}["'][^>]*>`, 'i'));
  return m ? m[0] : null;
}

function attr(tag, name) {
  if (!tag) return null;
  const m = tag.match(new RegExp(`${name}=["']([^"']*)["']`, 'i'));
  return m ? m[1] : null;
}

function hasClass(tag, cls) {
  if (!tag) return false;
  const c = attr(tag, 'class') || '';
  return c.split(/\s+/).includes(cls);
}

function innerText(html, id) {
  const m = html.match(new RegExp(`<[a-z0-9-]+[^>]*id=["']${id}["'][^>]*>([\\s\\S]*?)</[a-z0-9-]+>`, 'i'));
  if (!m) return null;
  return m[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
}

function countItems(html) {
  return { all: (html.match(/class="[^"]*shop-item/g) || []).length,
           owned: (html.match(/class="[^"]*shop-item owned/g) || []).length };
}

function buyButtons(html) {
  const out = [];
  const re = /class="[^"]*shop-buy[^"]*"[^>]*data-shop-id="([^"]+)"[^>]*>/g;
  let m;
  while ((m = re.exec(html))) out.push(m[1]);
  return out;
}

function activeTab(html) {
  const m = html.match(/class="btn btn-small shop-tab active"[^>]*data-cat="([^"]+)"/);
  return m ? m[1] : null;
}

const stages = ['daily', 'boost', 'perk', 'skin', 'theme', 'buy'];
for (const s of stages) {
  const file = DIR + `dom-${s}.html`;
  let html;
  try { html = readFileSync(file, 'utf8'); }
  catch (e) { console.log(`=== ${s}: ФАЙЛ НЕ НАЙДЕН`); continue; }

  const t = openTag(html, 'tutorial-modal');
  const dl = openTag(html, 'daily-login');
  const claim = openTag(html, 'dl-claim-btn');
  const shopModal = openTag(html, 'shop-modal');
  const boostSh = openTag(html, 'boost-shuffle');
  const grid = countItems(html);
  const buys = buyButtons(html);

  // Трейс драйвера (что реально кликнуто)
  const traceM = html.match(/data-driver-trace="([^"]*)"/);
  const trace = traceM ? traceM[1].replace(/"/g, '"') : null;

  console.log(`\n=== ЭТАП: ${s} (файл ${file.split('/').pop()}, ${html.length} байт) ===`);
  console.log('  title        :', (html.match(/<title>([^<]*)<\/title>/) || [])[1]);
  console.log('  driver trace :', trace);
  console.log('  tutorial-modal visible:', hasClass(t, 'visible'));
  console.log('  daily-login hidden-attr:', /<div id="daily-login"[^>]*\shidden/.test(html));
  console.log('  dl-claim-btn disabled :', attr(claim, 'disabled') != null, '| текст:', innerText(html, 'dl-claim-btn'));
  console.log('  dl-days               :', innerText(html, 'dl-days'));
  console.log('  doubloons             :', innerText(html, 'doubloons'));
  console.log('  shop-modal open       :', hasClass(shopModal, 'visible'), '| класс:', attr(shopModal, 'class'));
  console.log('  active tab            :', activeTab(html));
  console.log('  shop-doubloons        :', innerText(html, 'shop-doubloons'));
  console.log('  shop-grid items all/owned:', grid.all, '/', grid.owned);
  console.log('  shop-buy buttons      :', buys.join(', ') || '(нет)');
  console.log('  boost-shuffle disabled:', attr(boostSh, 'disabled') != null);
  console.log('  boost counts (shuffle/bomb/x2):', innerText(html, 'boost-shuffle-count'), '/', innerText(html, 'boost-bomb-count'), '/', innerText(html, 'boost-x2-count'));
}
