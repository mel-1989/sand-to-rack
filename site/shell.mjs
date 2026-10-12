// Wraps a chapter's figure in the course page: top bar, figure, lesson, prev/next.
// writeChapter({ slug, figure, css, script, lesson }) writes docs/<slug>.html.
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { k } from "./kit.mjs";
import { CHAPTERS, PARTS, partOf, indexOf } from "./chapters.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
export const DOCS = join(ROOT, "docs");

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const pad = (n) => String(n).padStart(2, "0");

// Runs before first paint: the saved choice, else the reader's system theme. Figures restyle through CSS variables only.
const THEME_BOOT = `<script>(function(){var t;try{t=localStorage.getItem("cp-theme")}catch(e){}if(t!=="light"&&t!=="dark")t=matchMedia("(prefers-color-scheme: light)").matches?"light":"dark";document.body.setAttribute("data-theme",t)})()</script>`;

const THEME_SCRIPT = `
(() => {
  const button = document.querySelector("[data-theme-toggle]");
  if (!button) return;
  const label = () => (button.textContent = document.body.dataset.theme === "light" ? "Dark" : "Light");
  label();
  button.addEventListener("click", () => {
    const next = document.body.dataset.theme === "light" ? "dark" : "light";
    document.body.setAttribute("data-theme", next);
    try { localStorage.setItem("cp-theme", next); } catch (e) {}
    label();
    document.dispatchEvent(new CustomEvent("themechange", { detail: next }));
  });
})();
`;

export const SHELL_CSS = `
.cp-bar{display:flex;align-items:center;gap:12px;margin:0 0 28px;font:11px/1.3 var(--anatomy-mono);letter-spacing:.06em;text-transform:uppercase;color:var(--anatomy-muted)}
.cp-bar a,.cp-bar button{color:var(--anatomy-muted);text-decoration:none;font:inherit;letter-spacing:inherit;text-transform:inherit;background:none;border:0;padding:6px 0;cursor:pointer}
.cp-bar a:hover,.cp-bar button:hover,.cp-bar a:focus-visible,.cp-bar button:focus-visible{color:var(--anatomy-strong);outline:none}
.cp-home{color:var(--anatomy-strong)!important}
.cp-where{flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.cp-head{margin:0 0 22px}
.cp-head .cp-kicker{font:11px/1.3 var(--anatomy-mono);letter-spacing:.08em;text-transform:uppercase;color:var(--anatomy-muted);margin:0 0 8px}
.cp-head h1{margin:0;font:600 28px/1.15 ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif;letter-spacing:-.01em;color:var(--anatomy-strong);text-wrap:balance}
.cp-head p{margin:10px 0 0;max-width:62ch;font-size:15px;line-height:1.6;color:var(--anatomy-text)}
.cp-lesson{display:grid;gap:30px;margin:44px 0 0}
.cp-lesson h2{margin:0 0 10px;font:11px/1.3 var(--anatomy-mono);letter-spacing:.08em;text-transform:uppercase;color:var(--anatomy-muted);font-weight:400}
.cp-lesson p{margin:0 0 10px;max-width:66ch;font-size:14.5px;line-height:1.65}
.cp-lesson ol,.cp-lesson ul{margin:0;padding-left:20px;display:grid;gap:7px;max-width:66ch;font-size:14px;line-height:1.6}
.cp-lesson li::marker{color:var(--anatomy-muted);font-family:var(--anatomy-mono);font-size:11px}
.cp-lesson strong{color:var(--anatomy-strong);font-weight:600}
.cp-numbers{width:100%;border-collapse:collapse;font-size:13.5px}
.cp-numbers td{padding:8px 0;border-top:1px solid var(--anatomy-faint);vertical-align:top}
.cp-numbers td:first-child{width:42%;padding-right:14px;color:var(--anatomy-muted)}
.cp-numbers td:nth-child(2){color:var(--anatomy-strong);font-family:var(--anatomy-mono);font-size:12.5px;font-variant-numeric:tabular-nums}
.cp-numbers .cp-note{display:block;font-family:ui-sans-serif,system-ui,sans-serif;font-size:12px;color:var(--anatomy-muted);margin-top:2px}
.cp-sources{font-size:12.5px}
.cp-sources a{color:var(--anatomy-text);text-underline-offset:3px;text-decoration-color:var(--anatomy-lo)}
.cp-sources a:hover{color:var(--anatomy-strong)}
.cp-turn{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:52px 0 0}
.cp-turn a{display:block;padding:14px 16px;border-radius:10px;text-decoration:none;color:var(--anatomy-text);background:var(--anatomy-card);box-shadow:var(--anatomy-lift)}
.cp-turn a:hover,.cp-turn a:focus-visible{color:var(--anatomy-strong);outline:none}
.cp-turn small{display:block;font:10.5px/1.3 var(--anatomy-mono);letter-spacing:.08em;text-transform:uppercase;color:var(--anatomy-muted);margin-bottom:4px}
.cp-turn .cp-next{text-align:right;grid-column:2}
@media (max-width:520px){.cp-head h1{font-size:23px}.cp-turn{grid-template-columns:1fr}.cp-turn .cp-next{grid-column:1}}
`;

