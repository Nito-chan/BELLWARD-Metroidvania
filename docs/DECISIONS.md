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

## D035 — 2026-10-20 — Pause and settings are accessible DOM overlays; only the simulation freezes

**Decision:** The pause, sound and controls screens are DOM overlays (`MenuView` / `MenuSystem`)
layered over the Pixi canvas, not Pixi-drawn UI; the HUD stays in Pixi. Opening the menu calls
`Loop.pause()` (fixed ticks stop, rendering continues), clears input state and marks `#app` inert.
The overlay root uses `hidden` when closed. `Game` tracks physical pause keys across the input reset
and keeps a `pauseLatch` until they are released, so the closing pause input (including an OS
auto-repeat) cannot immediately reopen the menu or leak into gameplay after close. Music keeps
playing while paused; the bell ambience is scheduled on the simulation clock and therefore pauses
with it. In the controls screen, Reset defaults is pinned in the footer beside Back so both actions
remain visible at 640×360; the binding table scrolls independently.

**Why:** DOM gives the menu native focus order, real dialog semantics, keyboard-operable range
inputs, crisp text at every scale and reliable Playwright access without spending the two-texture
batch budget. Freezing only the simulation keeps pause deterministic while the frozen scene remains
visible; hiding the closed overlay and making the canvas inert prevent focus traps and accidental
gameplay input. The latch fixes a real held-Escape bug found in E2E: the keydown that closed the
menu was sampled again as a pause press immediately after resume.

**Alternatives:** Pixi-drawn menus (rejected: focus, labels, range semantics and screen-reader
support would all be rebuilt by hand); stopping the render loop entirely (rejected: the pause frame
would freeze the browser/GPU path and pad polling would stop); leaving input live under the overlay
(rejected: movement and attack would react behind the dialog).

## D036 — 2026-10-20 — Bindings are a versioned, all-or-nothing document; edits reject conflicts

**Decision:** The editable document lives at `localStorage['bellward.bindings.v1']`, version 1, with
two keyboard slots and up to two gamepad-button slots per action plus the existing analog-axis
bindings. Loading validates the complete action set, slot counts, unique keys, button ranges and
axis fields; a corrupt, partial or future-versioned document is discarded as a whole with a warning
and the shipped defaults are used. Saves are wrapped in `try/catch` and blocked storage only disables
persistence. Edits return a new document; a keyboard code or pad button already used by another
action is rejected and reported, leaving the current document untouched. Reset defaults is
deliberately two-step: the first press arms it, the second restores every shipped binding, and
navigating away, closing the menu or starting a capture disarms it.

**Why:** Booting into half a control scheme is worse than losing a customization. All-or-nothing
validation makes malformed storage fail at one boundary instead of producing unpredictable gameplay.
Conflict rejection keeps one input from silently triggering two actions. The two-step reset avoids a
destructive one-click action next to Back while remaining keyboard/gamepad friendly.

**Alternatives:** merging partial documents (rejected: silent mixed defaults); allowing duplicate
bindings (rejected: ambiguous input and untestable priority rules); a modal confirmation dialog
(rejected: extra focus state and a second overlay for one destructive action). The shipped defaults
still contain `ArrowUp` for both `up` and `interact`; that pair predates the editor, is accepted by
shape validation, and can be restored by reset, but a new capture cannot introduce another
cross-action duplicate.

## D037 — 2026-10-20 — Menu inputs are reserved; the binding editor only edits gameplay actions

**Decision:** `Escape`, `Tab`, `F1`, bare modifiers, `Select`/`Start` and the D-pad (buttons 8, 9,
12–15) are reserved and cannot be newly captured. Outside capture, Start closes the menu from any
screen; Escape or B/Back goes back one screen (and closes from Pause); arrows/WASD move focus,
Enter/Space activate, and Tab/Shift+Tab wrap inside the dialog. During keyboard capture Escape
cancels; during pad capture Select cancels; any other reserved input is ignored with a status
message. Native range keys (`ArrowLeft/Right`, Home, End, PageUp/Down) go to the focused slider;
Up/Down move between rows, and volume changes are live. The `pause` action itself remains rebindable
for gameplay, but the menu's own navigation keys are not.

