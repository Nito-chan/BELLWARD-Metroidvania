/**
 * Pure geometry shared by the room validator, the Hookline simulation and the level
 * checker. Keeping it here means a ring can never be authored where the hero would hang
 * inside masonry, and the line-of-sight rule used to target a ring is the same rule the
 * tests prove.
 */
import { HOOK } from '../config/hookline';
import { PLAYER } from '../config/player';
import { RENDER } from '../config/render';
import type { Vec2 } from '../core/Types';
import type { Tilemap } from './Tilemap';

/** A grapple ring authored in world space. `x`/`y` is the ring centre. */
export type HookAnchorPoint = {
  readonly x: number;
  readonly y: number;
};

/** Feet position while hanging from `anchor`. */
export function hangFeet(anchor: HookAnchorPoint): Vec2 {
  return { x: anchor.x, y: anchor.y + HOOK.hangOffsetY };
}

/** Hand position used as the range origin, from a feet position. */
export function handPoint(feet: Vec2): Vec2 {
  return { x: feet.x, y: feet.y - HOOK.handOffsetY };
}

/**
 * True when the hero's whole body fits at the hang position and that position is inside
 * the room. One-way ledges count as solid here: a hang should never leave the sprite
 * embedded in a platform it could otherwise drop through.
 */
export function canHangAt(tilemap: Tilemap, anchor: HookAnchorPoint): boolean {
  const tile = RENDER.tileSize;
  const feet = hangFeet(anchor);
  const left = feet.x - PLAYER.size.w / 2;
  const top = feet.y - PLAYER.size.h;
  if (left < 0 || top < 0) return false;
  if (left + PLAYER.size.w > tilemap.pixelWidth) return false;
  if (feet.y > tilemap.pixelHeight) return false;

  const leftTx = Math.floor(left / tile);
  const rightTx = Math.floor((left + PLAYER.size.w - 0.001) / tile);
  const topTy = Math.floor(top / tile);
  const bottomTy = Math.floor((feet.y - 0.001) / tile);
  for (let ty = topTy; ty <= bottomTy; ty += 1) {
    for (let tx = leftTx; tx <= rightTx; tx += 1) {
      if (tilemap.isSolid(tx, ty)) return false;
    }
  }
  return true;
}

/**
 * True when the ring is visible from the hand. Walls block; one-way ledges do not,
 * because the Hookline is allowed to answer a ring through a platform the hero can jump
 * through. The endpoint is not sampled, so a ring mounted on open stone is fine.
 */
export function hasHookLineOfSight(tilemap: Tilemap, from: Vec2, to: HookAnchorPoint): boolean {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const distance = Math.hypot(dx, dy);
  if (distance === 0) return true;
  const steps = Math.ceil(distance / HOOK.sightStep);
  for (let step = 1; step < steps; step += 1) {
    const t = step / steps;
    const tx = Math.floor((from.x + dx * t) / RENDER.tileSize);
    const ty = Math.floor((from.y + dy * t) / RENDER.tileSize);
    if (!tilemap.contains(tx, ty)) return false;
    if (tilemap.isWall(tx, ty)) return false;
  }
  return true;
}
