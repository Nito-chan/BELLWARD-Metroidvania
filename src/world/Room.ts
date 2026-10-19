import type { PaletteName } from '../config/palette';
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

  return {
    definition,
    tilemap,
    bounds: { x: 0, y: 0, w: tilemap.pixelWidth, h: tilemap.pixelHeight },
    spawn: { x, y },
  };
}
