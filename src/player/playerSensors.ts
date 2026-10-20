import { RENDER } from '../config/render';
import { isHeld, type InputSnapshot } from '../input/InputState';
import type { Body } from '../physics/Body';
import type { Tilemap } from '../world/Tilemap';

const EPSILON = 0.001;

/** -1, 0 or 1: the horizontal direction the player is asking for. */
export function inputDirection(input: InputSnapshot): -1 | 0 | 1 {
  const left = isHeld(input, 'left');
  const right = isHeld(input, 'right');
  if (left === right) return 0;
  return right ? 1 : -1;
}

/** True when a one-way platform sits directly under the body's feet. */
export function standingOnOneWay(body: Body, tilemap: Tilemap): boolean {
  const tile = RENDER.tileSize;
  const row = Math.floor((body.y + body.h + 0.5) / tile);
  const left = Math.floor(body.x / tile);
  const right = Math.floor((body.x + body.w - EPSILON) / tile);
  for (let tx = left; tx <= right; tx += 1) {
    if (tilemap.isOneWay(tx, row)) return true;
  }
  return false;
}
