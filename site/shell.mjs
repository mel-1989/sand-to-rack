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

export const SITE = "Sand to Rack";
export const REPO = "https://github.com/mel-1989/sand-to-rack";

// Runs before first paint: the saved choice, else the reader's system theme. Figures restyle through CSS variables only.
// The cp-js class lets the reveal styles hide sections only when the script that shows them is running.
export const THEME_BOOT = `<script>(function(){var t;try{t=localStorage.getItem("cp-theme")}catch(e){}if(t!=="light"&&t!=="dark")t=matchMedia("(prefers-color-scheme: light)").matches?"light":"dark";document.body.setAttribute("data-theme",t);document.documentElement.classList.add("cp-js")})()</script>`;

// Theme toggle, the hairline under the stuck top bar, and the fade-in of sections as they scroll into view.
export const THEME_SCRIPT = `
(() => {
  const button = document.querySelector("[data-theme-toggle]");
  if (button) {
    const label = () => {
      const light = document.body.dataset.theme === "light";
      button.querySelector("span").textContent = light ? "Dark" : "Light";
      button.setAttribute("aria-pressed", String(light));
    };
    label();
    button.addEventListener("click", () => {
      const next = document.body.dataset.theme === "light" ? "dark" : "light";
      document.body.setAttribute("data-theme", next);
      try { localStorage.setItem("cp-theme", next); } catch (e) {}
      label();
      document.dispatchEvent(new CustomEvent("themechange", { detail: next }));
    });
  }
  const bar = document.querySelector(".cp-bar");
  if (bar) {
    const stuck = () => bar.classList.toggle("is-stuck", scrollY > 8);
    stuck();
    addEventListener("scroll", stuck, { passive: true });
  }
  const items = document.querySelectorAll(".cp-rv");
  if (!("IntersectionObserver" in window)) return items.forEach((el) => el.classList.add("is-in"));
  const io = new IntersectionObserver((entries) => entries.forEach((e) => {
    if (!e.isIntersecting) return;
    e.target.classList.add("is-in");
    io.unobserve(e.target);
  }), { rootMargin: "0px 0px -6% 0px" });
  items.forEach((el) => io.observe(el));
})();
`;

const ICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect x="3" y="3" width="26" height="26" rx="6" fill="#131313"/><rect x="9" y="9" width="14" height="14" rx="2" fill="none" stroke="#e6e6e6" stroke-width="1.6"/><path d="M13 9V5M19 9V5M13 27v-4M19 27v-4M9 13H5M9 19H5M27 13h-4M27 19h-4" stroke="#6e6e6e" stroke-width="1.6" stroke-linecap="round"/><rect x="13" y="13" width="6" height="6" rx="1" fill="#e6e6e6"/></svg>`;
const FONTS = "https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap";

// Extra <head> tags: description, icon, theme colour and the two web fonts (IBM Plex Sans for text, JetBrains Mono for labels).
const head = (description) => `<meta name="description" content="${esc(description)}"><meta name="theme-color" content="#0b0b0b" media="(prefers-color-scheme: dark)"><meta name="theme-color" content="#f2f2ef" media="(prefers-color-scheme: light)"><meta property="og:title" content="${SITE}"><meta property="og:description" content="${esc(description)}"><link rel="icon" href="data:image/svg+xml,${encodeURIComponent(ICON)}"><link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link rel="stylesheet" href="${FONTS}">`;

// Every page goes through here: the kit's page, plus the head tags above.
export function pageShell({ title, description, body, script = "", width }) {
  const html = k.pageHtml({ title, theme: "dark", body, script: THEME_SCRIPT + script, width });
  return html.replace("</title>", `</title>${head(description)}`);
}

export const toggleHtml = `<button type="button" class="cp-toggle" data-theme-toggle aria-label="Light theme" aria-pressed="false"><svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="5.25" fill="none" stroke="currentColor" stroke-width="1.3"/><path d="M8 2.75a5.25 5.25 0 0 1 0 10.5z" fill="currentColor"/></svg><span>Light</span></button>`;

export const footHtml = `<footer class="cp-foot cp-rv"><span>${SITE}</span><span>Figures drawn with <a href="https://github.com/wheresryan22/anatomy" rel="noopener" target="_blank">Anatomy</a> (MIT)</span><a href="${REPO}" rel="noopener" target="_blank">Source on GitHub</a></footer>`;

export const SHELL_CSS = `
.iso{--cp-sans:"IBM Plex Sans",ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif;--cp-mono:"JetBrains Mono",ui-monospace,"SF Mono",Menlo,monospace;--cp-muted:#8a8a8a;--cp-ring:#6b9bff;--cp-ease:cubic-bezier(.2,.7,.2,1)}
.iso[data-theme="light"]{--cp-muted:#67676c;--cp-ring:#3e63dd}
html{scroll-behavior:smooth;scroll-padding-top:76px}
body{transition:background-color .35s ease,color .35s ease}
@view-transition{navigation:auto}
::view-transition-old(root),::view-transition-new(root){animation-duration:.3s;animation-timing-function:var(--cp-ease)}
:where(.cp-bar,.cp-head,.cp-lesson,.cp-turn,.cp-foot){font-family:var(--cp-sans)}
:where(.cp-bar,.cp-turn,.cp-lesson,.cp-foot,.ix-flow,.ix-cards) :focus-visible{outline:2px solid var(--cp-ring);outline-offset:3px;border-radius:6px}
.cp-bar{position:sticky;top:0;z-index:30;display:flex;align-items:center;gap:14px;margin:-24px 0 32px;padding:10px 0;font:500 11px/1.3 var(--cp-mono);letter-spacing:.06em;text-transform:uppercase;color:var(--cp-muted);background:var(--anatomy-page);box-shadow:0 0 0 100vmax var(--anatomy-page),0 1px 0 100vmax transparent;clip-path:inset(0 -100vmax -1px);transition:box-shadow .3s ease,background-color .35s ease}
.cp-bar.is-stuck{box-shadow:0 0 0 100vmax var(--anatomy-page),0 1px 0 100vmax var(--anatomy-faint)}
.cp-bar a{color:var(--cp-muted);text-decoration:none;display:inline-flex;align-items:center;min-height:44px;transition:color .2s ease}
.cp-bar a:hover{color:var(--anatomy-strong)}
.cp-home{gap:9px;color:var(--anatomy-strong)!important;letter-spacing:.04em}
.cp-home svg{width:18px;height:18px;flex:none}
.cp-where{flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.cp-toggle{display:inline-flex;align-items:center;gap:7px;min-height:36px;padding:0 12px;margin:4px 0;border-radius:999px;border:1px solid var(--anatomy-faint);background:transparent;color:var(--cp-muted);font:inherit;letter-spacing:inherit;text-transform:inherit;cursor:pointer;transition:color .2s ease,border-color .2s ease,background-color .2s ease;position:relative}
.cp-toggle::after{content:"";position:absolute;inset:-4px}
.cp-toggle:hover{color:var(--anatomy-strong);border-color:var(--anatomy-lo)}
.cp-toggle svg{width:13px;height:13px;transition:transform .5s var(--cp-ease)}
.iso[data-theme="light"] .cp-toggle svg{transform:rotate(180deg)}
.cp-progress{display:none}
@supports (animation-timeline:scroll()){.cp-progress{display:block;position:fixed;inset:0 0 auto;height:2px;z-index:40;background:var(--anatomy-mid);transform-origin:0 50%;transform:scaleX(0);animation:cp-grow linear both;animation-timeline:scroll(root)}}
@keyframes cp-grow{to{transform:scaleX(1)}}
.cp-head{margin:0 0 24px}
.cp-head .cp-kicker{font:500 11px/1.3 var(--cp-mono);letter-spacing:.08em;text-transform:uppercase;color:var(--cp-muted);margin:0 0 10px}
.cp-head h1{margin:0;font:600 30px/1.15 var(--cp-sans);letter-spacing:-.018em;color:var(--anatomy-strong);text-wrap:balance}
.cp-head p{margin:12px 0 0;max-width:62ch;font-size:16px;line-height:1.65;color:var(--anatomy-text);text-wrap:pretty}
.cp-lesson{display:grid;gap:40px;margin:56px 0 0}
.cp-lesson h2{margin:0 0 12px;font:500 11px/1.3 var(--cp-mono);letter-spacing:.08em;text-transform:uppercase;color:var(--cp-muted)}
.cp-lesson h3{margin:18px 0 8px;font:600 15px/1.35 var(--cp-sans);color:var(--anatomy-strong)}
.cp-lesson p{margin:0 0 12px;max-width:66ch;font-size:15px;line-height:1.7;text-wrap:pretty}
.cp-lesson ol,.cp-lesson ul{margin:0;padding-left:20px;display:grid;gap:9px;max-width:66ch;font-size:15px;line-height:1.65}
.cp-lesson li::marker{color:var(--cp-muted);font-family:var(--cp-mono);font-size:11px}
.cp-lesson strong{color:var(--anatomy-strong);font-weight:600}
.cp-lesson a{color:var(--anatomy-strong);text-underline-offset:3px;text-decoration-color:var(--anatomy-lo);transition:text-decoration-color .2s ease}
.cp-lesson a:hover{text-decoration-color:currentColor}
.cp-numbers{width:100%;border-collapse:collapse;font-size:14px}
.cp-numbers td{padding:10px 0;border-top:1px solid var(--anatomy-faint);vertical-align:top}
.cp-numbers tr:last-child td{border-bottom:1px solid var(--anatomy-faint)}
.cp-numbers td:first-child{width:42%;padding-right:16px;color:var(--cp-muted)}
.cp-numbers td:nth-child(2){color:var(--anatomy-strong);font-family:var(--cp-mono);font-size:13px;font-variant-numeric:tabular-nums}
.cp-numbers .cp-note{display:block;font-family:var(--cp-sans);font-size:12.5px;color:var(--cp-muted);margin-top:3px}
.cp-sources ul{font-size:13px;gap:6px}
.cp-sources a{color:var(--anatomy-text)}
.cp-sources a:hover{color:var(--anatomy-strong)}
.cp-turn{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:64px 0 0}
.cp-turn a{display:block;padding:16px 18px;border-radius:12px;text-decoration:none;color:var(--anatomy-text);background:var(--anatomy-card);box-shadow:var(--anatomy-lift);font-size:15px;line-height:1.4;transition:color .2s ease,background-color .2s ease}
.cp-turn a:hover{color:var(--anatomy-strong);background:var(--anatomy-face)}
.cp-turn small{display:block;font:500 10.5px/1.3 var(--cp-mono);letter-spacing:.08em;text-transform:uppercase;color:var(--cp-muted);margin-bottom:6px}
.cp-turn .cp-next{text-align:right;grid-column:2}
.cp-foot{display:flex;flex-wrap:wrap;gap:6px 18px;margin:56px 0 0;padding-top:20px;border-top:1px solid var(--anatomy-faint);font-size:13px;color:var(--cp-muted)}
.cp-foot span:first-child{color:var(--anatomy-text);font-weight:500}
.cp-foot a{color:var(--anatomy-text);text-underline-offset:3px;text-decoration-color:var(--anatomy-lo)}
.cp-foot a:hover{color:var(--anatomy-strong)}
.cp-foot a:last-child{margin-left:auto}
.cp-js .cp-rv{opacity:0;transform:translateY(10px);transition:opacity .7s var(--cp-ease),transform .7s var(--cp-ease)}
.cp-js .cp-rv.is-in{opacity:1;transform:none}
@media (prefers-reduced-motion:reduce){html{scroll-behavior:auto}::view-transition-group(*),::view-transition-old(*),::view-transition-new(*){animation:none!important}.cp-js .cp-rv{opacity:1;transform:none;transition:none}.cp-toggle svg{transition:none}}
@media (max-width:520px){.cp-head h1{font-size:24px}.cp-where{display:none}.cp-bar{justify-content:space-between}.cp-turn{grid-template-columns:1fr}.cp-turn .cp-next{grid-column:1}.cp-foot a:last-child{margin-left:0}}
`;

const MARK = `<svg viewBox="0 0 18 18" aria-hidden="true"><rect x="4.5" y="4.5" width="9" height="9" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.2"/><rect x="7.25" y="7.25" width="3.5" height="3.5" rx=".6" fill="currentColor"/><path d="M7.5 4.5V2M10.5 4.5V2M7.5 16v-2.5M10.5 16v-2.5M4.5 7.5H2M4.5 10.5H2M16 7.5h-2.5M16 10.5h-2.5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" opacity=".55"/></svg>`;
export const homeHtml = (href) => href ? `<a class="cp-home" href="${href}">${MARK}${SITE}</a>` : `<span class="cp-home" style="display:inline-flex;align-items:center;min-height:44px">${MARK}${SITE}</span>`;

function bar(slug) {
  const i = indexOf(slug);
  const c = CHAPTERS[i];
  const part = partOf(c.part);
  return `<nav class="cp-bar" aria-label="Course">${homeHtml("index.html")}<span class="cp-where">${pad(i + 1)} / ${CHAPTERS.length} · Part ${part.n} · ${esc(part.title)}</span>${toggleHtml}</nav>`;
}

function turn(slug) {
  const i = indexOf(slug);
  const prev = CHAPTERS[i - 1];
  const next = CHAPTERS[i + 1];
  const a = (c, cls, word) => `<a class="${cls}" href="${c.slug}.html"><small>${word} · ${pad(indexOf(c.slug) + 1)}</small>${esc(c.title)}</a>`;
  return `<nav class="cp-turn cp-rv" aria-label="Chapters">${prev ? a(prev, "cp-prev", "Previous") : ""}${next ? a(next, "cp-next", "Next") : `<a class="cp-next" href="index.html"><small>Done</small>Back to the map</a>`}</nav>`;
}

// lesson: { intro, steps: [html], numbers: [[label, value, note?]], innovations?: [html], sources: [[text, url]] }
function lessonHtml(lesson) {
  const parts = [];
  if (lesson.steps?.length) parts.push(`<section class="cp-rv"><h2>What happens</h2><ol>${lesson.steps.map((s) => `<li>${s}</li>`).join("")}</ol></section>`);
  if (lesson.numbers?.length) parts.push(`<section class="cp-rv"><h2>Key numbers</h2><table class="cp-numbers"><tbody>${lesson.numbers.map(([l, v, n]) => `<tr><td>${l}</td><td>${v}${n ? `<span class="cp-note">${n}</span>` : ""}</td></tr>`).join("")}</tbody></table></section>`);
  if (lesson.innovations?.length) parts.push(`<section class="cp-rv"><h2>${esc(lesson.innovationsTitle || "Why it matters")}</h2><ul>${lesson.innovations.map((s) => `<li>${s}</li>`).join("")}</ul></section>`);
  if (lesson.more) parts.push(lesson.more);
  if (lesson.sources?.length) parts.push(`<section class="cp-sources cp-rv"><h2>Sources</h2><ul>${lesson.sources.map(([t, u]) => `<li><a href="${esc(u)}" rel="noopener" target="_blank">${esc(t)}</a></li>`).join("")}</ul></section>`);
  return `<div class="cp-lesson">${parts.join("")}</div>`;
}

export function chapterHtml({ slug, figure, css = "", script = "", lesson, width = 720 }) {
  const c = CHAPTERS[indexOf(slug)];
  if (!c) throw new Error(`unknown chapter ${slug}: add it to site/chapters.mjs`);
  const part = partOf(c.part);
  const head = `<header class="cp-head"><p class="cp-kicker">${esc(c.machine)}</p><h1>${esc(c.title)}</h1>${lesson.intro ? `<p>${lesson.intro}</p>` : ""}</header>`;
  const body = `${THEME_BOOT}<style>${SHELL_CSS}${css}</style><div class="cp-progress" aria-hidden="true"></div>${bar(slug)}${head}${figure}${lessonHtml(lesson)}${turn(slug)}${footHtml}`;
  const description = `${c.title}: ${c.machine}. Chapter ${indexOf(slug) + 1} of ${SITE}, an interactive course on how an AI chip is made.`;
  return pageShell({ title: `${c.title} · ${SITE}`, description, body, script, width });
}

export function writeChapter(opts) {
  const html = chapterHtml(opts);
  mkdirSync(DOCS, { recursive: true });
  const file = join(DOCS, `${opts.slug}.html`);
  writeFileSync(file, html);
  return { file, kb: Math.round(html.length / 1024) };
}

export { CHAPTERS, PARTS };
