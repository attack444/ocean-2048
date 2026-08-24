// generate-covers.mjs
// Генерация стилизованных обложек 1200x630 для игр 5mb2 (промо будущего релиза).
/* global console, process */
// Способ: сохраняем HTML на диск и делаем скриншот через Chrome CLI
//   --headless --screenshot (НЕ через playwright: remote-debugging заблокирован политикой Windows).
// Никакого просмотра изображений: только HTML/CSS + скриншот браузером.
import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, "covers");
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

const GAMES = [
  {
    slug: "pixel-quest",
    title: "PIXEL QUEST",
    tagline: "Ретро-платформер: собери монеты, добеги до флага",
    accent: "#76b900",
    motif: "pixel",
  },
  {
    slug: "neon-racer",
    title: "NEON RACER",
    tagline: "Синтвейв-гонки по неоновым трассам",
    accent: "#b6f000",
    motif: "synthwave",
  },
  {
    slug: "cube-lab",
    title: "CUBE LAB",
    tagline: "Головоломки с кубами и физикой",
    accent: "#38bdf8",
    motif: "cubes",
  },
];

const style = (g) => {
  const a = g.accent;
  return `
  *{margin:0;padding:0;box-sizing:border-box}
  html,body{width:1200px;height:630px;overflow:hidden}
  body{
    font-family:"Segoe UI",Arial,sans-serif;
    background:radial-gradient(circle at 30% 20%, ${a}44, transparent 55%),
               linear-gradient(135deg,#0a100c 0%,#060806 100%);
    color:#fff;position:relative;
  }
  .grain{position:absolute;inset:0;opacity:.25;
    background-image:repeating-linear-gradient(45deg,${a}22 0 2px,transparent 2px 14px)}
  .title{position:absolute;left:90px;top:200px;font-size:96px;font-weight:900;
    letter-spacing:2px;text-transform:uppercase;
    text-shadow:0 0 24px ${a},0 0 60px ${a}66;z-index:5}
  .tagline{position:absolute;left:92px;top:320px;font-size:26px;color:#cfd8cc;max-width:760px;z-index:5}
  .brand{position:absolute;left:92px;bottom:36px;font-size:22px;font-weight:700;letter-spacing:6px;
    color:${a};opacity:.9;z-index:5}
  .brand small{display:block;font-size:13px;font-weight:400;letter-spacing:3px;color:#7d8a77;margin-top:4px}
`;
};

const motifHtml = (m, a) => {
  const glow = `box-shadow:0 0 30px ${a}`;
  if (m === "pixel") {
    const blocks = [
      { w: 110, h: 110, x: 880, y: 150 },
      { w: 90, h: 90, x: 1010, y: 300 },
      { w: 130, h: 130, x: 920, y: 420 },
    ];
    return blocks
      .map(
        (b) =>
          `<div style="position:absolute;left:${b.x}px;top:${b.y}px;width:${b.w}px;height:${b.h}px;background:${a}55;border:3px solid ${a};transform:rotate(8deg);${glow}"></div>`
      )
      .join("");
  }
  if (m === "synthwave") {
    let grid = "";
    for (let i = 0; i < 14; i++) {
      const y = 420 + i * 18;
      const w = 200 + i * 95;
      grid += `<div style="position:absolute;left:50%;top:${y}px;width:${w}px;height:2px;transform:translateX(-50%);background:${a};opacity:${(0.9 - i * 0.05).toFixed(2)};${glow}"></div>`;
    }
    const sun = `<div style="position:absolute;left:820px;top:120px;width:180px;height:180px;border-radius:50%;background:${a}33;border:4px solid ${a};${glow}"></div>`;
    return grid + sun;
  }
  const cube = (x, y, s, o) =>
    `<div style="position:absolute;left:${x}px;top:${y}px;width:${s}px;height:${s}px;background:linear-gradient(135deg,${a}66,${a}22);border:3px solid ${a};transform:rotate(45deg) skew(-8deg,-8deg);opacity:${o};${glow}"></div>`;
  return (
    cube(930, 150, 130, 0.95) + cube(1040, 290, 90, 0.75) + cube(900, 380, 110, 0.85)
  );
};

const htmlFor = (g) => `<!doctype html><html><head><meta charset="utf-8"><style>${style(g)}</style></head>
<body>
  <div class="grain"></div>
  ${motifHtml(g.motif, g.accent)}
  <div class="title">${g.title}</div>
  <div class="tagline">${g.tagline}</div>
  <div class="brand">5MB2<small>GAMES STUDIO</small></div>
</body></html>`;

for (const g of GAMES) {
  const htmlPath = path.join(OUT, `${g.slug}.html`);
  const pngPath = path.join(OUT, `${g.slug}.png`);
  writeFileSync(htmlPath, htmlFor(g), "utf8");

  const fileUrl = "file:///" + htmlPath.replace(/\\/g, "/");
  const args = [
    "--headless",
    "--disable-gpu",
    "--hide-scrollbars",
    `--screenshot=${pngPath}`,
    "--window-size=1200,630",
    fileUrl,
  ];
  execFileSync(chromePath, args, { stdio: "ignore" });
  console.log("OK", g.slug, "->", pngPath);
}
console.log("DONE");