**Why:** A player who remaps every action must still be able to leave the menu. Reserving system
inputs guarantees that escape hatch, and keeping native range behavior avoids surprising keyboard
users. The focus trap and `aria-modal` dialog make the overlay behave like a real modal rather than a
visual layer over live controls.

**Alternatives:** allowing menu keys to be rebound (rejected: a bad capture can make the menu
unusable); intercepting every key for spatial navigation (rejected: breaks native slider semantics);
relying on pointer input for reset/back (rejected: controller and keyboard parity).

## D038 — 2026-10-20 — Timing-critical E2E drives DOM input in-page and observes state in-page

**Decision:** Playwright keeps a generous `60_000 ms` default test budget, but no timing assertion
depends on wall-clock sleeps or rAF frame counts. The walking test waits for distance and camera
movement and accepts an `idle|run` snapshot instead of demanding a mid-stride clip. The melee E2E
lands three light strikes through a `strikeNearestParishioner` helper that dispatches real
`KeyboardEvent`s inside the page at the strike moment; stage-two chaining stays unit-tested. The
i-frame/death E2E runs the approach, first-hurt capture, death and rebuild observation in one page
task (`takeHitsUntilDeath`). The menu focus-trap test wraps from Back with Tab/Shift+Tab in two
presses instead of tabbing twelve times. Vite watch ignores `playwright-report`, `test-results` and
`dist` so writing a report cannot reload the game mid-test.

**Why:** Headless SwiftShader plus audio decode made per-command IPC latency (~100 ms) longer than
the light swing's 7-tick (117 ms) damage window. The old 24-press wall-clock loop, the separate
first-hurt/death waits and the 12-step focus loop all flaked under the full-suite load even though
the game logic was correct. Dispatching events inside the page still exercises the game's real
window keydown/keyup handlers and fixed-tick `InputManager`; only the pacing moves to the browser
task, where it belongs. Simulation-clock assertions remain the source of truth. A full suite now
passes reliably and is faster (the menu focus test fell from ~90 s to under 15 s standalone).

**Alternatives:** fixed sleeps and longer waits (rejected: hides regressions and still flakes);
widening the attack window or lowering damage for tests (rejected: changes gameplay for the harness);
disabling audio in combat tests (rejected: loses integration coverage and the stall can also come from
rendering); keeping the 30 s default (rejected: menu teardown alone could exceed it on this VM).

---

## D039 — 2026-10-20 — Bosses are data-driven phases and patterns on the shared Enemy body

**Decision:** A boss is a `BossDef` (intro/death clocks, gate, reward name, ordered phases) plus a
catalog of reusable `BossPatternDef` rows. `Boss` extends `Enemy` for body, collision, hit flash,
grounding and the common hit contract; it adds only phase transitions, pattern execution, the
Bellbearer gate and a typed `BossEvent` stream. Phase pattern selection is a pure weighted roll with
cooldowns, min/max range filters and anti-repeat, executed by `BossPatternState`. Pattern kinds
(`charge`, `dash`, `sweep`, `slam`, `dive`, `rain`, `fan`, `ring`, `teleport`) map data to fixed
simulation behaviour; projectile spawn helpers stay pure so tests can assert positions and counts.
Fairness constants (minimum telegraph and idle gaps, ward-break radius) are asserted in content tests
rather than left to review by eye.

**Why:** Three bosses with seven phases and fifteen patterns would have become three copies of the
same collision, hit and movement code. A shared body plus content rows keeps every number tunable in
`src/config`, makes a phase a data edit rather than a branch edit, and lets unit tests exercise every
threshold and pattern without Pixi, audio or the loop. The event stream keeps rendering and audio out
of the simulation.

