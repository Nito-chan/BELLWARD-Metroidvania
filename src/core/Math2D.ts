import { BellwardError } from './Errors';
import type { Rect } from './Types';

/** Clamps `value` into [min, max]. Throws if the range itself is inverted. */
export function clamp(value: number, min: number, max: number): number {
  if (min > max) {
    throw new BellwardError(`clamp range inverted: min=${min} > max=${max}`);
  }
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

/** Linear interpolation. `t` is not clamped; callers clamp when they need to. */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Moves `value` toward `target` by at most `maxDelta`. Never overshoots. */
export function approach(value: number, target: number, maxDelta: number): number {
  // Written as !(x >= 0) so NaN is rejected too.
  if (!(maxDelta >= 0)) {
    throw new BellwardError(`approach maxDelta must be >= 0, got ${maxDelta}`);
  }
  const delta = target - value;
  if (Math.abs(delta) <= maxDelta) return target;
  return value + Math.sign(delta) * maxDelta;
}

/** Axis-aligned overlap test. Edge-touching rectangles do NOT overlap. */
export function overlap(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}
