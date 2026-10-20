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

## D022 — 2026-10-19 — Input is sampled once per fixed tick, with queued edges

**Decision:** `InputManager` keeps `held` / `pressed` / `released` sets and is polled exactly once
per fixed simulation tick (`Game.onTick → scene.update(tick, input.snapshot())`). Key events mutate
that state between ticks; press/release edges are queued and consumed by the next snapshot, OS
auto-repeat is ignored, window blur clears every held key, and the gamepad is polled inside
`snapshot()`. The simulation never sees a DOM event.

**Why:** the simulation stays a pure function of (config, tick index, input snapshots), which is what
makes the controller unit-testable and replays deterministic. Queuing edges matters at 60 Hz: a tap
that lands between two ticks would otherwise be dropped. An injectable pad reader keeps the manager
DOM-free in tests while `navigator.getGamepads()` remains the default in the browser.

**Alternatives:** reading `keydown` state directly inside the controller (rejected: couples the sim
to the DOM and loses edge semantics); storing only an "is down" map (rejected: drops taps).

## D023 — 2026-10-19 — Collision semantics: axis-separated sub-steps, one-way rules, corner forgiveness

**Decision:** `moveAndCollide` resolves X then Y, each split into sub-steps of at most
`PHYSICS.maxStep` (8 px). Out-of-bounds cells block on every side, so a room's border is its wall.
One-way platforms block downward motion only when the body was above the platform's top edge at the
start of the sub-step, and never while a drop-through is active; they never block sideways or upward
motion. A body is grounded only on a _resting contact_ — feet within 0.5 px of a solid row's top
edge and `vy >= 0`. A rising body that clips a ceiling corner by up to `PHYSICS.cornerCorrection`
(6 px) is nudged sideways (preferred side = direction of travel) and keeps rising.

**Why:** the axis order plus sub-stepping is the simplest scheme that cannot tunnel at any reachable
speed (asserted at 4× the terminal fall speed) and never teleports a body through a floor while it
is pushed horizontally. The two grounded guards were forced by a real bug: "is there a solid tile
below the feet" is _true_ while the feet are inside a one-way platform during a rise, so the
controller believed it had landed at y 303 and froze mid-jump. Drop-throughs are a controller
concern (12 tick window, 40 px/s nudge) rather than a solver mode.

**Alternatives:** swept AABB against a tile query (rejected: more code, identical result at these
speeds); a separate one-way entity list (rejected: the tile-role table already encodes it).

## D024 — 2026-10-19 — Player tuning is config data, cross-checked against the animation data

**Decision:** every feel number lives in `src/config/player.ts` (size, ground/air accel + caps,
friction/skid, the jump arc, dash burst/cooldown, attack clip ticks + active windows, buffers,
coyote, drop-through) with the derived figures documented inline. `tests/unit/player.test.ts`
asserts the derived behavior (apex 60–85 px, cut jump 10–45 px, skid, coyote expiry, input buffer,
drop-through, dash cooldown, combo chain) and cross-checks `PLAYER.attack.clipTicks` against the
authored `HERO_ART` clip lengths. The controller publishes a clip name plus a `restarted` flag and
never touches the animator or the sprite.

**Why:** the numbers _are_ the design, so they belong in one typed table where a reviewer sees them
and a test proves them. Cross-checking the attack windows against the art data means a retimed swing
cannot silently desynchronize from its hitbox window, and the view stays a pure consumer of poses.

**Alternatives:** tuning in JSON (rejected for now, see D021); letting the controller drive frames
(rejected: the animator stays a dumb, replay-stable frame clock).

## D025 — 2026-10-19 — The hero pose contract, and all-or-nothing fallback for the packed knight

**Decision:** `HeroView.setPose({x, y, facing, animation, restart, grounded})` is the only entry
point; the contact shadow belongs to the hero view and shrinks/fades while airborne. The packed
knight is used only when _all_ eight sheets in `KNIGHT_REQUIRED` load; otherwise the hero falls back
to the procedural knight, which now authors 12 poses and the same clip names and durations.

