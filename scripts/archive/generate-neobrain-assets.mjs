// generate-neobrain-assets.mjs
// Генерация фирменных ассетов neobrain в дизайн-системе сайта:
//   og-neobrain.png (1200x630) — OG/логотип-баннер
//   ill-home.png    (720x480)  — иллюстрация на главную (SEO-дашборд)
//   ill-uslugi.png  (720x480)  — иллюстрация для uslugi (рост позиций)
//   ill-plans.png   (720x480)  — иллюстрация для plans (3 тарифа)
// Способ: HTML+CSS -> скриншот Chrome headless (CDP заблокирован политикой).
// Никакого просмотра изображений: только вёрстка и скриншот браузером.
/* global console, process */
import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, "neobrain");
mkdirSync(OUT, { recursive: true });

const CHROME_CANDIDATES = [
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
];
const chromePath = CHROME_CANDIDATES.find((c) => existsSync(c));
if (!chromePath) {
  console.error("Chrome/Edge не найден");
  process.exit(1);
}
console.log("Browser:", chromePath);

// Общие стили тёмной темы neobrain (из style.css)
const base = (w, h) => `
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:${w}px;height:${h}px;overflow:hidden}
body{
  font-family:"Inter","Segoe UI",Arial,sans-serif;
  background:
    radial-gradient(1000px 560px at 12% -10%,rgba(129,140,248,.30),transparent 55%),
    radial-gradient(800px 480px at 95% -4%,rgba(99,102,241,.22),transparent 50%),
    linear-gradient(rgba(129,140,248,.14) 1px,transparent 1px) 0 0/44px 44px,
    linear-gradient(90deg,rgba(129,140,248,.14) 1px,transparent 1px) 0 0/44px 44px,
    #09090b;
  color:#fafafa;position:relative;
}
.grad-text{background:linear-gradient(90deg,#818cf8,#6366f1,#22d3ee);
  -webkit-background-clip:text;background-clip:text;color:transparent}
`;

// ---------- 1. OG-баннер 1200x630 ----------
const ogHtml = `<!doctype html><html><head><meta charset="utf-8"><style>${base(1200, 630)}
  .wrap{position:absolute;inset:0;padding:70px 84px;display:flex;flex-direction:column;justify-content:center}
  .label{font-size:22px;letter-spacing:8px;color:#a1a1aa;text-transform:uppercase;margin-bottom:18px}
  .title{font-size:118px;font-weight:900;line-height:1.02;letter-spacing:2px}
  .sub{font-size:30px;color:#a1a1aa;margin-top:22px;font-weight:500}
  .sub b{color:#e2e8f0}
  .site{margin-top:38px;display:inline-flex;align-items:center;gap:14px;
    background:linear-gradient(90deg,#818cf8,#6366f1,#22d3ee);color:#fff;
    font-size:26px;font-weight:800;padding:16px 30px;border-radius:14px;width:fit-content;
    box-shadow:0 8px 40px rgba(129,140,248,.45)}
  .glow{position:absolute;right:-120px;top:-120px;width:520px;height:520px;border-radius:50%;
    background:radial-gradient(circle,rgba(34,211,238,.35),transparent 60%)}
  .accent{position:absolute;left:0;bottom:0;height:12px;width:100%;
    background:linear-gradient(90deg,#818cf8,#6366f1,#22d3ee)}
</style></head><body>
  <div class="glow"></div>
  <div class="wrap">
    <div class="label">5MB2&nbsp;Digital&nbsp;·&nbsp;SaaS&nbsp;платформа</div>
    <div class="title grad-text">NeoBrain</div>
    <div class="sub"><b>ИИ-агент</b> вносит правки и выкладывает сайт за минуты · <b>деплой</b> · <b>SEO</b> · <b>обучение</b></div>
    <div class="site">neobrain.site &nbsp;→</div>
  </div>
  <div class="accent"></div>
</body></html>`;

// ---------- 2. ill-home: SEO-дашборд ----------
const homeHtml = `<!doctype html><html><head><meta charset="utf-8"><style>${base(720, 480)}
  .panel{position:absolute;left:64px;top:60px;width:592px;background:#18181b;border:1px solid #27272a;
    border-radius:18px;overflow:hidden;box-shadow:0 24px 70px rgba(129,140,248,.25)}
  .bar{display:flex;justify-content:space-between;align-items:center;padding:14px 20px;
    background:rgba(129,140,248,.16);border-bottom:1px solid #27272a;font-weight:800;font-size:15px}
  .bar .on{font-size:12px;color:#4ade80}
  .body{padding:20px;display:flex;gap:18px}
  .col{flex:1}
  .check{display:flex;align-items:center;gap:10px;padding:9px 12px;background:#111113;border:1px solid #27272a;
    border-radius:10px;margin-bottom:10px;font-size:13px;color:#e2e8f0}
  .check i{width:16px;height:16px;border-radius:4px;flex:none;
    background:linear-gradient(135deg,#818cf8,#22d3ee)}
  .graph{margin-top:6px;height:150px;display:flex;align-items:flex-end;gap:10px}
  .g{flex:1;border-radius:6px 6px 0 0;
    background:linear-gradient(180deg,#22d3ee,#818cf8)}
</style></head><body>
  <div class="panel">
    <div class="bar"><span>🔍 SEO-аудит · NeoBrain</span><span class="on">● готово</span></div>
    <div class="body">
      <div class="col">
        <div class="check"><i></i>Title и description</div>
        <div class="check"><i></i>UTM-метки</div>
        <div class="check"><i></i>Open Graph</div>
        <div class="check"><i></i>Sitemap и robots</div>
      </div>
      <div class="col">
        <div class="graph">
          <div class="g" style="height:28%"></div>
          <div class="g" style="height:46%"></div>
          <div class="g" style="height:38%"></div>
          <div class="g" style="height:64%"></div>
          <div class="g" style="height:56%"></div>
          <div class="g" style="height:84%"></div>
          <div class="g" style="height:100%"></div>
        </div>
      </div>
    </div>
  </div>
</body></html>`;

