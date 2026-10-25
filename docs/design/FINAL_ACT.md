# The Final Act — design and implementation

Status: **implemented**. Censer and Toll, the Ward of Four, the three-phase Last Keeper,
save v3 and the earned ending are in the build. The Tideglass map UI and the P0 final art
remain deferred (see Explicitly deferred). This document covers Censer and Toll, the Ward of
Four, the three-phase Last Keeper, the earned ending, save v3 and the Tideglass pickup.

## Goals

- Finish the four-weapon, grapple-first arsenal: **Nail, Hookline, Censer, Toll**.
- Aim for a 10–15 minute clear (design target, not yet verified in a timed run); the fight
  should take 1–3 hours to learn: phase 2 nearly impossible but fair, phase 3 invulnerable
  and solved by a method rather than damage.
- Give the story a complete, earned ending with no cliffhanger. Adapt the **themes** of
  Ra.One (2011) — a created guardian bound to a role, the creator/creation bond, sacrifice,
  and a remembered world becoming real — not its plot or characters.
- Keep BELLWARD's own language: bells, brine, brass, bone, wax and porcelain. No Hollow
  Knight map, charm or combat shorthand.
- Preserve keyboard, gamepad, touch, focus traps, reduced motion and the exact labels
  `Enter the belfry`, `Continue the climb`, `Begin anew`, `Paused` and `The Bench`.

## The arsenal

### Weapon cycle

The attack button uses one of three attack weapons:

```
Nail  →  Censer  →  Toll  →  Nail
```

The **Hookline** is the fourth weapon and stays on `cast`. It is always available for
traversal and for the Last Keeper's flooded arena. The HUD shows a small four-slot arsenal
plaque; the current attack weapon is lit, and the Hookline slot is lit when owned.

- New action `weapon`: keyboard `Q`, gamepad LB (button 4), touch **Swap**.
- The touch Swap plaque is at least 44×44 px, sits above the action pad, shows the current
  weapon's icon/name and cycles on tap.
- Switching is allowed while idle, running, airborne or on a cooldown. It is ignored while
  an attack, guard, hook, dash or heal owns the hero. The new weapon starts on the next
  attack press; it never cancels a swing.
- The binding document moves to v3. v2 documents gain the default `weapon` binding; v1
  migrates through v2 to v3.
- The controls screen and pause binding editor name **Swap weapon**; the touch plaque
  shortens that to **Swap**. The HUD and pickup banners use the exact weapon names
  **Nail**, **Censer**, **Toll** and **Hookline**.

Ownership derives from pickups, so no save field is needed:

| Weapon   | Pickup id           | Room             | Placement                     |
| -------- | ------------------- | ---------------- | ----------------------------- |
| Nail     | starter             | —                | —                             |
| Hookline | `aqueduct-hookline` | Sunless Aqueduct | existing                      |
| Longline | `shaft-longline`    | Wall-Claw Shaft  | existing upgrade              |
| Censer   | `reliquary-censer`  | Reliquary        | high altar, `(480, 180)`      |
| Toll     | `upper-toll`        | Upper Gallery    | high east ledge, `(780, 180)` |

The Censer and Toll are deliberately near the end of the climb: the Reliquary is the
Upper Gallery's secret, and the Toll sits on the high ledge on the way to the Tide door.
Both can be reached with the Hookline. The final door then proves the player has the full
arsenal.

### Censer

A brass censer on a long chain: a slow, committed, wide heavy swing.

- One swing, 26 ticks: 9-tick wind-up, 7-tick active window, 11-tick recovery.
- Wide hitbox: 40 px reach, 52 px tall, 6 px forward offset; hits every targetable enemy
  in the arc once per swing.
- 3 damage, 30 posture. No combo; 0 Focus gain (the Nail remains the Focus engine).
- On a landed hit, leaves a **Brine Cloud** at the target for 90 ticks. Every 15 ticks it
  applies 2 posture to enemies inside (no health damage). The cloud is a posture tool that
  extends the Censer's KNELL setup.
- Visual: procedural chain + vessel + smoke; reuse the existing heavy-impact SFX. No new
  art or audio assets.

### Toll

A hand-bell / tuning hammer that answers the belfry.

- One ring, 20 ticks: 6-tick wind-up, 6-tick active, 8-tick recovery.
- Spawns a **Toll Wave** at the active tick: 240 px/s, 60-tick life, 22×30 px, passes
  through enemies, stops at solid tiles, hits each enemy once.
- 1 damage, 24 posture, and applies **Resonance** for 180 ticks.
- Resonance: the next Nail or Censer hit deals +2 damage and +10 posture and consumes the
  mark; the enemy's posture regeneration is halved while marked. A small brass ring marks
  the target.
