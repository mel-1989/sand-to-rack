// The course map: docs/index.html. Chapters without a built page show as "coming".
// node site/index.mjs
import { existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { CHAPTERS, PARTS } from "./chapters.mjs";
import { DOCS, SHELL_CSS, SITE, THEME_BOOT, pageShell, homeHtml, toggleHtml, footHtml } from "./shell.mjs";

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const pad = (n) => String(n).padStart(2, "0");

const CSS = `
.ix-hero{margin:24px 0 72px;max-width:62ch;font-family:var(--cp-sans)}
.ix-hero .cp-kicker{font:500 11px/1.3 var(--cp-mono);letter-spacing:.08em;text-transform:uppercase;color:var(--cp-muted);margin:0 0 14px}
.ix-hero h1{margin:0;font:600 44px/1.06 var(--cp-sans);letter-spacing:-.025em;color:var(--anatomy-strong);text-wrap:balance}
.ix-hero p{margin:18px 0 0;font-size:17px;line-height:1.65;text-wrap:pretty}
.ix-flow{display:flex;flex-wrap:wrap;gap:4px 8px;margin:26px 0 0;padding:0;list-style:none;font:500 11px/1.3 var(--cp-mono);letter-spacing:.06em;text-transform:uppercase;color:var(--cp-muted)}
.ix-flow a{display:inline-flex;align-items:center;min-height:32px;padding:0 10px;border-radius:999px;border:1px solid var(--anatomy-faint);color:inherit;text-decoration:none;transition:color .2s ease,border-color .2s ease}
.ix-flow a:hover{color:var(--anatomy-strong);border-color:var(--anatomy-lo)}
.ix-part{display:grid;grid-template-columns:210px 1fr;gap:28px;padding:36px 0;border-top:1px solid var(--anatomy-faint);font-family:var(--cp-sans)}
.ix-part header{position:sticky;top:84px;align-self:start}
.ix-part .ix-n{font:500 11px/1.3 var(--cp-mono);letter-spacing:.08em;text-transform:uppercase;color:var(--cp-muted)}
.ix-part h2{margin:8px 0 8px;font:600 20px/1.25 var(--cp-sans);letter-spacing:-.01em;color:var(--anatomy-strong);text-wrap:balance}
.ix-part p{margin:0;font-size:14px;line-height:1.6;text-wrap:pretty}
.ix-cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:14px}
.ix-card{display:flex;flex-direction:column;border-radius:14px;overflow:hidden;text-decoration:none;color:var(--anatomy-text);background:var(--anatomy-card);box-shadow:var(--anatomy-lift);transition:background-color .25s ease,color .25s ease}
a.ix-card:hover{color:var(--anatomy-strong);background:var(--anatomy-face)}
.ix-thumb{aspect-ratio:5/4;max-width:100%;background:var(--anatomy-paper);display:grid;place-items:center;overflow:hidden}
.ix-thumb img{width:100%;height:100%;object-fit:cover;object-position:50% 45%;transition:transform .6s var(--cp-ease)}
a.ix-card:hover .ix-thumb img{transform:scale(1.035)}
.ix-thumb img[data-theme-img="light"]{display:none}
body[data-theme="light"] .ix-thumb img[data-theme-img="light"]{display:block}
body[data-theme="light"] .ix-thumb img[data-theme-img="dark"]{display:none}
.ix-thumb span{font:500 10.5px/1 var(--cp-mono);letter-spacing:.08em;text-transform:uppercase;color:var(--cp-muted)}
.ix-meta{padding:13px 15px 15px}
.ix-meta small{display:block;font:500 10.5px/1.3 var(--cp-mono);letter-spacing:.06em;text-transform:uppercase;color:var(--cp-muted);margin-bottom:6px}
.ix-meta b{display:block;font-weight:600;font-size:15px;line-height:1.35;color:var(--anatomy-strong)}
.ix-meta em{display:block;font-style:normal;font-size:13px;line-height:1.45;margin-top:4px}
.ix-soon{opacity:.55}
.ix-note{margin:48px 0 0;max-width:66ch;font:13px/1.6 var(--cp-sans);color:var(--cp-muted)}
@media (max-width:720px){.ix-hero h1{font-size:32px}.ix-hero p{font-size:16px}.ix-part{grid-template-columns:1fr;gap:18px}.ix-part header{position:static}}
@media (prefers-reduced-motion:reduce){.ix-thumb img{transition:none}a.ix-card:hover .ix-thumb img{transform:none}}
`;

function card(c) {
  const i = CHAPTERS.indexOf(c);
  const built = existsSync(join(DOCS, `${c.slug}.html`));
  const thumb = (theme) => existsSync(join(DOCS, "thumbs", `${c.slug}-${theme}.png`)) ? `<img src="thumbs/${c.slug}-${theme}.png" alt="" loading="lazy" data-theme-img="${theme}">` : "";
  const art = thumb("dark") + thumb("light") || `<span>${built ? "figure" : "coming"}</span>`;
  const inner = `<div class="ix-thumb">${art}</div><div class="ix-meta"><small>${pad(i + 1)}</small><b>${esc(c.title)}</b><em>${esc(c.machine)}</em></div>`;
  return built ? `<a class="ix-card" href="${c.slug}.html">${inner}</a>` : `<div class="ix-card ix-soon">${inner}</div>`;
}

const flow = `<ol class="ix-flow">${PARTS.map((p) => `<li><a href="#${p.id}">${p.n} ${esc(p.title.split(":")[0])}</a></li>`).join("")}</ol>`;
const hero = `<header class="ix-hero" id="top"><p class="cp-kicker">An interactive course in ${CHAPTERS.length} machines</p><h1>How an AI chip is made, from sand to rack</h1><p>Every chapter is a working drawing of the machine that does one stage of the job. Take it apart, pick a part to read its numbers, and drag the slider to watch the stage happen. The last two parts follow the chip through its generations and out to the frontier.</p>${flow}</header>`;
const parts = PARTS.map((p) => `<section class="ix-part cp-rv" id="${p.id}"><header><div class="ix-n">Part ${p.n}</div><h2>${esc(p.title)}</h2><p>${esc(p.blurb)}</p></header><div class="ix-cards">${CHAPTERS.filter((c) => c.part === p.id).map(card).join("")}</div></section>`).join("");
const bar = `<nav class="cp-bar" aria-label="Course">${homeHtml()}<span class="cp-where">${CHAPTERS.length} chapters · ${PARTS.length} parts</span>${toggleHtml}</nav>`;
const note = `<p class="ix-note cp-rv">Heights and some layouts are exaggerated or illustrative so thin layers stay visible; each chapter says which. Numbers carry their sources at the foot of each chapter.</p>`;

const description = `An interactive course in ${CHAPTERS.length} machines: how an AI chip is made, from sand to rack, through its generations and out to the frontier.`;
const html = pageShell({ title: `${SITE}: how an AI chip is made`, description, body: `${THEME_BOOT}<style>${SHELL_CSS}${CSS}</style>${bar}${hero}${parts}${note}${footHtml}`, width: 1080 });
writeFileSync(join(DOCS, "index.html"), html);
console.log("wrote docs/index.html", `${CHAPTERS.filter((c) => existsSync(join(DOCS, `${c.slug}.html`))).length}/${CHAPTERS.length} chapters built`);
