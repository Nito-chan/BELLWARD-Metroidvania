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

| Gate                   | Result                                                                                                   |
| ---------------------- | -------------------------------------------------------------------------------------------------------- |
| `npm run typecheck`    | clean                                                                                                    |
| `npm run lint`         | clean, zero warnings                                                                                     |
| `npm run test`         | 144/144 passed (14 files, ~4.7 s) — up from 126                                                          |
| `npm run build`        | ✓ 762 modules, 330.70 kB JS / 96.94 kB gzip (Howler adds ~43 kB)                                         |
| `npm run test:e2e`     | 8/8 passed — 70.8 fps avg vs 45 floor, 2.4 min (audio startup dominates)                                 |
| `npm run assets:check` | OK, 662 files, 0 warnings                                                                                |
| `npm run format:check` | clean                                                                                                    |
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

---

## M4 — Combat, three enemies & the death loop (2026-10-20)

**Commit:** `754994a` · **Status:** complete, all gates green.

### Shipped

- **Player survivability (`PlayerVitals`, `PlayerController`):** five masks, 60-tick invulnerability
  after a hit, 30-tick spawn protection, a 16-tick hurt reaction with knockback and a
  face-the-attacker turn, `hurt` / `death` sound events, and a 100-tick death clock. Both existing
  attack clips now open real damage windows; `attackId` identifies a swing so it damages each enemy
  at most once even though the window spans several ticks (D030). A simulation-recorded
  `jumpPeakY` / `lastJumpPeakY` also gives the debug contract a stall-proof jump apex (D034).
- **Combat resolver (`src/combat/*`):** one fixed-order pass per tick — player swing, then each
  enemy's melee or contact, then projectiles. Strict AABB/circle math, no per-hit allocations,
  4-tick hitstop, shake request, pooled impact sparks and death bursts, and a `CombatEvent` stream
  that the scene turns into audio and FX. Enemy melee and contact are mutually exclusive in the
  same tick, and i-frames gate every damage source. The projectile pool is a fixed 12 slots; a full
  pool recycles its shortest-lived shot rather than dropping a cast.
- **Three enemies, data-driven (`src/enemies/*`, `src/config/enemies.ts`):**
  - **Parishioner** — slow walker that claws in place; the readable first fight.
  - **Ghoul** — fast chase with a committed 2-damage lunge on the beam bridge; refuses to lunge off
    a ledge.
  - **Cinder Adept** — rooted caster with a 30-tick cast; the fireball leaves at tick 18, and any
    hit before that cancels the cast.

  They share the FSM `idle / patrol / chase / windup / active / recover / stagger / dead`, expose a
  normalised telegraph to the view, and read every speed, range, damage and duration from
  `ENEMIES`. The adept's fireball has its own pooled lifetime, tile collision and player hit.

- **Room content and validation:** the terrace now has four spawns — two parishioners at x=150 and
  x=270, the ghoul at x=380 on the beam bridge, and the adept at x=872 in the far pocket. The
  spawn corridor 420–660 stays clear, so every M2 traversal test still passes unchanged.
  `createRoom()` rejects an unknown kind, a spawn with no ground, a body overlapping a wall, an
  inverted or out-of-room patrol beat, and a spawn outside its own beat.
- **Rendering:** `CharacterView` is now shared by the hero and every enemy (frame-clock animation,
  slicing, flipping, contact shadow, hit flash); `EnemyView` adds the wind-up telegraph;
  `EffectsLayer` pools 24 sparks and 3 death bursts; `ProjectileView` owns one sprite per pool slot;
  `Hud` draws five health pips plus damage and death overlays. `HeroView` is a thin wrapper, so the
  hero art and animation output are unchanged. Packed boot art grew from 12 to 18 textures
  (parishioner idle/walk, ghoul, adept, death burst, fireball), all with procedural fallbacks.
- **Audio:** six new CC0 SFX (`enemyHurt`, `enemyDie`, `playerHurt`, `cast`, `fireball`,
  `fireballHit`); the total `PlayerEvent` map gained `hurt` and `death`, so the compiler still
  refuses a simulation event with no sound. Everything routes through `AudioManager` (D026–D029).
- **Death and respawn:** death fades the screen for 100 ticks, then `Game` rebuilds the room from
  its data definition with a fresh RNG fork. The loaded `ArtProvider`, the audio manager and the
  playing track survive; enemies return at full health and the new hero gets spawn i-frames (D032).
- **Debug, tests and tooling:** the F1 overlay adds vitals, live foes, shots, hitstop and jump arc;
  `window.__game.debugState()` exposes the same contract. New coverage: 14 combat tests, 13 enemy
  FSM tests, camera-shake decay, room enemy-spawn validation, jump-apex recording, and two M4 E2E
  scenarios. `npm run screenshot -- <path> --combat` drives a real fight and captures the frame.

### Gates (all green at commit)

| Gate                   | Result                                                                                            |
| ---------------------- | ------------------------------------------------------------------------------------------------- |
| `npm run typecheck`    | clean                                                                                             |
| `npm run lint`         | clean, zero warnings                                                                              |
| `npm run test`         | 179/179 passed (16 files, ~3.2 s) — up from 144 (+35)                                             |
| `npm run build`        | ✓ 782 modules, 360.55 kB JS / 105.35 kB gzip (up 29.85 kB / 8.41 kB)                              |
| `npm run test:e2e`     | 10/10 passed (1.8 min), 68.0 fps avg vs 45 floor; a second full run passed at 60.0 fps            |
| `npm run assets:check` | OK, 662 files, 0 warnings                                                                         |
| `npm run format:check` | clean                                                                                             |
| Screenshot             | `docs/screenshots/M4-combat.png` — hero engaging the parishioner, HUD at 5/5, ghoul on the bridge |

### E2E coverage added

1. **Boot contract:** four enemies in spawn order with full HP, player 5/5 and not dead, zero
   projectiles, 18 packed textures, no fallbacks.
2. **Melee kill:** walk into the nearest parishioner, chain stage one into stage two (1 + 2 damage),
   and confirm the room drops to three enemies with no page errors. _M5 update: this test now lands
   three light hits through an in-page helper for headless timing; stage-two chaining is covered
   deterministically in the unit suite (D038)._
3. **Damage, i-frames and death:** take a hit (HP down, invulnerability running), let the parishioner
   finish the hero, verify the death flag, then verify the room rebuilds at spawn with HP 5/5 and
   four restored enemies. The i-frame invariant is asserted on the simulation clock (the four
   remaining hits need four full 60-tick windows), not wall time.

### Adjustments & findings

- **Zero-alpha full-screen overlays were a real frame-rate cost.** The first M4 E2E run measured
  42.0 fps (floor 45) after adding full-screen damage and death quads that were merely transparent.
  Hiding them when their alpha is zero — and caching the HUD setters — restored 67.6 fps in the same
  test. Final runs: 68.0 and 60.0 fps (D033).
- **Two E2E timing flakes, both measurement bugs, not gameplay bugs.** The i-frame check used a
  300 ms wall-clock wait, but after a main-thread stall the fixed-step loop catches up several ticks
  per rendered frame; the sim clock is the only honest clock. The jump check counted airborne
  rAF frames and saw 1 instead of >10 during an audio-decode stall. It now reads the apex the
  simulation recorded (D034); 6/6 repeats and two full suites passed.
- **Procedural death burst aligned to eight frames** (frames 1–8 of the packed sheet) instead of
  nine, so fallback timing matches packed timing exactly.
- **One dead tuning key removed:** `COMBAT.enemy.contactDamage` was never read; per-kind
  `ENEMIES[kind].contactDamage` is the single source of truth.
- **Enemy art falls back as a whole kind**, not per clip: a partial sheet would otherwise leave the
  FSM requesting a missing animation. `ENEMY_REQUIRED` lists the sheets each kind needs.
- **The camera shake is sampled by the camera view, not written into the follow position**, so it
  decays to exactly zero and never leaves the camera offset after a fight.

### Explicitly deferred / stubs