**Alternatives:** three bespoke boss classes (rejected: duplicated physics and hit handling);
imperative per-boss update methods (rejected: phase edits become control-flow edits); random pattern
choice without cooldowns (rejected: repeated unpunishable patterns and non-reproducible tests).

## D040 — 2026-10-20 — The Bellbearer's shield needs a player-baited wall charge; first clears are permanent for the run

**Decision:** The Bellbearer's `bellShield` blocks all damage and sword deflections until a charge
impacts a wall **and the player is within 64 px of that impact**. A far wall hit does not break the
ward. A break enters the post-gate phase, emits a ward-break/phase pair, and staggers the boss for
`wardBreakStunTicks`. A first defeat records a sigil, raises the mask ceiling by one, fills the new
mask, unlocks the arena's return door and marks the room claimed. Re-entering a claimed arena creates
no boss and no lock. M6 keeps the sigil set in memory; persistence is M7.

**Why:** The first implementation let the arena-wide charge hit the far wall and solve its own gate
before the player understood the puzzle. The radius makes the break a deliberate bait: the player
must stay near the wall, survive the charge and punish the stagger. Claiming the room prevents a
defeated boss from returning on every door traversal, which would make the reward feel temporary and
the return path a chore. The one-mask reward gives the fight a run-level consequence without adding
an ability system yet.

