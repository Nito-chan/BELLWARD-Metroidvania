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
- **M7 — Run persistence, benches and the region map: complete.** A versioned `bellward.save.v1`
  document restores room entry, masks, sigils, charted rooms and the bench checkpoint; malformed or
  future saves start clean without breaking play. Two data-driven benches fully heal, rebuild the
  room and set respawn, while death returns to the last rest rather than the room that killed you.
  An accessible DOM region chart opens from the pause menu or `M`, draws routes from the authored
  room exits and hides uncharted names. Claimed bosses and their extra masks survive reloads. All
  gates green.
- **M8 — The Drowned Belfry: complete.** Seven new rooms finish the twelve-room region: the Drowned
  Gallery, Sunless Aqueduct, Bellows, Wall-Claw Shaft, Upper Gallery, and the Ossuary and Reliquary
  secrets. The Wall Claw opens a real wall-jump climb; two nail-breakable walls hide charm rooms; 22
  pickups include four mask shards, five charms and the Tide-Bell. Focus healing, a three-slot charm
  belt, two nail levels and optional harder Ordeal rematches support the three bosses; the Tide door
  ends the slice once. The save is now v2 and migrates v1 in place, and `level:check` plus a full-run
  Playwright audit guard the whole region. All gates green.
- **M9 — Title, onboarding and accessibility: complete.** Boot waits on an accessible title card over the
  live terrace: **Continue** restores the saved run, **Begin anew** needs a second confirmation (Escape
  cancels), and the first real gesture unlocks audio. A non-modal first-run hint strip reads the live
  bindings, yields its auto-hide timer on focus and never blocks play. Settings gained a persisted
  **Camera shake** switch that defaults from the OS reduced-motion preference and applies immediately.
  Bench, objective and boss ownership moved out of `Game` and `RoomScene`. M9 was verified together with
  M10 in the combined sweep; all gates green.
- **M10 — Touch controls and the shipping pass: complete.** A landscape-first DOM touch overlay feeds
  virtual actions through the same held/pressed/released snapshot contract as keyboard and gamepad,
  with multi-touch, safe-area layout, pointer/blur cleanup and clean handoff to every modal. The title
  and onboarding render touch hints instead of keycaps; the canvas now fits the visual viewport (touch
  uses exact fractional scaling, desktop keeps whole pixels) and the shell adds a boot splash plus
  mobile metadata. No new assets. All gates green: 275 unit tests, 37 Playwright tests, strict asset
  validation at 662 files / 0 warnings.
- **G1 — The Keeper's Guard: complete.** The combat foundation now has a held guard, a five-tick
  perfect parry, a Hook Counter, player and enemy posture, a 70-tick KNELL window, red unblockable
  attacks, and one guard reaction per enemy swing. Keyboard `F`, gamepad LT/RT and a touch **Guard**
  button share the same action map; bindings migrate from v1 without resetting custom keys. The HUD
  shows player posture under Focus, enemy bars appear only after posture damage, and boss bars add a
  posture line. No new art or audio was needed. All gates green: 285 unit tests and 38 Playwright
  tests, with guard verified in Chrome at 375, 768 and 1440 plus the touch context.
- **The Drowned Belfry vertical slice is feature-complete; G1 begins the post-slice combat expansion.**
  Physical touch/gamepad testing and Capacitor/Tauri packaging remain the next shipping work.

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
| `npm run test:e2e`             | Full Playwright suite (starts the dev server itself)        |
| `npm run level:check`          | Validate rooms, pickups, benches, gates and map positions   |
| `npm run assets:check`         | Validate `public/assets/MANIFEST.json` against disk         |
| `npm run assets:check:strict`  | Same, but fails on UNCLEAR-license placeholders (ship gate) |
| `npm run fetch-assets`         | Download + unzip the registered asset packs                 |
| `npm run screenshot -- <path>` | Capture the running game canvas (dev server required)       |
| `npm run check`                | typecheck + lint + test + build                             |
| `npm run check:all`            | `check` + E2E                                               |

## Repository layout

```
src/core        fixed timestep, loop, event bus, RNG, math, errors, composition root
src/config      tunable constants (input, player, combat, enemies, progression, pickups, physics, render, audio, menu, bench, save)
src/data        art keys/rects/clips, enemy/effect sheets, room/pickup/bench definitions and sound/track catalogs
src/input       keyboard/gamepad/virtual-input manager, touch detection, per-tick snapshots and bindings
src/physics     body model and the tile collision solver
src/player      player state machine, Focus/healing, Wall Claw, vitals, i-frames and attack windows
src/enemies     shared FSM, melee/caster behaviors, boss phases/patterns and spawn factory
src/combat      damage resolver, projectile pool and shared hitbox geometry
src/save        versioned v2 run document, v1 migration, all-or-nothing validation and progression
src/ui          HUD, title/onboarding, touch overlay, bench, ending, pause flow and the region chart
src/audio       audio manager and the Howler backend seam (nothing else imports Howler)
src/world       semantic tile roles (including breakable/sealed), tilemap and room model
src/render      art provider, procedural fallbacks, camera, character/enemy views, FX, pickups, room scene
src/debug       F1 overlay + debug state contract
scripts         level/content check, asset fetcher/validator, screenshot capture (--run / --combat / --boss / --boss-phase / --overlay / --menu / --settings / --controls / --bench / --map / --title / --onboarding / --touch; add --small for 640x360)
tests/unit      Vitest (core, world, input, bindings, menus, map, saves, progression, collision, player, boss patterns, camera, animator, combat, enemies, audio, manifest, accessibility)
tests/e2e       Playwright (boot, movement, jump, collision, fps, overlay, audio, combat/death, menus, bosses, saves/benches/map, M8 progression/full run, M9 title/onboarding/accessibility, M10 touch)
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
