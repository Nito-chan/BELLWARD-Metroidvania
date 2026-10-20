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
- **M3 — Audio: complete.** A Howler-backed `AudioManager` behind a testable backend seam: three-bus
  mix (master/music/sfx) persisted across reloads, `B` mute, music that starts only on the first
  gesture, a deterministic distant-bell ambience, and simulation events (jump, land grades,
  footsteps, skid, attacks, dash) driving CC0 sound effects. The terrace now has its own track; the
  boss loops are downloaded only when a boss room asks for them. All gates green.
- **M4 — Combat, three enemies & the death loop: complete.** A deterministic combat resolver with
  swing ids, hitstop and pooled FX; five-mask health, i-frames, hurt stun and a 100-tick death fade;
  three data-driven enemies (parishioner, ghoul, fireball-casting adept) with shared FSMs and a
  validated spawn pipeline; a shared character renderer, wind-up telegraphs, a combat HUD and
  procedural fallbacks for every enemy/effect. Death rebuilds the room while art and music stay
  warm. All gates green.
- **M5 — Pause, settings and the binding editor: complete.** An accessible DOM pause flow over the
  deterministic loop: pause, master/music/effects mix with mute, and a keyboard/gamepad binding
  editor with conflict detection, two-step reset and versioned persistence. Opening the menu freezes
  ticks, keeps rendering/music alive and traps focus inside the dialog. All gates green.
- **M6 — Bosses of the Drowned Belfry: complete.** The Bellbearer gate fight plus Warden Moss and the
  Bell Thief: seven phases, fifteen data-driven telegraphed patterns, three arena rooms and a Bell
  Nave hub, boss health/phase HUD and banners, guard/lane/rain warnings, boss SFX and loops, and
  first-clear sigils worth one mask. Claimed bosses stay dead for the run; the return door unlocks on
  victory. All gates green.
- Next: M7 — save/load, benches and the map.

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
src/config      tunable constants (input, player, combat, enemies, physics, render, audio, menu; no magic numbers)
src/data        art keys/rects/clips, enemy/effect sheets, room definitions and sound/track catalogs
src/input       keyboard/gamepad manager, per-tick snapshots and the versioned binding document
src/physics     body model and the tile collision solver
src/player      player state machine, vitals, i-frames, attack windows and sound events
src/enemies     shared FSM, melee/caster behaviors, boss phases/patterns and spawn factory
src/combat      damage resolver, projectile pool and shared hitbox geometry
src/ui          combat HUD plus the pause/sound/controls DOM menu
src/audio       audio manager and the Howler backend seam (nothing else imports Howler)
src/world       semantic tile roles, tilemap and room model, including validated enemy spawns
src/render      art provider, procedural fallbacks, camera, shared character/enemy views, FX, room scene
src/debug       F1 overlay + debug state contract
scripts         asset fetcher/validator, screenshot capture (--run / --combat / --boss / --boss-phase / --overlay / --menu / --settings / --controls)
tests/unit      Vitest (core, world, input, bindings, menus, collision, player, boss patterns, camera, animator, combat, enemies, audio, manifest)
tests/e2e       Playwright smoke (boot, movement, jump, collision, fps, overlay, audio gate, combat/death, menus, bosses)
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
