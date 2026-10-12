// Card thumbnails for the index: docs/thumbs/<slug>-dark.png and -light.png, shot headless from each built page.
// node site/thumbs.mjs [slug ...]
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";
import { CHAPTERS } from "./chapters.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DOCS = join(ROOT, "docs");
const DRIVE = join(ROOT, "vendor/anatomy/scripts/drive.mjs");
const only = process.argv.slice(2);
mkdirSync(join(DOCS, "thumbs"), { recursive: true });
for (const c of CHAPTERS) {
  if (only.length && !only.includes(c.slug)) continue;
  const page = join(DOCS, `${c.slug}.html`);
  if (!existsSync(page)) continue;
  const out = (t) => join(DOCS, "thumbs", `${c.slug}-${t}.png`);
  const actions = [
    ["eval", "document.body.dataset.theme='dark'"], ["wait", 1200], ["shot", out("dark"), ".iso-plate", 0.5],
    ["eval", "document.body.dataset.theme='light';document.dispatchEvent(new CustomEvent('themechange',{detail:'light'}))"], ["wait", 400], ["shot", out("light"), ".iso-plate", 0.5],
  ];
  const file = join(tmpdir(), `cp-thumb-${c.slug}.json`);
  writeFileSync(file, JSON.stringify(actions));
  const run = spawnSync(process.execPath, [DRIVE, page, "--actions", file, "--width", "900", "--height", "1400", "--reduced"], { encoding: "utf8" });
  rmSync(file, { force: true });
  console.log(c.slug, run.status === 0 ? "ok" : `failed: ${(run.stderr || run.stdout).slice(-300)}`);
}