- **Bosses, the Bellbearer and the second pattern boss are not in this milestone** (M6). The boss
  music loops are still registered but unplayed.
- **No menus, pause, settings or volume UI yet** (M5). `B` mute remains the only mix control.
- **No bench, save/load, map or additional rooms yet** — they belong to the later world/save
  milestones; death respawns by rebuilding the current room, not from persistent state.
- **Heal, cast, interact and map inputs are still bindings without a consumer.** Attack is the only
  combat verb; no poise, damage numbers, attack-cancel, parry or grab.
- **Enemies do not jump, pathfind or chase across gaps**, and the adept casts without a line-of-sight
  check; projectiles collide with tiles and the player only. The ghoul's ledge guard is the
  deliberately simple counterweight.
- **No loot, currency, XP or upgrade economy**; a kill only removes the enemy and plays its burst.
- **Known size debt:** `PlayerController.ts` 496 lines and `RoomScene.ts` 312 lines exceed the
  ~300-line guideline. Both are heavily covered and cohesive; extraction is planned for the M9
  polish pass rather than risking the M4 gate.
- **Headless audio remains slow:** the E2E audio block keeps its 120 s timeout and the 45 s
  live-music wait; tightening them would only re-introduce VM flakes.

### Next milestone preview (M5)

Menus and the input binding editor: pause/settings/volume screens on top of the existing input
serialization and audio mix, keyboard and gamepad remapping with conflict detection, and a first
in-game menu pass that can be opened without stopping the deterministic simulation loop.

---

## M5 — Pause, settings and the binding editor (2026-10-20)

**Commit:** `746f3dd` · **Status:** complete, all gates green.

### Shipped

- **Pause flow (`src/ui/menu/*`):** a focused DOM modal with three screens — Pause, Sound and
  Controls. Pause freezes fixed ticks while rendering and music continue, resets held input on
  open/close, marks `#app` inert, traps Tab/Shift+Tab, restores focus on close and hides the root
  with `hidden` when idle. A `pauseLatch` prevents the Escape/Start press that closed the menu from
  reopening it or leaking into gameplay (D035). `MenuSystem` owns the lifecycle and gamepad polling;
  `MenuModel` is a pure screen/capture/status/reset state machine; `MenuView` renders DOM only.
- **Sound screen:** master, music and effects sliders (0–100 in 5% steps), keyboard and gamepad
  adjustment, a live percentage, and a Silence all switch. Changes apply immediately and persist
  through `AudioManager`'s existing `bellward.audio.v1` record; no new audio assets.
- **Binding editor:** all 12 gameplay actions, two keyboard slots and the primary pad-button slot
  per action, keyboard/gamepad capture, slot navigation, conflict detection with the owning action
  named, Escape/Select cancellation, screen-reader descriptions and a two-step Reset defaults.
  Bindings are a versioned, validated, all-or-nothing document at `bellward.bindings.v1`; corrupt,
  partial or future records fall back to the shipped defaults; storage failures are non-fatal but
  warned (D036). Reserved menu/system inputs cannot be captured, while the defaults that use them
  remain restorable by reset (D037).
- **Input and loop integration:** `InputManager` now accepts instance bindings plus
  `setBindings`/`getBindings`/`reset`; `Game` loads bindings before boot, persists accepted edits,
  pauses/resumes the loop around the menu, and exposes the menu state through `debugState()`.
  `DebugOverlay` shows the open screen, focus id, capture target and latest status. Volume/mute
  updates are reflected live; music keeps playing while paused and the simulation-clock bell ambience
  pauses.
- **Layout and accessibility:** dialog semantics (`role="dialog"`, `aria-modal`, labelled title),
  visible focus, reduced-motion-safe transitions, status live region, `inert` canvas, responsive panel
  at 640×360 and 1280×720. Reset defaults is pinned beside Back in the controls footer so it stays
  discoverable when the binding list scrolls; the body scrolls independently. Targets are
  keyboard-first; the dedicated touch pass is M10.
- **Tests and docs:** 27 new unit tests cover the model, binding validation/conflicts/labels and
  audio mix; a four-test M5 Playwright suite covers pause determinism, audio persistence, rebinding
  with reload and focus/layout. `docs/CONTROLS.md` is now the menu/binding contract; D035–D038 record
  the architecture, persistence, reserved-input and E2E decisions.
- **Maintainability:** extracted `MenuPad` (gamepad loop/edge/direction repeat), `screenBuilders`
  (pause/settings/controls DOM) and `bindingLabels` (formatting) after the first implementation.
  `MenuSystem` is 266 lines, `MenuView` 237, `bindings` 258 — all back under the ~300-line guideline.

### Gates (all green at commit)

| Gate                   | Result                                                                                   |
| ---------------------- | ---------------------------------------------------------------------------------------- |
| `npm run typecheck`    | clean                                                                                    |
| `npm run lint`         | clean, zero warnings                                                                     |
| `npm run test`         | 206/206 passed (18 files, ~6.3 s) — up from 179 (+27)                                    |
| `npm run build`        | ✓ 794 modules, 386.33 kB JS / 113.05 kB gzip, 12.70 kB CSS / 3.36 kB gzip                |
| `npm run test:e2e`     | 14/14 passed (3.7 min), 63.2 fps avg vs 45 floor; menu block 1.5 min standalone          |
| `npm run assets:check` | OK, 662 files, 0 warnings                                                                |
| `npm run format:check` | clean                                                                                    |
| Screenshots            | `M5-pause.png`, `M5-sound.png`, `M5-bindings.png` — final pinned-footer layout inspected |

### E2E coverage added

1. **Pause freeze and resume:** open on the terrace, confirm `tickCount` freezes while `frameCount`
   keeps advancing and the dialog stays open, then resume and confirm ticks advance and focus returns
   to the canvas.
2. **Sound persistence:** adjust master with the keyboard and mute with the pointer, confirm the live
   debug state, reload, and confirm the mix survives.
3. **Binding editor:** rebind jump to a free key, verify it applies in play, attempt a conflicting
   key and see it rejected with the owner named, confirm a reserved key is refused without closing
   capture, then reload and verify persistence.
4. **Focus and small viewport:** Tab/Shift+Tab stays inside the dialog (wrap from Back), Escape backs
   out one screen, and the controls screen fits 640×360 with Reset/Back reachable via the pinned
   footer.

### Adjustments & findings

- **Held pause input needed a latch.** The Escape keydown that closes the dialog is still held when
  the simulation resumes. `Game` tracks physical pause keys across the input reset, and
  `pauseLatch` consumes the closing press and any OS auto-repeat until release; the E2E test
  dispatches a repeat keydown and confirms the menu stays closed. Input is reset on both
  transitions and focus returns to the canvas (D035).
- **The full suite exposed pacing assumptions in older smoke tests.** The M4 melee test's 24
  wall-clock key presses and the death test's separate waits could miss 7-tick damage windows and the
  100-tick rebuild under headless IPC latency. Combat/death helpers now dispatch real DOM keyboard
  events and observe first-hurt/death/rebuild inside one page task; stage-two chaining remains
  covered deterministically in unit tests (D038). The walking assertion now accepts `idle|run` and
  waits on distance/camera, and the menu focus test wraps from Back in two presses instead of twelve.
- **Playwright report writes were reloading the dev server.** Vite watched `playwright-report/`,
  `test-results/` and `dist/`; writing a report during a run could trigger an HMR reload and kill the
  page. These paths are now ignored. The global Playwright timeout is 60 s (menu/combat blocks get
  explicit 90 s; the audio block keeps 120 s because headless audio remains slow).
- **The 640×360 layout hid Reset below the scroll.** The first small-viewport screenshot showed only
  five binding rows and no reset action. Moving Reset into the pinned footer with Back fixed both
  discoverability and keyboard reachability; the table still scrolls and the footer stays visible.
- **DOM menus were the right trade.** Native focus, labels and range behavior came for free; the cost
  is two UI systems (Pixi HUD, DOM menus), accepted because the HUD stays in the render loop while
  menus must be accessible and crisp at CSS scale. The closed overlay uses `hidden`, and alpha-zero
  Pixi overlays remain hidden (D033).
