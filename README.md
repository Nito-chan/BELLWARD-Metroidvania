# BELLWARD (working title)

A souls-like 2D metroidvania vertical slice with puzzle bosses. Browser first
(Vite + PixiJS v8 + TypeScript), later packaged for Android (Capacitor) and PC (Tauri).
Built to a master production doc; every deviation from it is logged in `docs/DECISIONS.md`.

## Status

- **M0 — Project skeleton: complete.** Fixed-timestep loop (60 Hz), typed EventBus, seeded RNG,
  debug overlay (F1), asset manifest validator, unit + E2E test harness.
- **M1 — Art pipeline + renderer base: complete.** Asset fetcher and license archive, semantic
  tilemap/world model, packed art with procedural fallbacks, parallax, camera, animated hero, and
  the first room: **The Belfry Terrace**.
- **M2 — Input, player controller & collision: complete.** Deterministic 60 Hz player state machine
  (idle/run/skid/jump/fall/attack/dash) with coyote time, input buffering, variable jump height and
  a two-stage attack; tile collision with one-way platforms, drop-through and ceiling corner
  correction; keyboard + gamepad bindings (`docs/CONTROLS.md`); camera look-ahead; the terrace now
  has two climbable routes. All gates green.
- Next: M3 — audio (Howler): music, ambience and the movement SFX set.

## Quick start

```sh
npm install
npm run dev          # http://localhost:5173
```

First-time E2E setup: `npx playwright install chromium`.

## Commands

| Command                        | What it does                                                |
| ------------------------------ | ----------------------------------------------------------- |
| `npm run dev`                  | Vite dev server                                             |
| `npm run build`                | Typecheck + production build to `dist/`                     |
| `npm run preview`              | Serve the built `dist/`                                     |
| `npm run typecheck`            | `tsc --noEmit`                                              |
| `npm run lint`                 | ESLint, zero warnings allowed                               |
| `npm run test`                 | Vitest unit suite                                           |
| `npm run test:e2e`             | Playwright smoke (runs the dev server itself)               |
| `npm run assets:check`         | Validate `public/assets/MANIFEST.json` against disk         |
| `npm run assets:check:strict`  | Same, but fails on UNCLEAR-license placeholders (ship gate) |
| `npm run fetch-assets`         | Download + unzip the registered asset packs                 |
| `npm run screenshot -- <path>` | Capture the running game canvas (dev server required)       |
| `npm run check`                | typecheck + lint + test + build                             |
| `npm run check:all`            | `check` + E2E                                               |

## Repository layout

```
src/core        fixed timestep, loop, event bus, RNG, math, errors, composition root
src/config      tunable constants (input bindings, player feel, physics, render; no magic numbers)
src/data        art keys/rects/clips and room definitions (content, no logic)
src/input       keyboard/gamepad manager and per-tick input snapshots
src/physics     body model and the tile collision solver
src/player      player state machine (movement, jump, attack, dash)
src/world       semantic tile roles, tilemap and room model (collision reads these)
src/render      art provider, procedural fallbacks, camera, layers, hero view, room scene
src/debug       F1 overlay + debug state contract
scripts         asset fetcher/validator, screenshot capture
tests/unit      Vitest (core, world, input, collision, player, camera, animator, manifest)
tests/e2e       Playwright smoke (boot + packed art, keyboard movement, jump, collision, fps, overlay)
docs            DECISIONS / PROGRESS / BIBLE / CONTROLS / ASSET_NOTES / MANUAL_DOWNLOADS
public/assets   downloaded packs, MANIFEST.json and per-pack LICENSE.txt files
```

## Rules of engagement (condensed)

- Fixed 60 Hz simulation, independent from rendering; all gameplay randomness from the seeded RNG.
- All tunables in `src/config`; content is data-driven.
- No silent stubs: unimplemented features throw or warn and are listed in `docs/PROGRESS.md`.
- No paid assets; licenses archived in the manifest and checked in CI-style runs.

## Requirements

- Node ≥ 22.12 (developed on 24.x), npm ≥ 10.
