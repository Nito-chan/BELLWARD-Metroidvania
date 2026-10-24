# BELLWARD — Final Act audit

**Date:** 2026-10-24  
**Baseline:** `e221d30` (`test(boss): wait out Last Keeper phase transition before damage`)  
**Scope:** The four-weapon arsenal, Last Keeper, Tide door, save v3, final ending, HUD,
menus, touch controls, audio/visual feedback, accessibility, and the coverage protecting
them.  
**Status:** Audit only. No gameplay, art, balance, or test changes have been applied.
This report is the approval gate before fixes.

---

## Verdict

**Not releasable, and the final act cannot be completed in normal play.**

There are five P0 defects:

1. Censer or Toll attacks terminate the simulation with a missing-animation error.
2. The Last Keeper's third phase crashes on its first idle tick.
3. The third phase is not invulnerable once it becomes idle.
4. The three-note ritual is not a timing test: one Toll wave answers all three notes,
   windows reopen continuously, and misses cost nothing.
5. The great bell cannot be interacted with from any stable position, and there is no
   prompt for the final interaction.

The first three make the Last Keeper unfinishable. The fourth removes the designed phase 3
method. The fifth makes the ending unreachable even if the fight is repaired. The rest of
the final act is substantially authored and worth keeping; this is a repair-and-finish
problem, not a rewrite.

The P1 issues below — especially touch layout, missing weapon/chain/answer feedback, the
dead phase-2 flood, and the ending copy — will still make the finished fight feel
unfinished until they are addressed.

### Severity definitions

| Level  | Meaning                                                                                                                   |
| ------ | ------------------------------------------------------------------------------------------------------------------------- |
| **P0** | Crashes, blocks progression, or makes the required ending unreachable. Fix before any content or art approval.            |
| **P1** | Breaks a required mechanic or makes it unreadable/unusable in normal play. Fix in the final-act pass.                     |
| **P2** | Incorrect or misleading behaviour with a workaround, or a missing secondary feature. Fix before calling the act complete. |
| **P3** | Copy, documentation, or cosmetic polish. Safe to batch at the end.                                                        |

**Counts:** 5 P0, 8 P1, 4 P2, 3 P3.

---

## Evidence and gates

### Automated gates at `e221d30`

| Gate                         | Result                                                         |
| ---------------------------- | -------------------------------------------------------------- |
| Unit tests                   | **325 / 325 passed** across 27 files (10.7 s)                  |
| Typecheck + production build | **Passed** after removing the temporary audit harness          |
| `level:check`                | **13 rooms / 27 pickups / 38 anchors / 3 benches / 3 Ordeals** |
| `assets:check:strict`        | **1,914 files / 0 warnings**                                   |
| Playwright E2E               | **41 passed / 4 failed** in 45 tests (28.1 min)                |

The `level:check` and asset gates confirm the content and asset references are internally
consistent. They do **not** prove the final act is playable: the failures below are runtime
and interaction defects.

### Browser pass

Playwright was run against the live dev server at:

- **1440 px:** title, normal room, Censer equipped, The Last Bell.
- **768 px:** touch controls.
- **375 px:** touch controls, pause, Region Map, The Bench, title.

Normal-flow pages had a clean console. Induced Censer/Toll attacks and the phase 3
transition produced fatal errors. The 375 px Bench overlay measured **375 × 667**, fitted
without scrolling, used the exact label **The Bench**, and produced no console errors.
Pause, map, and title also kept their required labels and focus behaviour in that pass.

### Temporary simulation harness

A throwaway harness was used to drive the phase 2 → phase 3 transition and Toll answers
without a browser. It was deleted after the run and is not part of the test suite. Its
recorded output is the evidence for the phase 3 findings:

```text
A: crash -> [BELLWARD] boss phase "answer" has no positive pattern weight
A: state idle phase 2 hp 23
A: one hit after transition -> hp 22 alive true solved false
B: tick 0 answers 1 window false solved false alive true
B: tick 1 answers 2 window false solved false alive true
B: tick 2 answers 3 window false solved true alive false
```

### Stale E2E expectations

