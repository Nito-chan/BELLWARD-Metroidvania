import type { AttackBoxDef } from '../config/enemies';
import type { Rect } from '../core/Types';
import type { Body } from '../physics/Body';

/** Shared AABB helpers. Pure functions so combat math is trivially testable. */

/** The body's world-space rectangle. */
export function bodyRect(body: Body): Rect {
  return { x: body.x, y: body.y, w: body.w, h: body.h };
}

/** Strict AABB overlap: edges that merely touch are not a hit. */
export function overlaps(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

/**
 * A forward-facing attack box anchored at the owner's feet-center. The box starts
 * `forward` pixels in front of the feet, so a swing never hits something standing
 * behind the attacker.
 */
export function forwardBox(feetX: number, feetY: number, facing: -1 | 1, def: AttackBoxDef): Rect {
  const x = facing === 1 ? feetX + def.forward : feetX - def.forward - def.width;
  return { x, y: feetY - def.top, w: def.width, h: def.height };
}

/** Circle vs AABB overlap, used for projectiles (a point with radius). */
export function circleOverlapsRect(cx: number, cy: number, radius: number, rect: Rect): boolean {
  const closestX = Math.max(rect.x, Math.min(cx, rect.x + rect.w));
  const closestY = Math.max(rect.y, Math.min(cy, rect.y + rect.h));
  const dx = cx - closestX;
  const dy = cy - closestY;
  return dx * dx + dy * dy <= radius * radius;
}
