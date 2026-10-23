# Controls

Status: **implemented (M2; utility keys M3; menus and binding editor M5; map, benches and run saves
M7; Focus healing, Wall Claw, bench equipment, Ordeals and the Tide ending M8; title, onboarding and
screen-shake access M9; the Keeper's Guard, parry, posture and KNELL M10; the Hookline and Longline
G2)**. These are the live defaults, sourced from `src/config/input.ts` and
round-tripped by the binding editor; this table is the contract that editor edits. Keyboard events are
matched on `KeyboardEvent.code` (physical key), so layouts like AZERTY still use the same physical
positions.

## Title and first run

Boot opens **BELLWARD** over the already-rendered terrace. The simulation is frozen; music still plays
once audio is unlocked. **Enter the belfry** starts a fresh run; when a save exists the primary action
is **Continue the climb**, with progress counts and no story spoilers. **Begin anew** is destructive
and takes two presses: the first arms it, the second starts over. `Escape` cancels the armed state.
`Tab` / `Shift+Tab`, arrow keys and WASD move focus; `Enter` / `Space` or gamepad A/Start activate;
gamepad B/Select moves back. Clicking or pressing any start control is the first user gesture and
unlocks audio. Merely viewing the title writes nothing: the first boot save is written when a run
actually begins.

A non-modal **First steps** strip appears after a fresh start, naming the live keyboard bindings for
movement, jump, strike, guard, rest/use and pause. It auto-hides after 16 seconds, stays while focused, and has
a **Dismiss first steps** button. It never traps focus or pauses the game.

## Keyboard (defaults)

| Action          | Primary        | Alternate |
| --------------- | -------------- | --------- |
| left            | ArrowLeft / A  |           |
| right           | ArrowRight / D |           |
| up              | ArrowUp / W    |           |
| down            | ArrowDown / S  |           |
| jump            | Z / Space      |           |
| attack          | X / J          |           |
| guard           | F (hold)       |           |
| dash            | C / K          |           |
| heal            | L (hold)       |           |
| cast (Hookline) | I              |           |
| interact        | E              | ArrowUp   |
| map             | M              |           |
| pause           | Escape         |           |

Note: the design doc's original list put heal on A and cast on S, which collide with A/S for
movement; the collision is resolved here by moving heal to L and cast to I. The key list was
validated in M2 with no changes; any future change is logged in DECISIONS.md.

## Focus, healing and the Wall Claw

Nail hits gather Focus (11 per hit, 17 with **Ember Greed**). A full heal costs 33 Focus: hold `heal`
while grounded and hurt for 54 ticks to restore one mask (`quickMend` reduces the hold to 36 ticks).
Releasing the button, leaving the ground or taking a hit cancels the channel; **Sturdy Shell** absorbs
one interrupting hit and grants a brief invulnerability window instead. Focus carries between rooms and
refills at a bench or respawn; reloading starts it empty because it is a moment-to-moment resource, not
a durable save fact.

The **Wall Claw** is found in the Sunless Aqueduct. While airborne, move against a vertical wall to
cling and slide; press `jump` to kick away. The Wall-Claw Shaft off the Bellows is the ability gate — it
is ordinary geometry, not a lift, so the jump timing is the same in every run.

## The Hookline and Longline

The **Hookline** is a coil of bell wire found on the high span of the Sunless Aqueduct. Press `cast`
(I, gamepad RB, or the touch **Hook** button) to throw it at a brass ring. The line targets the best ring
ahead within 176 px: rings within 24 px, more than 44 px below the hand, behind the hero by more than
20 px, or without line of sight are ignored. One-way ledges do not block the line; masonry does. A ring
ahead is preferred by 14 px of score and a ring below costs 30 px, so the reticle normally chooses the
route the hero is facing.

The pull travels at 420 px/s and settles with the feet 28 px below the ring. The grip lasts 18 ticks,
then the hero drops and a 12-tick cooldown starts. While hanging, `jump` kicks away at 210 px/s
horizontally and 500 px/s upward, `down` drops through a platform below, and pressing `cast` again
retargets another ring in range. Striking a wall mid-pull cancels the line instead of carrying the hero
through it.

**Longline**, found on the upper shelf of the Wall-Claw Shaft, raises the hand-to-ring reach from 176 to
220 px. Thirty-five rings are authored across the terrace, Drowned Gallery, Ossuary, Sunless Aqueduct,
Bellows, Upper Gallery, Reliquary and the three boss arenas; the Wall-Claw Shaft, Bell Nave and belfry
antechamber have none. The Hookline and Longline are derived from their pickup ids, so ability
ownership needs no extra save field or version bump.

## Guard, parry, posture and KNELL