**Why:** a pose object keeps the view data-driven instead of an if-chain per state. Parenting the
shadow to the pose fixed a latent M1 bug — the shadow was added to the scene container at the world
origin and never followed the hero. All-or-nothing fallback avoids the worst case (a knight missing
the dash or attack sheet) which would otherwise surface as a runtime throw during play.

**Alternatives:** per-sheet fallback (rejected: half a knight is worse than a procedural one);
shadow as a separate scene layer (rejected: it is part of the actor's silhouette).

## D026 — 2026-10-20 — Audio architecture: one manager, one backend seam, content in data tables

**Decision:** all audio goes through `AudioManager` (`src/audio/AudioManager.ts`), which talks to an
`AudioBackend` interface. `HowlerBackend` is the only module in `src/` that imports `howler`.
Content lives in `src/data/audio.ts` (the `SFX` table with per-key volume, cooldown and rate jitter,
the `MUSIC` track table, the total `PLAYER_SFX` map) and tuning in `src/config/audio.ts` (bus
defaults, fade lengths, jitter, bell schedule, storage key, mute key). The mix has three buses —
`master`, `music`, `sfx` — and the backend applies master once on the context, so a play request is
scaled by its own bus only. Music fades in over 2.4 s and crossfades in 0.9 s.

**Why:** the simulation must never import a DOM audio library — the unit suite runs in Node, and an
injected recording backend makes unlock gating, cooldowns, mixing, crossfades and persistence
testable without a sound device. A total `Record<PlayerEvent, SfxKey>` turns "new simulation event
without a sound" into a compile error, and data tables keep a retune to one line.

**Alternatives:** controller calling Howler directly (rejected: couples the simulation to the
browser); a switch statement over string keys (rejected: no exhaustiveness, no data table).

## D027 — 2026-10-20 — The unlock gate is synchronous; music is registered only when requested

**Decision:** a sound plays only when all three hold: a user gesture has arrived (`unlocked`), the
mix is not muted, and the audio context is live (`contextState() === 'running'`). `unlock()` flips
`unlocked` **synchronously** on the first gesture and only then awaits `AudioContext.resume()`; the
requested track starts once the context is running. Music tracks are registered with the backend
(downloaded and decoded) at the first `requestMusic()` for that key; only SFX are preloaded at boot.

**Why (measured):** the first implementation registered all three tracks at boot, which fetched and
decoded 12.9 MB of ogg (~150 MB of PCM) and delayed the soundtrack by ~2.4 s while starving
gameplay-timing E2E tests. Context resume itself measured 0.8–6 s in this headless Windows VM
(environment-dependent; a real desktop resumes in tens of milliseconds), which is exactly why the
gate must not wait on it. Gating playback on a running context also prevents a burst: sounds
scheduled into a suspended clock all release at once when it resumes. Lazy registration means the
two boss loops (6.6 MB) are never downloaded by a player who never reaches a boss.

**Alternatives:** html5 streaming for music (rejected: Howler loops html5 by re-playing on `ended`,
leaving an audible gap at every loop point); preloading everything (rejected: measured boot stall
and wasted bandwidth); deferring the music decode until after resume (rejected for now: Howler
returns a non-numeric handle when asked to play a sound it has not loaded, so the fade would be
lost).

## D028 — 2026-10-20 — Simulation events are a per-tick buffer consumed by audio

**Decision:** `PlayerController` collects `PlayerEvent`s in an array cleared at the start of every
`update()`, and `RoomScene.update()` returns it. The events are `jump`, `land`, `landHeavy`,
`footstep`, `skid`, `attack1`, `attack2`, `dash`. Landing weight is graded by the fall speed sampled
_before_ the collision resolves (`PLAYER.landSoundSpeed` 140, `PLAYER.landHeavySoundSpeed` 700 px/s).
Footsteps fire every 25 ticks while running (the run cycle is 50 ticks with two footfalls), the
first one 14 ticks into a run; `skid` fires only on the transition into the skid state. `PLAYER_SFX`
maps each event to a sound key.

**Why:** polling controller state from the audio layer both double-fires (a state that persists for
many ticks) and misses transients (a state that begins and ends within one tick). A buffer makes the
order and count of events explicit, keeps the simulation free of RNG (so replays and the
determinism test are unaffected), and lets unit tests assert exact event sequences without audio.

**Alternatives:** observer callbacks from the controller (rejected: the controller would have to
know its consumers); deriving sounds from clip-frame events in the art data (deferred: the clip data
has the hook, but the controller-side event buffer is the authoritative timeline).

## D029 — 2026-10-20 — Persisted mix, utility keys, and a deterministic ambience clock

**Decision:** the mix (three buses plus `muted`) is written to `localStorage['bellward.audio.v1']`
on every change; reads and writes are wrapped in `try/catch`, a corrupt record falls back to
defaults, and blocked storage simply disables persistence. `B` toggles master mute and `F1` toggles
the diagnostics overlay; both are handled in `Game` and never reach `InputManager`, so they are not
rebindable actions. The distant-bell ambience is scheduled on the simulation clock (first toll after
1500 ticks, then a 2100–4200 tick gap) from `AudioManager`'s own RNG fork, with a 600-tick cooldown.

**Why:** storage can throw in private mode and must never break boot; players expect their volume
and mute choice to survive a reload. Muting is a master mute, not a stop — the track keeps its
place, so unmuting resumes mid-phrase. A separate RNG fork keeps the world's RNG sequence (and thus
replays and the determinism tests) untouched by ambience timing.

