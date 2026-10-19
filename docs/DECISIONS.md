# Decisions log

Format: `D### — date — title`, then Decision / Why / Alternatives. Entries are append-only:
never edit an old entry, correct it with a new one. Every deviation from the design doc and
every judgement call the doc left open is recorded here.

---

## D001 — 2026-10-19 — Project location & repo convention

**Decision:** The game lives at `C:\Users\tanji\Opencode\bellward` as a standalone git
repository, added to the workspace root `.gitignore` under "separate repos — do not track here".
**Why:** Matches the workspace's established convention (several sibling projects are separate
repos). Keeps game history clean of workspace noise.
**Alternatives:** inside the parent repo without its own `.git` (rejected: mixes histories).

## D002 — 2026-10-19 — TypeScript pinned to 6.0.3 (not latest 7.0.2)

**Decision:** `typescript@6.0.3` exact.
**Why:** `typescript-eslint@8.71.2` (current stable) declares peer `typescript >=4.8.4 <6.1.0`.
The 7.x line is not yet supported by the lint toolchain.
**Revisit:** when typescript-eslint ships support for ≥6.1 / 7.x.
**Alternatives:** TS 5.9.3 (older, fully supported — fallback if 6.0.3 causes trouble).

## D003 — 2026-10-19 — WebGL first; fatal banner if all renderers fail

**Decision:** The renderer is initialized with `preference: 'webgl'`, `resolution: 1`,
`autoDensity: false`, `roundPixels: true`, 640×360 backing store, integer CSS upscaling.
If renderer initialization fails entirely, the page shows a visible fatal error banner.
**Why:** WebGL is the best-supported fast path in Pixi v8; headless CI uses SwiftShader.
Pixi 8.22 ships a canvas fallback renderer, so `preference: 'webgl'` degrades gracefully on
devices without WebGL — while the E2E gate asserts `renderer.name` contains "webgl" under
SwiftShader, so the fast path itself is proven on every run.
**Alternatives:** WebGPU-first (possible via `preference: 'webgpu'`; not needed for the slice).

## D004 — 2026-10-19 — E2E runs against the Vite dev server

**Decision:** Playwright `webServer` starts `npm run dev`; `window.__game` debug handle is
DEV-only (`import.meta.env.DEV`), per design doc §7.16 ("expose a read-only debug state in DEV").
**Why:** The E2E suite asserts on `debugState()`; production builds strip it by design.
Build correctness is enforced separately by `npm run check` (includes `tsc` + `vite build`).

## D005 — 2026-10-19 — Debug overlay is DOM, not Pixi

**Decision:** The F1 overlay is a plain `<pre>` element, updated ≤6×/s, never drawn inside Pixi.
**Why:** Zero frame-budget impact, trivial accessibility, no font/atlas coupling.
In-game UI (HUD/menus) will be Pixi; dev tooling does not need to be.

## D006 — 2026-10-19 — Single tsconfig + ESLint guard for Node imports in src/**

**Decision:** One `tsconfig.json` spans `src/ tests/ scripts/`; a scoped ESLint override bans
`node:*` imports and Node globals inside `src/**` so game code stays packaging-portable.
**Why:** Simpler than three project tsconfigs; the actual risk (Node APIs leaking into game
code) is enforced where it matters. Can switch to project references later without user-visible
change.

## D007 — 2026-10-19 — ESLint runs without type-aware rules for now

**Decision:** `typescript-eslint` "recommended" (non-type-checked) in M0; upgrade path is
`parserOptions.projectService` for typed rules (`no-floating-promises`, …) later.
**Why:** Fast feedback now; typed linting adds config/time cost with few M0-relevant wins.

## D008 — 2026-10-19 — assets:check semantics

**Decision:** `npm run assets:check` fails on: missing/empty required fields, `commercialUse:false`,
non-ISO dates, declared-but-missing files, undeclared files (orphans). `licenseStatus:"UNCLEAR"`
warns in normal mode and **fails** in `--strict` mode (`npm run assets:check:strict` = shipping
gate). `LICENSE.txt`, `README.md`, `CREDITS.md` and dotfiles are exempt from the orphan rule.
**Why:** Implements design doc §10.2 ("fail on any missing license field") while letting demo
builds carry flagged placeholders that can never silently ship.

## D009 — 2026-10-19 — howler installed now, first used in M3