// ---------- 3. ill-uslugi: рост позиций ----------
const uslugiHtml = `<!doctype html><html><head><meta charset="utf-8"><style>${base(720, 480)}
  .card{position:absolute;left:64px;top:52px;width:592px;background:#18181b;border:1px solid #27272a;
    border-radius:18px;padding:24px;box-shadow:0 24px 70px rgba(99,102,241,.25)}
  .t{font-size:20px;font-weight:800;display:flex;justify-content:space-between;align-items:center}
  .t .up{font-size:15px;color:#4ade80}
  .line{position:relative;height:220px;margin-top:18px;border-bottom:1px solid #27272a;
    background-image:linear-gradient(rgba(129,140,248,.1) 1px,transparent 1px);
    background-size:100% 44px}
  svg{position:absolute;inset:0;width:100%;height:100%}
  .tick{font-size:11px;color:#71717a;position:absolute;bottom:-22px;transform:translateX(-50%)}
</style></head><body>
  <div class="card">
    <div class="t"><span>📈 Продвижение под ключ</span><span class="up">▲ +180% трафика</span></div>
    <div class="line">
      <svg viewBox="0 0 544 220" preserveAspectRatio="none">
        <defs><linearGradient id="gr" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stop-color="#818cf8"/><stop offset="1" stop-color="#22d3ee"/>
        </linearGradient></defs>
        <polygon points="0,200 70,180 140,150 210,130 280,95 350,80 420,45 490,30 544,12 544,220 0,220"
          fill="url(#gr)" opacity="0.22"/>
        <polyline points="0,200 70,180 140,150 210,130 280,95 350,80 420,45 490,30 544,12"
          fill="none" stroke="url(#gr)" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
      <span class="tick" style="left:6%">Ноя</span><span class="tick" style="left:33%">Янв</span>
      <span class="tick" style="left:64%">Мар</span><span class="tick" style="left:92%">Май</span>
    </div>
  </div>
</body></html>`;

// ---------- 4. ill-plans: 3 тарифа ----------
const plansHtml = `<!doctype html><html><head><meta charset="utf-8"><style>${base(720, 480)}
  .cards{position:absolute;left:34px;top:52px;display:flex;gap:16px}
  .card{width:196px;background:#18181b;border:1px solid #27272a;border-radius:16px;padding:20px;
    text-align:center;box-shadow:0 16px 50px rgba(129,140,248,.15)}
  .card.hot{background:linear-gradient(160deg,#1b1b22,#18181b);
    border:1px solid #6366f1;box-shadow:0 16px 60px rgba(99,102,241,.4)}
  .n{font-size:15px;font-weight:800;letter-spacing:1px;text-transform:uppercase}
  .p{font-size:30px;font-weight:900;margin:10px 0 16px}
  .p small{font-size:12px;color:#a1a1aa;font-weight:500}
  .tag{font-size:12px;color:#a1a1aa;line-height:1.6}
  .btn{margin-top:16px;font-size:13px;font-weight:800;padding:10px 0;border-radius:10px;color:#fff;
    background:linear-gradient(90deg,#818cf8,#6366f1,#22d3ee)}
  .free{color:#a1a1aa}
</style></head><body>
  <div class="cards">
    <div class="card"><div class="n free">Free</div><div class="p free">0 ₽</div>
      <div class="tag">до 50 задач<br>попробовать</div><div class="btn">Начать</div></div>
    <div class="card hot"><div class="n">Starter</div><div class="p">490 ₽<small> /30д</small></div>
      <div class="tag">до 200 задач<br>регулярная работа</div><div class="btn">Оплатить</div></div>
    <div class="card"><div class="n">Pro</div><div class="p">1490 ₽<small> /30д</small></div>
      <div class="tag">до 1000 задач<br>сложные правки</div><div class="btn">Оплатить</div></div>
  </div>
</body></html>`;

const assets = [
  { file: "og-neobrain.png", w: 1200, h: 630, html: ogHtml },
  { file: "ill-home.png", w: 720, h: 480, html: homeHtml },
  { file: "ill-uslugi.png", w: 720, h: 480, html: uslugiHtml },
  { file: "ill-plans.png", w: 720, h: 480, html: plansHtml },
];

for (const a of assets) {
  const htmlPath = path.join(OUT, a.file.replace(".png", ".html"));
  const pngPath = path.join(OUT, a.file);
  writeFileSync(htmlPath, a.html, "utf8");
  const fileUrl = "file:///" + htmlPath.replace(/\\/g, "/");
  const args = [
    "--headless",
    "--disable-gpu",
    "--hide-scrollbars",
    `--screenshot=${pngPath}`,
    `--window-size=${a.w},${a.h}`,
    fileUrl,
  ];
  execFileSync(chromePath, args, { stdio: "ignore" });
  console.log("OK", a.file, `(${a.w}x${a.h})`);
}
console.log("DONE");