Hold `guard` (F, gamepad LT/RT, or the touch **Guard** button) while grounded to brace. Guarding slows
movement to 34% and cannot start in the air, during a dash, or while another action owns the hero. The
first 5 ticks of each fresh guard are a **perfect parry**: the hit costs no posture, adds 18 posture to
the attacker, and opens a 45-tick **Hook Counter** in which the next swing deals +2 damage and +10
posture. After those 5 ticks the same guard still blocks, at 22 posture per hit. Releasing locks the
guard for 6 ticks; tapping it repeatedly inside a 45-tick window shortens the deflect ladder from 10 to
7, 5 and 3 ticks so mashing is not a free defence. Posture regenerates after 45 quiet ticks.

At zero posture the guard **shatters** through the normal hurt path: one mask, lost control, and no guard
for 60 ticks. Every enemy swing lands at most one block or parry, even though its hitbox stays active for
several ticks. **Red** attacks are unblockable and cannot be parried; the enemy telegraph turns blood-red
and the boss gains a red ring during the wind-up. Move instead.

Enemy posture fills from guarded hits, parries and ordinary swings. When it breaks, the enemy is open
for 70 ticks and the next hit is a **KNELL**: 3× damage, heavier hit-stop and a stronger shake. Lesser
foes usually die to it; bosses lose a real chunk. A broken enemy's posture bar turns blood-red.

## Utility keys (outside the action map)

| Key | Effect                                                   |
| --- | -------------------------------------------------------- |
| F1  | Toggle the diagnostics overlay (development builds only) |
| B   | Mute / unmute all audio (persisted across reloads)       |

These are handled in `Game` or the title card, never reach `InputManager`, and therefore cannot be
rebound. `F1` applies while playing; the title, pause, bench and ending dialogs own the keyboard.
`B` works while playing and on the title card; while a pause, bench or ending dialog is open it owns the
keyboard, so use **Sound → Silence all** (or close the dialog) instead. Audio starts on the first key
press or pointer press, including the title's start gesture, as browser autoplay policy requires.

## Pause menu and binding editor

While playing, the `pause` action opens the menu (default Escape / Start). Opening freezes the
simulation and clears held input; rendering and music continue. The pause, sound and controls
screens are a focused modal: `Tab` / `Shift+Tab` wrap inside it, and the game canvas is inert until
it closes.

| Context              | Keyboard                              | Gamepad (standard)      |
| -------------------- | ------------------------------------- | ----------------------- |
| Move focus           | Arrow keys or WASD                    | Left stick / D-pad      |
| Activate             | Enter / Space                         | A                       |
| Adjust a volume      | Left/Right, Home/End, PageUp/PageDown | Left stick / D-pad      |
| Cancel a capture     | Escape                                | Select                  |
| Back one screen      | Escape                                | B / Select              |
| Close the map        | Escape or the live `map` key          | B / Select              |
| Close the menu       | Escape from Pause                     | Start (outside capture) |
| Leave the focus trap | Tab / Shift+Tab                       | —                       |

**Accessibility.** **Settings → Camera shake** toggles the camera's impact kicks without changing
combat timing, hit-stop or damage. It defaults to the inverse of the operating system's
`prefers-reduced-motion` preference and persists separately as `bellward.accessibility.v1`; changing
it applies immediately to the mounted room, and the next room inherits it. The menu switch reads
**On** or **Off** and survives reloads.

**Remapping.** Select a binding cell and press Enter/Space/A (pointer click also starts capture),
then press the new key or gamepad button. Each action exposes two keyboard slots and its pad-button
slots; analog stick axes are fixed. A key or button already owned by another slot or
action is rejected with a status naming the conflict, and the old binding is kept. **Reset defaults**
is deliberately two presses: the first arms it, the second restores every shipped binding; navigating
away or starting a capture disarms it. Bindings persist as `bellward.bindings.v1`; a valid v1 record is
migrated by adding the guard defaults, while a corrupt, partial or future-versioned record is discarded
whole and defaults are used.

**Reserved inputs.** Escape, Tab, F1, bare modifiers, and pad Select/Start/D-pad (buttons 8, 9,
12–15) cannot be newly captured, so a player can always navigate back. The shipped defaults still
use some of them (Escape = pause, Start = pause, D-pad = movement/interact) and reset restores
those. New captures cannot introduce a cross-action duplicate; the pre-existing default pair
`ArrowUp` for both `up` and `interact` is grandfathered. The `pause` action can be remapped for
gameplay, but the menu's own keys above stay fixed.

## Benches, saves and the region map