function bar(slug) {
  const i = indexOf(slug);
  const c = CHAPTERS[i];
  const part = partOf(c.part);
  return `<nav class="cp-bar" aria-label="Course"><a class="cp-home" href="index.html">Chip pipeline</a><span class="cp-where">${pad(i + 1)} / ${CHAPTERS.length} · Part ${part.n} · ${esc(part.title)}</span><button type="button" data-theme-toggle aria-label="Switch theme">Light</button></nav>`;
}

function turn(slug) {
  const i = indexOf(slug);
  const prev = CHAPTERS[i - 1];
  const next = CHAPTERS[i + 1];
  const a = (c, cls, word) => `<a class="${cls}" href="${c.slug}.html"><small>${word} · ${pad(indexOf(c.slug) + 1)}</small>${esc(c.title)}</a>`;
  return `<nav class="cp-turn" aria-label="Chapters">${prev ? a(prev, "cp-prev", "Previous") : ""}${next ? a(next, "cp-next", "Next") : `<a class="cp-next" href="index.html"><small>Done</small>Back to the map</a>`}</nav>`;
}

// lesson: { intro, steps: [html], numbers: [[label, value, note?]], innovations?: [html], sources: [[text, url]] }
function lessonHtml(lesson) {
  const parts = [];
  if (lesson.steps?.length) parts.push(`<section><h2>What happens</h2><ol>${lesson.steps.map((s) => `<li>${s}</li>`).join("")}</ol></section>`);
  if (lesson.numbers?.length) parts.push(`<section><h2>Key numbers</h2><table class="cp-numbers"><tbody>${lesson.numbers.map(([l, v, n]) => `<tr><td>${l}</td><td>${v}${n ? `<span class="cp-note">${n}</span>` : ""}</td></tr>`).join("")}</tbody></table></section>`);
  if (lesson.innovations?.length) parts.push(`<section><h2>${esc(lesson.innovationsTitle || "Why it matters")}</h2><ul>${lesson.innovations.map((s) => `<li>${s}</li>`).join("")}</ul></section>`);
  if (lesson.more) parts.push(lesson.more);
  if (lesson.sources?.length) parts.push(`<section class="cp-sources"><h2>Sources</h2><ul>${lesson.sources.map(([t, u]) => `<li><a href="${esc(u)}" rel="noopener" target="_blank">${esc(t)}</a></li>`).join("")}</ul></section>`);
  return `<div class="cp-lesson">${parts.join("")}</div>`;
}

export function chapterHtml({ slug, figure, css = "", script = "", lesson, width = 720 }) {
  const c = CHAPTERS[indexOf(slug)];
  if (!c) throw new Error(`unknown chapter ${slug}: add it to site/chapters.mjs`);
  const part = partOf(c.part);
  const head = `<header class="cp-head"><p class="cp-kicker">${esc(c.machine)}</p><h1>${esc(c.title)}</h1>${lesson.intro ? `<p>${lesson.intro}</p>` : ""}</header>`;
  const body = `${THEME_BOOT}<style>${SHELL_CSS}${css}</style>${bar(slug)}${head}${figure}${lessonHtml(lesson)}${turn(slug)}`;
  return k.pageHtml({ title: `${c.title} · Chip pipeline`, theme: "dark", body, script: THEME_SCRIPT + script, width });
}

export function writeChapter(opts) {
  const html = chapterHtml(opts);
  mkdirSync(DOCS, { recursive: true });
  const file = join(DOCS, `${opts.slug}.html`);
  writeFileSync(file, html);
  return { file, kb: Math.round(html.length / 1024) };
}

export { CHAPTERS, PARTS };