- **Gamepad menu support is code-complete but hardware-unverified.** Polling, edge detection,
  repeat, capture filtering and focus movement are implemented; the menu-pad path has no automated
  coverage and this machine has no controller. Keyboard and pointer paths are covered by E2E.
- **No new assets or licences.** The manifest remains 662 files with 0 warnings; menus use the
  existing fonts/CSS and the existing audio mix, so M5 changes no asset provenance.

### Explicitly deferred / stubs

- **Bosses and the Bellbearer are still M6.** No boss room, pattern FSM or boss health bar yet; the
  two boss loops remain lazily registered and unplayed.
- **Save/load, benches and the map are still later milestones (M7+).** Bindings and audio persist,
  but room state, health, currency and position do not.
- **No menu sound effects** (focus/confirm/back) yet; M9 polish owns UI audio. Music continues while
  paused, but there is no pause-specific mix/ducking.
- **No gameplay settings beyond audio:** no screen-shake toggle, key-repeat tuning, deadzone slider,
  language selector or remapping of analog axes. The second pad-button slot exists in the data model
  but the editor exposes the primary slot only.
- **Gamepad menu behavior is not verified on physical hardware**, and screen-reader behavior is based
  on native dialog/focus semantics without a manual NVDA/VoiceOver pass.
- **The editor cannot capture Escape, Tab, F1, bare modifiers, Select, Start or D-pad.** This is
  deliberate (D037); reset restores those defaults.
- **Known size debt remains in older files:** `PlayerController.ts` (496 non-empty / 563 total lines)
  and `RoomScene.ts` (312 / 343) are still above the ~300 guideline and are scheduled for the M9
  polish pass.
- **Headless audio is still slow:** the audio E2E block keeps its 120 s timeout and 45 s live-music
  wait.

### Next milestone preview (M6)

The Bellbearer mini-boss and two pattern bosses: arena rooms, boss health/phase UI, telegraphed
attack patterns, boss audio and rewards, all on the existing deterministic combat and FSM
foundations.

---

## M6 — Bosses of the Drowned Belfry (2026-10-20)

**Commit:** `c802f7f` — **Status:** complete, all gates green.

### Shipped

- **Boss contract and content (`src/config/bossTypes.ts`, `bosses.ts`, `src/enemies/Boss.ts`):**
  three encounters, seven phases and fifteen telegraphed patterns. `Boss` extends the shared
  `Enemy` body/FSM instead of duplicating physics; phases, thresholds, speed scales, pattern pools,
  cooldowns, damage and projectile data all live in typed content. `BossPatternState` owns the
  deterministic weighted roll, distance filters, cooldowns, anti-repeat memory and rain-shot
  accounting. Every telegraph is at least 22 ticks; idle gaps stay within the authored fairness
  bounds, both asserted by content tests.
- **Three fights:** **The Bellbearer** (16 HP, 2 phases) teaches the guarded charge — its bell shield
  blocks all damage until a wall charge shatters it near the player. **Warden Moss** (26 HP, 2 phases)
  controls space with sweeps, shockwaves, spore rain, a wall-stunned dash and a radial burst. **The
  Bell Thief** (32 HP, 3 phases) escalates from coin fans to teleport strikes, dives, rings and bell
  rain. Pattern archetypes cover charge, dash, sweep, slam, dive, rain, fan, ring and teleport.
- **Arena content (`src/data/rooms/*`):** a new enemy-free hub, **The Bell Nave**, connects the
  terrace to three 60×24 arenas. Bosses spawn at x=560 so they are visible from the player's x=120
  entry; two one-way shelves (low 42–49, high 45–51) provide vertical play without creating a safe
  rain camp. The return door is locked while the boss lives. Room labels moved to x=72 so names are
  not clipped.
- **Presentation:** procedural boss art (no new licensed assets), a shared `BossView` with a
  body-sized ward aura, swept charge/dash lanes, player-centred rain lanes and slam/dive target
  markers; screen-space `BossHud` with phase pips and a spell-out of `WARDED`; intro, phase and reward
  `Banner`s; a three-sigil HUD row; and screen-reader announcements. The boss HUD lingers through the
  death fade, then clears.
- **Rewards and re-entry:** a first clear records a sigil, raises the mask ceiling by one and fills
  the new mask. Claimed arenas are skipped for the rest of the run — no boss respawn, and the return
  door is already open. M6 keeps sigils in memory; M7 owns persistence.
- **Audio:** eight boss SFX built from already-approved CC0 packs, plus the two existing alcakrab
  loops (`bossAbyss` for the Bellbearer, `bossCitadel` for the other two). No new downloads and no
  manifest changes.
- **Debug and tests:** `SceneBossDebugState` (hp/max, phase/count/name, ward, pattern, telegraph,
  hidden, x/y, death clock), `exitLocked`, run sigils and `maxHp`; DEV hooks for room load, damage,
  ward break and defeat. `debugLoadRoom()` resets held input so a test cannot carry a run key between
  rooms. Nineteen boss unit tests cover pattern selection, every phase threshold, the wall-stun and
  near-player ward break, rain-shot caps and boss defeat; five Playwright tests cover the nave,
  gate/reward/door flow, Warden phase, Bell Thief final phase and the live Warden boss loop.
- **Docs/tooling:** four M6 captures cover the warded Bellbearer, the Warden phase, the Bell Thief's
  second phase and the first-clear reward with six masks and the sigil row. Screenshots freeze the
  simulation through the pause flow before capturing the canvas, so the chosen boss frame or phase
  banner survives SwiftShader's slow screenshot path. The `--boss-room=<id>` flag now implies a boss
  capture. `docs/PROGRESS.md` and `docs/DECISIONS.md` record the milestone.

### Gates (all green at commit)

| Gate                   | Result                                                                                          |
| ---------------------- | ----------------------------------------------------------------------------------------------- |
| `npm run typecheck`    | clean                                                                                           |
| `npm run lint`         | clean, zero warnings                                                                            |
| `npm run test`         | 234/234 passed (20 files, ~6.5 s) — up from 206 (+28)                                           |
| `npm run build`        | ✓ 825 modules, 440.80 kB JS / 128.03 kB gzip, 12.83 kB CSS / 3.40 kB gzip                       |
| `npm run test:e2e`     | 19/19 passed (7.1 min), 5 boss tests incl. the live Warden loop                                 |
| `npm run assets:check` | OK, 662 files, 0 warnings                                                                       |
| `npm run format:check` | clean                                                                                           |
| Screenshots            | `M6-bellbearer.png`, `M6-warden-phase.png`, `M6-bellthief.png`, `M6-reward.png` — frozen frames |

### E2E coverage added

1. **The Bell Nave** opens all three arenas; each loads its boss kind, phase 0, music and 5 masks,
   with no scene errors.
2. **Bellbearer gate:** 99 damage is blocked while warded; breaking the ward enters phase 1 and
   removes the guard; a real hit lands; defeat records the sigil, raises max masks to 6 and unlocks
   the door; walking back to the nave preserves the reward; re-entering the claimed arena has no boss
   and an open door.
3. **Warden Moss** crosses its phase threshold, reports `The Overgrowth`, and later shows a live
   wind-up telegraph; the exact phase hold and pattern FSM stay in unit tests because the transition
   is shorter than reliable Playwright polling.
4. **Bell Thief** crosses both thresholds and reaches `The Last Silence` (3 phases), with no errors.
5. **Boss audio:** the Warden arena requests `bossCitadel` and waits for the loop to actually play
   after the first gesture, with no failed audio keys.

### Adjustments & findings

- **The ward gate could solve itself.** The Bellbearer's arena-wide charge hit a far wall and broke
  its own shield on the first pattern. The break now requires the player to be within
  `BOSS_FAIRNESS.wardBreakRadius` (64 px) of the impact, so only a baited wall charge counts; the
  player's near-wall punish is the actual puzzle.
