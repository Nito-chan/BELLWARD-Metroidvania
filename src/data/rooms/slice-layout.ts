/** Shared builder for the seven M8 rooms. Layouts stay rectangular and validated. */
import { BellwardError } from '../../core/Errors';
import type { TileRole } from '../../world/tiles';

export const SLICE_WIDTH = 60;
export const SLICE_HEIGHT = 24;
export const SLICE_FLOOR_ROW = 20;

export const SLICE_LEGEND: Readonly<Record<string, TileRole>> = {
  '#': 'wall',
  F: 'floor',
  f: 'floorFill',
  L: 'ledge',
  B: 'breakable',
  S: 'sealedDoor',
  p: 'puddle',
  r: 'rubble',
  c: 'cobweb',
};

export type SliceOpening = {
  readonly side: 'left' | 'right';
  /** First empty row of the doorway. */
  readonly top: number;
  /** Number of rows (usually 3, matching the hero's height). */
  readonly height: number;
};

export type SliceStamp = {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  readonly glyph: string;
};

export type SliceOptions = {
  readonly openings?: readonly SliceOpening[];
  readonly platforms?: readonly SliceStamp[];
  readonly stamps?: readonly SliceStamp[];
  /** Decorative, non-solid tiles placed on the walkable row above the floor. */
  readonly decor?: readonly { readonly x: number; readonly glyph: string }[];
};

/**
 * Builds a 60x24 room with a solid floor, two-tile side walls, carved doorways, one-way
 * ledges and explicit stamps. Every stamp is bounds-checked here rather than in the room
 * file, so a malformed layout fails before it can reach the renderer.
 */
export function sliceRows(options: SliceOptions = {}): string[] {
  const cells: string[][] = Array.from({ length: SLICE_HEIGHT }, (_, y) =>
    Array.from({ length: SLICE_WIDTH }, (_, x) => {
      if (y === SLICE_FLOOR_ROW) return 'F';
      if (y > SLICE_FLOOR_ROW) return 'f';
      if (x <= 1 || x >= SLICE_WIDTH - 2) return '#';
      return ' ';
    }),
  );

  for (const opening of options.openings ?? []) {
    if (opening.top < 0 || opening.top + opening.height > SLICE_FLOOR_ROW) {
      throw new BellwardError(
        `slice doorway rows ${opening.top}..${opening.top + opening.height} are invalid`,
      );
    }
    const columns = opening.side === 'left' ? [0, 1, 2, 3] : [56, 57, 58, 59];
    for (let y = opening.top; y < opening.top + opening.height; y += 1) {
      for (const x of columns) cells[y]![x] = ' ';
    }
  }

  for (const platform of [...(options.platforms ?? []), ...(options.stamps ?? [])]) {
    stamp(cells, platform);
  }

  for (const decoration of options.decor ?? []) {
    if (decoration.x < 0 || decoration.x >= SLICE_WIDTH) {
      throw new BellwardError(`slice decoration column ${decoration.x} is outside the room`);
    }
    cells[SLICE_FLOOR_ROW - 1]![decoration.x] = decoration.glyph;
  }

  return cells.map((row) => row.join(''));
}

function stamp(cells: string[][], stamp: SliceStamp): void {
  if (stamp.w <= 0 || stamp.h <= 0) {
    throw new BellwardError(`slice stamp at (${stamp.x},${stamp.y}) has non-positive size`);
  }
  if (
    stamp.x < 0 ||
    stamp.y < 0 ||
    stamp.x + stamp.w > SLICE_WIDTH ||
    stamp.y + stamp.h > SLICE_HEIGHT
  ) {
    throw new BellwardError(`slice stamp at (${stamp.x},${stamp.y}) leaves the room`);
  }
  if (stamp.glyph.length !== 1) {
    throw new BellwardError(`slice stamp glyph must be one character`);
  }
  for (let y = stamp.y; y < stamp.y + stamp.h; y += 1) {
    for (let x = stamp.x; x < stamp.x + stamp.w; x += 1) {
      cells[y]![x] = stamp.glyph;
    }
  }
}