The four E2E failures are expectations that were not updated after the thirteenth room, the
fourth sigil, and the Tide door becoming a midpoint:

1. `tests/e2e/m8.spec.ts:297` expects `1 / 3` sigils; the game correctly reports `1 / 4`.
2. `tests/e2e/persistence.spec.ts` expects `3 / 12` charted rooms; the game reports `3 / 13`.
3. `tests/e2e/persistence.spec.ts` expects `11` unknown rooms; the game reports `12`.
4. `tests/e2e/playthrough.spec.ts` still expects the old Tide-door ending at `upper-gallery`
   and the pre-final card title.

These are test debt, not evidence that the new counts are wrong. They are still a P1 because
CI is red and because the suite has no coverage for the P0 paths.

---

## P0 findings

### P0-1 — Censer and Toll attacks crash the simulation

**Area:** Weapons, hero animation, render loop  
**Observed:** Pressing attack with either Censer or Toll produces a fatal error and the
simulation stops:

```text
BellwardError: animation "censer1" is not defined
BellwardError: animation "toll1" is not defined
[BELLWARD] simulation frame failed
```

**Reproduction:**

1. Load a save with Censer or Toll owned (or a normal save at the Reliquary/Upper Gallery).
2. Press `Q` / gamepad LB / touch **Swap** until the Censer or Toll is current.
3. Press attack (`X` / gamepad X / touch **Strike**).
4. The canvas freezes; the browser console contains the error above.

**Root cause:** `PlayerCombat` names the one-shot clip `${weapon}1`, so Censer asks for
`censer1` and Toll asks for `toll1`. `HERO_ART.animations` in `src/data/art.ts` defines
`attack1`, `attack2`, `hook`, `guard`, and `parry`, but not `censer1` or `toll1`.
`SpriteAnimator.play` correctly throws on an unknown clip; `Game` records it as
`simulation frame failed` and the loop stops.

**Impact:** Both weapons acquired by normal progression are unusable. This alone prevents
the full-arsenal check, the phase 2 chain loop, the phase 3 ritual, and the Tide door from
being completed normally.

**Required fix:** Add valid Censer/Toll clips to the hero animation table. A temporary
reuse of the existing attack sheets is acceptable to stop the crash; P0 art can replace the
frames later. Do not silently fall back to `idle` in `SpriteAnimator`: the throw is the
correct guard against missing art.

**Regression protection:**

- A unit test that every attack weapon's `PlayerCombat` clip name exists in
  `HERO_ART.animations`.
- An E2E test that cycles to Censer and Toll and attacks once each, with a console-error
  assertion.
- A startup/data validation test that all animation keys referenced by the player are
  present.

---

### P0-2 — Phase 3 crashes on its first idle tick

**Area:** Last Keeper phase lifecycle, pattern selection  
**Observed:** After the phase 2 → phase 3 transition, the first idle tick throws:

```text
[BELLWARD] boss phase "answer" has no positive pattern weight
```

The harness state before the throw is `state idle phase 2` (the zero-based phase index for
the third phase), i.e. the boss has entered the third phase but is still using the
idle/pattern machinery.

**Root cause:** `enterPhase3()` clears the pattern set and starts a `phase` transition.
When the transition ends, `think()` calls `beginIdle()`; on the next idle tick it calls
`choosePattern(ctx)`. The `answer` phase definition has no patterns (the ritual is not a
pattern pool), so `chooseBossPattern` throws.

**Impact:** The final phase can never run, which means the final ending is unreachable even
if the Censer/Toll crash is bypassed.

**Required fix:** Phase 3 is a terminal ritual state, not a pattern state. Do not call
`beginIdle()`/`choosePattern()` after the phase 3 transition. Either add a dedicated
`ritual` state or guard the idle branch when `lastKeeperMode && phaseIndex === 2`. The
Keeper should kneel/ring the bell and remain invulnerable until the ritual resolves.

**Regression protection:** A unit test that drives phase 1 → phase 2 → phase 3 and ticks
past the transition without throwing, then asserts the phase name and ritual state. This is
the test the existing suite was missing.

---

### P0-3 — Phase 3 is not invulnerable after the transition

