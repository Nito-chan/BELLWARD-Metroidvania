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

---

## M2 — Input, player controller & collision (2026-10-19)

**Commit:** `96066b7` · **Status:** complete, all gates green.

### Shipped

- **Input (`src/config/input.ts`, `src/input/*`):** 12 `ACTIONS`, keyboard bindings keyed by
  `KeyboardEvent.code` (the `docs/CONTROLS.md` contract), standard-mapping gamepad buttons/axes with
  a 0.4 stick deadzone, and `InputManager` — DOM-free `handleKey(code, down)` / `blur()` /
  `snapshot()` with single-fire press/release edges queued between ticks, auto-repeat ignored and an
  injectable pad reader for tests. `serialize()` emits the versioned binding document the M5 binding
  editor will round-trip.
- **Tile collision (`src/physics/*`, `src/config/physics.ts`):** `Body` AABB and `moveAndCollide`,
  axis-separated (X then Y) in ≤8 px sub-steps; out-of-bounds cells block on every side; one-way
  platforms catch only downward motion that started above their top edge and stand down during a
  drop-through; a resting-contact ground probe; 6 px ceiling corner correction. `Tilemap.isWall`
  marks sideways blockers (one-way platforms are never walls).
- **Player controller (`src/player/PlayerController.ts`, `src/config/player.ts`):** FSM
  idle/run/skid/jump/fall/attack/dash. Ground/air acceleration with friction and a 140 px/s run cap,
  560 px/s jump under 2100/2500 px/s² gravity (apex ≈70 px), variable height, apex float, coyote
  time, jump/attack buffers, skid deceleration, a two-stage ground attack (16/20-tick clips, active
  windows 4–11 and 5–15), a dash burst (300 px/s, 11 ticks, 24-tick cooldown) and down+jump
  drop-through. Pure simulation: no Pixi, no DOM, no wall clock — a unit test runs two identically
  scripted controllers and asserts frame-for-frame equality.
- **View & camera:** `HeroView.setPose({x, y, facing, animation, restart, grounded})` with the
  contact shadow now parented to the pose (airborne = smaller + fainter); camera look-ahead
  (`CAMERA.lookAheadX` 28 px toward facing) with `focusOffsetY` moved into `CAMERA`; the scripted
  patrol and the `DEMO` config block are deleted.
- **Room:** the terrace gained the dais approach (two step blocks at x 672/688) and a three-beam
  ascent up the left tower to the broken beam bridge, so the room now has two real traversal routes.
  Tile count 440 → 449.
- **Art:** six new knight sheets wired (turn, jump, fall, attack1, attack2, dash) with authored
  per-frame durations; the packed hero is all-or-nothing (`KNIGHT_REQUIRED`). The procedural fallback
  was extended to 12 poses with the same clip names and durations.
- **Debug/E2E:** the scene snapshot's `hero` became `player` (x, y, vx, vy, state, animation, facing,
  grounded, clipTick); the F1 overlay shows state/clip/velocity; the smoke suite now drives real
  keyboard input.
- **Docs:** DECISIONS D022–D025, CONTROLS.md status → implemented (key list validated in M2 with no
  changes), ASSET_NOTES hero clip table, README status.

### Gates (all green at commit)

| Gate                   | Result                                                                      |
| ---------------------- | --------------------------------------------------------------------------- |
| `npm run typecheck`    | clean                                                                       |
| `npm run lint`         | clean, zero warnings                                                        |
| `npm run test`         | 126/126 passed (13 files, ~5 s) — up from 85                                |
| `npm run build`        | ✓ 287.28 kB JS / 84.92 kB gzip                                              |
| `npm run test:e2e`     | 6/6 passed — 65.6 fps avg vs 45 floor                                       |
| `npm run assets:check` | OK, 474 files, 0 warnings                                                   |
| `npm run format:check` | clean                                                                       |
| Screenshot             | `docs/screenshots/M2-terrace.png` (hero running, camera panned to the dais) |

### E2E coverage (rewritten for real input)

1. boots with packed art; the player stands idle on the walkway at y 320;
2. keyboard walk: >60 px of travel with the camera following, `run` → `idle` on release, vx → 0;
3. full jump sampled **inside the page every frame**: >10 airborne frames, apex 40–95 px, lands back
   within 1 px;
4. collision gate: a held run stops flush against the dais step (x ≈ 666) and clears it after a jump;
5. frame rate while the player is moving (self-calibrating floor, D016);
6. F1 overlay reports the player state/clip/velocity.

### Findings & adjustments (recorded in DECISIONS)

