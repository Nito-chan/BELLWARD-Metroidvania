# Controls (planned)

Status: **planned defaults** — implemented by the InputManager in M2. This table is the contract
the binding editor (M5+) and docs will follow; the live values ship through
`InputManager.serialize()`.

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
movement; the collision is resolved here by moving heal to L and cast to I. Final key list is
validated for feel in M2 — any change is logged in DECISIONS.md.

## Gamepad (standard mapping)

Left stick / D-pad = move; A = jump; X = attack; B = dash; Y = heal (hold); RB = cast;
D-pad up = interact; Start = pause; Back = map.

## Touch overlay

Not in the vertical slice scope until M10 (mobile pass). Landscape-first layout.