- **Claimed bosses kept returning.** The first reward implementation rebuilt the arena with a living
  boss because the scene carried claim state separately. `RoomScene` now skips boss creation when the
  room's sigil is claimed; the arena is silent and the exit is open on re-entry.
- **Rain shot semantics were ambiguous.** `shots` now means the total shots in one active window,
  with `shotIntervalTicks` controlling cadence and `patternShots` capping the loop. This is the
  contract the unit tests and the Warden telegraph share.
- **Transient FSM states are not E2E assertions.** Phase and stagger holds are only a few ticks; a
  Playwright poll can miss them even when the simulation is correct. Boss E2E asserts outcomes (hp,
  phase, ward, reward, door) and snapshots a live wind-up in one page task; exact transition timing
  stays in unit tests. The first damage call after a ward break is retried in-page until the legal
  hit lands, so a slow frame spanning the stagger cannot produce a false failure. Door returns release
  movement with `walkLeftToRoom` because a spawn can overlap its own trigger.
- **Arena framing changed for readability.** The first capture pass had the old ledge columns and
  labels close enough to the edge to clip. Boss spawns, shelves and label positions were retuned so
  the encounter and room name read from the entry; the intro banner and phase HUD arrived after that
  pass.
- **Screenshot capture lost the frame it was aiming at.** SwiftShader writes a frame slower than a
  boss pattern; by save time the idle player could die, reset the room or phase back to intro. Boss
  shots now wait two rendered frames, open the pause menu to freeze ticks, hide the DOM menu and
  capture the canvas. This is diagnostics-only; gameplay and determinism are untouched.
- **Trace capture delayed WebAudio resume in the M2 keyboard smoke.** The test's 20 s window was
  occasionally shorter than headless trace + SwiftShader allowed, even though the context did resume
  on the next frames. It now uses the same 45 s window as the dedicated audio tests, under a 90 s test
  budget; product audio behavior is unchanged.
- **Size debt paid down.** `PlayerController` fell from 496 to 301 non-empty lines by extracting
  pose, combat, dash, jump, reaction, motion and sensor modules. `RoomScene` fell from 485 to 304 by
  extracting the backdrop, motes, exit gate, combat feedback, scene debug snapshot and boss spawn.
  `Boss` gained `BossPatternState`, placement helpers and an event type module; all remain covered by
  the full unit suite.

### Explicitly deferred / stubs

- **Save/load, benches, the map and persistent sigils are M7+.** A run's sigils and mask ceiling
  live in memory; a reload starts the terrace over.
- **Boss art is procedural.** The encounter renderer has no authored boss sheets; the existing
  approved packs are reused for effects and boss SFX. Replacing procedural silhouettes with authored
  art later requires only new art keys and manifest entries.
- **No fog gates, arena intro cutscenes or mid-fight checkpoints.** The return door is the only
  spatial lock; death rebuilds the room at full health and resets the boss.
- **Two shared boss loops cover three fights.** There is no per-boss theme, phase-layer music or
  ducking; the loop is requested on room entry and crossfades with the normal room track.
- **No unique sigil abilities.** Each first clear only raises the mask ceiling; ability gates remain
  later milestones.
- **Gamepad boss play is covered by the shared input path but not separately E2E-tested on hardware.**
- **The 12-room region is not complete.** M6 ships five rooms (terrace, nave, three arenas); the
  remaining region, benches and fast travel arrive later.

### Next milestone preview (M7)

Save/load and benches: persist run position, masks, sigils and room state; add a bench checkpoint
and respawn path; and introduce the map/region loop around the five M6 rooms.

---

## M7 — Run persistence, benches and the region map (2026-10-20)

**Commit:** `c7210e2` — **Status:** complete, all gates green.

### Shipped

- **Versioned run save (`src/save/runSave.ts`, `RunProgress.ts`, `src/config/save.ts`):** one
  `bellward.save.v1` document stores current room, validated spawn, HP, owned sigils, charted rooms
  and checkpoint bench id. Parsing is all-or-nothing: unknown rooms/benches/sigils, duplicate values,
  an unclear standing point, bad HP, an unvisited current room or a future version starts a fresh run.
  Storage access is guarded; a blocked read or write never breaks play. Mask ceilings come from the
  same sigil count used by the reward system.
- **Run lifecycle (`src/core/RunSession.ts`):** the composition root now delegates scene construction,
  room/spawn tracking, progression, autosaves, rest, respawn and map snapshots. A valid resume rebuilds
  the saved room entry without rewriting storage. Room entry, first boss clears, rests and deaths write
  `room`, `reward`, `bench` and `respawn` respectively; a fresh boot writes `boot`.
- **Benches (`src/config/bench.ts`, `src/data/benches.ts`, `Benches` in room data):** data-driven rest
  points with stable ids, validated floor markers, validated spawn offsets and a validated interaction
  range around the seat. **The Weeping Stone** stands in the terrace and **The Bell-Keeper's Rest** in
  the nave, both with procedural stone-bench art. A range-based prompt names the bench; pressing
  interact fully heals, rebuilds the room clean, sets the checkpoint, writes the save and shows a
  `RESTED` arrival banner. The screen reader hears the bench name and the save promise once per
  approach.
- **Death and resume semantics:** reload returns to the last saved room entry with the saved masks,
  sigils and charted rooms. Death returns to the last rested bench (or the terrace before any rest) at
  full masks and rebuilds the room. Claimed bosses stay claimed: their arena has no boss and its return
  door is open after reload.
- **Region map (`src/ui/map/`, menu model/view/CSS):** an accessible DOM chart in the existing
  focus-trapped pause dialog, opened by `map` (M by default) or the pause **Map** entry. It freezes the
  simulation, shows charted count, claimed sigils, current room, last rest and a legend, and derives
  deduplicated routes from the authored exit graph. Unknown room and boss names never enter the DOM;
  the current chamber is `aria-current="location"`. Only Back is focusable; `Escape` or the live map
  key closes it, and the footer's close hint is generated from the current binding instead of a
  hard-coded M.
- **Interaction/debug surface:** `scene.bench` (id/name/in range), `run` facts (room, sigils, max HP,
  visited rooms, checkpoint) and `save` facts (key/version/present/loaded/last successful write) join
  the F1 overlay and DEV contract. `debugLoadRoom(roomId, spawn?)` now accepts a validated spawn.
  `debugKillPlayer()` and `debugProtectPlayer()` support real-path death and deterministic phase probes.
- **Tests and docs:** 21 new unit tests cover the save schema, validation matrix, storage failures and
  progression, bench/save-room validation, map model/layout and the debug i-frame contract; three new
  Playwright flows cover rest → save → map → reload, death to the checkpoint, and sigil/mask persistence
  with a silent claimed arena. `docs/CONTROLS.md`, `README.md` and D043–D047 document the live contract.

### Gates (all green at commit)

| Gate                          | Result                                                                                         |
| ----------------------------- | ---------------------------------------------------------------------------------------------- |
| `npm run typecheck`           | clean                                                                                          |
| `npm run lint`                | clean, zero warnings                                                                           |
| `npm run test`                | 255/255 passed (22 files, ~7 s) — up from 234 (+21)                                            |
| `npm run build`               | ✓ 837 modules, 457.21 kB JS / 132.99 kB gzip, 16.98 kB CSS / 4.22 kB gzip                      |
| `npm run test:e2e`            | 22/22 passed (8.6 min), including the three M7 persistence flows                               |
| `npm run assets:check:strict` | OK, 662 files, 0 warnings                                                                      |
| `npm run format:check`        | clean                                                                                          |
| Screenshots                   | `M7-bench.png` (live rest prompt) and `M7-map.png` (fully charted, one sigil, nave checkpoint) |

### E2E coverage added

1. **Rest → save → chart → reload:** the hero starts in the terrace bench range, rests through the
   real interact key, the save reports `bench`, the map shows 1/5 charted, 0/3 sigils, the current node,
   four hidden names and the correct last-rest copy. The map fits the 640×360 dialog. Opening it again
   through the pause menu and closing with Back returns to the run; reload resumes on the terrace bench
   spawn with the same checkpoint and masks.