- **A naïve ground probe broke the jump (real bug).** "Is there a solid tile below the feet?" is
  _true_ while the feet are inside a one-way platform during a rise, so the controller believed it
  had landed at y 303 and froze mid-jump. The probe now requires a resting contact (feet within
  0.5 px of the row's top edge) **and** `vy >= 0` (D023). Caught by the room test that jumps onto an
  ascent beam.
- **The first E2E jump test was wrong, not the game.** It polled from the test process and released
  `Space` after the first sample, so the variable-height cut legitimately clipped the rise to ≈18 px
  and the hero never reached the beam. Fixed by holding the button and sampling with rAF inside the
  page (D024).
- **Test fixtures needed real headroom.** Rooms are 96–160 px tall in the first fixtures, which
  silently capped the jump apex at the room's top border. Fixtures now carry ≥128 px of clearance,
  which is also a useful regression: the apex assertion would catch a "room height" mistake again.
- **The M1 contact shadow never followed the hero** — it was added to the scene container at the
  world origin. It is now part of the pose (D025).
- **Screenshot tooling:** `npm run screenshot -- <path> --run` holds ArrowRight so milestone shots
  show the controller in motion instead of the spawn pose.

### Explicitly deferred / stubs

- **Attacks deal no damage.** `attackActive` (the damage window) is emitted and unit-tested, but there
  are no hitboxes, health or entities until M4.
- **Dash and drop-through are ungated** — they exist for feel; the ability gate (item + door) arrives
  with the map/items milestone.
- **Heal / cast / interact / map / pause are bound but unused** — no system consumes them yet.
- **Gamepad support is implementation-complete but hardware-unverified** (unit-tested with an injected
  pad only; no controller was available).
- **No audio, enemies, bosses, additional rooms, save/load or UI** (M3+); `howler` remains unused.
- **Per-clip foot offsets** remain deferred: the run cycle lifts the feet a few pixels and the contact
  shadow compensates. Revisit if it reads badly against M9's polish pass.

### Next milestone preview (M3)

Audio: a Howler-based sound manager (music/ambience for the terrace, SFX hooks for the movement set
shipped here), a mix/volume model, and the already-downloaded music assets verified for license
before use.

---

## M3 — Audio (2026-10-20)

**Commit:** `d89a06b` · **Status:** complete, all gates green.

### Shipped

- **Audio architecture (`src/audio/*`):** `AudioManager` owns the mix, unlock gate, cooldowns, music
  crossfades, the bell ambience and persistence. It talks to an `AudioBackend` interface;
  `HowlerBackend` is the only module in `src/` that imports Howler (D026). A recording fake backend
  drives all 18 audio unit tests without a sound device.
- **Content & tuning:** `src/config/audio.ts` (bus defaults 0.9/0.65/0.9, fades 2400 ms in / 900 ms
  out, ±6 % pitch jitter, bell first toll at 1500 ticks then 2100–4200, 600-tick cooldown, storage +
  mute key) and `src/data/audio.ts` (9 SFX keys with 5 footstep variants, 3 bell variants; 3 music
  tracks; the total `PLAYER_SFX` map). `bossAbyss` / `bossCitadel` are registered but not yet played.
- **Mix:** master/music/sfx buses; master is applied once on the context, play requests carry their
  own bus level. `B` toggles master mute (the track keeps its position); the mix and mute state
  persist to `localStorage['bellward.audio.v1']` with every access wrapped in `try/catch` (D029).
- **Autoplay gate (D027):** nothing is scheduled before the first gesture; `unlock()` opens the gate
  synchronously and only then awaits the context. Playback additionally requires
  `contextState() === 'running'`, so sounds are never queued into a frozen clock and released in a
  burst on resume. Music starts with a fade-in; changing rooms crossfades (0.9 s).
- **Lazy music registration:** only SFX are preloaded at boot. A track is downloaded and decoded the
  first time a room requests it, so the two boss loops (6.6 MB) never load for a player who stays on
  the terrace.
- **Simulation → sound (`PlayerController`, D028):** a per-tick `PlayerEvent` buffer
  (jump, land, landHeavy, footstep, skid, attack1, attack2, dash) returned by `RoomScene.update()`.
  Landings are graded by pre-collision fall speed (soft below 700 px/s, heavy at or above); footsteps
  run every 25 ticks against the 50-tick run cycle, first one 14 ticks in; skid fires only on the
  transition. `Game` forwards events to the audio manager each tick and calls `audio.tick()` for the
  bell ambience.
- **Ambience:** a distant bell tolls on the simulation clock from `AudioManager`'s own RNG fork, so
  the world's RNG sequence (and replay determinism) is untouched.
- **Assets (4 packs, 188 files, 11.1 MB):** Kenney RPG Audio and Impact Sounds (both CC0) for
  cloth/leather/blade/footstep/impact/bell sounds, congusbongus "Cathedral in the forest" (CC0) for
  the terrace, and two loops from alkakrab's dark-fantasy boss pack (author-confirmed commercial
  use). Every pack ships its verbatim licence. `assets:check`: 662 files, 0 warnings. Full key → file
  map in `docs/ASSET_NOTES.md`.
- **Fetcher:** asset packs gained an `include` regex filter, a single-file download strategy and a
  cached-download reuse path; the itch flow now selects the right `div.upload` row and handles both
  "Download Now" and "No thanks" variants. The cached 6-loop boss zip is reusable for widening the
  selection later.