**Alternatives:** keeping settings in memory only (rejected: every reload resets the mix); using the
scene RNG for bell spacing (rejected: ambience would perturb gameplay randomness); a settings menu
as the only mute path (deferred to M5; the key is the minimum a player needs today).

## D030 — 2026-10-20 — Combat resolves in one deterministic pass; swing ids gate repeat hits

**Decision:** `CombatSystem.resolve(player, enemies, projectiles, tilemap)` runs every tick in a
fixed order: the player's open swing first, then each enemy's melee or contact box, then live
projectiles. The player's swing carries an `attackId`; each enemy remembers the last swing that hit
it, so a multi-tick active window can only damage it once. Enemy melee is tested before contact, and
contact is skipped for that enemy while its melee box overlaps, so a single attack cannot charge both.
All damage goes through `PlayerVitals.damage()` / `Enemy.takeDamage()`; i-frames are the only gate,
and a killing blow removes the enemy before it can retaliate in the same tick. Health, i-frames,
hurt stun and death live in `PlayerVitals` rather than the locomotion FSM. The per-tick
`CombatEvent` list (not the view) is the single source for sparks, shake, audio and the HUD.

**Why:** One ordered resolver is deterministic, testable with plain objects, and makes simultaneous
trades explainable. Swing ids solve the "same swing hits on every active tick" problem without
per-enemy cooldown guesswork. Splitting vitals keeps the player state machine about movement, and
remaining damage numbers stay in `config/combat.ts` / `config/enemies.ts`.

**Alternatives:** a physics engine (rejected: heavy, nondeterministic contacts); per-entity overlap
callbacks (rejected: order and double-hit ownership become implicit); a per-enemy damage cooldown
(rejected: it would make a long swing inconsistent and is harder to read in the debug state).

## D031 — 2026-10-20 — Three enemy verbs, data-driven FSMs, validated room spawns and whole-kind art

**Decision:** M4 ships exactly three kinds — the slow **parishioner**, the lunging **ghoul** and the
rooted **Cinder Adept** — on a shared FSM (`Enemy` base with `MeleeEnemy` and `Adept` behaviors).
Every speed, range, damage, wind-up, active/recover window, stagger duration and cast projectile
value lives in `ENEMIES`. Spawns are room data and `createRoom()` validates kind, solid ground, body
clearance, patrol bounds and that the spawn lies inside its beat; bad level data fails at boot with
a readable error. The terrace placements (150/270, the ghoul at 380 on the bridge, the adept at 872)
leave the M2 corridor 420–660 empty. Packed enemy art is all-or-nothing per kind (`ENEMY_REQUIRED`);
one missing sheet falls back to that kind's procedural art instead of a missing clip at runtime.