**Area:** Damage gate, phase 3  
**Observed:** In the simulation, after the phase 3 transition the boss is `idle` and a
single hit reduces HP from **23 → 22**. Phase 2 can be chipped down to 1 HP, so once the
crash is fixed one phase 3 hit can kill the boss immediately.

**Root cause:** `Boss.damageBlocked` covers `warded`, `hidden`, `intro`, and `phase`. Once
the phase 3 transition ends, none of those are true; `takeDamage` applies normally.
`enterPhase3()` sets `phaseIndex = 2` but does not add an invulnerability condition.

**Impact:** The design says phase 3 is solved by the method, not by damage. A player could
skip the ritual with one Nail hit once phase 2 has chipped HP to 1. The phase 2 gate also
lowers HP without killing, making the eventual one-shot even easier.

**Required fix:** Make `damageBlocked` true while the Last Keeper is in phase 3 and the
ritual is unsolved. Return `false` without changing HP; route the hit through
`enemyBlocked` (or a dedicated muted-clang event), not ordinary hit sparks. Set/confirm the
phase 2 HP lock at 1 on phase entry so phase 3 cannot inherit a lower value.

**Regression protection:** Assert HP is unchanged at phase 3 idle, during every answer
window, and after a missed answer. Assert a Nail/Censer/Toll hit on the Keeper produces
blocked/muted feedback rather than damage.

---

### P0-4 — The three-note ritual is not a timing test

**Area:** Phase 3 answer windows, Toll wave processing, miss handling  
**Observed and reproduced:**

- One Toll wave inside the bell radius answers all three notes on three consecutive ticks.
  The harness output above shows `tick 0 → 1`, `tick 1 → 2`, `tick 2 → 3`, then
  `solved true / alive false`.
- The answer window reopens immediately. `think()` opens a new 24-tick window on the next
  tick after the old one expires, so there is no closed beat and no meaningful “meet the
  ring” timing.
- A miss only pushes a `wallHit` event at the Keeper's feet. It does not reset the current
  note, does not close progress, and does not create a shockwave hazard.
- Answer windows can open during the phase transition because the ritual clock runs before
  the state switch.

**Root cause:** The phase 3 ritual is implemented as a proximity check plus a continuously
re-armed timer. `RoomScene` calls `boss.processTollWave(slot.x, slot.y)` for every active
player projectile every tick. `tollAt` closes the current window and increments the answer
count, but the next `think()` opens another window immediately; the same wave is still in
range, so it answers the next note. There is no wave identity, ring travel, or note reset.

**Impact:** The designed 2–3 minute phase 3 becomes a three-tick cheese. “Three timed Toll
answers” is not implemented, and the final act loses its climax. The continuous window also
spams the bell tell every 24 ticks.

**Required fix:** Give the ritual an explicit state machine:

- `kneel` → one ring travels outward → `answer window` → resolve (answer or miss) → close →
  next ring.
- One answer per Toll wave (store a wave id or a `answeredThisWave` flag).
- Open windows only after the transition, never during `phase`.
- A miss resets the current note, closes the window, and spawns a telegraphed shockwave with
  a real hitbox and i-frame interaction.
- Only the third successful answer solves the ritual.

**Regression protection:** Tests for one wave = one answer, no answer during transition,
miss reset, shockwave hitbox, and exactly three answers to solve. An E2E test should fire
three separate Toll rings and verify the HUD count.

---

### P0-5 — The final bell has no normal-play interaction path

**Area:** Ending trigger, level geometry, interaction prompt  
**Observed:** The great bell is at `(480, 148)`. The natural center hang puts the hero's feet
at `(480, 200)` — **52 px** away. The interaction check is strict `< 48`. There is no
platform at the bell, and no prompt appears when the ritual is solved.

```ts
if (boss.ritualSolved && input.pressed.has('interact')) {
  const bell = this.room.definition.lastKeeper.greatBell;
  const feet = this.player.feet;
  if (Math.hypot(feet.x - bell.x, feet.y - bell.y) < 48) {
    this.objectives.triggerFinalEnding();
  }
}
```

