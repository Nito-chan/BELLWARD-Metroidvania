# BELLWARD (working title)

A souls-like 2D metroidvania vertical slice with puzzle bosses. Browser first
(Vite + PixiJS v8 + TypeScript), later packaged for Android (Capacitor) and PC (Tauri).
Built to a master production doc; every deviation from it is logged in `docs/DECISIONS.md`.

## Status

- **M0 — Project skeleton: complete.** Fixed-timestep loop (60 Hz), typed EventBus, seeded RNG,
  debug overlay (F1), asset manifest validator, unit + E2E test harness.
- Next: M1 — procedural art, asset downloads, renderer base.

## Quick start

```sh
npm install
npm run dev          # http://localhost:5173
```

First-time E2E setup: `npx playwright install chromium`.

## Commands

| Command                       | What it does                                                |
| ----------------------------- | ----------------------------------------------------------- |
| `npm run dev`                 | Vite dev server                                             |
| `npm run build`               | Typecheck + production build to `dist/`                     |
| `npm run preview`             | Serve the built `dist/`                                     |
| `npm run typecheck`           | `tsc --noEmit`                                              |
| `npm run lint`                | ESLint, zero warnings allowed                               |
| `npm run test`                | Vitest unit suite                                           |
| `npm run test:e2e`            | Playwright smoke (runs the dev server itself)               |
| `npm run assets:check`        | Validate `public/assets/MANIFEST.json` against disk         |
| `npm run assets:check:strict` | Same, but fails on UNCLEAR-license placeholders (ship gate) |
| `npm run check`               | typecheck + lint + test + build                             |
| `npm run check:all`           | `check` + E2E                                               |

## Repository layout

```
src/core        fixed timestep, loop, event bus, RNG, math, errors, composition root
src/config      tunable constants (no magic numbers in logic)
src/render      rendering (M0 demo scene only; the real Renderer lands in M1)
src/debug       F1 overlay + debug state contract
scripts         assets:check validator (fetch scripts land in M1)
tests/unit      Vitest (fixed step, loop, bus, RNG, math, manifest)
tests/e2e       Playwright smoke (boot, frame rate, overlay)
docs            DECISIONS / PROGRESS / BIBLE / CONTROLS / ASSET_NOTES / MANUAL_DOWNLOADS
```

## Rules of engagement (condensed)

- Fixed 60 Hz simulation, independent from rendering; all gameplay randomness from the seeded RNG.
- All tunables in `src/config`; content is data-driven.
- No silent stubs: unimplemented features throw or warn and are listed in `docs/PROGRESS.md`.
- No paid assets; licenses archived in the manifest and checked in CI-style runs.

## Requirements

- Node ≥ 22.12 (developed on 24.x), npm ≥ 10.
