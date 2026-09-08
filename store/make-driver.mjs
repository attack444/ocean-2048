// Генератор тест-драйвера: копия index.html + авто-скрипт кликов по этапам.
// Этапы (?stage=...): home | daily | boost | perk | skin | theme | buy
// Драйвер устойчив к гонкам: ждёт готовности каждого шага, кликает,
// проверяет результат и повторяет при необходимости. Пишет трейс в DOM.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const driver = `<!-- TEST DRIVER (auto-generated, не для продакшна) -->
<script>
(function () {
  var stage = new URLSearchParams(location.search).get('stage') || 'home';
  var plan = {
    daily: ['tutorial-ok', 'dl-claim-btn'],
    boost: ['tutorial-ok', 'dl-claim-btn', 'shop-btn', 'tab-boost'],
    perk:  ['tutorial-ok', 'dl-claim-btn', 'shop-btn', 'tab-perk'],
    skin:  ['tutorial-ok', 'dl-claim-btn', 'shop-btn', 'tab-skin'],
    theme: ['tutorial-ok', 'dl-claim-btn', 'shop-btn', 'tab-theme'],
    buy:   ['tutorial-ok', 'dl-claim-btn', 'shop-btn', 'tab-boost', 'buy-shuffle', 'close-shop-btn']
  }[stage] || [];
  var trace = [];
  var stepIndex = 0;
  var attempts = 0;
  var MAX = 400; // 400 * 50ms = 20s виртуального времени

  function $id(id) { return document.getElementById(id); }
  function $sel(sel) { return document.querySelector(sel); }

  function getEl(step) {
    if (step === 'tutorial-ok') return $id('tutorial-ok');
    if (step === 'dl-claim-btn') return $id('dl-claim-btn');
    if (step === 'shop-btn') return $id('shop-btn');
    if (step === 'close-shop-btn') return $id('close-shop-btn');
    if (step === 'tab-perk') return $sel('.shop-tab[data-cat="perk"]');
    if (step === 'tab-skin') return $sel('.shop-tab[data-cat="skin"]');
    if (step === 'tab-theme') return $sel('.shop-tab[data-cat="theme"]');
    if (step === 'tab-boost') return $sel('.shop-tab[data-cat="boost"]');
    if (step === 'buy-shuffle') return $sel('.shop-buy[data-shop-id="boost_shuffle"]');
    return null;
  }

  // Условие, что шаг можно выполнять (элемент готов к клику)
  function ready(step) {
    if (step === 'tutorial-ok') {
      var m = $id('tutorial-modal');
      return !!(m && m.classList.contains('visible'));
    }
    return true;
  }

  // Применился ли шаг (результат в DOM)
  function applied(step) {
    var m, sm;
    if (step === 'tutorial-ok') {
      m = $id('tutorial-modal');
      return !!(m && !m.classList.contains('visible'));
    }
    if (step === 'dl-claim-btn') {
      var d = $id('doubloons');
      return !!(d && d.textContent.trim() === '50');
    }
    if (step === 'shop-btn') {
      sm = $id('shop-modal');
      return !!(sm && sm.classList.contains('visible'));
    }
    if (step === 'tab-boost' || step === 'tab-perk' || step === 'tab-skin' || step === 'tab-theme') {
      return !!$sel('.shop-tab.active[data-cat="' + step.slice(4) + '"]');
    }
    if (step === 'buy-shuffle') {
      var c = $id('boost-shuffle-count');
      return !!(c && c.textContent.trim() === '1');
    }
    if (step === 'close-shop-btn') {
      sm = $id('shop-modal');
      return !!(sm && !sm.classList.contains('visible'));
    }
    return true;
  }

  var timer = setInterval(function () {
    if (stepIndex >= plan.length || attempts++ > MAX) {
      clearInterval(timer);
      document.body.setAttribute('data-driver-done', '1');
      document.body.setAttribute('data-driver-trace', JSON.stringify(trace));
      return;
    }
    var step = plan[stepIndex];
    var el = getEl(step);
    if (!ready(step)) {
      trace.push('wait:' + step);
      return;
    }
    if (!el || el.disabled) {
      trace.push('missing:' + step);
      return;
    }
    el.click();
    trace.push('clicked:' + step);
    if (applied(step)) {
      stepIndex++;
      trace.push('ok:' + step);
    }
  }, 50);
})();
</script>`;

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const html = readFileSync(join(ROOT, 'index.html'), 'utf8');
// <base href="/"> — чтобы относительные пути (css/, js/, manifest.json, icons/)
// резолвились от корня сайта, а не от /store/ (иначе 404 и драйвер не работает)
const withBase = html.replace('<head>', '<head>\n<base href="/">');
const out = withBase.replace('</body>', driver + '\n</body>');
writeFileSync(join(ROOT, 'store', 'test-driver.html'), out, 'utf8');
console.log('test-driver.html создан,', out.length, 'байт');
