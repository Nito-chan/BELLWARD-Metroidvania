import { clamp } from '../core/Math2D';
import type { Rect } from '../core/Types';

const TELEPORT_BEHIND = 42;
const DIVE_OFFSET = 24;
const ARENA_EDGE = 32;
const DEFAULT_ARENA_WIDTH = 960;

/** Body x for a teleport that lands behind the player, clamped inside the arena. */
export function teleportBehindX(
  arena: Rect | undefined,
  bossFeetX: number,
  playerX: number,
  bodyWidth: number,
): number {
  const side = bossFeetX <= playerX ? 1 : -1;
  return clampToArena(arena, playerX + side * TELEPORT_BEHIND, bodyWidth);
}

/** Body x for a dive that lands beside the player, clamped inside the arena. */
export function diveLandingX(
  arena: Rect | undefined,
  playerX: number,
  facing: -1 | 1,
  bodyWidth: number,
): number {
  return clampToArena(arena, playerX - facing * DIVE_OFFSET, bodyWidth);
}

function clampToArena(arena: Rect | undefined, target: number, bodyWidth: number): number {
  const min = (arena?.x ?? 0) + ARENA_EDGE;
  const max = (arena?.x ?? 0) + (arena?.w ?? DEFAULT_ARENA_WIDTH) - ARENA_EDGE;
  return clamp(target, min, max) - bodyWidth / 2;
}