**Decision:** `howler@2.2.4` + `@types/howler@2.2.13` are pinned in M0 (per the design doc's
setup list) but no audio code exists yet. Browser autoplay will be gated behind the first user
input (start screen) when audio lands in M3/M9.

## D010 — 2026-10-19 — Code style

**Decision:** Prettier: single quotes, semicolons, printWidth 100, trailing commas, LF; plus
`.gitattributes` enforcing LF in the repo. ESLint runs with `--max-warnings=0`.

## D011 — 2026-10-19 — Event renamed: `shadeRecovered` → `echoRecovered`

**Decision:** The retrieval-death event is named `echoRecovered`; the dropped currency entity is
"Echo" (§7.11).
**Why:** §5.3 listed `shadeRecovered`, but §2 forbids terms from named inspirations and §7.11
already renames the mechanic to Echo. §7.3 allows documented renames.

## D012 — 2026-10-19 — Skills policy for this project

**Decision:** The workspace AGENTS.md skill list is web-framework oriented; the applicable
skills (`frontend-design`, `animation`, `design-system`, `web-design-guidelines`) will be loaded
at the visual milestones (M1 rendering, M5 UI/menus, M9 art pass). `shadcn`, `tailwind-4-docs`,
`vercel-react-best-practices`, `next-*`, `astro`, `ai-sdk` do not apply to a vanilla-TS + PixiJS
canvas game and are intentionally not used.

## D013 — 2026-10-19 — No paid assets (user directive)

**Decision:** The asset pipeline only admits $0-downloadable assets. The paid CraftPix "Bosses
Pixel Art Pack" is excluded from the plan (no fetch entry, no manual step).

## D014 — 2026-10-19 — Fantasy Knight (aamatniekss) approved by user override

**Decision:** `Fantasy Knight — Free Pixelart Animated Character` joins the approved list as the
hero placeholder (procedural fallback remains).
**Why:** The user explicitly overrode the earlier "do not use". Additionally verified on the
asset page (2026-10-19): free for commercial use; the author clarified in comments that
AI-assisted _coding_ with original-form art is fine (the prohibition targets AI image
creation/training). Redistribution of the assets alone is not allowed; public-repo inclusion
requires credit + link back.
**Alternatives:** procedural hero (kept as guaranteed fallback for zero-download runs).

## D015 — 2026-10-19 — License re-verification of three previously "unclear" packs

**Decision:** Two cleared, one excluded:

- alkakrab "6 Dark Fantasy Boss Battle Tracks": page states "Absolutely Free For Commercial
  use"; author confirmed selling games with it is fine → approved (boss music placeholders).
- Maaot "Mossy Cavern": license V0.1 on the page allows free + commercial use and modification;
  forbids repackaging/redistributing/reselling → approved (optional hi-res backdrop experiment,
  M9).
- CraftPix "Bosses Pixel Art Pack": paid (min $0.60) → excluded (see D013).
  Verbatim license text + URLs + date are archived in each pack's `LICENSE.txt` at download time.

## D016 — 2026-10-19 — E2E assertions & thresholds

**Decision:** Smoke asserts: canvas 640×360, zero page/console errors, `uniqueColors > 8` via
`renderer.extract.pixels()` with an explicit 640×360 frame, average FPS over a 2.5 s window
against a **self-calibrating floor**: 75% of the environment's measured bare-`requestAnimationFrame`
ceiling, clamped to [30, 45], sim time progressing ≥ 0.75 × wall time (fixed-step tracking),
F1 overlay toggle. The browser runs at a 640×360 viewport (native resolution, no software
compositing upscale).
**Why:** First runs measured 37–40 fps because (a) extraction used stage-content bounds instead
of the screen, and (b) the sampling window overlapped cold-start work (dev-server module
transforms, renderer chunk loading). With an explicit frame, a native-resolution viewport and a
pre-navigation RAF warm-up, the same machine measures ≈56 fps (94% of the 60 fps ceiling). The
calibrated floor keeps the gate meaningful on slower environments without pretending every CI
box can pace 60.
**Alternatives:** flat 45 (rejected: flaky on software-composited machines); flat 30 (rejected:
too weak where 60 is achievable).

## D017 — 2026-10-19 — M0 demo scene is explicitly temporary

**Decision:** `src/render/DemoScene.ts` (animated palette shapes) stands in for the render
pipeline proof until M1's real `Renderer` + test room replaces it. It is listed in PROGRESS.md
as temporary, not a silent stub.

