/**
 * Input configuration: actions, keyboard bindings and gamepad mapping.
 *
 * `docs/CONTROLS.md` is the human-readable contract; this file is the machine-readable
 * source of truth and the data the binding editor (M5) will round-trip through
 * `InputManager.serialize()`. Keyboard keys are `KeyboardEvent.code` values, so bindings
 * are layout-independent: a QWERTZ player gets the key their keyboard labels Z.
 */

/** Every action the game can bind. Mirrors docs/CONTROLS.md. */
export const ACTIONS = [
  'left',
  'right',
  'up',
  'down',
  'jump',
  'attack',
  'guard',
  'dash',
  'heal',
  'cast',
  'interact',
  'weapon',
  'map',
  'pause',
] as const;

export type ActionName = (typeof ACTIONS)[number];

export const INPUT = {
  /** Analog stick magnitude below this counts as centered (0..1). */
  stickDeadzone: 0.4,
  /** Standard-mapping gamepad polled each tick; the first connected pad wins. */
  gamepadIndex: 0,
  /** Version of the serialized binding document (the M5 binding editor reads this). */
  bindingFormatVersion: 3,
  /** localStorage key for the persisted binding document. Reads/writes are try/catch. */
  storageKey: 'bellward.bindings.v1',
} as const;

/** Keyboard bindings per action, primary first. Rebinding is a data change only. */
export const KEY_BINDINGS: Readonly<Record<ActionName, readonly string[]>> = {
  left: ['ArrowLeft', 'KeyA'],
  right: ['ArrowRight', 'KeyD'],
  up: ['ArrowUp', 'KeyW'],
  down: ['ArrowDown', 'KeyS'],
  jump: ['KeyZ', 'Space'],
  attack: ['KeyX', 'KeyJ'],
  guard: ['KeyF'],
  dash: ['KeyC', 'KeyK'],
  heal: ['KeyL'],
  cast: ['KeyI'],
  weapon: ['KeyQ'],
  interact: ['KeyE', 'ArrowUp'],
  map: ['KeyM'],
  pause: ['Escape'],
};

/** Gamepad buttons per action (indices into `Gamepad.buttons`). */
export const PAD_BUTTONS: Readonly<Partial<Record<ActionName, readonly number[]>>> = {
  jump: [0], // A / cross
  attack: [2], // X / square
  guard: [6, 7], // LT / L2, RT / R2
  dash: [1], // B / circle
  heal: [3], // Y / triangle
  cast: [5], // RB / R1
  weapon: [4], // LB / L1
  interact: [12], // D-pad up
  map: [8], // Back / select
  pause: [9], // Start
  left: [14], // D-pad left
  right: [15], // D-pad right
  down: [13], // D-pad down
};

/** Analog stick readings per action (axis index plus which side is "pressed"). */
export const PAD_AXES: Readonly<
  Partial<Record<ActionName, { readonly axis: number; readonly dir: -1 | 1 }>>
> = {
  left: { axis: 0, dir: -1 },
  right: { axis: 0, dir: 1 },
  down: { axis: 1, dir: 1 },
};