- 45-tick cooldown after the ring; the HUD shows the cooldown. No Focus cost.
- Visual: hand-bell and an expanding brass note; reuse the bell SFX with a pitch/volume
  variation. No new asset.
- The Toll is also the answer to the Last Keeper's final phase: its wave must meet the
  great bell's ring at the right moment.

The Censer and Toll use the existing attack/pose/art vocabulary. Their silhouettes,
timing, hitboxes and effects make them distinct without commissioning new frames.

## The Ward of Four

The Tide door in the Upper Gallery stops being the ending. The first crossing shows a
one-shot **midpoint** card:

- Title: `THE TIDE-BELL ANSWERS`
- Subtitle: `The last door opens. Far below, a bell is still ringing.`

Beyond the card is an exit to **The Last Bell**. The exit requires the
`bellthief-tide-bell` and the full arsenal: Hookline, Censer and Toll (the Nail is always
owned). The door carries a four-socket seal; each owned weapon lights a socket. If the
seal is incomplete, the door stays sealed and the plaque reads `FOUR VOICES OPEN IT`.
This is a collection gate, not a stat check: every required item is on the main climb or
the one Reliquary secret.

The old save flag `sliceComplete` becomes `tideDoorOpened` in v3, so an old run does not
replay the midpoint card. The final ending gets a new `endingSeen` flag.

## The Last Keeper

### Arena

**The Last Bell** is the unseen thirteenth room above the tower: a 60×24 arena with a
great bell, a flooded floor, two high ledges and three authored Hookline rings. The entrance
is on the left, the Keeper waits beneath the bell. The Upper Gallery's `upper-tide-watch`
bench is the runback; there is no bench inside the arena. The exit locks while the Keeper
is alive, so the fight is a commitment.

The arena's water is a visual line plus a hazard volume. It starts below the floor; phase 2
raises it in three clear steps. Standing in water costs one mask and knocks the hero back
with the normal invulnerability window. The ledges and rings are always the safe answer.

### Phase 1 — The Vigil (100%–60% health)

The Keeper fights with the bell-hammer and the chain: readable sweeps, a chain lash, a
ringing shockwave and a toll that marks the floor. Forty health; the player learns the
Censer's commitment and the Toll's resonance. A first-time player should take roughly 3–4
minutes (timing target). The Keeper can be posture-broken and KNELLed normally; his guard is
the bell-hammer.

### Phase 2 — The Drowning Toll (locked health, three chains)

The Keeper refuses to die. His health locks at 1 and the water begins to rise. Three iron
bell chains hang around the arena; each must be broken to end the phase. A chain is warded:

1. A **Toll** wave hitting the chain opens a 60-tick **Answer** window.
2. A **Censer** hit during that window breaks the chain.

The Nail cannot break iron; attacking the ward does nothing. The Keeper's patterns become
faster and the water rises after each chain. The Toll's resonance can stagger the Keeper and
buy the Censer wind-up. The Hookline is the only reliable way between the rising ledges.
The phase ends when the third chain breaks; there is no health race and no random one-shot.
This is the long "nearly impossible but fair" phase: it is a deterministic execution
test of all four weapons.

### Phase 3 — The Answer (invulnerable)

The Keeper kneels, invulnerable, and rings the great bell three times. Attacking him deals
nothing and produces a muted clang. Each ring expands toward an outer brass circle. The
player must ring the **Toll** as the wave meets that circle (a 24-tick window). A correct
answer lights one of three brass pips; a miss resets only the current note and sends a
telegraphed shockwave. After three answers the Keeper's ward breaks, the Tide-Bell answers,
and the player interacts with the great bell to ring the final note. The phase is solved by
the method, not by damage.

The three phase names are **The Vigil**, **The Drowning Toll** and **The Answer**. The HUD
shows the phase 1 health bar, a three-pip chain counter in phase 2, and a three-pip answer
counter in phase 3.

### Target difficulty and length

These are design targets, not yet confirmed by a timed full run. Only phase 3 has been
timed in simulation; the full-run 10–15 minute target is still unverified.

- Phase 1: 3–4 minutes, fair and readable (target).
- Phase 2: 6–9 minutes, deterministic flood/chain execution; the player learns the safe
  route and the Toll → Censer cadence (target).
- Phase 3: **measured** at 367 ticks (~6.1s) from ritual start to the Keeper's defeat for
  three perfect Toll answers. The earlier 2–3 minute estimate is withdrawn; duration comes
  from missed notes, not the authored cadence.