## D018 — 2026-10-19 — Render budget guardrails: 2-texture batches, no room bakes, strip parallax

**Decision:** Three permanent guardrails, all measured rather than assumed:

1. `RENDER.maxBatchableTextures = 2`, assigned immediately after `app.init()` and before the
   first render (Pixi builds its batch shader lazily on that first render).
2. Static layers stay as individual sprites (440 tiles, 9 props). No `renderer.generateTexture`
   room bakes.
3. Parallax layers are a row of plain sprites covering `viewport width + max camera shift`, not
   `TilingSprite`.

**Why:** With Pixi defaults the full M1 scene measured ~15 fps on headless SwiftShader at
640×360. A raw WebGL2 benchmark in the same browser drew 4 blended fullscreen quads at 60 fps,
so this was not a hardware fill-rate ceiling. Pixi's batch fragment shader evaluates
`maxBatchableTextures` texture selects for every pixel; the default 16 makes full-screen quads a
shader-loop benchmark. Measured: cap 2 → 60 fps, cap 4 → ~54 fps, cap 1 → ~51 fps (draw-call
overhead overtakes the shader win at 1). Baking made things worse, not better: a baked tile quad
measured 46 fps vs 60 fps for the 440 unbaked tile sprites, and adding two baked prop quads
dropped the scene to 24 then 15 fps — large alpha quads cost more than many small ones.

**Alternatives:** lowering the E2E floor (rejected — the scene clears the existing floor now);
pre-compositing rooms into RenderTextures (rejected by the measurements above); dropping
parallax or the ambient wash (rejected — core to the art direction).

**Revisit:** if a future scene needs many textures in one batch, re-measure; the cap trades draw
calls for cheap fragments and 2 is deliberately conservative.

## D019 — 2026-10-19 — Background layers are data: source crop + world-space anchor

**Decision:** `BackgroundArtData` describes each layer with `texture`, optional `rect`, `factor`,
`scale`, `tint`, `anchor: 'top' | 'bottom'` and `anchorY` (a world y). The town sheets are
384×288: the far layer crops rows 0..230 (clouds + mountain tops) and pins its top to world y 0;
the mid layer uses the full sheet (transparent above its rooftops) and pins its bottom to world
y 380 — 60 px below the walkway surface at y 320 — so the ground shadow stays hidden behind the
terrace and only the skyline shows.

**Why:** At 2× the sheets cover the screen but the town reads as adjacent and the bell loses its
silhouette against buildings. At 1× pinned to the top, the sheet's bottom leaves a void band.
Anchoring in world space keeps the composition stable across camera heights and removes magic
pixel offsets from the scene code.

**Alternatives:** a full-screen sky gradient behind the layers (rejected: another fullscreen
blended pass on software WebGL); cropping the skyline at its first opaque row (rejected: it cut
the tallest spires flat).

## D020 — 2026-10-19 — Camera E2E asserts motion and a valid clip, not a mid-stride frame

**Decision:** The patrol camera test asserts the hero advanced >40 px, the camera >10 px, and the
hero's clip is `idle|run`, instead of requiring exactly `run`.

**Why:** The snapshot lands on an arbitrary simulation tick and the scripted patrol pauses at
both ends, so `idle` is a legitimate state at that instant. The earlier assertion failed exactly
this way once boot slowed. The boot test already covers clip validity.

**Alternatives:** waiting a fixed number of ticks before asserting (rejected: couples the test to
timing and would fail the same way under load).

## D021 — 2026-10-19 — Content data is typed TypeScript, not runtime JSON (M1)

**Decision:** Rooms, art rects and animation clips live in `src/data/*.ts` as typed constant data.
Room glyph rows are validated at runtime (unknown glyph, missing legend, unknown prop/background
throw); everything keyed by `ArtKey` / `TileRole` / `PropKey` is checked at build time. The JSON
sheet format in ASSET_NOTES remains the contract for _external_ content; no JSON loader exists yet.

**Why:** Every rect and key is compile-checked, there is no parsing/validation code for data we
own, and content ships inside the bundle with no extra fetch path. ASCII rows are already a
readable data format, and the type system enforces that the packed and procedural providers cover
the same logical keys.

**Alternatives:** runtime JSON now (rejected: untyped and needs a schema validator before it buys
anything); hybrid (revisit when content is authored outside the repo).

---

(append new entries at the bottom; never edit old ones — correct them with a new entry)