**Impact:** The ending is effectively unreachable. A frame-perfect jump-off from the center
ring can momentarily put the hero inside 48 px, but there is no prompt, no stable position,
and no reason for a player to discover that input. This is the smallest geometry bug in the
act with the largest consequence.

**Required fix:** Choose one:

- Add a central dais/platform below the bell so the hero can stand and interact, or
- Raise the interaction radius to at least 64 px and make the center hang a deliberate
  interaction position, and
- In both cases, show a clear `Ring the final note` prompt when the ritual is solved, and
  support keyboard, gamepad, and touch `interact`.

Do not rely on a frame-perfect jump. The final interaction should be the easiest input in
the fight, not the hardest.

**Regression protection:** An E2E test that reaches `ritualSolved`, positions the hero at the
center ring, presses interact, and asserts the final card. A unit/level test should assert
the bell interaction volume and that a platform or reachable radius exists.

---

## P1 findings

### P1-1 — Touch controls break at 375 px and the Swap button is misplaced

**Area:** Touch, responsive layout, target sizing  
**Measured at 375 × 667:**

| Element      | Box                    |
| ------------ | ---------------------- |
| Movement pad | `(14, 605, 157, 48)`   |
| Action pad   | `(162, 546, 199, 107)` |
| Swap button  | `(0, 0, 42, 42)`       |

- The action pad overlaps the movement pad by **9 px** (`move` right edge 171, `actions`
  left edge 162). The right movement button sits under **Guard**, causing mispresses.
- **Swap** is a 42 × 42 px button at the top-left of the viewport, nowhere near the action
  thumb. It is below the 44 px target minimum and does not show the current weapon.
- At 768 px the pads do not overlap, but Swap is still at `(0, 0, 42, 42)`.

**Root cause:** `buildSwapButton()` is appended directly to the touch root, not to the
action pad. `setActionVisible('weapon', true)` still adds the `has-weapon` class, which
reserves a fourth column in the action grid (`touch.css`). That empty fourth column widens
the action pad to 199 px at 375 px and squeezes it into the movement pad. The intended
`.touch-actions .touch-weapon { grid-area: weapon; }` rule never applies because the button
is not a child of `.touch-actions`.

**Required fix:** Do not add a fourth column at phone width. Put Swap in a small floating
slot above the action pad (or use an explicit compact 375 px layout) and keep the action pad
three columns wide. Make every target at least 44 × 44 px, preferably 48 px. Show the
current weapon name or glyph on Swap and announce the change.

**Regression protection:** Playwright pointer-box checks at 375, 768, and 1440: no overlap,
every visible touch target >= 44 px, Swap is inside the action thumb zone, and pressing Swap
changes the weapon.

---

### P1-2 — The Last Keeper's mechanics have no readable visual state

**Area:** Boss presentation, chain/answer feedback, HUD  
**Observed:** In The Last Bell at 1440, the arena shows the generic hook ring and a bell
prop, but no iron chains, no chain-open indication, no answer ring, and no current-note
indicator. The boss HUD shows the generic three phase pips and `The Vigil`; it does not show
`chain 0/3`, `answer 0/3`, or `INVULNERABLE`. The only chain/answer cues are sound effects,
small sparks, and a generic banner with the wrong Bellbearer copy. `BossEncounter` uses the
same `wardBreak` banner for every event.

**Root cause:** `chainOpen`, `chainWindowTicks`, `answerWindow`, `answerCount`, and
`waterLevel` are simulation state without a view. `BossHudInfo` has no chain/answer fields,
and `BossView`/`EnemyView` do not render resonance or ritual markers. The room data has
three chain positions but no chain props.

**Impact:** Phase 2 is trial-and-error and phase 3 is unlearnable. The design target —
“nearly impossible but fair” — depends on the player seeing which chain is open and when the
bell is answerable. Audio-only cues are not sufficient, especially with reduced motion or
hearing loss.

**Required fix:**

- Render three chain props at `(240, 172)`, `(480, 172)`, `(720, 172)`, with a clear
  open/closed state and a 60-tick ring.
