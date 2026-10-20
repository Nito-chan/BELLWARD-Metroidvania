import { ENEMIES, type EnemyKind } from '../config/enemies';
import type { PaletteName } from '../config/palette';
import { RENDER } from '../config/render';
import { BellwardError } from '../core/Errors';
import type { Rect, Vec2 } from '../core/Types';
import { Tilemap } from './Tilemap';
import type { TileRole } from './tiles';

/** Art keys for background layers, far to near. Resolved by the active art provider. */
export type BackgroundKey = 'far' | 'mid' | 'near';

/** Art keys for props. Resolved by the active art provider. */
export type PropKey = 'balustrade' | 'column' | 'bell';

/** Depth band for a prop: behind the hero, or in front of the hero. */
export type PropLayerName = 'back' | 'front';

export type RoomProp = {
  /** Logical art key; the renderer picks packed art or its procedural equivalent. */
  art: PropKey;
  /** World position of the prop's bottom-center anchor, in pixels. */
  x: number;
  y: number;
  /** `back` props sit behind actors; `front` props occlude them. */
  layer: PropLayerName;
};

export type RoomSpawn = {
  /** Feet position (bottom-center of the hero), in world pixels. */
  x: number;
  y: number;
};

/**
 * One enemy placed in a room. `x`/`y` is the feet-center, so level data reads like the
 * hero spawn. `patrol` is an optional horizontal beat, in world pixels.
 */
export type EnemySpawn = {
  kind: EnemyKind;
  x: number;
  y: number;
  /** Initial facing; defaults to right. */
  facing?: -1 | 1;
  patrol?: { min: number; max: number };
};

export type RoomDefinition = {
  id: string;
  name: string;
  /** ASCII layout, one character per tile. Rows must all be the same length. */
  rows: readonly string[];
  /** Maps every non-space glyph to a semantic tile role. */
  legend: Readonly<Record<string, TileRole>>;
  /** Parallax layers to build behind the room, far to near. */
  backgrounds: readonly BackgroundKey[];
  /** Colour wash applied above the world container. Alpha 0 disables it. */
  ambient: { tint: PaletteName; alpha: number };
  props: readonly RoomProp[];
  spawn: RoomSpawn;
  /** Enemies to spawn when the room is (re)entered. */
  enemies: readonly EnemySpawn[];
};

export type Room = {
  definition: RoomDefinition;
  tilemap: Tilemap;
  /** Camera bounds and collision bounds, in world pixels. */
  bounds: Rect;
  spawn: Vec2;
};

/** Builds a room from its definition, validating the layout and spawn placement. */
export function createRoom(definition: RoomDefinition): Room {
  const tilemap = Tilemap.fromRows(definition.rows, definition.legend);

  const { x, y } = definition.spawn;
  const insideX = x >= 0 && x < tilemap.pixelWidth;
  const insideY = y >= 0 && y <= tilemap.pixelHeight;
  if (!insideX || !insideY) {
    throw new BellwardError(
      `room "${definition.id}" spawn (${x},${y}) is outside ${tilemap.pixelWidth}x${tilemap.pixelHeight}`,
    );
  }
  if (!(definition.ambient.alpha >= 0 && definition.ambient.alpha <= 1)) {
    throw new BellwardError(
      `room "${definition.id}" ambient alpha must be within 0..1, got ${definition.ambient.alpha}`,
    );
  }

  validateEnemies(definition, tilemap);

  return {
    definition,
    tilemap,
    bounds: { x: 0, y: 0, w: tilemap.pixelWidth, h: tilemap.pixelHeight },
    spawn: { x, y },
  };
}

/**
 * Fails loudly on bad level data: an enemy must stand on solid ground with room for its
 * body, a valid patrol beat, and a known kind. A typo can never ship as an invisible
 * floating enemy or a phantom spawn.
 */
function validateEnemies(definition: RoomDefinition, tilemap: Tilemap): void {
  const tile = RENDER.tileSize;
  definition.enemies.forEach((spawn, index) => {
    const label = `room "${definition.id}" enemy ${index} (${String(spawn.kind)})`;
    const stats = ENEMIES[spawn.kind];
    if (!stats) {
      throw new BellwardError(`${label}: unknown enemy kind`);
    }
    if (!Number.isFinite(spawn.x) || !Number.isFinite(spawn.y)) {
      throw new BellwardError(`${label}: spawn position must be finite`);
    }
    if (spawn.x < 0 || spawn.x >= tilemap.pixelWidth) {
      throw new BellwardError(`${label}: x=${spawn.x} is outside the room`);
    }
    if (spawn.y <= 0 || spawn.y > tilemap.pixelHeight) {
      throw new BellwardError(`${label}: y=${spawn.y} is outside the room`);
    }
    if (spawn.facing !== undefined && spawn.facing !== -1 && spawn.facing !== 1) {
      throw new BellwardError(`${label}: facing must be -1 or 1`);
    }

    const footTx = Math.floor(spawn.x / tile);
    const groundTy = Math.floor(spawn.y / tile);
    if (!tilemap.isSolid(footTx, groundTy)) {
      throw new BellwardError(`${label}: feet (${spawn.x},${spawn.y}) are not on solid ground`);
    }

    // Every cell the body occupies must be free of walls (one-way platforms are fine:
    // a body can stand on them and pass upward through them).
    const leftTx = Math.floor((spawn.x - stats.body.w / 2) / tile);
    const rightTx = Math.floor((spawn.x + stats.body.w / 2 - 0.001) / tile);
    const topTy = Math.floor((spawn.y - stats.body.h + 0.001) / tile);
    for (let ty = topTy; ty < groundTy; ty += 1) {
      for (let tx = leftTx; tx <= rightTx; tx += 1) {
        if (tilemap.isWall(tx, ty)) {
          throw new BellwardError(`${label}: body overlaps wall tile (${tx},${ty})`);
        }
      }
    }

    if (spawn.patrol) {
      const { min, max } = spawn.patrol;
      if (!(min < max)) {
        throw new BellwardError(`${label}: patrol min ${min} must be less than max ${max}`);
      }
      if (min < 0 || max > tilemap.pixelWidth) {
        throw new BellwardError(`${label}: patrol ${min}..${max} leaves the room`);
      }
      if (spawn.x < min || spawn.x > max) {
        throw new BellwardError(`${label}: spawn x=${spawn.x} is outside patrol ${min}..${max}`);
      }
    }
  });
}