2. **Death returns to the checkpoint:** after resting in the nave, the test loads the terrace, confirms
   spawn invulnerability expired, kills the hero through the damage path and waits for the rebuilt nave.
   The respawn is at the nave bench spawn, not the room that killed the hero, and the save reason is
   `respawn`; a reload then resumes there.
3. **Sigils and masks persist:** defeating the Bellbearer records the sigil and raises the mask ceiling
   to six; after reload the sigil, max HP and charted rooms remain, and re-entering the arena creates no
   boss. The saved reward HP is not assumed to be full because damage taken before the kill is real.

### Adjustments & findings

- **The first nave bench was behind a boss door.** At x=360 it could only be reached from the room
  spawn by crossing the Bellbearer trigger. It moved to x=104 with a x=64 respawn, west of the first
  door; the terrace entry spawns at x=80 and every arena return spawns at x=120, both inside its range.
  This makes the hub checkpoint reachable without solving a fight and still leaves the door labels clear.
- **Resume and respawn had to be different facts.** A single last-room field made closing the tab either
  lose progress (bench-only) or make death free (entry-only). The save now stores the entry, while the
  checkpoint bench is a separate durable field; D044 records the split.
- **A corrupted save must not be repaired field-by-field.** Early validation accepted partial records
  and could produce a checkpoint outside the charted set. Loading now rejects the whole document and
  starts fresh; the next boot/room write replaces it with a valid run.
- **The map's first node layout crowded its own cards.** The arena cards at the old vertical offsets
  clipped labels and the REST badge at 640×360. The layout now uses y=17/50/83 with terrace/nave at
  y=50, and the navigation test asserts the whole dialog stays inside 640×360.
- **A successful save is not a failed attempt.** `lastWrite` now records the reason of the most recent
  successful write; `present` remains false when storage rejects the first write, and the run stays
  playable in memory. The unit suite covers the distinction.
- **E2E needed a valid spawn, not a longer walk.** `debugLoadRoom` gained an optional spawn validated by
  the same standing-point check as production. That removed a slow, IPC-sensitive 280 px walk from the
  bench flow without bypassing the rest interaction. M6's phase probes also call the DEV-only i-frame
  protection so a SwiftShader stall cannot replace a phase assertion with a death reset.
- **Size debt paid down where M7 grew it.** Extracting `RunSession` and `BenchInteraction` brought
  `Game.ts` from 436 to 309 non-empty lines and `RoomScene.ts` from 372 to 344. `RunSession` is 164 and
  `BenchInteraction` 54. `RoomScene` remains 44 lines over the soft guideline and keeps the boss,
  combat and presentation orchestration; further splitting is a polish-pass task, not a hidden stub.
- **No new art or licences.** Benches, map marks and prompts are procedural/CSS; the asset inventory
  stays at 662 files with zero strict-mode warnings.

### Explicitly deferred / stubs

- **Seven of the twelve region rooms are not built.** The chart shows the five existing chambers; the
  rest of the region, new exits and traversal abilities are later milestones.
- **One automatic slot, no manual save management.** There is no save-slot UI, rename/export/import,
  cloud sync, manual delete or migration beyond rejecting version mismatches.
- **No mid-boss checkpoint or boss-phase persistence.** Saving happens at room entry/reward/rest, so a
  reload during a fight restarts that arena from the beginning at the saved mask count.
- **Benches do not fast-travel, upgrade or offer a menu.** Rest is a heal/rebuild/checkpoint interaction.
- **The map has no zoom, pan, pins or fog-of-war.** It lists the authored rooms and hides unknown names;
  future rooms need only data, exits and a layout entry.
- **No authored bench/map art and no touch pass.** Both use procedural/CSS presentation; mobile controls
  remain M10 scope.
- **No souls-style currency loss or enemy respawn timer.** Death restores masks and resets the room;
  enemies already return on every clean rebuild.

### Next milestone preview (M8)

Not started. Scope will be confirmed before any M8 code is written; this run ends at the M7 gate.

---

## M8 — The complete Drowned Belfry (2026-10-21)

**Commit:** `bb1d1e1` — **Status:** complete, all gates green.

### Shipped

- **The full twelve-room region.** Seven new rooms join the five M6/M7 chambers: **The Drowned
  Gallery**, **The Sunless Aqueduct**, **The Bellows**, **The Wall-Claw Shaft**, **The Upper Gallery**,
  and the two secret chambers **The Ossuary** and **The Reliquary**. A shared 60×24 slice builder
  authors floors, one-way ledges, doorways, breakable walls, sealed doors and decoration with bounds
  checks. The graph now loops terrace → gallery → aqueduct → bellows → nave and bellows → shaft → upper
  gallery → terrace, with the gallery and upper gallery opening one-way secret routes. Every room has a
  map node and a validated standing spawn.
- **Wall Claw traversal gate (`src/player/PlayerWall.ts`, `aqueduct-wall-claw`).** The ability is a
  normal pickup; once owned, airborne contact with a wall clings and caps the slide, and jump kicks
  away with a short input lock. The shaft is ordinary geometry, so the climb cannot be bypassed by a
  scripted lift. A dedicated E2E test climbs it with a real in-page wall-jump autopilot.
- **Two breakable secrets and one sealed door.** Breakable masonry and the Tide door are semantic tile
  roles. A real nail swing shatters every breakable tile in the room and records the parent room in
  `brokenSecrets`; the secret rooms then persist as clean rebuilds. The sealed door opens only while
  the `bellthief-tide-bell` key is owned, and `level:check` proves there are exactly two breakable rooms,
  one sealed door and one ending trigger.
- **22 data-driven pickups.** Eleven shard pickups (195 total), four mask shards (one complete mask),
  five charms, the Wall Claw and the Tide-Bell. A registry owns every id, name, description, reward and
  keyed gate; room data only places coordinates. Pickup banners, audio, spark FX and HUD counters share
  one collection path, and save validation rejects unknown, duplicate or prematurely keyed pickups.
- **Focus and healing (`PlayerFocus`, `PlayerHealing`, HUD).** Nail hits gather 11 Focus (17 with Ember
  Greed); a held 54-tick channel spends 33 and restores one mask. Quick Mend shortens the hold to 36
  ticks, Sturdy Shell absorbs one interrupting hit with 30 ticks of protection, and the HUD shows the
  bar plus heal progress. Focus carries between rooms, refills at rests/respawns and is deliberately not
  saved.
- **Equipment and upgrades (`BenchOverlay`, `PlayerLoadout`, `progression.ts`).** Resting opens a
  focus-trapped DOM equipment screen over the frozen simulation. The belt has three slots; all five
  charms cost one, auto-equip while a slot is free and can be toggled at the bench. The Nail Forge sells
  two levels for 30 then 60 shards, adding +1 damage and +4 reach each. Purchases apply to the live hero
  and write immediately.
- **Three Ordeals.** Each claimed arena has an altar that relights its boss as an optional rematch:
  1.35× base health, 0.85× wind-up/recovery, 40 shards on the first clear. The clear persists per boss,
  cannot pay twice and does not disturb the normal sigil, mask ceiling or return door.
- **The Tide ending and ending card.** The Bell Thief drops the Sturdy Shell and Tide-Bell; the key opens
  the Upper Gallery's sealed door. Crossing the threshold shows **The Bell Remembers** once, with run
  totals for sigils, shards and charms. It is a focus-trapped DOM card; closing it returns to the mounted
  world, and `sliceComplete` plus `RoomScene.endingFired` prevent replay after closing or reloading.
- **Save v2 with in-place v1 migration.** The same `bellward.save.v1` key now stores pickups, broken
  secrets, owned/equipped charms, nail level, shards, Ordeals and `sliceComplete`. M7 documents migrate
  in memory by adding empty/new defaults, then pass the same all-or-nothing validator; unknown content,
  impossible health/charm states, duplicates and future versions still start a fresh run.
