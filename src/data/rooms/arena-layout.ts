import { BellwardError } from '../../core/Errors';
import type { TileRole } from '../../world/tiles';

export const ARENA_WIDTH = 60;
export const ARENA_HEIGHT = 24;

const WALL = '#';
const OPEN = `${WALL}${' '.repeat(ARENA_WIDTH - 2)}${WALL}`;
const FLOOR = 'F'.repeat(ARENA_WIDTH);
const FILL = 'f'.repeat(ARENA_WIDTH);

export const ARENA_LEGEND: Readonly<Record<string, TileRole>> = {
  '#': 'wall',
  F: 'floor',
  f: 'floorFill',
  L: 'ledge',
};

/** Copies `base` and stamps glyphs at explicit columns, failing loudly on typos. */
function place(base: string, glyphs: readonly (readonly [number, string])[]): string {
  const cells = base.split('');
  if (cells.length !== ARENA_WIDTH) {
    throw new BellwardError(`arena row has ${cells.length} cells, expected ${ARENA_WIDTH}`);
  }
  for (const [index, glyph] of glyphs) {
    if (index < 0 || index >= cells.length) {
      throw new BellwardError(`arena column ${index} is outside the row`);
    }
    cells[index] = glyph;
  }
  return cells.join('');
}

const LOW_LEDGE = place(OPEN, [
  ...Array.from({ length: 8 }, (_, i) => [11 + i, 'L'] as const),
  ...Array.from({ length: 8 }, (_, i) => [42 + i, 'L'] as const),
]);
const HIGH_LEDGE = place(OPEN, [
  ...Array.from({ length: 7 }, (_, i) => [6 + i, 'L'] as const),
  ...Array.from({ length: 7 }, (_, i) => [45 + i, 'L'] as const),
]);

/**
 * A flat 60x24 arena with optional one-way escape ledges. The ledges sit above ground
 * waves without creating a safe camp: rain and volleys still reach them.
 */
export function arenaRows(withLedges = true): string[] {
  const rows = Array.from({ length: 20 }, (_, index) => {
    if (!withLedges) return OPEN;
    if (index === 17) return LOW_LEDGE;
    if (index === 13) return HIGH_LEDGE;
    return OPEN;
  });
  rows.push(FLOOR, FILL, FILL, FILL);
  if (rows.length !== ARENA_HEIGHT) {
    throw new BellwardError(`arena built ${rows.length} rows, expected ${ARENA_HEIGHT}`);
  }
  return rows;
}
