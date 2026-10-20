import { BellwardError } from '../../core/Errors';
import type { RoomDefinition } from '../../world/Room';

/**
 * The Belfry Terrace — the first room of "The Drowned Belfry".
 *
 * An open-air terrace at the top of the belfry: the drowned town's skyline fills the
 * parallax layers, a broken bell hangs above the walkway, and the room is deliberately
 * wider than the 640px viewport so the camera has somewhere to pan.
 *
 * Layout is 60x24 tiles (960x384 px):
 *
 *   rows 0..11   open air between two four-tile stone towers
 *   row  12      broken beam bridge (one-way ledge, 8 tiles)
 *   row  14      ascent beam 3 (two tiles)
 *   row  16      ascent beam 2 (two tiles) + the raised dais (8 tiles wide)
 *   row  18      ascent beam 1 (two tiles) + dais step (1 tile)
 *   row  19      dais step (2 tiles)
 *   row  20      walkway surface
 *   rows 21..23  structural fill
 *
 * The left tower's three beams climb 32 px at a time (walkway 320 → 288 → 256 → 224 →
 * beam bridge 192); the dais steps climb from the walkway on the right. Both routes and
 * the beam bridge's drop-through are exercised by the M2 movement tests.
 */

const LEFT_WALL = '####';
const RIGHT_WALL = '####';
const OPEN_ROW = `${LEFT_WALL}${' '.repeat(52)}${RIGHT_WALL}`;
const WALK_ROW = 'F'.repeat(60);
const FILL_ROW = 'f'.repeat(60);
const LEDGE_ROW = `${LEFT_WALL}${' '.repeat(16)}${'L'.repeat(8)}${' '.repeat(28)}${RIGHT_WALL}`;
const DAIS_TOP = `${LEFT_WALL}${' '.repeat(40)}${'F'.repeat(8)}${' '.repeat(4)}${RIGHT_WALL}`;
const DAIS_FILL = `${LEFT_WALL}${' '.repeat(40)}${'f'.repeat(8)}${' '.repeat(4)}${RIGHT_WALL}`;

const ROOM_WIDTH = 60;

/**
 * Copies `base` and stamps glyphs at explicit column indexes. Indexing rows by hand
 * would invite silent off-by-one holes; this fails loudly instead.
 */
function place(base: string, glyphs: readonly (readonly [number, string])[]): string {
  const cells = base.split('');
  if (cells.length !== ROOM_WIDTH) {
    throw new BellwardError(`room row template has ${cells.length} cells, expected ${ROOM_WIDTH}`);
  }
  for (const [index, glyph] of glyphs) {
    if (index < 0 || index >= cells.length) {
      throw new BellwardError(
        `room tile column ${index} is outside the row (${cells.length} tiles)`,
      );
    }
    cells[index] = glyph;
  }
  return cells.join('');
}

/** Ascent beams climbing the left tower to the bridge. */
const ASCENT_ROW_14 = place(OPEN_ROW, [
  [18, 'L'],
  [19, 'L'],
]);
const ASCENT_ROW_16 = place(DAIS_TOP, [
  [14, 'L'],
  [15, 'L'],
]);
const ASCENT_ROW_18 = place(DAIS_FILL, [
  [10, 'L'],
  [11, 'L'],
  [43, 'F'],
]);
/** Walkway step blocks onto the dais (top at rows 19 and 18). */
const STEP_ROW_19 = place(DAIS_FILL, [
  [42, 'F'],
  [43, 'F'],
]);

export const belfryTerrace: RoomDefinition = {
  id: 'belfry-terrace',
  name: 'The Belfry Terrace',
  rows: [
    OPEN_ROW,
    OPEN_ROW,
    OPEN_ROW,
    OPEN_ROW,
    OPEN_ROW,
    OPEN_ROW,
    OPEN_ROW,
    OPEN_ROW,
    OPEN_ROW,
    OPEN_ROW,
    OPEN_ROW,
    OPEN_ROW,
    LEDGE_ROW,
    OPEN_ROW,
    ASCENT_ROW_14,
    OPEN_ROW,
    ASCENT_ROW_16,
    DAIS_FILL,
    ASCENT_ROW_18,
    STEP_ROW_19,
    WALK_ROW,
    FILL_ROW,
    FILL_ROW,
    FILL_ROW,
  ],
  legend: {
    '#': 'wall',
    F: 'floor',
    f: 'floorFill',
    L: 'ledge',
  },
  backgrounds: ['far', 'mid'],
  ambient: { tint: 'deepWater', alpha: 0.12 },
  props: [
    { art: 'balustrade', x: 90, y: 320, layer: 'back' },
    { art: 'balustrade', x: 290, y: 320, layer: 'back' },
    { art: 'balustrade', x: 490, y: 320, layer: 'back' },
    // The bell's chain runs off the top of the frame: it hangs from the unseen belfry above.
    { art: 'bell', x: 480, y: 120, layer: 'back' },
    { art: 'column', x: 32, y: 320, layer: 'front' },
    { art: 'column', x: 896, y: 320, layer: 'front' },
    { art: 'door', x: 928, y: 320, layer: 'back' },
  ],
  labels: [{ x: 884, y: 228, text: 'THE BELL NAVE', color: 'echo' }],
  spawn: { x: 420, y: 320 },
  /**
   * The first rest point stands just left of the broken bell. Its respawn point is
   * deliberately offset from the seat so the hero never wakes inside the stone.
   */
  benches: [
    {
      id: 'terrace-weeping-stone',
      name: 'The Weeping Stone',
      x: 608,
      y: 320,
      spawn: { x: 566, y: 320 },
    },
  ],
  /**
   * Combat is deliberately off the spawn pocket (420..660) so the first frames stay
   * readable: two parishioners haunt the left walkway, the ghoul guards the beam bridge
   * above, and the adept waits beyond the dais in the far-right pocket.
   */
  enemies: [
    { kind: 'parishioner', x: 150, y: 320, facing: -1, patrol: { min: 104, max: 200 } },
    { kind: 'parishioner', x: 270, y: 320, facing: 1, patrol: { min: 228, max: 312 } },
    { kind: 'ghoul', x: 380, y: 192, facing: -1, patrol: { min: 328, max: 432 } },
    { kind: 'adept', x: 872, y: 320, facing: -1 },
  ],
  exits: [
    {
      x: 900,
      y: 260,
      w: 56,
      h: 60,
      targetRoomId: 'belfry-antechamber',
      spawn: { x: 80, y: 320 },
    },
  ],
};