- **`npm run level:check` (`scripts/level-check.ts`).** A content gate requiring exactly the twelve
  rooms, reachability from the terrace, a directed loop, valid standing spawns for every room and door,
  map coverage, 22 placed pickups with support inside the pickup aura, exactly two breakable rooms, one
  sealed door, one ending, the four/five/one/one reward mix, three boss rooms with Ordeals, and a bench
  within two rooms of every boss.
- **Tests and docs.** 11 new unit tests cover Focus/healing, wall contact, progression/economy and the
  v2 save matrix. Seven new Playwright flows cover the M8 progression path; `docs/CONTROLS.md`,
  `README.md` and D048–D053 document the live contract.

### Gates (all green at commit)

| Gate                          | Result                                                                                 |
| ----------------------------- | -------------------------------------------------------------------------------------- |
| `npm run typecheck`           | clean                                                                                  |
| `npm run lint`                | clean, zero warnings                                                                   |
| `npm run level:check`         | OK — 12 rooms, 22 pickups, 3 benches, 3 Ordeals                                        |
| `npm run test`                | 266/266 passed (23 files, ~8 s) — up from 255 (+11)                                    |
| `npm run build`               | ✓ 851 modules, 505.55 kB JS / 145.04 kB gzip, 20.44 kB CSS / 4.78 kB gzip              |
| `npm run test:e2e`            | 29/29 passed (10.6 min), including the six M8 flows and the complete-playthrough audit |
| `npm run assets:check:strict` | OK, 662 files, 0 warnings                                                              |
| `npm run format:check`        | clean                                                                                  |
| Screenshots                   | `M8-upper-gallery.png` (new room) and `M8-bench.png` (equipment after Quick Mend)      |

### Complete run evidence

`tests/e2e/playthrough.spec.ts` runs one fresh browser context and one continuous run:

1. **Route:** terrace → Drowned Gallery → Ossuary (secret) → Sunless Aqueduct → Bellows → Bell Nave →
   Bellbearer, Warden and Bell Thief arenas → Wall-Claw Shaft → Upper Gallery → Reliquary (secret) →
   the Tide door. Movement between authored encounters is seeded with the DEV room loader; the M8
   suites separately keep the real shaft wall-jump and walk-through-door coverage. Rewards, secrets,
   bench transactions, saves and the ending all use production paths.
2. **Collectibles and traversal:** 22/22 pickups, including four mask shards, all five charms, the Wall
   Claw and the Tide-Bell. Both secret walls are opened by real nail swings, and both secret rooms are
   entered.
3. **Bosses and economy:** 3/3 normal sigils and 3/3 Ordeals. The run earns 195 shards from pickups plus
   120 from Ordeals, buys both nail levels for 90 at The Weeping Stone and finishes with 225 shards.
4. **Loadout:** five charms owned, three equipped by auto-fill (Quick Mend, Light Step, Ember Greed);
   nail level +2; four mask shards plus three sigils give nine maximum masks.
5. **Ending and chart:** **The Bell Remembers** shows 3/3 sigils, 225 shards and five charms, closes
   once, and the map reports 12/12 chambers and 3/3 sigils with no unknown nodes.
6. **Persistence:** a real page reload restores all 12 visited rooms, 22 pickups, both secrets, three
   sigils, three Ordeals, the terrace checkpoint, nail +2, 225 shards, nine masks, three equipped
   charms, `sliceComplete: true`, and no ending retrigger. The run reports no runtime errors.

### Adjustments & findings

- **Closing the ending card immediately reopened it.** The player was still standing in the ending
  trigger when the DOM overlay closed, so the next tick fired the ending again. `RoomScene` now owns an
  `endingFired` guard seeded from the durable `sliceComplete` flag; closing or reloading on the
  threshold is inert. The E2E test closes the card, keeps playing and reloads to prove it.
- **The full-run audit initially saw 11/12 rooms.** The continuous route had never entered the Bell
  Nave because the boss tests seed the arenas directly. Adding an explicit nave visit made the chart
  proof honest; this is exactly the cross-room drift the run test exists to catch.
- **Save compatibility was worth more than a clean key.** The schema is v2 but the key stayed
  `bellward.save.v1`, so M7 progress migrates without a second storage slot. The validator treats the
  migrated document as strictly as a native v2 record.
- **Route-assisted is not the same as reward-assisted.** The playthrough uses `debugLoadRoom` only to
  skip locomotion between authored encounters. Pickups, keyed gates, secret-wall attacks, bench
  purchases, Ordeals, ending and reload all run through the same code a player uses.
- **Headless audio needed a non-rAF poll.** The smoke test now polls the audio path every 250 ms for up
  to 60 s instead of waiting on animation frames, which SwiftShader can starve while decoding. Persistence
  map/count locators are scoped to the map dialog so hidden overlays cannot satisfy them.
- **Two files remain over the size guideline.** `RoomScene.ts` is 554 non-empty lines and `Game.ts` 419;
  both grew with pickups, secrets, Ordeals, the ending and overlay ownership. Extraction is carried into
  the M9 polish pass rather than risking the M8 gate. `RunSession.ts` (233), `runSave.ts` (289),
  `RunProgress.ts` (273) and `BenchOverlay.ts` (241) stay near the guideline.
- **No new licensed assets.** The new rooms reuse the approved packs; breakable masonry, the sealed door
  and pickup markers are procedural/CSS. The inventory remains 662 files with zero strict warnings.

### Explicitly deferred / stubs

- **No title screen or onboarding flow.** The game still boots directly into the terrace; M9 owns the
  start/title flow and the final visual/audio polish pass, including the size extraction above.
- **No post-ending content beyond exploration and Ordeals.** There is no NG+, alternate ending, credits
  sequence or boss rush; the run remains open after the card closes.
- **No manual save management.** One automatic v2 document, no slots, export/import, cloud sync or
  delete UI. Focus and mid-boss state are intentionally not saved; a reload during a fight restarts that
  arena at the saved masks.
- **Benches still do not fast-travel.** They are heal/rebuild/checkpoint/equipment points; there is no
  bench-to-bench travel or shop beyond the Nail Forge.
- **Ordeals are the only hard-mode variant.** No new enemy archetypes, fourth boss, difficulty setting
  or per-boss modifiers ship in M8.
- **No touch controls or packaging.** Keyboard/gamepad remain the supported inputs; mobile and desktop
  packaging stay M10 scope.

---

## M9 — The threshold: title, onboarding and accessibility (2026-10-21)

**Commit:** `8083f55` · **Status:** complete, all gates green (verified with M10 in the combined sweep).

### Shipped

- **Title/start flow (`src/ui/start/TitleScreen.ts`, `src/ui/start/start.css`).** Boot mounts the terrace,
  then opens a full-screen **BELLWARD** dialog and pauses the fixed-step loop; rendering and requested
  music continue behind the opaque card. The card offers **Continue the climb** when a valid save loaded,
  otherwise **Enter the belfry**, plus **Begin anew** when a save exists. New run is a two-step destructive
  action; Escape cancels the armed state. The title shows sigil/room counts and completion, never story
  spoilers. Native buttons, a focus trap, `aria-modal`, `inert` on the canvas and gamepad navigation keep
  it keyboard/screen-reader usable. The first start gesture unlocks browser audio and plays a door cue.
- **The first save waits for a real start.** `RunSession.begin()` and `newRun()` mount the room without
  writing; `Game` calls `RunSession.saveStart()` only after the title closes. The method writes only when
  no valid document exists, so starting a restored run does not rewrite its save. Looking at the title no
  longer creates a climb that offers **Continue** on the next visit. `RunProgress.reset()` clears every
  durable run fact atomically in memory before the fresh boot save replaces the slot.
- **First-run onboarding (`src/ui/start/Onboarding.ts`).** A non-modal **First steps** strip lists the
  live keyboard bindings for movement, jump, strike, rest/use and pause; it auto-hides after 16 seconds,
  stops its timer while focused, and has a native dismiss button. It is shown on a fresh start or a new
  run, never when continuing, and is not persisted. It never traps focus or pauses the simulation.
