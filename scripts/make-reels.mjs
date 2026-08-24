// Генерация серии вертикальных роликов 9:16 (VK Клипы / Reels / Shorts).
// Каждая сцена — анимированный HTML (фото-гибрид: CSS-подводный фон + пузырьки,
// типографика, CTA) → Playwright recordVideo → ffmpeg MP4 (+ GIF-превью).
// Сценарии (см. plans/MONETIZATION_CONTENT.md §4 Reels):
//   1. game — «как играть» / тизер механики
//   2. depths — «7 глубин океана» (факты, список)
//   3. tips — советы и секреты игрокам (список)
//   4. meme — юмор про 2048
//   5. news — анонсы обновлений
// Запуск:  node scripts/make-reels.mjs [секунды]   (по умолчанию 15)
// Выход:   store/media/reels/reel-<id>.mp4 (1080×1920, 30fps) + reel-<id>-preview.gif
/* global console, process */
import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import { recordHtmlVideo, toMp4, toGif, MEDIA_DIR, ROOT } from './lib/media.mjs';

const icon = readFileSync(join(ROOT, 'icons', 'icon-512.png')).toString('base64');

// ---------- Палитра бренда ----------
const ACCENT = {
  game: '#ffc93c',      // янтарный — Океан 2048
  studio: '#76b900',    // зелёный — 5MB2
  neobrain: '#818cf8',  // индиго — NeoBrain
  ocean: '#22d3ee',     // бирюза — экосистема
};

// ---------- Сценарии ----------
const SCENES = [
  {
    id: 'game',
    accent: 'game',
    kicker: 'Океан 2048',
    title: '2048 в подводном мире',
    sub: 'Соединяй плитки · Исследуй 7 глубин',
    cta: '🌊 Играть бесплатно',
    bullets: null,
  },
  {
    id: 'depths',
    accent: 'ocean',
    kicker: '7 глубин океана',
    title: 'От Ракушки до Хозяина Моря',
    sub: 'Каждая глубина — новый вызов',
    cta: '🌊 Начать погружение',
    bullets: [
      '🪸 4×4 — старт у рифа',
      '🦀 5×5 — Краб уже ждёт',
      '🦈 6×6 — Акула не прощает',
    ],
  },
  {
    id: 'tips',
    accent: 'neobrain',
    kicker: 'Советы профи',
    title: 'Как дойти до 2048',
    sub: '3 правила, которые меняют игру',
    cta: '🌊 Проверить на практике',
    bullets: [
      '↔️ Держи крупные плитки в одном углу',
      '⬆️ Свайпай вверх — и только вверх',
      '🧠 Не делай «пустых» ходов',
    ],
  },
  {
    id: 'meme',
    accent: 'game',
    kicker: 'Мем про 2048',
    title: 'Доска забилась?',
    sub: 'Бывает. Главное — не свайпай хаотично 😄',
    cta: '🌊 Реши сам',
    bullets: null,
  },
  {
    id: 'news',
    accent: 'ocean',
    kicker: 'Что нового',
    title: 'Обновление уже здесь',
    sub: 'Бусты, скины и ежедневные награды',
    cta: '🌊 Играть сейчас',
    bullets: [
      '🎁 Ежедневный бонус',
      '🧩 Ежедневные задания',
      '👑 Новые глубины',
    ],
  },
];

