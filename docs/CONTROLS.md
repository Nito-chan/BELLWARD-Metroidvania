# Controls

Status: **implemented (M2; utility keys M3; menus and binding editor M5)**. These are the live
defaults, sourced from `src/config/input.ts` and round-tripped by the binding editor; this table is
the contract that editor edits. Keyboard events are matched on `KeyboardEvent.code` (physical key),
so layouts like AZERTY still use the same physical positions.

## Keyboard (defaults)

| Action   | Primary        | Alternate |
| -------- | -------------- | --------- |
| left     | ArrowLeft / A  |           |
| right    | ArrowRight / D |           |
| up       | ArrowUp / W    |           |
| down     | ArrowDown / S  |           |
| jump     | Z / Space      |           |
| attack   | X / J          |           |
| dash     | C / K          |           |
| heal     | L (hold)       |           |
| cast     | I              |           |
| interact | E              | ArrowUp   |
| map      | M              |           |
| pause    | Escape         |           |

Note: the design doc's original list put heal on A and cast on S, which collide with A/S for
movement; the collision is resolved here by moving heal to L and cast to I. The key list was
validated in M2 with no changes; any future change is logged in DECISIONS.md.

## Utility keys (outside the action map)

| Key | Effect                                                   |
| --- | -------------------------------------------------------- |
| F1  | Toggle the diagnostics overlay (development builds only) |
| B   | Mute / unmute all audio (persisted across reloads)       |

These are handled in `Game`, never reach `InputManager`, and therefore cannot be rebound. They apply
while playing; while the pause dialog is open it owns the keyboard, so use **Sound → Silence all**
instead. Audio starts on the first key press or pointer press, as browser autoplay policy requires;
there is no separate click-to-start screen.

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
| Close the menu       | Escape from Pause                     | Start (outside capture) |
| Leave the focus trap | Tab / Shift+Tab                       | —                       |

**Remapping.** Select a binding cell and press Enter/Space/A (pointer click also starts capture),
then press the new key or gamepad button. Each action exposes two keyboard slots and its primary
pad-button slot; analog stick axes are fixed. A key or button already owned by another slot or
action is rejected with a status naming the conflict, and the old binding is kept. **Reset defaults**
is deliberately two presses: the first arms it, the second restores every shipped binding; navigating
away or starting a capture disarms it. Bindings persist as `bellward.bindings.v1`; a corrupt, partial
or future-versioned record is discarded whole and defaults are used.

**Reserved inputs.** Escape, Tab, F1, bare modifiers, and pad Select/Start/D-pad (buttons 8, 9,
12–15) cannot be newly captured, so a player can always navigate back. The shipped defaults still
use some of them (Escape = pause, Start = pause, D-pad = movement/interact) and reset restores
those. New captures cannot introduce a cross-action duplicate; the pre-existing default pair
`ArrowUp` for both `up` and `interact` is grandfathered. The `pause` action can be remapped for
gameplay, but the menu's own keys above stay fixed.

## Gamepad (standard mapping)

Left stick / D-pad = move; A = jump; X = attack; B = dash; Y = heal (hold); RB = cast;
D-pad up = interact; Start = pause; Back = map. While the menu is open, stick/D-pad navigates,
A confirms, B/Select goes back and Start closes. Axes use a 0.4 deadzone and are combined with the
D-pad. Implemented against the standard mapping and unit-tested with an injected pad; not yet
verified on physical hardware.

## Touch overlay

Not in the vertical slice scope until M10 (mobile pass). Landscape-first layout.
