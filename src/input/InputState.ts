import type { ActionName } from '../config/input';

/**
 * One tick of input, as the simulation sees it. Held state persists across ticks;
 * pressed/released are edges delivered exactly once, so buffered actions (jump, attack)
 * can never be missed between ticks and never double-fire within one.
 */
export type InputSnapshot = {
  readonly held: ReadonlySet<ActionName>;
  readonly pressed: ReadonlySet<ActionName>;
  readonly released: ReadonlySet<ActionName>;
};

export function isHeld(input: InputSnapshot, action: ActionName): boolean {
  return input.held.has(action);
}

export function isPressed(input: InputSnapshot, action: ActionName): boolean {
  return input.pressed.has(action);
}

export function isReleased(input: InputSnapshot, action: ActionName): boolean {
  return input.released.has(action);
}