- First clear: aim for 10–15 minutes (target, not a claim); learning: 1–3 hours, dominated
  by phase 2 and the answer timing. The bench runback is one room, so failure is a lesson,
  not a walk.

Measured phase 3 cadence (real-input E2E, 2026-10-25): kneel 60 / ring 30 / window 24 /
recover 36 ticks. All three answers landed **7 ticks** into their 24-tick windows, so the
authored window is reachable with 17 ticks to spare. A missed note adds one full note cycle
(~150 ticks / 2.5s) before the retry. The timeline is attached to
`tests/e2e/last-keeper.spec.ts` as `last-keeper-real-answers.json`.

## The earned ending

When the final note rings:

1. The Keeper's mask cracks; the great bell's light goes out; the water falls below the
   floor.
2. The Keeper sets down the bell-hammer and bows, or simply sits. He is not killed.
3. The city's bells answer one by one in the distance; the screen brightens; the hero is
   left on the Weeping Stone with the Tideglass.
4. The final card: **THE BELL REMEMBERS** — `The Keeper sets down the bell. The water is
still.`

The Ra.One themes are adapted, not copied: the Last Keeper is a created guardian bound to
a loop; the hero is the successor who gives the creation a real ending; the sacrifice is
the Keeper's release, not a death; the remembered city becomes real because someone chose
to remember it. There is no sequel hook: the water is still, the bell is silent, the city
is remembered, and the hero can keep exploring.

The final card is one-shot (`endingSeen`). The ending overlay reuses the existing focus
trap, Escape/back handling and reduced-motion behavior. `Continue the climb` closes the
card; the title screen marks the run complete and still offers `Continue the climb` and
`Begin anew`.

## Save v3 and the Tideglass

- `SAVE.version` becomes **3**.
- `RunSave` adds `tideDoorOpened` and `endingSeen`; `sliceComplete` is migrated into
  `tideDoorOpened`. v2 migration sets `endingSeen: false`; v1 migrates through v2.
- `RunProgress` exposes `endingSeen`, `tideDoorOpened`, and derives `censer`, `toll` and
  `tideglass` from pickup ids.
- The ending marks `endingSeen` and writes with a new `ending` save reason. Reloading after
  the ending never replays the card.
- **Tideglass pickup:** `terrace-tideglass` on the Weeping Stone, `(648, 292)`, kind
  `ability`, name **Tideglass**, description `A black wax tablet. The belfry's rooms wait to
be remembered.` The map UI is not wired yet; the pickup and save fact are added now, and
  the existing placeholder map stays untouched until the map phase.
- `level:check` reports 13 rooms, 38 anchors, 27 pickups, 3 benches and 3 Ordeals. The Last
  Bell has three rings, one per chain. The mid-fight bench is the existing `upper-tide-watch`.

## Tests and proof

- Unit: weapon ownership and cycle; Censer timing/hitbox/cloud; Toll wave/one-hit rule,
  resonance and cooldown; bindings v3 migration; save v2→v3; ending flag; Last Keeper phase
  gates, chain windows and answer windows; room validation for the new door and arsenal.
- E2E: both pickups equip and persist; Censer/Toll in real combat; the Ward of Four locks
  and opens; the three phases via debug; phase 2 chain sequence; phase 3 invulnerable, then
  three real-input Toll answers inside the 24-tick windows (measured 7-tick margin, 367-tick
  phase); the final card exactly once and no replay after reload; touch Swap at
  375/768/1440; focus trap and reduced motion.
- Existing m8/playthrough/persistence expectations change from "Tide door ending" to
  "Tide door midpoint + Last Bell final ending".

## Explicitly deferred

- The Tideglass **map UI** (true room geometry, explored state, locked/open paths,
  objectives, room details, log, where to go / where not to go, medieval pickup/load
  ritual). Only the pickup and save fact land now.
- P0 final art for the Censer, Toll, Last Keeper, flood and ending tableau. The build keeps
  procedural placeholders and the existing CC0 audio.
- Any fast-travel or additional map lenses.

## Decisions

1. Weapon switch: the cycle above (`Q` / gamepad LB / touch **Swap**). The cycle is used
   because the Last Keeper tests all four weapons in one fight.
2. Phase 2 chain cadence: Toll opens, Censer breaks, three times, with the water rising after
   each. The alternative pure survival timer was not taken.
3. Phase 3 answer window: 24 ticks, three notes, reset-current-on-miss. The one longer final
   note was not taken. Real-input E2E answers land 7 ticks into the window on all three
   notes, so the window stays 24.
4. Censer/Toll placements (Reliquary / Upper Gallery) and the Ward of Four collection gate
   are used as written above.
