---
tags: [type/index, for/human, status/live]
---

# How an AI chip is made, from sand to rack

An interactive course through every stage of making an AI accelerator, one working isometric drawing of the real machine per chapter: the Siemens reactor and the crystal puller, the wire saw, the mask writer, the fab's overhead transport, deposition, the EUV scanner, etch, implant, CMP, copper interconnect, metrology, probe test, thinning and dicing, hybrid bonding, the Rubin package and the rack it ends up in. Part V follows the transistor, HBM and the accelerator package through their generations and key innovations; Part VI looks at the frontier: High-NA EUV, co-packaged optics, glass substrates and wafer-scale compute.

Open `docs/index.html` in a browser, or serve `docs/` with any static server. Each chapter page lets you pick a part (hover, arrow keys or the numbered buttons) to read its numbers, play or scrub the slider to watch the stage happen, and switch between dark and light. Every number carries its source at the foot of the chapter, and each chapter says which geometry is exaggerated or illustrative.

## Hosting

The built site is plain static files in `docs/`, so any static host serves it as is. A private preview is published as a Claude artifact: [Chip pipeline](https://claude.ai/artifact/PtSNMZqhkwakir4hdHzCcQ). GitHub Pages needs the repo to be public or a plan with Pages for private repos; Cloudflare Pages (`npx wrangler pages deploy docs`) works with the repo kept private.

## Build

Requires Node 20.10+ and Google Chrome (for the headless checks and thumbnails). There are no npm dependencies.

```sh
node build.mjs              # every chapter (settles painter's order, slow) and the index
node build.mjs --fast       # skip settling, for quick looks
node build.mjs etch cmp     # just these chapters
node site/thumbs.mjs        # refresh the index card thumbnails
node site/index.mjs         # rebuild the index only
```

Inside a chapter folder, `node build.mjs --audit` runs the geometry audit (it must end `audit passed`), and `node ../../vendor/anatomy/scripts/lines.mjs ../../docs/<slug>.html` checks that every drawn line ends on something.

## Layout

| Path | Holds |
|---|---|
| `site/chapters.mjs` | The chapter list, order and parts |
| `site/shell.mjs` | The chapter page shell: top bar, theme toggle, lesson, prev/next |
| `site/index.mjs`, `site/thumbs.mjs` | The course map and its card thumbnails |
| `chapters/<slug>/` | One chapter: `model.mjs` (sourced numbers), `build.mjs` (geometry), `lesson.mjs`, `live.js`, styles |
| `vendor/anatomy/` | The [Anatomy](https://github.com/wheresryan22/anatomy) drawing kit and its headless check scripts (MIT, by Ryan) |
| `docs/` | The built site |

`CLAUDE.md` is the contract every chapter follows.
