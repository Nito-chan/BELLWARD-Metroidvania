# Controls

Status: **implemented (M2)**. These are the live defaults, sourced from `src/config/input.ts` and
round-tripped by `InputManager.serialize()`; this table is the contract the binding editor (M5+)
will edit. Keyboard events are matched on `KeyboardEvent.code` (physical key), so layouts like
AZERTY still use the same physical positions.

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

## Gamepad (standard mapping)

Left stick / D-pad = move; A = jump; X = attack; B = dash; Y = heal (hold); RB = cast;
D-pad up = interact; Start = pause; Back = map. Axes use a 0.4 deadzone and are combined with the
D-pad. Implemented against the standard mapping and unit-tested with an injected pad; not yet
verified on physical hardware.

## Touch overlay

Not in the vertical slice scope until M10 (mobile pass). Landscape-first layout.