// ---------- Сцена (HTML) ----------
function sceneHtml(s) {
  const a = ACCENT[s.accent] || ACCENT.game;
  const bullets = (s.bullets || [])
    .map((b, i) => `<div class="li" style="animation-delay:${0.8 + i * 0.9}s">${b}</div>`)
    .join('');
  return `<!doctype html>
<html lang="ru"><head><meta charset="utf-8"><style>
  * { margin:0; padding:0; box-sizing:border-box; }
  html,body { width:1080px; height:1920px; overflow:hidden;
    font-family:'Segoe UI', Roboto, Arial, sans-serif; }
  body {
    /* фото-гибрид: свет из глубины + блики (без внешних запросов) */
    background:
      radial-gradient(1400px 1000px at 22% -12%, rgba(34,211,238,.55), transparent 55%),
      radial-gradient(1000px 800px at 88% 16%, rgba(255,201,60,.20), transparent 55%),
      radial-gradient(1200px 900px at 50% 115%, rgba(20,85,138,.9), transparent 62%),
      linear-gradient(180deg,#062b45 0%,#0a3a5e 40%,#0c4a6e 66%,#071827 100%);
    color:#fff; position:relative; }
  .wrap { position:relative; width:100%; height:100%; display:flex; flex-direction:column;
    align-items:center; justify-content:center; text-align:center; padding:0 90px; }
  .kicker { display:inline-flex; align-items:center; gap:10px; font-size:34px; font-weight:700;
    letter-spacing:6px; text-transform:uppercase; color:#bfe9f5;
    background:rgba(7,24,39,.55); border:2px solid rgba(34,211,238,.45);
    border-radius:999px; padding:14px 30px; margin-bottom:44px; animation:fadeIn 1s ease both; }
  .icon { width:230px; height:230px; border-radius:56px; box-shadow:0 24px 60px rgba(0,0,0,.55);
    margin-bottom:44px; animation: bob 3s ease-in-out infinite, fadeIn 1s ease both; }
  h1 { font-size:120px; font-weight:900; line-height:1.02; color:#fff;
    text-shadow:0 7px 0 rgba(0,0,0,.35), 0 16px 48px rgba(0,0,0,.6);
    animation:fadeInUp .9s ease .15s both; }
  .sub { margin-top:30px; font-size:46px; font-weight:600; color:#e6f4fb;
    text-shadow:0 3px 14px rgba(0,0,0,.6); animation:fadeInUp .9s ease .3s both; }
  .sub b, .sub .hl { color:#ffd24a; }
  .list { margin-top:54px; display:flex; flex-direction:column; gap:26px; align-items:stretch; }
  .li { font-size:42px; font-weight:700; color:#fff;
    background:rgba(7,24,39,.55); border:2px solid ${a}66; border-radius:26px;
    padding:30px 36px; text-shadow:0 2px 10px rgba(0,0,0,.5);
    opacity:0; animation:fadeInUp .8s ease both; }
  .cta { margin-top:${s.bullets ? 64 : 88}px; font-size:50px; font-weight:800; color:#0f2233;
    background:linear-gradient(180deg,#ffe27a,#ffc93c); padding:30px 74px; border-radius:999px;
    box-shadow:0 18px 44px rgba(0,0,0,.45);
    animation:pulse 2s ease-in-out .8s infinite, fadeInUp .9s ease .5s both; }
  /* пузырьки поднимаются снизу вверх */
  .b { position:absolute; bottom:-80px; border-radius:50%;
    background:radial-gradient(circle at 30% 30%, rgba(255,255,255,.55), rgba(255,255,255,.06) 70%);
    animation: rise linear infinite; }
  @keyframes bob { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-18px)} }
  @keyframes pulse { 0%,100%{transform:scale(1)} 50%{transform:scale(1.05)} }
  @keyframes rise { 0%{transform:translateY(0)} 100%{transform:translateY(-2150px)} }
  @keyframes fadeIn { from{opacity:0} to{opacity:1} }
  @keyframes fadeInUp { from{opacity:0; transform:translateY(40px)} to{opacity:1; transform:translateY(0)} }
</style></head><body>
  <div class="b" style="left:8%;  width:60px; height:60px; animation-duration:7s;"></div>
  <div class="b" style="left:22%; width:34px; height:34px; animation-duration:5s;"></div>
  <div class="b" style="left:45%; width:80px; height:80px; animation-duration:9s;"></div>
  <div class="b" style="left:63%; width:42px; height:42px; animation-duration:6s;"></div>
  <div class="b" style="left:82%; width:56px; height:56px; animation-duration:8s;"></div>
  <div class="b" style="left:91%; width:28px; height:28px; animation-duration:4.5s;"></div>
  <div class="wrap">
    <div class="kicker">${s.kicker}</div>
    <img class="icon" src="data:image/png;base64,${icon}" alt=""/>
    <h1>${s.title}</h1>
    <div class="sub">${s.sub}</div>
    ${s.bullets ? `<div class="list">${bullets}</div>` : ''}
    <div class="cta">${s.cta}</div>
  </div>
</body></html>`;
}

const outDir = join(MEDIA_DIR, 'reels');

async function main() {
  const seconds = Number(process.argv[2] || 15);
  console.log(`Серия reels (${SCENES.length} шт., 1080×1920, ${seconds}с) →`, outDir);
  for (const s of SCENES) {
    console.log(`\n── ${s.id}: «${s.title}»`);
    const webm = await recordHtmlVideo({
      html: sceneHtml(s),
      width: 1080,
      height: 1920,
      outDir,
      seconds,
    });
    const mp4 = toMp4(webm, join(outDir, `reel-${s.id}.mp4`), { fps: 30, crf: 22, scale: '1080:1920' });
    const gif = toGif(webm, join(outDir, `reel-${s.id}-preview.gif`), { seconds: 5, fps: 12, scale: '360:-1' });
    console.log('  MP4:', mp4 ? 'OK' : 'FAIL', '| GIF:', gif ? 'OK' : 'FAIL');
  }
  console.log('\nГотово. Файлы в', outDir);
}

main().catch((e) => { console.error('Ошибка:', e.message); process.exit(1); });