- Render a ring traveling from the bell to the outer answer circle, a 24-tick window arc, and
  three answer pips.
- Add `chainCount`, `chainOpen`, `answerCount`, and `answerWindow` to the boss HUD.
- Use shape and colour, not only sound, and keep the existing reduced-motion path.

**Regression protection:** Boss HUD unit tests for the counters; a browser screenshot/state
test that a chain open and an answer window are visible; an accessibility announcement test.

---

### P1-3 — No arsenal, current-weapon, or Toll-cooldown HUD

**Area:** HUD, weapon cycle  
**Observed:** The HUD draws health, Focus, posture, sigils, shards, and death, but no
four-slot arsenal plaque, no current weapon name, and no Toll cooldown. The player can press
Swap but cannot see what changed or when the Toll is ready.

**Impact:** The three attack weapons are new and visually similar in the placeholder art.
Without a weapon indicator the player cannot intentionally choose Censer for a chain or Toll
for the bell; the 45-tick Toll cooldown is invisible. This directly undermines phase 2 and 3.

**Required fix:** Add the designed four-slot plaque (Nail, Hookline, Censer, Toll), light the
current attack weapon and owned Hookline, and show the Toll cooldown as a small radial or
segmented ring. Keep it compact and readable at 375 px; include the exact weapon names.

**Regression protection:** HUD state tests for ownership, current weapon, and cooldown; a
375 px screenshot check that the plaque does not collide with health or touch controls.

---

### P1-4 — Censer and Toll combat effects are missing or wrong

**Area:** VFX, combat feedback, resonance  
**Observed:**

- Censer clouds are simulated (`CENSER_CLOUD`, 90 ticks, posture pulses) but no renderer
  draws them.
- Toll resonance is a real damage/posture state but has no enemy mark or ring.
- The Toll wave uses the shared fireball sprite tinted bone (`ProjectileView`), not a brass
  note or expanding ring.
- There is no hand-bell/Censer silhouette beyond the hero clip (and that clip is the P0
  crash).

**Impact:** The new weapons read as invisible stat changes or palette swaps. The Censer's
area denial and the Toll's “mark, then Nail/Censer” loop cannot be learned. Phase 2's
Toll → Censer cadence has no visual grammar.

**Required fix:** Add procedural, pooled effects:

- Censer: chain + vessel + smoke cloud at the impact point, with a visible 90-tick fade.
- Resonance: a brass ring/notch on the marked enemy that persists for its duration.
- Toll: an expanding brass note/ring, not a tinted fireball; use the existing bell SFX.
- Keep effects pooled and driven by fixed ticks; respect reduced motion.

**Regression protection:** Effect-layer unit tests for pool reuse and lifetime; visual
screenshot tests for Censer cloud, resonance mark, and Toll ring.

---

### P1-5 — Phase 2's flood is dead state and the phase is not implemented as designed

**Area:** Last Keeper phase 2, level hazard, pacing  
**Observed:** `waterLevelValue` increments in `censerAt()` when a chain breaks, but nothing
reads it. The room has no water line, hazard volume, rising floor, or safe-ledge logic.
The phase's unique objective is only “Toll opens three chains, Censer breaks them”; the
Keeper patterns still run, but there is no flood pressure. The design calls for a flooded
floor that rises in three steps and costs a mask with knockback and i-frames.

**Impact:** The “Drowning Toll” is currently a label, not a phase. There is no rising
pressure, no flood-driven reason to use the ledges or Hookline, and no 6–9 minute
survival/execution layer. The stated 10–15 minute target is not supported by the authored
content.

**Required fix:** Implement the water as a visual line plus a hazard volume, raise it after
each chain, and make the ledges/rings the safe answer. Alternatively, explicitly de-scope the
flood and rebalance the phase around another pressure source. This is the largest design
decision in the report; it should be approved before implementation.

**Regression protection:** Phase 2 tests for water step, hazard damage/i-frames, and safe
ledge positions; a timed playtest to verify the phase length target.

---

### P1-6 — The final ending is presented as the old slice ending

**Area:** Final card copy and close action  
**Observed:** The final card shows:

