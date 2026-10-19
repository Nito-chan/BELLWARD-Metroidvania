# Progress log

Per-milestone reports, newest last. Each entry: what shipped, gate results, adjustments made,
and what is explicitly deferred — nothing here hides a stub.

---

## M0 — Project skeleton (2026-10-19)

**Commit:** `d28f92f` · **Status:** complete, all gates green.

### Shipped

- **Toolchain pinned and locked:** TypeScript 6.0.3, Vite 8.3.4, Vitest 5.0.5 (+coverage-v8),
  Playwright 1.64.1, ESLint 10.13.0 (+ @eslint/js, typescript-eslint 8.71.2, globals,
  eslint-config-prettier), Prettier 3.9.10, tsx 4.23.15, pixi.js 8.22.0, howler 2.2.4 (+ types).
- **Deterministic core:** `FixedTimestep` (60 Hz, stall-clamped), `Loop` (one RAF chain, pause,
  time-scale, injectable scheduler for tests, fps smoothing), typed `EventBus` (listener errors
  isolated and reported, snapshot-safe dispatch), seeded `Rng` (mulberry32, fork/getState),
  `Math2D`, `Errors` (`BellwardError` / `NotImplementedError` / `formatError`).
- **Composition root `Game`:** Pixi v8 init (`preference: 'webgl'`, 640×360, resolution 1,
  integer CSS upscale), manual render driving (App ticker disabled), DEV-only `window.__game`
  handle (`debugState`, `sampleFrame`).
- **F1 debug overlay:** DOM `<pre>`, ≤6 Hz refresh, driven by `GameDebugState`.
- **Temporary `DemoScene`** (M0 proof-of-life; replaced by the real renderer in M1 — D017).
- **Asset pipeline scaffolding:** `public/assets/MANIFEST.json`, pure validator
  (`scripts/lib/manifest.ts`) + CLI (`assets:check`, `--strict` shipping gate), semantics in D008.
- **Docs:** DECISIONS (17 entries), BIBLE (wordless story bible v0), CONTROLS (planned bindings),
  ASSET_NOTES (sheet + animation data format v0), MANUAL_DOWNLOADS, README.
- **Tests:** 50 unit tests (fixed step, loop, bus, rng, math, manifest) + 3 E2E smoke tests
  (boot/non-blank with color histogram, frame-rate + sim-time tracking, F1 overlay toggle).
- **Tooling:** `npm run screenshot` frame capture → `docs/screenshots/M0-boot.png`.

### Gates (all green at commit)

| Gate                   | Result                                                                           |
| ---------------------- | -------------------------------------------------------------------------------- |
| `npm run typecheck`    | clean                                                                            |
| `npm run lint`         | clean, zero warnings                                                             |
| `npm run test`         | 50/50 passed (6 files, ~1.7 s)                                                   |
| `npm run build`        | ✓ 729 modules, 292 kB JS / 87 kB gzip, 2.2 s                                     |
| `npm run test:e2e`     | 3/3 passed — 62.8 fps avg vs 45 floor, `uniqueColors > 8`, sim tracks wall clock |
| `npm run assets:check` | OK, 0 warnings (manifest empty by design)                                        |

### Findings & adjustments (recorded in DECISIONS)

- **D003 corrected:** Pixi 8.22 ships a canvas fallback renderer after all (the "WebGL-only" premise
  was wrong for this version). We still prefer WebGL and E2E asserts the WebGL path.
- **D016 revised after measurement:** stage-content bounds had stretched the pixel readback to
  388 px tall → extraction now uses an explicit 640×360 frame; E2E runs at the native viewport;
  FPS floor is self-calibrating (75% of measured bare-RAF ceiling, clamped to [30, 45]). Cold
  first runs measured 37–40 fps; the frozen configuration measures ~56–63 fps (≈94–100% of ceiling).
- **ESLint:** project-wide `_`-prefix convention for intentionally unused identifiers.

### Explicitly deferred / stubs

- `DemoScene` is temporary by design (D017) — replaced in M1.
- `howler` installed but unused until M3 (D009).
- No input system yet (M2); `docs/CONTROLS.md` is the contract it will implement.
- First real manifest entries land with the M1 asset downloads.

### Next milestone preview (M1)

Procedural art fallbacks, asset downloads + license archiving (Gothicvania CC0 packs, Kenney packs,
Fantasy Knight, alkakrab music), renderer base: camera, tilemap room loading, parallax layers, and
the first playable test room.

---

## M1 — Art pipeline + the Belfry Terrace (2026-10-19)

**Commit:** `59ee08a` · **Status:** complete, all gates green.

### Shipped

- **Asset pipeline:** `npm run fetch-assets` downloads, unzips and prunes the approved packs,
  writes each pack's verbatim license next to it as `LICENSE.txt`, and merges its MANIFEST entry.
  Four packs / 352 files / 1.1 MB: GothicVania Church, Town and Warped Caves (all CC0, ansimuz)
  and Fantasy Knight (aamatniekss, custom free-commercial — D014). `assets:check`: 474 on-disk
  files, 0 warnings.
