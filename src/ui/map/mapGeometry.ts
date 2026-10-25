/**
 * Turns a room's real ASCII tilemap into a drawn plan. Nothing here is hand-authored:
 * walls, floors, ledges, cracked seams and the Tide door all come from the same rows the
 * physics uses, so the chart cannot drift away from the room.
 */
import { MAP } from '../../config/map';
import { BellwardError } from '../../core/Errors';
import type { RoomDefinition } from '../../world/Room';
import { roleIsOneWay, type TileRole } from '../../world/tiles';
import type { MapRect, MapRoomGeometry, MapSegment } from './mapTypes';

export type MapGeometryOptions = {
  /** A shattered secret seam is no longer drawn as masonry. */
  readonly secretBroken: boolean;
  /** The Tide door has been opened and reads as a threshold, not a seal. */
  readonly sealOpen: boolean;
};

type Mask = Uint8Array;

export function buildRoomGeometry(
  definition: RoomDefinition,
  options: MapGeometryOptions,
): MapRoomGeometry {
  const height = definition.rows.length;
  const width = definition.rows[0]?.length ?? 0;
  if (width === 0 || height === 0) {
    throw new BellwardError(`room "${definition.id}" has no rows to chart`);
  }

  const solids = mask(width, height);
  const ledges = mask(width, height);
  const breakables = mask(width, height);
  const sealed = mask(width, height);
  const structure = mask(width, height);

  for (let y = 0; y < height; y += 1) {
    const row = definition.rows[y] ?? '';
    if (row.length !== width) {
      throw new BellwardError(`room "${definition.id}" row ${y} is not rectangular`);
    }
    for (let x = 0; x < width; x += 1) {
      const glyph = row[x] ?? ' ';
      if (glyph === ' ') continue;
      const role = definition.legend[glyph];
      if (!role) {
        throw new BellwardError(
          `room "${definition.id}" glyph "${glyph}" is missing from its map legend`,
        );
      }
      markRole(role, options, x, y, width, {
        solids,
        ledges,
        breakables,
        sealed,
        structure,
      });
    }
  }

  return {
    solid: mergeMask(solids, width, height),
    ledges: mergeMask(ledges, width, height),
    breakables: mergeMask(breakables, width, height),
    sealed: mergeMask(sealed, width, height),
    surfaces: mergeSurfaces(structure, width, height),
  };
}

type RoleMasks = {
  readonly solids: Mask;
  readonly ledges: Mask;
  readonly breakables: Mask;
  readonly sealed: Mask;
  readonly structure: Mask;
};

function markRole(
  role: TileRole,
  options: MapGeometryOptions,
  x: number,
  y: number,
  width: number,
  masks: RoleMasks,
): void {
  const index = y * width + x;
  if (role === 'breakable') {
    if (options.secretBroken) return;
    masks.breakables[index] = 1;
    masks.structure[index] = 1;
    return;
  }
  if (role === 'sealedDoor') {
    if (options.sealOpen) return;
    masks.sealed[index] = 1;
    masks.structure[index] = 1;
    return;
  }
  if (roleIsOneWay(role)) {
    masks.ledges[index] = 1;
    masks.structure[index] = 1;
    return;
  }
  if (role === 'wall' || role === 'wallTrim' || role === 'pillar') {
    masks.solids[index] = 1;
    masks.structure[index] = 1;
    return;
  }
  if (role === 'floor' || role === 'floorFill') {
    masks.solids[index] = 1;
    masks.structure[index] = 1;
    return;
  }
  // Decorative roles never become plan geometry.
}

function mask(width: number, height: number): Mask {
  return new Uint8Array(width * height);
}

function has(target: Mask, x: number, y: number, width: number, height: number): boolean {
  return x >= 0 && y >= 0 && x < width && y < height && target[y * width + x] === 1;
}

function mergeMask(source: Mask, width: number, height: number): MapRect[] {
  const remaining = source.slice();
  const rects: MapRect[] = [];
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (!has(remaining, x, y, width, height)) continue;
      let x2 = x;
      while (has(remaining, x2 + 1, y, width, height)) x2 += 1;
      let y2 = y;
      expandDown: while (y2 + 1 < height) {
        for (let cx = x; cx <= x2; cx += 1) {
          if (!has(remaining, cx, y2 + 1, width, height)) break expandDown;
        }
        y2 += 1;
      }
      for (let cy = y; cy <= y2; cy += 1) {
        for (let cx = x; cx <= x2; cx += 1) remaining[cy * width + cx] = 0;
      }
      rects.push({
        x: x * MAP.tileSize,
        y: y * MAP.tileSize,
        w: (x2 - x + 1) * MAP.tileSize,
        h: (y2 - y + 1) * MAP.tileSize,
      });
    }
  }
  return rects;
}

/** Top edges of masonry and ledges, merged into continuous lit runs. */
function mergeSurfaces(source: Mask, width: number, height: number): MapSegment[] {
  const segments: MapSegment[] = [];
  for (let y = 0; y < height; y += 1) {
    let start: number | null = null;
    for (let x = 0; x <= width; x += 1) {
      const exposed =
        x < width && has(source, x, y, width, height) && !has(source, x, y - 1, width, height);
      if (exposed && start === null) start = x;
      if (!exposed && start !== null) {
        segments.push({
          x1: start * MAP.tileSize,
          y1: y * MAP.tileSize,
          x2: x * MAP.tileSize,
          y2: y * MAP.tileSize,
        });
        start = null;
      }
    }
  }
  return segments;
}