- **Screen-shake accessibility.** A separate `bellward.accessibility.v1` document stores the preference
  all-or-nothing, defaulting to the inverse of the OS `prefers-reduced-motion` value. **Settings →
  Camera shake** applies immediately through `Camera.setShakeEnabled`, cancelling an active kick and
  applying to later rooms. Gameplay timing, hit-stop, damage and RNG are untouched.
- **UI feedback.** Menu move/confirm/back/capture and the title start use the existing approved Kenney
  RPG CC0 files; no new assets or licenses. Capture cancellation through Escape now has an explicit back
  cue, and focus moves only play a cue when focus actually changes.
- **Extraction and fresh-start plumbing.** `BenchController` (115 non-empty) owns bench equipment;
  `RoomObjectives` (173) owns pickups, breakable secrets, boss/Ordeal reward queues and the ending
  trigger; `BossDirector` (127) owns boss spawn, Ordeal prompt/relight and boss debug delegates.
  `RoomScene` fell from 554 to 440 non-empty lines. `Game` is 438 (M8: 419) after adding title,
  onboarding, accessibility and start wiring; `TitleScreen` is 338. No mechanics were intentionally
  changed.

### Verification coverage (M9 additions, run with M10)

- `tests/e2e/m9.spec.ts`: five flows — title focus/keyboard start/no boot save, saved continue plus
  two-step new run and Escape cancel, progress-preserving continue, screen-shake persistence through
  reload, and OS reduced-motion default. Title-aware `bootGame`/`reloadGame` helpers and updates to the
  smoke/menu reload paths are in place.
- `tests/unit/accessibility.test.ts` (+4): OS default, persistence, corrupt/future documents and missing
  storage. `tests/unit/menu-model.test.ts` (+1): screen-shake toggle through the accessibility port.
  `tests/unit/camera.test.ts` (+1): disabling cancels and ignores shakes, re-enabling works.
- `scripts/capture-screenshot.ts` supports `--title` and `--onboarding`; the M9 captures are listed in
  the gate table below.

### Gates (all green; verified with M10)

| Gate                          | Result                                                                                                                  |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `npm run typecheck`           | clean                                                                                                                   |
| `npm run lint`                | clean, zero warnings                                                                                                    |
| `npm run level:check`         | OK — 12 rooms, 22 pickups, 3 benches, 3 Ordeals                                                                         |
| `npm run test`                | 275/275 passed (24 files, ~16 s) — includes M9's 6 and M10's 3 new tests                                                |
| `npm run build`               | 864 modules, 527.61 kB JS / 150.50 kB gzip, 37.60 kB CSS / 8.17 kB gzip                                                 |
| `npm run test:e2e`            | 37/37 passed (10.6 min), including all five M9 flows and three M10 touch flows                                          |
| `npm run assets:check:strict` | OK, 662 files, 0 warnings                                                                                               |
| `npm run format:check`        | clean                                                                                                                   |
| Screenshots                   | `M9-title.png` / `M9-title-small.png` (1280×720 / 640×360), `M9-onboarding.png` / `M9-onboarding-small.png` — inspected |

### Findings & adjustments

- **A viewed title was creating a save.** The original boot path persisted `'boot'` inside
  `RunSession.begin()`, so opening the page and walking away would later show **Continue**. The initial
  save now waits for the title's start action, and the M9 E2E asserts no save before that point.
- **The reload helper sampled `isVisible()` before the title mounted.** `ready` is set one frame before
  `title.open()`, so a reload could skip the click and wait forever on a paused loop. `reloadGame` now
  waits for `[data-testid="title-root"]` to be visible, then starts it deterministically.
- **The settings menu gained a fifth row.** The back button's focus row is now computed from the number
  of rendered settings instead of the old literal `4`; screen shake is only rendered when the
  accessibility port exists.
- **Destructive new-run confirmation is cancellable.** Escape disarms **Confirm new run**, restores the
  **Begin anew** label and moves focus back to Continue, so the second press is always deliberate.
- **Onboarding does not disappear under a keyboard reader.** Focus inside the strip clears the auto-hide
  timer; the player dismisses it explicitly. Rebinding calls `Onboarding.refresh()` so keycaps stay live.
- **Title and gameplay keys stay separate.** The title owns the keyboard while open, except `B` mute;
  once it closes, the canvas is focused and the normal input path resumes with menu latches cleared.
- **Starting a restored run must not rewrite its save.** `saveStart()` writes only when no document is
  present. A fresh run still writes `boot`; **Continue** keeps the existing save and its `lastWrite`
  history unchanged, so the pre-M9 reload assertions stay meaningful.
- **Paused overlays froze the UI sound clock.** `AudioManager` rate-limits by simulation tick, but the
  loop is intentionally paused behind menus. Menu cues therefore use zero tick cooldowns; focus-change
  gating and the short clips prevent chatter. The first pointer gesture and the start action now share
  one in-flight `unlock()` promise, so the start cue cannot race a still-suspended audio context.

### Explicitly deferred / risks

- **M9 was verified with M10; no gate is outstanding.** The combined sweep corrected the
  progress-preserving E2E spawn to a validated `drowned-gallery` standing point and made the M3 audio
  dismissal tolerate the hint strip's 16 s auto-hide.
- **`RoomScene` and `Game` remain above the size guideline.** `RoomScene` is 440 non-empty lines; `Game`
  ended M9 at 438 and is 448 after M10's touch wiring. The M9 controllers are cohesive and
  behavior-preserving; further extraction is deferred until after the slice.
- **Gamepad title navigation is wired through the existing `MenuPad` polling path, but M9 adds no
  gamepad-specific E2E coverage and it remains unverified on physical hardware.** Touch controls now ship
  in M10.
- **No new story, rooms, enemies, bosses or pickups.** M9 is a threshold/accessibility/polish milestone.

---

## M10 — Touch controls and the shipping pass (2026-10-21)

**Commit:** this milestone's commit · **Status:** complete, all gates green. M9 and M10 were verified
together in one sweep after both implementations landed.

### Shipped

- **Touch controls (`src/ui/touch/TouchControls.ts`, `touch.css`).** A landscape-first DOM overlay mounted
  only when `(pointer: coarse)` or `maxTouchPoints > 0` is true. The left thumb gets left/down/right; the
  right thumb gets Focus, Rest, Dash, Strike and Jump, with Pause at the top-right. Every target is at
  least 2.6 rem and grows to 3.5–3.9 rem in landscape. Safe-area insets keep clusters clear of notches
  and home indicators, and a reduced-motion rule removes the arrive transition.
- **Virtual input with honest source merging (`InputManager.setVirtual`).** Touch presses join a third
  held-source set beside keyboard and gamepad. Press/release edges are still queued between fixed ticks,
  so a tap shorter than one frame registers. Releasing one source never drops an action another source
  still holds, and blur/reset clear virtual state along with the rest.
- **Pointer lifetimes and modal handoff.** Each button owns its pointer id (multi-touch), captures the
  pointer when the browser allows it, and releases on pointer-up/cancel/lost capture, window blur or
  visibility loss. The whole overlay hides and clears before any menu, bench, ending card or title owns
  the screen. Touch Pause calls the same `openMenu('pause')` path as Escape; no virtual action can leak
  into the next tick after resume.
- **Touch-aware teaching and shell.** The title footer and first-run strip read the device capability and
  render labels instead of keyboard keycaps. The canvas fits the visual viewport with fractional scaling
  on touch and on any viewport smaller than 640×360; desktop playback keeps whole-pixel scaling for crisp
  art. `index.html` gains a boot splash, theme/mobile metadata and safe-area viewport; the splash is
  removed as soon as boot resolves and sits below the title, so it can never intercept the first gesture.
- **Device detection (`src/input/device.ts`).** Capability is sampled once at boot so rotating a hybrid
  laptop cannot swap the control scheme mid-run; privacy-mode media queries are guarded.
- **Tests and docs.** Three unit tests cover a between-tick virtual tap, keyboard/touch overlap and pad
  release while touch holds. `tests/e2e/m10.spec.ts` adds three Playwright flows: touch movement/jump and
  Pause handoff at 844×390, title teaching, and no touch DOM on desktop. `docs/CONTROLS.md` documents the
  overlay, and D059 records the architecture. No new assets or licenses.

