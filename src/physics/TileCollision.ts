import { PHYSICS } from '../config/physics';
import { RENDER } from '../config/render';
import { BellwardError } from '../core/Errors';
import { clamp } from '../core/Math2D';
import type { Tilemap } from '../world/Tilemap';
import type { Body } from './Body';

export type MoveResult = {
  /** The body ran into a wall while moving horizontally. */
  hitX: boolean;
  /** The body landed on a floor or one-way platform. */
  hitGround: boolean;
  /** The body bumped its head on a ceiling. */
  hitCeiling: boolean;
};

const EPSILON = 0.001;

/**
 * Moves a body by its velocity for one tick and resolves tile collisions axis by axis
 * (X first, then Y) — the standard platformer order, which keeps horizontal pushes from
 * teleporting a body through a floor and lets a body slide along a wall while falling.
 *
 * Semantics:
 * - one-way platforms block only downward motion from above (and only while the body was
 *   above them at the start of the sub-step, so passing up through them always works);
 * - out-of-bounds cells always block, so a room's outer edge is its wall;
 * - small ceiling clips are forgiven by nudging the body sideways (corner correction).
 */
export function moveAndCollide(tilemap: Tilemap, body: Body, dt: number): MoveResult {
  if (!(dt > 0)) {
    throw new BellwardError(`moveAndCollide needs a positive dt, got ${dt}`);
  }
  if (body.dropThroughTicks > 0) body.dropThroughTicks -= 1;

  const result: MoveResult = { hitX: false, hitGround: false, hitCeiling: false };
  moveX(tilemap, body, body.vx * dt, result);
  moveY(tilemap, body, body.vy * dt, result);
  body.grounded = isOnGround(tilemap, body);
  return result;
}

/** True when the tile at (tx,ty) blocks sideways movement (one-way platforms never do). */
function blocksSideways(tilemap: Tilemap, tx: number, ty: number): boolean {
  if (!tilemap.contains(tx, ty)) return true;
  return tilemap.isWall(tx, ty);
}

/** True when the tile at (tx,ty) blocks a body moving down from `beforeBottom`. */
function blocksDown(
  tilemap: Tilemap,
  body: Body,
  tx: number,
  ty: number,
  beforeBottom: number,
): boolean {
  if (!tilemap.contains(tx, ty)) return true;
  if (!tilemap.isSolid(tx, ty)) return false;
  if (!tilemap.isOneWay(tx, ty)) return true;
  if (body.dropThroughTicks > 0) return false;
  // The body must have been above the platform when this sub-step began; otherwise it is
  // still on its way up through it and must not be caught.
  return beforeBottom <= ty * RENDER.tileSize + EPSILON;
}

function moveX(tilemap: Tilemap, body: Body, dx: number, result: MoveResult): void {
  const tile = RENDER.tileSize;
  let remaining = dx;

  while (Math.abs(remaining) > EPSILON) {
    const step = clamp(remaining, -PHYSICS.maxStep, PHYSICS.maxStep);
    const dir = step > 0 ? 1 : -1;
    const nextX = body.x + step;
    const column = Math.floor((dir > 0 ? nextX + body.w - EPSILON : nextX) / tile);
    const top = Math.floor(body.y / tile);
    const bottom = Math.floor((body.y + body.h - EPSILON) / tile);

    let blocked = false;
    for (let ty = top; ty <= bottom; ty += 1) {
      if (blocksSideways(tilemap, column, ty)) {
        blocked = true;
        break;
      }
    }

    if (blocked) {
      body.x = dir > 0 ? column * tile - body.w : (column + 1) * tile;
      body.vx = 0;
      result.hitX = true;
      return;
    }

    body.x = nextX;
    remaining -= step;
  }
}

function moveY(tilemap: Tilemap, body: Body, dy: number, result: MoveResult): void {
  const tile = RENDER.tileSize;
  let remaining = dy;

  while (Math.abs(remaining) > EPSILON) {
    const step = clamp(remaining, -PHYSICS.maxStep, PHYSICS.maxStep);
    const dir = step > 0 ? 1 : -1;
    const beforeBottom = body.y + body.h;
    const nextY = body.y + step;
    const row = Math.floor((dir > 0 ? nextY + body.h - EPSILON : nextY) / tile);
    const left = Math.floor(body.x / tile);
    const right = Math.floor((body.x + body.w - EPSILON) / tile);

    let blocked = false;
    for (let tx = left; tx <= right; tx += 1) {
      const hit =
        dir > 0
          ? blocksDown(tilemap, body, tx, row, beforeBottom)
          : blocksSideways(tilemap, tx, row);
      if (hit) {
        blocked = true;
        break;
      }
    }

    if (blocked) {
      if (dir < 0 && tryCornerCorrection(tilemap, body, nextY)) {
        // Nudged past the ceiling corner: keep rising.
        body.y = nextY;
        remaining -= step;
        continue;
      }
      body.y = dir > 0 ? row * tile - body.h : (row + 1) * tile;
      body.vy = 0;
      if (dir > 0) result.hitGround = true;
      else result.hitCeiling = true;
      return;
    }

    body.y = nextY;
    remaining -= step;
  }
}

/**
 * Ceiling forgiveness: if shifting the body sideways by up to `PHYSICS.cornerCorrection`
 * pixels clears the ceiling it just hit, take the nudge and keep rising. The preferred
 * side is the direction of travel; ties try left first, so results stay deterministic.
 */
function tryCornerCorrection(tilemap: Tilemap, body: Body, nextY: number): boolean {
  const directions = body.vx > 0 ? [1, -1] : [-1, 1];
  for (const dir of directions) {
    for (let offset = 1; offset <= PHYSICS.cornerCorrection; offset += 1) {
      if (!overlapsWall(tilemap, body.x + dir * offset, nextY, body)) {
        body.x += dir * offset;
        return true;
      }
    }
  }
  return false;
}

/** True when the body placed at (x,y) overlaps a wall or the out-of-bounds border. */
function overlapsWall(tilemap: Tilemap, x: number, y: number, body: Body): boolean {
  const tile = RENDER.tileSize;
  const left = Math.floor(x / tile);
  const right = Math.floor((x + body.w - EPSILON) / tile);
  const top = Math.floor(y / tile);
  const bottom = Math.floor((y + body.h - EPSILON) / tile);

  for (let ty = top; ty <= bottom; ty += 1) {
    for (let tx = left; tx <= right; tx += 1) {
      if (blocksSideways(tilemap, tx, ty)) return true;
    }
  }
  return false;
}

/** Ground probe tolerance: a resting contact is within this distance of a tile edge. */
const GROUND_PROBE = 0.5;

/** Ground probe: the feet must rest on the top edge of a solid (or eligible one-way) row. */
function isOnGround(tilemap: Tilemap, body: Body): boolean {
  // A rising body is never resting, even while its feet are inside a one-way platform.
  if (body.vy < 0) return false;

  const tile = RENDER.tileSize;
  const bottom = body.y + body.h;
  const row = Math.floor(bottom / tile);
  // Only contact with the row's top edge counts: feet *inside* a tile (mid-fall, or
  // mid-rise through a platform) are not grounded.
  if (bottom - row * tile > GROUND_PROBE) return false;

  const left = Math.floor(body.x / tile);
  const right = Math.floor((body.x + body.w - EPSILON) / tile);
  for (let tx = left; tx <= right; tx += 1) {
    if (!tilemap.contains(tx, row)) return true;
    if (!tilemap.isSolid(tx, row)) continue;
    if (tilemap.isOneWay(tx, row) && body.dropThroughTicks > 0) continue;
    return true;
  }
  return false;
}
