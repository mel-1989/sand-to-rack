// The course map: docs/index.html. Chapters without a built page show as "coming".
// node site/index.mjs
import { existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { k } from "./kit.mjs";
import { CHAPTERS, PARTS } from "./chapters.mjs";
import { DOCS, SHELL_CSS } from "./shell.mjs";

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const pad = (n) => String(n).padStart(2, "0");

const CSS = `
.ix-hero{margin:0 0 56px;max-width:60ch}
.ix-hero .cp-kicker{font:11px/1.3 var(--anatomy-mono);letter-spacing:.08em;text-transform:uppercase;color:var(--anatomy-muted);margin:0 0 12px}
.ix-hero h1{margin:0;font:600 40px/1.08 ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif;letter-spacing:-.02em;color:var(--anatomy-strong);text-wrap:balance}
.ix-hero p{margin:16px 0 0;font-size:16px;line-height:1.6}
.ix-flow{display:flex;flex-wrap:wrap;gap:6px 10px;margin:22px 0 0;padding:0;list-style:none;font:11px/1.3 var(--anatomy-mono);letter-spacing:.06em;text-transform:uppercase;color:var(--anatomy-muted)}
.ix-flow a{color:inherit;text-decoration:none}
.ix-flow a:hover{color:var(--anatomy-strong)}
.ix-flow li+li::before{content:"→";margin-right:10px;color:var(--anatomy-lo)}
.ix-part{display:grid;grid-template-columns:200px 1fr;gap:24px;padding:30px 0;border-top:1px solid var(--anatomy-faint)}
.ix-part header{position:sticky;top:20px;align-self:start}
.ix-part .ix-n{font:11px/1.3 var(--anatomy-mono);letter-spacing:.08em;text-transform:uppercase;color:var(--anatomy-muted)}
.ix-part h2{margin:6px 0 8px;font:600 19px/1.25 ui-sans-serif,system-ui,sans-serif;color:var(--anatomy-strong);text-wrap:balance}
.ix-part p{margin:0;font-size:13.5px;line-height:1.55}
.ix-cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:12px}
.ix-card{display:flex;flex-direction:column;border-radius:12px;overflow:hidden;text-decoration:none;color:var(--anatomy-text);background:var(--anatomy-card);box-shadow:var(--anatomy-lift);transition:transform .2s var(--anatomy-ease)}
a.ix-card:hover,a.ix-card:focus-visible{transform:translateY(-2px);color:var(--anatomy-strong);outline:none}
.ix-thumb{aspect-ratio:5/4;max-width:100%;background:var(--anatomy-paper);display:grid;place-items:center;overflow:hidden}
.ix-thumb img{width:100%;height:100%;object-fit:cover;object-position:50% 45%}
.ix-thumb img[data-theme-img="light"]{display:none}
body[data-theme="light"] .ix-thumb img[data-theme-img="light"]{display:block}
body[data-theme="light"] .ix-thumb img[data-theme-img="dark"]{display:none}
.ix-thumb span{font:10.5px/1 var(--anatomy-mono);letter-spacing:.08em;text-transform:uppercase;color:var(--anatomy-lo)}
.ix-meta{padding:12px 14px 14px}
.ix-meta small{display:block;font:10.5px/1.3 var(--anatomy-mono);letter-spacing:.06em;text-transform:uppercase;color:var(--anatomy-muted);margin-bottom:5px}
.ix-meta b{display:block;font-weight:600;font-size:14px;line-height:1.35;color:var(--anatomy-strong)}
.ix-meta em{display:block;font-style:normal;font-size:12.5px;margin-top:3px}
.ix-soon{opacity:.55}
.ix-foot{margin:56px 0 0;padding-top:20px;border-top:1px solid var(--anatomy-faint);font-size:12.5px;color:var(--anatomy-muted)}
.ix-foot a{color:var(--anatomy-text)}
@media (max-width:720px){.ix-hero h1{font-size:30px}.ix-part{grid-template-columns:1fr;gap:16px}.ix-part header{position:static}}
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
const hero = `<header class="ix-hero"><p class="cp-kicker">An interactive course in ${CHAPTERS.length} machines</p><h1>How an AI chip is made, from sand to rack</h1><p>Every chapter is a working drawing of the machine that does one stage of the job. Take it apart, pick a part to read its numbers, and drag the slider to watch the stage happen. The last two parts follow the chip through its generations and out to the frontier.</p>${flow}</header>`;
const parts = PARTS.map((p) => `<section class="ix-part" id="${p.id}"><header><div class="ix-n">Part ${p.n}</div><h2>${esc(p.title)}</h2><p>${esc(p.blurb)}</p></header><div class="ix-cards">${CHAPTERS.filter((c) => c.part === p.id).map(card).join("")}</div></section>`).join("");
const bar = `<nav class="cp-bar" aria-label="Course"><span class="cp-home">Chip pipeline</span><span class="cp-where">${CHAPTERS.length} chapters · ${PARTS.length} parts</span><button type="button" data-theme-toggle aria-label="Switch theme">Light</button></nav>`;
const foot = `<footer class="ix-foot">Figures drawn with the <a href="https://github.com/wheresryan22/anatomy" rel="noopener" target="_blank">Anatomy</a> kit (MIT). Heights and some layouts are exaggerated or illustrative so thin layers stay visible; each chapter says which. Numbers carry their sources at the foot of each chapter.</footer>`;

const BOOT = `<script>(function(){var t;try{t=localStorage.getItem("cp-theme")}catch(e){}if(t!=="light"&&t!=="dark")t=matchMedia("(prefers-color-scheme: light)").matches?"light":"dark";document.body.setAttribute("data-theme",t)})()</script>`;
const SCRIPT = `
const button = document.querySelector("[data-theme-toggle]");
const label = () => (button.textContent = document.body.dataset.theme === "light" ? "Dark" : "Light");
label();
button.addEventListener("click", () => {
  const next = document.body.dataset.theme === "light" ? "dark" : "light";
  document.body.setAttribute("data-theme", next);
  try { localStorage.setItem("cp-theme", next); } catch (e) {}
  label();
});
`;

const html = k.pageHtml({ title: "Chip pipeline", theme: "dark", body: `${BOOT}<style>${SHELL_CSS}${CSS}</style>${bar}${hero}${parts}${foot}`, script: SCRIPT, width: 1080 });
writeFileSync(join(DOCS, "index.html"), html);
console.log("wrote docs/index.html", `${CHAPTERS.filter((c) => existsSync(join(DOCS, `${c.slug}.html`))).length}/${CHAPTERS.length} chapters built`);