**Why:** The trio teaches the three verbs the vertical slice needs: read and punish, dodge a
committed burst, and close distance under fire. Typed tables make retuning one line and the unit
suite can drive every FSM without Pixi. Validation turns floating enemies and broken patrols into
startup failures rather than invisible bugs. The corridor constraint protects the existing movement
suite by construction.

**Alternatives:** behavior trees or per-enemy scripts (deferred until there are enough kinds to
justify the machinery); random or hand-tuned only placements (rejected: untestable and error-prone);
per-clip art fallback (rejected: an FSM can request a clip the fallback lacks).

## D032 — 2026-10-20 — Death rebuilds the scene; the art provider and music survive

**Decision:** On the killing hit the player enters `dead`; after `COMBAT.player.deathTicks` (100)
`RoomScene` asks `Game.resetScene()`. That constructs the room again from its data definition with a
fresh RNG fork, reuses the already loaded `ArtProvider`, creates a new player (with spawn i-frames),
fresh enemies and a fresh projectile pool, and leaves the `AudioManager` and current track untouched.
The HUD death fade is driven by `deathElapsed`, so the reset only happens after the screen is black.

**Why:** Rooms are pure data by design, so rebuilding is the shortest correct respawn and cannot
leave stale state (dead enemies, open swings, live projectiles, hitstop). Reusing the art provider
avoids re-downloading and re-decoding 18 textures on every death, and leaving audio alone keeps the
track continuous — dying should not stop the music in a souls-like. The same path is used at boot,
so respawn is not a second, less-tested code path.

**Alternatives:** mutating the live scene (rejected: easy to miss a component); reloading the page
(rejected: loses audio and pays the full boot); respawning from a save (no save system until a later
milestone).

## D033 — 2026-10-20 — Zero-alpha overlays are hidden, not merely transparent

**Decision:** The HUD's full-screen damage and death quads set `visible = false` whenever their
alpha is zero, and their setters cache the last level so a steady frame does no work. Character hit
flashes do the same (`visible` tracks the flash). The ambient wash and all other authored overlays
are unchanged.

**Why (measured):** The first complete M4 E2E run reported 42.0 fps against a 45 fps floor in the
moving-frame test. The only new full-screen layers were the two transparent HUD quads; hiding them
when unused restored 67.6 fps in the same test, and the final two full runs measured 68.0 and
60.0 fps. SwiftShader still rasterizes an alpha-0 quad, so "invisible" must mean `visible = false`.
This preserves the D018 two-texture batch cap and keeps the headless performance gate meaningful.

**Alternatives:** removing the damage flash or death fade (rejected: both are required readability
and tone); one shared overlay (rejected: damage and death can overlap and need different colors);
filters (rejected: more expensive on the software rasterizer).

## D034 — 2026-10-20 — E2E time-sensitive checks read simulation records, not wall time or rAF frames

**Decision:** The player records `jumpPeakY` (current airtime) and `lastJumpPeakY` (last completed
upward jump); the trace starts only on upward motion, so the initial settle into the floor is not a
jump. Both are exposed in `SceneDebugState` and the F1 overlay. The jump E2E asserts the recorded
apex rise (40–95 px) after landing instead of counting airborne animation frames. The i-frame E2E
records the first-hit `tickCount`, waits for death, and asserts the elapsed ticks are at least
`remainingHp × COMBAT.player.invulnerableTicks`; it no longer sleeps 300 ms and assumes no second hit.

**Why:** The loop is fixed-step and catches up after a main-thread stall. During the first-gesture
audio decode or a SwiftShader hitch, several simulation ticks can run in one rendered frame, so a rAF
sampler can see one airborne frame out of a whole jump and a wall-clock sleep can span multiple
i-frame windows. Both tests flaked (airborne 1 vs expected >10; HP 3 after a 300 ms wait) while the
unit suite proved the underlying physics. Measuring on the simulation clock tests the game instead of
the scheduler, and the apex bound still fails if the jump height actually regresses.

**Alternatives:** longer waits and lower thresholds (rejected: hides real regressions and still
flakes); disabling audio in movement tests (rejected: loses integration coverage and the stall can
come from rendering too); a debug single-step API (unnecessary complexity for two assertions).

---

(append new entries at the bottom; never edit old ones — correct them with a new entry)