**Alternatives:** break on any wall hit (rejected: the boss solves the puzzle itself); a scripted
cutscene break (rejected: removes the fight's central decision); respawning bosses on re-entry
(rejected: undermines the sigil and the door); persisting sigils now (deferred to M7's save contract).

## D041 — 2026-10-20 — Boss tells are geometric and screen-space; the HUD spells out the gate

**Decision:** `BossView` draws procedural art plus archetype-aware warnings: a swept lane for
charge/dash, a target ring and player marker for slam/dive, player-centred vertical lanes for rain,
and spokes/rings for fan/ring. The ward is a body-sized bell-rim aura, not a generic shield icon. The
screen-space `BossHud` shows name, phase pips, phase name and an explicit `WARDED` label; intro,
phase and reward `Banner`s use the simulation clock. Boss events translate to eight existing CC0 SFX;
the Bellbearer requests `bossAbyss`, the other arenas request `bossCitadel`. No new assets or licences
were added.

**Why:** A boss pattern is a commitment, so the player must be able to read where it will land, not
just that something is charging. Drawing the actual lane/ring/rain columns makes the fairness
constants legible during play. Spelling out `WARDED` avoids the common souls-like failure where a
player assumes their damage is broken. Procedural boss art kept M6 shippable without introducing
unlicensed or unapproved art.

**Alternatives:** a single generic flash for every pattern (rejected: unreadable in a three-boss
milestone); authored boss sheets (deferred: no approved packs and no time to commission art);
relying on bar color alone for the ward (rejected: not readable for color-vision differences).

## D042 — 2026-10-20 — Boss E2E asserts outcomes, not short-lived FSM states; captures freeze the frame

**Decision:** Boss Playwright coverage uses the debug contract and simulation outcomes: HP, phase
number/name, ward flag, alive flag, sigil, max masks and `exitLocked`. It does not poll for a phase or
stagger state, whose hold can be shorter than one IPC round trip. After the ward break it retries the
real damage call in-page until the legal hit sticks, rather than asserting one instantaneous call.
Door traversal goes through `walkLeftToRoom`, which releases movement inside the page.
`debugLoadRoom` resets held input so a key from the previous room cannot leak into the next. Boss
screenshots wait two rendered frames, open the pause menu to freeze ticks, hide the DOM menu, and
capture only the canvas; `--boss-room=<id>` now implies `--boss`. Phase/pattern timing and every
transition remain unit-tested.

**Why:** The first boss suite flaked on transient states even though the simulation was correct: a
poll can arrive after the phase hold ended or after `stagger` became `idle`. Outcomes are stable and
still fail if the gate, reward or door logic regresses. The screenshot path had a real capture bug:
SwiftShader writes slower than a boss pattern, so an idle player could die and reset the room before
the PNG was saved, producing an intro frame instead of the selected telegraph. Freezing through the
existing pause flow uses the real loop semantics and needs no extra debug API.

**Alternatives:** widening phase holds for tests (rejected: changes gameplay to suit the harness);
sleeping longer (rejected: still loses the frame under load); adding a DEV freeze API (rejected: the
pause flow already freezes exactly the simulation and keeps rendering); screenshotting the whole page
(rejected: the pause overlay covers the arena).

---

## D043 — 2026-10-20 — A run save stores durable facts only; validation is all-or-nothing

**Decision:** A run persists to `localStorage['bellward.save.v1']` as a versioned document containing
the current room, a validated standing spawn, current masks, claimed sigils, charted rooms and the
checkpoint bench id. Enemies, projectiles, hitstop, boss phase timers and pickup state are deliberately
excluded: every room rebuilds clean, exactly as it does on a door transition. `loadRunSave()` validates
the whole document — known room, clear standing point, unique known sigils, unique known visited rooms
that include the current room, integer HP within the sigil-derived ceiling, and a checkpoint bench in a
charted room. Any failure, including a future version, returns `null` and boots a fresh run. A valid
resume is not rewritten at boot; fresh boots, room entries, rests, first boss clears and respawns write.
Storage `getItem`/`setItem` calls are guarded; a blocked write is reported but never breaks play.

**Why:** Autosaving a whole scene would preserve half-finished attacks, dead enemies and boss phase
timers that the deterministic rebuild contract does not expect. Durable facts are enough to continue a
metroidvania run and are straightforward to validate. All-or-nothing loading prevents an impossible
state such as HP above the mask ceiling or a checkpoint in an unvisited room; discarding a bad document
is safer than repairing it field-by-field. Version 1 gives later milestones an explicit migration
point. Not rewriting on resume keeps the save's room entry stable until the player actually moves.

**Alternatives:** full-scene snapshots (rejected: timers, pools and transient enemy state are not
durable content); salvage valid fields from a corrupt document (rejected: can create inconsistent runs);
multiple slots or cloud saves (deferred); save on every tick or hurt (rejected: storage churn, no
gameplay value); localStorage access without guards (rejected: private mode and embedded browsers can
throw).

## D044 — 2026-10-20 — Resume position and respawn checkpoint are separate; benches rebuild the room

**Decision:** The room entry autosave is the reload position. The bench checkpoint is only the death
return point. Death respawns at the last bench at full masks, or at the terrace if no bench has been
rested at. Resting at a bench sets the checkpoint, fully heals, rebuilds the current room clean and
autosaves; it does not teleport to another room. Benches are data-driven room content with stable ids,
a procedural prop and a validated spawn. The nave bench sits at x=104, west of the Bellbearer door, so
it can be reached from the terrace and from every arena return without entering another fight.

**Why:** Reloading at the last bench would erase legitimate progress every time the tab closes; dying
at the saved room entry would make death nearly free. Splitting the two positions preserves both
conveniences and consequences. Rebuilding on rest clears enemies and projectiles, matching the
souls-like reset without introducing a second persistence path. The first nave bench placement (x=360)
was behind a boss door: walking to it from the room spawn triggered the Bellbearer arena. Moving it
west makes the checkpoint reachable without solving a fight first.

**Alternatives:** reload always at the checkpoint (rejected: loses progress and makes exploration
hostile); respawn at the room that killed the player (rejected: no checkpoint consequence); heal in
place without rebuilding (rejected: dead enemies remain, inconsistent with room resets); put the nave
bench in the central hub (rejected: all approaches cross a door trigger).

## D045 — 2026-10-20 — The region chart is a DOM pause screen generated from room exits and run facts

**Decision:** The map is an accessible DOM screen inside the existing focus-trapped pause dialog,
opened by the `map` action (M by default) or the pause menu's **Map** entry. Opening it freezes the
fixed simulation through the same pause path and keeps rendering/audio alive. Nodes come from all
authored rooms and the current layout; routes are deduplicated from each room's exit graph rather than
hand-maintained. The chart shows charted count, current location, claimed sigils, last rest and a
legend. Unknown rooms keep their names and boss names out of the DOM. The chart is an ordered list with
`aria-current="location"` on the current chamber; only Back is focusable. Escape or the live map key
closes the map, and the footer hint is rendered from that same binding; **Back** returns directly to
the run.

**Why:** A canvas map would duplicate the menu's focus, screen-reader and responsive work. Deriving
routes from exits prevents the chart from drifting when rooms are added. Hiding unknown names preserves
discovery while still showing the region's shape. Reusing the pause flow means the deterministic loop
freezes with no new menu system, and deriving both the close key and its footer hint from the same
binding keeps a remapped map truthful.

**Alternatives:** canvas/Pixi map (rejected: no DOM semantics, duplicated focus handling); a
hand-authored map graph (rejected: drift from room content); reveal every room immediately (rejected:
removes exploration); a separate always-running overlay (rejected: simulation would continue under it).

## D046 — 2026-10-20 — M7 E2E reloads the real browser and seeds positions through a DEV spawn

**Decision:** The persistence suite boots the real app, rests through a real interact key, reloads the
page and asserts the resulting room/spawn/masks/sigils/map state. `debugLoadRoom(roomId, spawn?)` now
accepts a validated standing point so a bench test starts in range without a 280 px walk; the rest
interaction itself is still real input. Death coverage waits for spawn i-frames to expire, calls the
real damage path, and waits for the rebuilt room. Reward coverage defeats the boss immediately through
the existing DEV hook. M6 phase probes call `debugProtectPlayer()` first so a headless frame stall cannot
turn a phase assertion into a fifth-hit death; protection is DEV-only. The persistence describe gets a
90 s budget because each full reload re-decodes the score under SwiftShader.

**Why:** A fake storage unit test cannot catch boot ordering, scene rebuild or real `localStorage`
behavior. Walking to the terrace bench took long enough to approach the default test budget and was
sensitive to IPC latency; seeding a valid spawn tests the interaction rather than locomotion. The
optional debug spawn also gives future room probes a safe entry without bypassing room validation.
Protecting i-frames isolates the boss FSM tests from headless timing without changing gameplay.

**Alternatives:** keep the in-page walking helper (rejected: slow and sensitive to keyup latency);
import `RunProgress` into a page stub (rejected: no real boot/reload proof); assert transient boss
states (rejected: flaky, already documented in D042); raise the global timeout (rejected: hides slow
tests instead of removing the walk).

## D047 — 2026-10-20 — RunSession owns the run lifecycle; BenchInteraction owns rest presentation

**Decision:** `Game` remains the composition root for the renderer, loop, input, menus and audio, but
delegates the continuous run to `RunSession`: scene construction, room/spawn tracking, progression,
autosave, rest, respawn and the map snapshot. `RoomScene` keeps gameplay and exposes the one-tick
`consumeBenchRest()` request; `BenchInteraction` owns bench range, focus, prompt and announcement state.
The scene's arrival banner stays above the HUD so rest/respawn announcements survive the rebuild.

**Why:** M7 pushed `Game` from 335 to 436 non-empty lines and `RoomScene` past 370. Moving the run
lifecycle out brought `Game` to 309 and `RoomScene` to 344 while creating a single place to reason about
save/respawn ordering. Rest UI is now independent of combat and can be unit-tested through its small
surface if needed. The split preserves the contract that only the composition root talks to every
subsystem.

**Alternatives:** leave the god object (rejected: violates the size guideline and mixes menu, run and
scene concerns); put saving inside `RoomScene` (rejected: scene should not know storage or checkpoints);
make a generic event-driven persistence service (rejected: unnecessary indirection for one run).

---

(appended M7; append new entries at the bottom — never edit old ones — correct them with a new entry)

---

## D048 — 2026-10-21 — Save v2 keeps the v1 key and migrates legacy runs in place

**Decision:** The durable run document is now version 2, still at `localStorage['bellward.save.v1']`. It
adds `pickups`, `brokenSecrets`, `charmsOwned`, `charmsEquipped`, `nailLevel`, `shards`, `ordeals` and
`sliceComplete`; all M7 fields keep their meaning. A version-1 document is upgraded in memory by adding
empty pickups/secrets/charms/Ordeals, nail 0, shards 0 and `sliceComplete: false`, then validated by the
same all-or-nothing v2 parser. Unknown pickups, impossible mask ceilings, unowned equipped
charms, duplicate facts, an Ordeal without its sigil and a malformed or future version start a fresh run
rather than booting an impossible state. A successful write replaces the document at the same key.

**Why:** M7 saves are the first real player progress; changing the key would strand them with no benefit.
Keeping one key also avoids dual-read precedence rules forever. The version number, not the key name,
owns the schema. Migration only fills new durable sets, so every legacy fact survives verbatim.

**Alternatives:** a v2 storage key with dual reads (rejected: two sources of truth and a migration that
could run twice); discard v1 saves (rejected: unnecessary progress loss); repair corrupt v2 field-by-field
(rejected: M7 established all-or-nothing loading, and a half-valid run can place the hero outside the
charted graph).

## D049 — 2026-10-21 — Traversal gates and secrets are tile roles with parent-room persistence

**Decision:** The Wall Claw is a normal ability pickup; after it is found, `PlayerWall` reads real wall
contact from the tilemap and enables cling/slide and a kick. The Wall-Claw Shaft is authored as ordinary
geometry, not a scripted lift or invisible trigger. Breakable walls and the Tide door are semantic tile
roles (`breakable`, `sealedDoor`). A nail swing removes every breakable tile in that room, records the
parent room id in `brokenSecrets`, and the level checker proves there are exactly two such rooms. The
sealed door opens when the `bellthief-tide-bell` key is owned. Secret chambers are ordinary rooms entered
through the opened wall.

**Why:** One tile vocabulary is shared by collision, rendering, pickup support checks and content
validation, so a gate cannot look open while still blocking. Persisting the parent room rather than a
wall instance id keeps the save stable when a layout is retuned, and there are only two authored secrets.
The Wall Claw remains an emergent movement ability rather than a bespoke shaft animation.

**Alternatives:** per-wall save ids (rejected: brittle content coupling for no gameplay benefit); a
scripted shaft elevator (rejected: would not test the ability); a separate `hasBrokenWall` boolean
(rejected: cannot distinguish the two secrets or survive a future third wall).

## D050 — 2026-10-21 — Focus, charms and nail upgrades share one loadout snapshot

**Decision:** Nail hits grant 11 Focus (17 with Ember Greed); a held heal spends 33 over 54 ticks (36
with Quick Mend) and restores one mask. Focus carries between rooms and refills at a bench or respawn; it
is intentionally not in the durable save. The bench equipment screen is an accessible DOM dialog over the
paused simulation. It owns a three-slot charm belt (all five charms cost one notch) and the Nail Forge
(two levels, 30 then 60 shards, +1 damage and +4 reach each). Charms auto-equip into a free slot when
found; the bench can toggle them. The controller receives one immutable `PlayerLoadout` snapshot, so
healing duration, reach, damage, dash cooldown and wall-claw availability all change together.

**Why:** Focus gives the aggressive nail loop a defensive payoff without adding another consumable, and
carrying change between heals makes every third hit feel earned. Auto-equipping avoids a new player
finding a charm and believing it does nothing; the bench then makes the choice explicit. A single loadout
snapshot prevents the HUD, controller and save from disagreeing after a purchase.

**Alternatives:** a soul-style heal with no hold (rejected: loses the risk/reward channel that makes
Sturdy Shell meaningful); per-charm bespoke hooks in the scene (rejected: updates would drift from the
saved set); saving Focus (rejected: every reload would start mid-resource, and benches already restore
it).

## D051 — 2026-10-21 — The Ordeal is a deterministic rematch variant, not a second boss

**Decision:** A claimed arena exposes an altar prompt. Interacting relights the same boss as an Ordeal:
1.35× base health and 0.85× wind-up/recovery tempo, using the established patterns. The first clear pays
40 shards and is stored in `ordeals`; the altar goes dark for the rest of the run. An Ordeal still requires
the normal sigil first, and clearing it does not alter the normal first-clear reward or checkpoint rules.

**Why:** Three authored bosses already carry fifteen telegraphed patterns. Reusing their FSM and data
gives the slice a hard-mode goal without a fourth boss or an unreadable speed-only difficulty slider.
Deterministic health and tempo scaling is testable and transparent; a flat damage increase would instead
make one mistake lethal and hide the patterns.

**Alternatives:** an NG+ that scales every room (rejected: larger save scope and no focused goal); a
difficulty setting (rejected: the slice wants a diegetic optional challenge); brand-new Ordeal bosses
(deferred: content cost beyond the vertical slice).

## D052 — 2026-10-21 — The Tide door is a one-shot accessible ending, not a cutscene lock

**Decision:** The Bell Thief leaves the Tide-Bell key in the claimed arena. Owning it opens the sealed
door in the Upper Gallery, where crossing the threshold fires **The Bell Remembers** once. The ending is
a focus-trapped DOM card with the run's sigil/shard/charm totals; `Escape`, `Enter` or **Return to the
belfry** closes it and returns to the still-mounted world. The durable `sliceComplete` flag seeds
`RoomScene.endingFired`, so closing the card or reloading on the threshold cannot reopen it. The card
does not delete the run or consume the key.

**Why:** The ending is a milestone, not a lockout: a player should be able to keep exploring, finish
pickups and attempt Ordeals after seeing it. A DOM card inherits the pause flow's focus and screen-reader
work and keeps the simulation frozen while it is open. The one-shot guard is a durable fact because a
reload must not replay the ending.

**Alternatives:** a scroll/credits lockout (rejected: ends the slice early); a canvas banner only
(rejected: inaccessible and easy to miss); consuming the Tide-Bell or deleting the save (rejected: both
destroy optional content).

## D053 — 2026-10-21 — `level:check` owns the content contract; a full-run E2E owns the economy

**Decision:** `npm run level:check` is a zero-dependency content gate. It requires exactly the twelve
named rooms, reachability from the terrace, a directed loop, a valid standing spawn for every room and
door, a map position for every room, exactly the 22 registry pickups placed once with support inside the
pickup aura, two breakable-secret rooms, one sealed door, one ending, four mask shards, five charms, one
ability, one key, three boss rooms each with an Ordeal, and every boss room within two rooms of a bench.
A separate Playwright flow performs one continuous content-complete run: all twelve rooms, all 22
pickups, both secret walls opened by real nail swings, three normal bosses, three Ordeals, both nail
levels, the ending, the full map and a reload. It seeds between authored encounters with `debugLoadRoom`
to avoid repeating locomotion; the dedicated M8 tests retain real shaft wall-jumps and door walks, and
the run still uses the production pickup, save, bench and ending paths.

**Why:** Data-driven content drifts silently when a room moves or a pickup loses its ledge. A script that
fails before boot is cheaper than a runtime test discovering an unreachable reward. The full-run test
proves the economy closes: 195 shards from pickups plus 120 from Ordeals pays the 90-shard nail line and
leaves 225, while also proving a single run can reach 12/12 charted and the one-shot ending. Manual
playthroughs documented the feel; the test keeps the facts reproducible.

**Alternatives:** per-content unit tests only (rejected: cannot catch cross-room reachability or bench
distance); a fully unaided bot route (rejected: brittle platforming noise on SwiftShader); screenshots as
the only proof (rejected: not a contract).

---

(appended M8; append new entries at the bottom — never edit old ones — correct them with a new entry)
