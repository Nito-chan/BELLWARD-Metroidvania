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