### Gates (all green; M9 and M10 combined)

| Gate                          | Result                                                                           |
| ----------------------------- | -------------------------------------------------------------------------------- |
| `npm run typecheck`           | clean                                                                            |
| `npm run lint`                | clean, zero warnings                                                             |
| `npm run level:check`         | OK — 12 rooms, 22 pickups, 3 benches, 3 Ordeals                                  |
| `npm run test`                | 275/275 passed (24 files, ~16 s) — up from M8's 266 (+9: 6 M9, 3 M10)            |
| `npm run build`               | 864 modules, 527.61 kB JS / 150.50 kB gzip, 37.60 kB CSS / 8.17 kB gzip          |
| `npm run test:e2e`            | 37/37 passed (10.6 min), including all M8/M9 flows and the three M10 touch flows |
| `npm run assets:check:strict` | OK, 662 files, 0 warnings                                                        |
| `npm run format:check`        | clean                                                                            |
| Screenshots                   | `M10-touch.png` and `M10-touch-onboarding.png` at 844×390 — inspected            |

### Findings & adjustments

- **A tap can be shorter than a simulation tick.** The virtual API therefore uses the same pending-edge
  queues as keyboard input; a press and release between snapshots still produces both edges. The unit
  suite asserts exactly that, rather than only testing a held button.
- **Pause must clear the thumb before freezing.** The pause handler releases every virtual action before
  opening the menu, and `openMenu` hides the overlay before `input.reset()` and `loop.pause()`. This
  prevents a resting Jump thumb from carrying into the first resumed tick.
- **Mobile browser chrome changes the usable canvas.** Fitting now prefers `visualViewport` dimensions and
  listens for its resize; touch devices use the exact fractional ratio, while desktop keeps integer
  scaling. Very small desktop viewports now shrink instead of clipping.
- **The boot splash cannot compete with the title.** It is removed synchronously after boot resolves and
  its z-index is below the title; the E2E first gesture never sees a loading overlay. The initial
  combined run exposed exactly this class of interception while the splash still faded, so the final
  shell removes the ambiguity rather than extending a timeout.
- **Onboarding can legitimately auto-hide before audio is live.** The M3 audio flow waits on software
  decode and then tried to click a hint strip that had already hidden. `dismissOnboarding` now treats the
  16 s auto-hide as valid and callers still assert the final hidden state.
- **One M9 fixture used an invalid room point.** The progress-preserving reload test loaded
  `drowned-gallery` at `(240, 208)`, which is not a clear standing point. It now uses the validated
  `(300, 256)` pickup ledge; the room contract was right, the fixture was not.
- **Headless touch-context teardown can outlast the default test budget.** The first touch flow
  occasionally spent more than 60 s closing its browser context after every assertion had passed. The M10
  describe now has a 120 s budget while the test body is unchanged; repeat runs of that flow passed. This
  is SwiftShader context cost, not a game hang.
- **Chromium can report a transient adapter change while Vite serves art.** One full sweep saw four
  `net::ERR_NETWORK_CHANGED` console entries even though the scene reported every packed texture loaded
  and zero art failures. The boot smoke test now ignores only that transport code; page errors and every
  other console error remain fatal, and the packed-art/loaded-count assertions still prove the content.
- **The production JS chunk still exceeds 500 kB.** The build reports 527.61 kB / 150.50 kB gzip. This is
  the existing single-bundle shape plus the touch/menu UI; code-splitting is a post-slice packaging task,
  not a correctness risk for the vertical slice.

### Explicitly deferred / risks

- **Physical touch hardware is unverified.** Playwright's `hasTouch` context proves the DOM/pointer path,
  canvas fit, movement, jump and Pause handoff, but no phone or tablet has run this build.
- **Gamepad hardware remains unverified.** Coverage is still an injected pad; physical controllers and
  touch-on-laptop hybrids are untested.
- **No procedural packaging yet.** Browser shipping is complete for the slice; Capacitor/Tauri app
  shells, icons, store metadata, offline service worker and install prompts are future work.
- **Touch layout is fixed.** There is no left-handed mirror, button-size setting or touch rebinding; the
  overlay is intentionally minimal and safe-area aware.
- **No touch button for Cast.** The slice has no player cast action; the map remains in the Pause menu.
- **`Game` and `RoomScene` still exceed the ~300-line guideline** (448 and 440 non-empty). The touch wiring
  is contained in its own class; further extraction is deferred until after the slice.

### Next

The vertical slice is feature-complete. The next work is physical-device testing and packaging, followed
by content beyond the twelve-room region if the slice is greenlit.

## G1 - The Keeper's Guard (2026-10-22)

**Commit:** pending. **Status:** complete, all gates green.

### Shipped

- **Guard and parry:** a held guard with a five-tick perfect parry, a ten-to-three-tick anti-spam
  ladder, a six-tick release lock, a 45-tick Hook Counter (+2 damage, +10 posture), and a 60-tick
  shatter that costs one mask through the normal damage path. Guarding moves at 34% speed.
- **Posture and KNELL:** player and enemy posture, enemy regeneration after 90 quiet ticks, a 70-tick
  open window, and a 3x-damage KNELL with heavier hitstop and shake. Enemy bars appear after posture
  damage; boss bars carry a posture line under health.
- **Red attacks:** ghoul lunge and the `bearer.charge`, `warden.slam`, `thief.teleport` and
  `thief.dive` boss patterns ignore the guard. Enemy telegraphs turn blood-red and bosses gain a red
  ring during the wind-up.
- **One reaction per swing:** enemies carry an attack id, so an eight-tick active hitbox blocks or
  parries once instead of draining the whole posture bar in a single attack.
- **Input parity:** keyboard `F`, gamepad LT/RT and a touch **Guard** button. The onboarding strip,
  controls screen, pause-menu binding editor and docs all name the action; binding documents move to
  format v2 and migrate v1 in place without losing custom keys.
- **Presentation:** a brass guard arc that brightens during the perfect window, a thin posture line
  under Focus, local enemy posture bars, and combat feedback for parry, block, shatter and KNELL using
  the existing SFX and effects. No new art or audio assets.
- **Coverage:** new `tests/unit/guard.test.ts` (state machine, shatter, counter, KNELL, one-reaction
  rule), binding migration tests, and `tests/e2e/combat.spec.ts` proving the real key path in Chromium.

### Gates (final state)

| Gate                | Result                                                             |
| ------------------- | ------------------------------------------------------------------ |
| `npm run typecheck` | clean                                                              |
| `npm run lint`      | clean, zero warnings                                               |
| `npm run test`      | 285/285 passed (25 files)                                          |
| Playwright          | 38/38 passed in the full sweep after one stale title assertion fix |
| `npm run format`    | clean                                                              |
| `assets:check`      | unchanged; no assets added                                         |

### Adjustments

- **The first browser guard test exposed a real combat bug.** One parishioner swing held the guard
  active for eight ticks and drained 176 posture in a single attack. Combat now keys guard reactions
  on an enemy attack id; the regression is covered by a unit test and the E2E block test.
- **Guard shatter uses `takeDamage`,** not the reaction directly, so i-frames and Sturdy Shell still
  apply. The guard still breaks even when the mask cost is absorbed.
- **The default guard pad buttons are LT/RT (6/7), not LB** so the binding editor's free-button
  coverage stays honest; keyboard `F` leaves `Q` free for existing rebind tests.
- **The `m9` title assertion had a stale period** and the `m10` touch-title assertion still expected
  the pre-redesign wording. Both now assert the shipped copy; this is the only unrelated test edit.

### Explicitly deferred / risks

- Hookline, Censer and Toll, the three-phase Last Keeper, the earned ending, save v3, the Tideglass
  pickup and the Tideglass map UI are not in this step.
- Physical gamepad and touch hardware remain unverified; Playwright supplies the input proof.
- The guard arc and posture bars use existing procedural/art frames; a bespoke guard animation and
  shield silhouette are art-pipeline work for the P0 pass.
