// АРХИВ (2026-09): осенний пост-голосования «Океан 2048» для VK (1080×1080).
// Голосование отменено — треки встроены в игру (см. store/community/autumn/post-ost.md).
// Скрипт сохранён для истории / на случай переиспользования шаблона.
// Выход: store/community/autumn-vote-1080x1080.png (легаси-файл, актуальные осенние
// ассеты генерирует scripts/make-community-assets.mjs --season autumn).
/* global console */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderHtmlToPng, ROOT } from './lib/media.mjs';

const OUT = join(ROOT, 'store', 'community');
const iconGame = readFileSync(join(ROOT, 'icons', 'icon-512.png')).toString('base64');

// Детерминированные «листья» (эмодзи), падающие по кадру
function leaves(n = 16, seed = 42) {
  const emojis = ['🍁', '🍂', '🍃'];
  let out = '';
  for (let i = 0; i < n; i++) {
    const x = ((seed * 31 + i * 47) % 100) / 100;
    const y = ((seed * 17 + i * 23) % 100) / 100;
    const s = 28 + ((seed * 7 + i * 13) % 46);
    const o = 0.35 + ((seed * 5 + i * 9) % 50) / 100;
    const emoji = emojis[(seed + i) % emojis.length];
    out += `<div style="position:absolute;left:${(x * 1080).toFixed(0)}px;top:${(y * 1080).toFixed(0)}px;font-size:${s}px;opacity:${o.toFixed(2)};transform:rotate(${(seed + i) * 23 % 180 - 90}deg);z-index:1">${emoji}</div>`;
  }
  return out;
}

const html = `<!doctype html><html lang="ru"><head><meta charset="utf-8"><style>
  *{margin:0;padding:0;box-sizing:border-box}
  html,body{width:1080px;height:1080px;overflow:hidden;font-family:'Segoe UI',Roboto,Arial,sans-serif}
  body{
    background:
      radial-gradient(120% 90% at 50% -10%, rgba(255,201,60,.4), transparent 55%),
      radial-gradient(90% 60% at 12% 88%, rgba(255,140,0,.25), transparent 60%),
      radial-gradient(120% 100% at 85% 70%, rgba(180,80,20,.4), transparent 62%),
      linear-gradient(180deg,#5a2a0e 0%,#8a4a1a 38%,#c26a24 66%,#7a3412 100%);
    color:#fff;position:relative;
  }
  .glow{position:absolute;right:-160px;top:-160px;width:640px;height:640px;border-radius:50%;
    background:radial-gradient(circle,rgba(255,220,120,.4),transparent 60%);z-index:1}
  .accent{position:absolute;left:0;bottom:0;height:14px;width:100%;
    background:linear-gradient(90deg,#ffc93c,#ff9d2e);z-index:5}
  .brand{position:absolute;left:44px;bottom:36px;display:flex;align-items:center;gap:14px;z-index:6}
  .brand .logo{width:56px;height:56px;border-radius:14px;background:linear-gradient(135deg,#c26a24,#5a2a0e);
    border:3px solid #ffc93c;display:flex;align-items:center;justify-content:center;
    font-weight:900;font-size:22px;color:#ffc93c}
  .brand .nm{font-size:20px;font-weight:700;letter-spacing:5px;color:#ffe9d0}
  .brand .nm small{display:block;font-size:13px;font-weight:400;letter-spacing:2px;color:#f3c8a0;margin-top:2px}
  .main{position:absolute;left:70px;right:70px;top:84px;z-index:4;text-align:center}
  .kicker{display:inline-flex;align-items:center;gap:10px;font-size:25px;letter-spacing:8px;
    color:#fff0d8;text-transform:uppercase;margin-bottom:20px;
    background:rgba(60,20,0,.5);border:2px solid rgba(255,201,60,.7);border-radius:999px;padding:12px 26px}
  .title{font-size:100px;font-weight:900;line-height:1.02;letter-spacing:1px;color:#fff;
    text-shadow:0 6px 0 rgba(0,0,0,.25),0 12px 36px rgba(0,0,0,.5)}
  .title .accent-text{background:linear-gradient(90deg,#ffd24a,#ff9d2e);-webkit-background-clip:text;background-clip:text;color:transparent}
  .sub{font-size:38px;color:#fff3e2;margin-top:24px;font-weight:600;line-height:1.35;max-width:900px;margin-left:auto;margin-right:auto;
    text-shadow:0 2px 12px rgba(0,0,0,.5)}
  .art{position:absolute;left:50%;top:58%;transform:translate(-50%,-50%);width:380px;height:380px;
    border-radius:64px;box-shadow:0 36px 90px rgba(0,0,0,.6);z-index:3;
    border:6px solid rgba(255,201,60,.55)}
  .vote{position:absolute;left:0;right:0;bottom:140px;z-index:5;text-align:center}
  .vote a{display:inline-flex;align-items:center;gap:14px;
    background:linear-gradient(180deg,#ffe27a,#ffc93c);color:#4a1c00;font-size:36px;font-weight:800;
    padding:24px 52px;border-radius:999px;box-shadow:0 16px 44px rgba(0,0,0,.55);text-decoration:none}
</style></head><body>
  <div class="glow"></div>
  ${leaves()}
  <div class="main">
    <div class="kicker">🍁 Осеннее обновление</div>
    <div class="title">Океан 2048</div>
    <div class="sub">Выбираем <b>музыку для игры</b> вместе! Слушай треки и голосуй 🎻</div>
  </div>
  <img class="art" src="data:image/png;base64,${iconGame}" alt="Океан 2048"/>
  <div class="vote"><a href="#">🎶 Голосовать</a></div>
  <div class="brand"><div class="logo">5M</div><div class="nm">5MB2 Digital<small>студия · SaaS · игры</small></div></div>
  <div class="accent"></div>
</body></html>`;

await renderHtmlToPng({ html, width: 1080, height: 1080, outPath: join(OUT, 'autumn-vote-1080x1080.png'), waitMs: 400 });
console.log('✓ Готово: store/community/autumn-vote-1080x1080.png');
