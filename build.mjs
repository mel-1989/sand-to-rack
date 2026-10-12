// Builds every chapter page and the index into docs/.
// node build.mjs [--fast] [slug ...]
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { CHAPTERS } from "./site/chapters.mjs";

const ROOT = dirname(fileURLToPath(import.meta.url));
const flags = process.argv.slice(2).filter((a) => a.startsWith("--"));
const only = process.argv.slice(2).filter((a) => !a.startsWith("--"));
let failed = 0;
for (const c of CHAPTERS) {
  if (only.length && !only.includes(c.slug)) continue;
  const script = join(ROOT, "chapters", c.slug, "build.mjs");
  if (!existsSync(script)) {
    console.log(`skip ${c.slug} (not built yet)`);
    continue;
  }
  const run = spawnSync(process.execPath, [script, ...flags], { cwd: dirname(script), stdio: "inherit" });
  if (run.status !== 0) failed++;
}
if (!only.length) spawnSync(process.execPath, [join(ROOT, "site", "index.mjs")], { stdio: "inherit" });
process.exit(failed ? 1 : 0);