- Title: **THE LAST SILENCE** (the design and E2E expect **THE BELL REMEMBERS**).
- Eyebrow: **THE DROWNED BELFRY · END OF THE SLICE** (hardcoded for both cards).
- Close button: **Return to the belfry** (the design says **Continue the climb**).
- Subtitle is correct: “The Keeper sets down the bell. The water is still.”

**Root cause:** `RunSession` supplies `'THE LAST SILENCE'` as the Last Keeper fallback;
`EndingOverlay` hardcodes the slice eyebrow and the `Return to the belfry` button for both
the midpoint and final cards.

**Impact:** The earned ending reads as a vertical-slice endpoint. This directly contradicts
the requirement for a complete, earned ending and the exact-label contract.

**Required fix:** Pass the final title/eyebrow from room data or a dedicated ending config;
use `THE BELL REMEMBERS` for The Last Bell, remove `END OF THE SLICE` from the final card,
and use `Continue the climb` as the close action. Keep the midpoint card distinct. Update
the E2E expectation.

**Regression protection:** Assert the exact final title, eyebrow, subtitle, and close label;
assert the midpoint still says `THE TIDE-BELL ANSWERS`; verify focus and Escape close.

---

### P1-7 — The authored fight is probably far shorter than the 10–15 minute target

**Area:** Encounter pacing, phase 2/3 content  
**Observed:** Phase 2 is three chain checks; phase 3 is three answers. The current phase 3
is solved in three ticks. Even with P0-4 fixed, the phase has no 2–3 minute ring/answer loop,
and phase 2 has no flood pressure. There is no evidence the fight reaches the design's
3–4 + 6–9 + 2–3 minute plan.

**Impact:** The final act is at risk of being a 3–6 minute fight with a 15-minute label. This
is a scope and pacing risk, not a measured time; the phase 3 crash prevents a valid timing
run. Padding HP would be the wrong fix.

**Required fix:** After the P0/P1 mechanics are correct, time a real playthrough. Add phase-2
pressure and phase-3 ring timing, then retune. Do not claim the 10–15 minute target until a
full run supports it.

**Regression protection:** A scripted end-to-end timing run, plus a manual first-clear
record.

---

### P1-8 — E2E is red and misses the paths that hid the P0s

**Area:** Test coverage, CI  
**Observed:** 41 / 45 E2E tests pass. The four failures are stale expectations, not
regressions in the new counts. More importantly, no E2E test attacks with Censer/Toll,
reaches phase 3, triggers the final bell ending, or checks the 375 px touch layout. Unit tests
cover boss mechanics but not render clips.

**Impact:** CI cannot be trusted as a final-act gate. The P0s escaped because the tested
paths stopped at Nail combat and the midpoint.

**Required fix:** Update the four expectations to **13 rooms / 4 sigils / Tide-door midpoint /
Last Bell final ending**, then add the regression tests listed in each finding. Keep the
console-error assertion in every new browser test.

---

## P2 findings

### P2-1 — The Last Keeper uses the Bellbearer's ward banner

`BossEncounter` maps every `wardBreak` event to:

```text
THE BELL SHIELD BREAKS
The Bellbearer is vulnerable
```

This is wrong for Last Keeper chain breaks and answers. It also announces the wrong thing to
screen readers. Use event-specific copy, e.g. `A CHAIN FALLS` / `THE BELL ANSWERS`, and keep
the Bellbearer wording only for the Bellbearer.

### P2-2 — Phase 2 lies about hits and can be chipped to 1 HP

`CombatSystem` emits an `enemyHit` event even when `enemy.takeDamage()` returns `false`.
In phase 2 the damage gate lowers HP toward 1 (`24 → 23` observed) but returns `false`, so
the player still gets sparks, hitstop, and the hurt sound. The design says the Nail does
nothing to the warded chains; the current feedback says it is working. This can also leave
HP at 1 for phase 3.

Fix the damage gate to set the phase-2 HP lock on entry and expose a blocked/gated result;
route gated hits through `enemyBlocked` or a dedicated muted-clang event, with no damage
sparks.

### P2-3 — The Tide door ignores the Hookline