**Resting.** Walk within a bench's range and the screen prompt names it; press `interact` (E, or
ArrowUp by default). Resting fully restores every mask and Focus, rebuilds the room clean, sets that
bench as the respawn checkpoint, writes the run and shows a `RESTED` banner. **The Weeping Stone**,
**The Bell-Keeper's Rest** and **The Tide-Watch** stand in the terrace, nave and upper gallery; the nave
bench sits west of the Bellbearer door, so it is reachable from the terrace spawn and every arena return
without crossing a fight.

**Bench equipment.** A rest opens a focused equipment dialog. It freezes the simulation while open,
traps `Tab`, and closes with `Escape`, the **Leave the bench** button or the gamepad Back/pause button.
The charm belt has three notches and all five charms cost one; found charms auto-equip while a notch is
free, and selecting a charm there equips or sets it aside. The Nail Forge sells two levels for 30 then
60 shards; each adds +1 nail damage and +4 px reach. Arrow keys/D-pad move focus, Enter/A activates and
Escape/B leaves. Every change is written immediately and applies to the live hero.

**Ordeals.** After a boss's first normal clear, its arena altar can be relit with `interact`. The Ordeal
is the same boss with 1.35× health and wind-up/recovery shortened to 0.85×; the first clear pays 40
shards and cannot be repeated. Ordeals are optional and do not replace the normal sigil reward.

**Persistence.** A new run saves when it leaves the title; a restored run already has its document and
is not rewritten just by starting. Thereafter a run saves on each room entry, each rest, each equipment
change, each first boss or Ordeal clear, each pickup/secret and each respawn. Reloading resumes at the
last saved room entry with saved masks, sigils, charted rooms, checkpoint, pickups, secrets, charms,
nail level, shards, Ordeals and ending flag; death instead returns to the last bench (or the terrace if
none). Claimed bosses stay claimed and their arenas stay silent. The document is versioned at
`bellward.save.v1` (schema v2); a valid v1 document migrates in place, while an invalid, partial or
future-versioned record is discarded whole and a fresh run starts. Unavailable storage never interrupts
play, but progress cannot be written.

**Map.** Press `map` (M by default) or choose **Map** in the pause menu. The simulation freezes while
the DOM chart is open. It shows discovered chambers among the twelve authored rooms, current location,
claimed sigils and the last rest; routes come from the authored room exits, and unknown rooms keep their
names hidden. `Escape` or the current map key closes it; **Back** returns straight to the run. The map key
is rebindable, and the close hint follows the live binding. Gamepad Back opens it.

**The Tide door.** The Bell Thief leaves the Tide-Bell in its claimed arena. Carrying it opens the sealed
door in the Upper Gallery; crossing the threshold shows **The Bell Remembers** once. `Escape`, `Enter` or
**Return to the belfry** closes the card and returns to the world, where optional pickups and Ordeals
remain available. The ending stays complete across reloads and cannot retrigger.

## Gamepad (standard mapping)

Left stick / D-pad = move; A = jump; X = attack; B = dash; Y = heal (hold); LT/RT = guard (hold); RB = Hookline
(cast); D-pad up = interact; Start = pause; Back = map. On the title card, stick/D-pad moves focus, A or
Start activates and B/Select moves back. While the menu is open, stick/D-pad navigates, A confirms, B/Select
goes back and Start closes. Axes use a 0.4 deadzone and are combined with the D-pad. Implemented against
the standard mapping and unit-tested with an injected pad; not yet verified on physical hardware.

## Touch overlay

On touch devices the game mounts a landscape-first on-screen control set; mouse/keyboard desktops never
see it. The left thumb gets **left**, **down** and **right**; the right thumb gets **Focus** (hold to
heal), **Rest** (interact), **Dash**, **Guard** (hold), **Hook** (once owned), **Strike** and **Jump**.
**Pause** sits at the top-right and opens the same accessible pause dialog as `Escape`. Movement +
attack/jump are multi-touch: each button owns its own pointer, and holding **down** while tapping
**Jump** drops through a one-way platform. **Hook** is hidden until the Hookline is found; when it
appears it spans both action rows as a tall lever rather than squeezing a fourth small target into the
pad.

Buttons feed `InputManager.setVirtual`, so the 60 Hz simulation receives the same held/pressed/released
snapshot contract as keyboard and gamepad input. Buttons release on pointer-up/cancel, window blur,
visibility loss and whenever a menu, bench, ending card or the title takes over; no virtual action can
stick across a pause. The title and first-run strip show touch wording instead of keyboard keycaps on
these devices. The canvas scales to the available viewport (fractional scale on touch, whole-pixel scale
on desktop), and safe-area insets keep the controls clear of notches and home indicators.

Touch input is covered by the Playwright touch context and the `InputManager` unit suite; physical
phone/tablet testing is still outstanding. **Hook** joins the action pad only after the Hookline is
owned; the map remains reachable from the pause menu.
