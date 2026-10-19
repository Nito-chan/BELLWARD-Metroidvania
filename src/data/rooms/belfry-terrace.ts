import type { RoomDefinition } from '../../world/Room';

/**
 * The Belfry Terrace — the first room of "The Drowned Belfry".
 *
 * An open-air terrace at the top of the belfry: the drowned town's skyline fills the
 * parallax layers, a broken bell hangs above the walkway and a raised dais waits on
 * the right. The room is deliberately wider than the 640px viewport so the M1 camera
 * has somewhere to pan; M2 replaces the scripted walker with real input.
 *
 * Layout is 60x24 tiles (960x384 px):
 *
 *   rows 0..11   open air between two four-tile stone towers
 *   row  12      a broken one-way beam (ledge) awaiting M2 platforming
 *   rows 13..15  open air
 *   row  16..19  raised dais (8 tiles wide) on the right
 *   row  20      walkway surface
 *   rows 21..23  structural fill
 */

const LEFT_WALL = '####';
const RIGHT_WALL = '####';
const OPEN_ROW = `${LEFT_WALL}${' '.repeat(52)}${RIGHT_WALL}`;
const WALK_ROW = 'F'.repeat(60);
const FILL_ROW = 'f'.repeat(60);
const LEDGE_ROW = `${LEFT_WALL}${' '.repeat(16)}${'L'.repeat(8)}${' '.repeat(28)}${RIGHT_WALL}`;
const DAIS_TOP = `${LEFT_WALL}${' '.repeat(40)}${'F'.repeat(8)}${' '.repeat(4)}${RIGHT_WALL}`;
const DAIS_FILL = `${LEFT_WALL}${' '.repeat(40)}${'f'.repeat(8)}${' '.repeat(4)}${RIGHT_WALL}`;

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
    OPEN_ROW,
    OPEN_ROW,
    DAIS_TOP,
    DAIS_FILL,
    DAIS_FILL,
    DAIS_FILL,
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
    { art: 'column', x: 928, y: 320, layer: 'front' },
  ],
  spawn: { x: 420, y: 320 },
};