`RoomScene.updateExit()` treats `requiresArsenal` as `hasCenser && hasToll`. The player has a
`hasFullArsenal` property that includes Hookline, but the gate does not use it. The design
calls for a four-socket seal. Normal progression likely owns Hookline already, so this is a
low-frequency logic bug, but it is still wrong and easy to test.

### P2-4 — Bindings are still v2 and old custom binds are wiped

`INPUT.bindingFormatVersion` is **2**, and `isBindings` requires every current action,
including the new `weapon` action. A pre-final v2 document without `weapon` fails validation
and `loadBindings` returns defaults. `migrateBindings` only handles v1 → v2 (the guard
action); there is no v2 → v3 migration for weapon. The design calls for bindings v3 migration.

Fix: bump the format to 3, migrate v2 by inserting the weapon defaults while preserving every
custom key/button, and test a v2 document with custom binds.

---

## P3 findings

### P3-1 — 375 px title action frame bleeds 4 px

The primary title action measured `x = -4`, width `356`, in a `375` viewport. The decorative
frame is clipped on the left and the right margin is asymmetric (about 23 px). The content is
readable and the exact labels are present, so this is cosmetic; constrain the frame or adjust
the mobile gutter.

### P3-2 — Documents are stale in three places

- `docs/design/FINAL_ACT.md` still says **“proposal, not implemented”**.
- It says `level:check` should report **37 anchors**; the implementation reports **38**.
- It says gamepad **Y/Triangle** for weapon; the implemented/decided mapping is **LB**.
- It is internally inconsistent about the Last Bell rings — **four** in one place, **two** in
  another — while the room defines **three** anchors.

Update the design doc after approval so the next engineer does not implement against stale
facts.

### P3-3 — The binding editor says “Swap weapon,” the design says “Cycle weapon”

`src/ui/menu/menuContent.ts` labels the action `Swap weapon`. The design and the touch
control use **Swap**, but the control contract calls the action **Cycle weapon**. Pick one
term and use it consistently in keyboard, gamepad, touch, and settings copy.

---

## Coverage matrix

| System / state                               | Coverage                        | Result                                                                             |
| -------------------------------------------- | ------------------------------- | ---------------------------------------------------------------------------------- |
| Move, jump, dash, momentum, reset            | Unit + browser                  | Pass; no new issue found                                                           |
| Nail attack, combo, guard, parry, heal       | Unit + E2E                      | Pass                                                                               |
| Hookline traversal and hang                  | Unit + browser                  | Pass; final-bell use is the P0-5 gap                                               |
| Censer logic (swing, cloud, posture, chain)  | Unit + simulation               | Logic passes; render crashes (P0-1); cloud invisible (P1-4)                        |
| Toll logic (ring, wave, resonance, cooldown) | Unit + simulation               | Logic passes; render crashes (P0-1); no cooldown HUD (P1-3); wave art wrong (P1-4) |
| Weapon cycle and ownership                   | Unit + browser                  | Logic passes; no HUD/readability (P1-3); touch layout (P1-1)                       |
| Last Keeper phase 1                          | Config/unit + browser           | Runs; generic arena readability                                                    |
| Last Keeper phase 2                          | Simulation                      | Chain logic runs; water dead (P1-5); false hit feedback (P2-2); no visuals (P1-2)  |
| Last Keeper phase 3                          | Simulation + browser transition | Crash (P0-2), not invulnerable (P0-3), ritual not implemented (P0-4)               |
| Final bell and ending                        | Browser + code                  | Unreachable / no prompt (P0-5); wrong final copy (P1-6)                            |
| Save v3, Tideglass, Tide door                | Unit + E2E                      | Save works; gate ignores Hookline (P2-3); counts stale in E2E (P1-8)               |
| HUD and boss HUD                             | Browser + unit                  | Missing arsenal/cooldown/counters (P1-2, P1-3); phase bar exists                   |
| Pause, bench, map, title                     | Browser 375/768/1440            | Labels/focus/geometry pass at 375; title 4 px bleed (P3-1)                         |
| Touch input                                  | Browser 375/768                 | Functional presses; layout and Swap broken at 375 (P1-1)                           |
| Reduced motion, focus traps                  | Browser spot checks             | No new regression observed                                                         |
| Audio / missing assets                       | `assets:check:strict`           | 0 warnings; weak audio-only chain/answer cues (P1-2)                               |
| CI / tests                                   | Unit, build, level, assets, E2E | Unit/build/level/assets green; E2E red (P1-8)                                      |

