---
tags: [type/charter, for/agent, status/live]
---

# Sand to Rack: chapter contract

This repo is Sand to Rack, a static site (`docs/`, served by GitHub Pages at https://mel-1989.github.io/sand-to-rack/) that teaches every stage of making an AI accelerator chip, one interactive isometric figure per chapter. Figures are drawn with the Anatomy skill's kit, vendored in `vendor/anatomy/` (MIT, by Ryan; the full skill with its examples and references is at `~/.claude/skills/anatomy`). The chapter list, order and titles live in `site/chapters.mjs`; the page shell (top bar, theme toggle, lesson, prev/next) lives in `site/shell.mjs`. The reference chapter is `chapters/advanced-packaging/` (the Rubin package): copy its structure.

## Files of a chapter

Each chapter is one folder, `chapters/<slug>/`, and an agent building a chapter touches nothing outside it: not `site/`, not `vendor/`, not another chapter, not git. If the shell lacks something you need, work around it inside your folder and say so in your report.

| File | Holds |
|---|---|
| `model.mjs` | Every real number the figure or text shows, each with a source comment (URL); derived values computed here; illustrative values marked as such. |
| `build.mjs` | Geometry and the page. Imports `{ k, G, A, Tube, kitScript, glScript }` from `../../site/kit.mjs` and `writeChapter` from `../../site/shell.mjs`. Supports `--audit` (geometry audit, must end `audit passed`) and `--fast` (skip `A.settle`). Writes `docs/<slug>.html` through `writeChapter({ slug, figure, css, script, lesson })`. |
| `lesson.mjs` | `export const LESSON = { intro, steps, numbers, innovationsTitle, innovations, sources }`, as in the reference chapter; text reads from `model.mjs`. |
| `live.js` | The figure's runtime, inlined by the build (`__DATA__` replaced with JSON). |
| `<slug>.css` | Figure styles. Prefix every class with a short chapter prefix (`cz-`, `euv-` …): the page also carries the shell's `cp-` classes. |

## Rules every figure follows

- **The machine is the explanation.** Draw the real machine of that stage (see the skill's SKILL.md and `references/craft.md`): dense, real parts, solids not wireframes, every line ends on something, one lit subject.
- **Facts first, with sources.** Collect real numbers before geometry, from primary sources (vendor and standards documents, papers, IEEE/SPIE, company tech pages) or reputable trade press; never invent a spec. Mark anything illustrative in the caption and the lesson.
- **Both themes at runtime.** The reader toggles theme on the page (body `data-theme` flips, and a `themechange` event fires on `document`). Colour only through the kit's `--anatomy-*` variables; a canvas or WebGL layer reads `document.body.dataset.theme` and listens for `themechange`. Never bake a theme at build time.
- **Interaction standard.** Hover, arrow keys and numbered legend buttons pick a part and light it with its readout. Under the plate, a play button and a scrub slider step through the stage's process (what the machine does to the wafer, in order) with a label naming the current step; the slider is the "watch it happen" control. Space plays or pauses and Escape resets, handled on `document` only while the figure is on screen and focus is on the page body or inside the figure, never in another control. An idle tour runs until the reader first interacts. Reduced motion jumps instead of animating. Touch works at 390 px wide.
- **Verify headless, never on the user's screen.** `node build.mjs --audit` ends `audit passed`; `node ../../vendor/anatomy/scripts/lines.mjs ../../docs/<slug>.html` prints `line ends: 0` in dark and again with the theme switched to light; screenshots through `vendor/anatomy/scripts/drive.mjs` at 900 and 390 wide, both themes, at rest and mid-process; console clean. Read every PNG you make. Shots go in `.shots/<slug>/` (gitignored).

## Markdown

Any `.md` here follows the workspace style: one line per paragraph, pipe tables, fenced code, ATX headings, the three frontmatter tags.