- **Debug/E2E/tooling:** the F1 overlay shows `audio` (`context`, unlocked/muted, track +
  `(playing)`, last SFX and tick), `mix` and `music`; failures are listed. `npm run screenshot`
  gained `--overlay` (whole-page shot, waits for a live playing path). The smoke suite grew two M3
  tests: silent-until-gesture → running + `terrace (playing)` with overlay attachment, and
  mute → reload persistence. The M2 walk test now waits for a live context and proves footsteps
  arrive as `lastSfx`.

### Gates (all green at commit)

| Gate                   | Result                                                                     |
| ---------------------- | -------------------------------------------------------------------------- |
| `npm run typecheck`    | clean                                                                      |
| `npm run lint`         | clean, zero warnings                                                       |
| `npm run test`         | 144/144 passed (14 files, ~4.7 s) — up from 126                            |
| `npm run build`        | ✓ 762 modules, 330.70 kB JS / 96.94 kB gzip (Howler adds ~43 kB)           |
| `npm run test:e2e`     | 8/8 passed — 70.8 fps avg vs 45 floor, 2.4 min (audio startup dominates)   |
| `npm run assets:check` | OK, 662 files, 0 warnings                                                  |
| `npm run format:check` | clean                                                                      |
| Screenshot             | `docs/screenshots/M3-audio.png` (overlay: context running, `terrace (playing)`, `last-sfx footstep@644`) |

### E2E coverage added

1. boots silent: `unlocked false`, `musicPlaying false`, `failed []`, track requested (`terrace`);
2. first key press opens the gate; context reaches `running` and the track reports playing; overlay
   shows `terrace (playing)` and the mix; no page errors;
3. `B` mutes without stopping the track, the choice survives a reload, and `B` unmutes again.

### Findings & adjustments (recorded in DECISIONS)

- **Preloading every track stalled the soundtrack and the timing tests.** Registering all three
  loops at boot fetched/decoded 12.9 MB of ogg (~150 MB PCM) and delayed the terrace track by
  ~2.4 s. Music is now registered on first request (D027); the boss loops cost nothing until a boss
  room exists.
- **Context start dominates music latency in this VM.** `AudioContext.resume()` measured 0.8–6 s and
  the software decode of the terrace track brought the first audible music to ~12 s in a probe
  (context running at ~3 s). Playback is gated on a `running` context for correctness, so the E2E
  waits for the real path instead of sleeping; the audio block got a scoped 120 s timeout because
  the first test legitimately takes ~30 s here. On a desktop this is sub-second.
- **Howler's html5 loop mode is audibly gapless-noisy:** it re-plays on `ended`. Music therefore uses
  WebAudio decode, and the boot cost was solved by lazy registration rather than streaming.
- **`.ogg` files from the itch pack live under `Loops ogg/`** because the archive's licence PDF sits
  at the root and the unpacker only strips a single top-level directory. The paths are part of the
  data table; the cached zip makes re-selection instant.
- **Landing sound needed a sampled pre-collision speed.** Reading `vy` after `moveAndCollide` always
  reports 0 on the landing tick, which flattened every landing to "soft"; grading now happens before
  the collision resolves.
- **The screenshot tool needed a real wait.** A fixed settle produced shots where the context was
  still starting and the music had not begun. `--overlay` now waits for `running && musicPlaying`,
  then turns the hero around (he reaches the dais step while audio starts) so the frame shows him
  mid-stride. This is a diagnostics tool improvement, not a gameplay change.
- **Footstep cadence is tied to the clip, not the frame rate:** 25 ticks matches two footfalls per
  50-tick run cycle; `PLAYER.footstepTicks` is the single place to retune it.

### Explicitly deferred / stubs

- **No volume UI.** The mix model and persistence exist and are unit-tested, but the only player
  control is `B` mute; the settings screen arrives with the menus milestone (M5).
- **The two boss tracks are reserved, not played** — boss rooms do not exist until M6. They are
  registered lazily, so nothing downloads them today.
- **No positional/stereo audio and no ducking** (e.g. music under a boss roar); all sounds are 2D
  and centred. Deliberate for the vertical slice.
- **Sound choices were made from file listings, not by ear** (no speakers on this machine); they are
  one-line data swaps, and the unit suite re-checks every URL exists and is manifested.
- **Bells are ambience only** — the broken bell prop has no interaction sound yet; that arrives with
  the bell-interaction mechanic.
- **Gamepad audio parity is untested on hardware** (keyboard and pointer gestures are covered).
- **No sound for heal/cast/interact/map/pause** because no system consumes those actions yet; the
  event map is total over `PlayerEvent`, so adding one is a compile-checked change.
- **Music does not resume from a save** — there is no save system yet (M7).

### Next milestone preview (M4)

Combat and the first enemies: hitboxes and damage windows on the existing two-stage attack, health
and i-frames for the player, three data-driven enemy types with FSMs and pooled projectiles, and the
combat sounds already wired through the event buffer.