---

## Game-feel recommendations

These are recommendations, not implemented changes. They assume the P0/P1 fixes are approved
first.

1. **Teach the grammar before the test.** Phase 1 should make the player use Censer, Toll,
   and Hookline once each in a low-stakes pattern. Phase 2 should then combine them under
   pressure. Right now phase 1 is a generic boss and phase 2 introduces two invisible verbs.
2. **Give the chains and the bell physical presence.** Brass chain links, a taut line, a
   water line, a ring that travels, and three pips are worth more than any health-bar tweak.
   The player should be able to describe the mechanic after one attempt.
3. **Make phase 3 a listening test.** One ring at a time; the wave meets the outer circle;
   one note per Toll wave; a miss is loud, visible, and resets only the current note. A
   success should feel like a struck bell, not a damage number.
4. **Make the finale the easiest interaction.** After the third answer, the camera should
   settle on the great bell, the prompt should appear, and the final note should be one
   deliberate press. The ending tableau can carry the release; the input should not be a
   secret.
5. **HUD as instrument panel.** Four slots, current weapon lit, Toll cooldown, chain/answer
   pips. Keep it to one compact strip; do not add a second health bar or a quest log.
6. **Touch as a first-class control scheme.** At 375 the action pad must be a 3-column grid
   or a 2×4 grid; Swap belongs above it, not at `(0,0)`. Keep every target >= 44 px and
   ensure the movement thumb never touches Guard.
7. **Reserve hitstop for meaning.** Ordinary Nail hits can keep their current hitstop; chain
   breaks and answers should get one clear beat. Do not shake the camera on blocked phase-2
   hits — it teaches the wrong lesson.
8. **Test the contract, not just the happy path.** Add a render-contract test for every
   weapon clip, a phase-3 FSM test, a one-wave/one-answer test, and a final-bell
   reachability test. Those four would have caught all five P0s; the touch-box test covers
   P1-1.

---

## Proposed repair order (after approval)

1. **P0-1:** Add Censer/Toll hero clips (temporary reuse is fine), then add the
   animation-contract test.
2. **P0-2 + P0-3:** Replace the phase 3 idle/pattern path with a terminal ritual state and
   make the phase invulnerable until the ritual resolves.
3. **P0-4:** Implement one ring/one window/one answer per wave, miss reset, and a real
   shockwave.
4. **P0-5:** Add the final-bell interaction volume/platform and prompt; test all three input
   modes.
5. **P1-1:** Fix the 375 px touch layout and Swap placement; add pointer-box tests.
6. **P1-2/3/4:** Add the readable boss state, weapon/cooldown HUD, and procedural effects.
7. **P1-5:** Approve or de-scope the phase-2 flood, then implement and time it.
8. **P1-6 + tests:** Correct the final card copy/close action; update the stale E2E counts and
   add the P0 regression tests.
9. Re-run unit, build, level, assets, E2E, and the 375/768/1440 browser pass.
10. Only then start the P0 final art review and the deferred Tideglass map UI.

**No gameplay or art changes should be made until this report is approved.**

---

## Approval requested

Please confirm the severity ranking and the proposed order, and specifically decide:

1. **Phase 2 flood:** implement the rising-water hazard, or explicitly de-scope it and
   rebalance around another pressure source?
2. **Final bell interaction:** central dais, larger interaction radius plus prompt, or both?
3. **Phase 3:** the full ring-travel timing model, or a simpler 24-tick closed/open cycle with
   one answer per wave and a miss shockwave? The latter is smaller but still needs a real
   closed beat.
4. **Final card copy:** confirm **THE BELL REMEMBERS** and **Continue the climb** as the
   canonical final labels.

Once approved, the P0 fixes and their regression tests can proceed as one focused pass.