- **World model:** semantic tile roles (`floor`, `floorFill`, `wall`, `wallTrim`, `pillar`,
  `ledge`, `window`, `backgroundBrick`, `puddle`, `rubble`, `cobweb`) carrying `solid` / `oneWay`
  flags for M2 physics; glyph-row `Tilemap` (bounds, non-empty count, iteration); `Room` factory
  with fail-loud validation (unknown glyph, missing legend, unknown prop or background). No room
  data names an atlas cell.
- **Content:** the first room, **The Belfry Terrace** — 60×24 tiles (960×384), four-tile stone
  towers at both ends, a one-way beam at row 12, a raised dais at rows 16..19, and a 60-tile
  walkway; balustrades, carved columns and the broken bell.
- **Art provider:** packed textures load in parallel and fall back **per texture**; a packed mode
  requires only the tileset, so partial downloads still render. Sub-textures are cached for crops.
  Every logical key has a `ProceduralArt` fallback (tiles, props, backgrounds, 6-frame hero), so
  the game runs with an empty `public/assets/`. Procedural painters were split into
  `src/render/procedural/*` to keep files small.
- **Hero:** Fantasy Knight idle/run, 120×80 frames, 10 frames each (idle 8 ticks/frame, run 5),
  feet-center pivot (54, 80), flip via `scale.x`, fixed-tick `SpriteAnimator`, contact shadow.
- **Rendering:** `Camera` (deadzone, exponential smoothing, clamp/center, render interpolation),
  `RoomScene` (parallax → tiles → back props → hero → front props → ambient wash → motes),
  `TileLayer` (decor/solid split, stable per-cell variants), `PropLayer`, `ParallaxLayer` (plain
  strip sprites anchored in world space), scripted patrol standing in for M2 input.
- **Debug:** the scene snapshot now reports room id/name, drawn tiles, art mode + loaded/failed
  textures, camera and hero for both the F1 overlay and E2E.
- **Docs:** DECISIONS D018–D021, ASSET_NOTES v1 (packs, hero grid/pivot, tile roles, parallax
  contract), MANUAL_DOWNLOADS (still none), README status/commands/layout, M1 screenshot.

### Gates (all green at commit)

| Gate                   | Result                                                                      |
| ---------------------- | --------------------------------------------------------------------------- |
| `npm run typecheck`    | clean                                                                       |
| `npm run lint`         | clean, zero warnings                                                        |
| `npm run test`         | 85/85 passed (10 files, ~3 s)                                               |
| `npm run build`        | ✓ 749 modules, 273.89 kB JS / 80.78 kB gzip, ~4 s                           |
| `npm run test:e2e`     | 4/4 passed — 62.0 fps avg vs 45 floor, packed art, camera patrol, F1 toggle |
| `npm run assets:check` | OK, 474 files, 0 warnings                                                   |
| `npm run format:check` | clean                                                                       |
| Screenshot             | `docs/screenshots/M1-terrace.png`                                           |

### Findings & adjustments (recorded in DECISIONS)

- **Render budget was the M1 blocker.** The finished scene ran at ~15 fps on headless SwiftShader.
  A raw WebGL2 probe drew four blended fullscreen quads at 60 fps, so this was not a fill-rate
  ceiling: Pixi's batch shader evaluates `maxBatchableTextures` texture selects per pixel. Capping
  the batch at 2 textures restored 60 fps (D018). The cap is a config constant, set before the
  first render.
- **Baking made it worse.** Baked tile/prop quads measured 46 → 24 → 15 fps as large alpha quads
  were added, versus 60 fps for 440 unbaked sprites. `src/render/bake.ts` was deleted; layers are
  never flattened.
- **`TilingSprite` replaced by strip sprites.** Each layer is a row of plain sprites covering the
  viewport plus its maximum pan; at this room size that is one sprite per layer.
- **Composition iteration → data-driven backgrounds (D019).** At 2× the town swallowed the sky and
  the bell lost its silhouette; the final contract crops the sky band, keeps the skyline sheet
  uncropped (it is transparent above the roofs) and pins each layer to a world-space edge.
- **Patrol range** ends at x 680 so the scripted walker stops before the dais (704) — there is no
  collision until M2, so the bound is the stand-in.
- **E2E camera assertion** now checks movement + a valid `idle|run` clip instead of demanding a
  mid-stride frame (D020). Suite time dropped from 100+ s to 16.6 s once the scene hit 60 fps.
- **Content data is typed TypeScript**, not runtime JSON yet (D021); the JSON sheet contract stays
  for external packs.

### Explicitly deferred / stubs

- **Movement is a scripted patrol**, not input: no controller, gravity or tile collision until M2.
  The hero can walk through the one-way beam and the dais is currently scenery.
- **One room only** — no doors, transitions, map, benches, save/load or respawn yet.
- **Audio, menus/fonts/UI, particles, enemies and bosses** are later milestones (M3+); `howler`
  remains installed but unused.
- **Warped Caves** is fetched and manifested but no art key references it yet.
- **The bell is procedural-only** and has no interaction or sound; it is set dressing in M1.
- **Per-clip foot offsets** are deferred until the real controller shows whether the run cycle's
  slight lift matters.

### Next milestone preview (M2)

Player controller + input mapping (`docs/CONTROLS.md`): acceleration/friction, jump with coyote
time and variable height, attack/dash placeholders, collision against the tile roles (solid and
one-way), camera follow polish, and the first traversal gate for the metroidvania loop.
