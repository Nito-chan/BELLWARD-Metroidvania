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
