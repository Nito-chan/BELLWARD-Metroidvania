import type { RoomDefinition } from '../../world/Room';
import { SLICE_FLOOR_ROW, SLICE_LEGEND, sliceRows } from './slice-layout';

/**
 * The Drowned District: seven rooms added in M8. They share one slab-and-ledge
 * vocabulary, then diverge by hazard, secret and verticality so the region reads as one
 * place built by the same hands.
 */

const FLOOR_Y = SLICE_FLOOR_ROW * 16;
const UPPER_LEDGE_Y = 13 * 16;
const MID_LEDGE_Y = 16 * 16;

export const drownedGallery: RoomDefinition = {
  id: 'drowned-gallery',
  name: 'The Drowned Gallery',
  rows: sliceRows({
    openings: [
      { side: 'left', top: 17, height: 3 },
      { side: 'right', top: 10, height: 3 },
    ],
    platforms: [
      { x: 15, y: 16, w: 6, h: 1, glyph: 'L' },
      { x: 27, y: 13, w: 5, h: 1, glyph: 'L' },
      { x: 40, y: 16, w: 6, h: 1, glyph: 'L' },
      { x: 47, y: 13, w: 13, h: 1, glyph: 'L' },
    ],
    stamps: [{ x: 57, y: 17, w: 3, h: 3, glyph: 'B' }],
    decor: [
      { x: 7, glyph: 'p' },
      { x: 10, glyph: 'p' },
      { x: 18, glyph: 'r' },
      { x: 38, glyph: 'p' },
    ],
  }),
  legend: SLICE_LEGEND,
  backgrounds: ['far', 'mid'],
  ambient: { tint: 'deepWater', alpha: 0.18 },
  props: [
    { art: 'door', x: 32, y: FLOOR_Y, layer: 'back' },
    { art: 'door', x: 928, y: UPPER_LEDGE_Y, layer: 'back' },
    { art: 'door', x: 928, y: FLOOR_Y, layer: 'back', tint: 'moss' },
    { art: 'column', x: 180, y: FLOOR_Y, layer: 'front' },
    { art: 'column', x: 700, y: FLOOR_Y, layer: 'front' },
    { art: 'bell', x: 480, y: 150, layer: 'back' },
  ],
  labels: [
    { x: 64, y: 228, text: 'THE DROWNED GALLERY', color: 'bone' },
    { x: 744, y: 228, text: 'TO THE AQUEDUCT', color: 'echo' },
    { x: 64, y: 276, text: 'WEST · TERRACE', color: 'bone', size: 8 },
  ],
  spawn: { x: 80, y: FLOOR_Y },
  enemies: [
    { kind: 'parishioner', x: 300, y: FLOOR_Y, patrol: { min: 230, max: 380 } },
    { kind: 'ghoul', x: 620, y: FLOOR_Y, patrol: { min: 520, max: 700 } },
    { kind: 'adept', x: 840, y: UPPER_LEDGE_Y, facing: -1 },
  ],
  pickups: [
    { id: 'gallery-shard-low', x: 300, y: MID_LEDGE_Y - 26 },
    { id: 'gallery-shard-high', x: 680, y: FLOOR_Y - 26 },
    { id: 'gallery-quick-mend', x: 480, y: UPPER_LEDGE_Y - 28 },
    { id: 'gallery-health-shard', x: 840, y: UPPER_LEDGE_Y - 28 },
  ],
  anchors: [
    { id: 'gallery-high-west', x: 440, y: 172 },
    { id: 'gallery-high-east', x: 800, y: 172 },
    { id: 'gallery-mid-west', x: 280, y: 220 },
    { id: 'gallery-mid-east', x: 688, y: 220 },
    { id: 'gallery-span', x: 560, y: 168 },
    { id: 'gallery-secret', x: 896, y: 236 },
  ],
  exits: [
    {
      x: 8,
      y: 272,
      w: 48,
      h: 48,
      targetRoomId: 'belfry-terrace',
      spawn: { x: 80, y: 320 },
    },
    {
      x: 904,
      y: 160,
      w: 56,
      h: 48,
      targetRoomId: 'sunless-aqueduct',
      spawn: { x: 80, y: 320 },
    },
    {
      x: 928,
      y: 272,
      w: 32,
      h: 48,
      targetRoomId: 'ossuary',
      spawn: { x: 80, y: 320 },
    },
  ],
};

export const ossuary: RoomDefinition = {
  id: 'ossuary',
  name: 'The Ossuary',
  rows: sliceRows({
    openings: [{ side: 'left', top: 17, height: 3 }],
    platforms: [
      { x: 17, y: 16, w: 6, h: 1, glyph: 'L' },
      { x: 27, y: 13, w: 7, h: 1, glyph: 'L' },
    ],
    decor: [
      { x: 12, glyph: 'r' },
      { x: 22, glyph: 'r' },
      { x: 36, glyph: 'r' },
    ],
  }),
  legend: SLICE_LEGEND,
  backgrounds: ['far', 'mid'],
  ambient: { tint: 'bone', alpha: 0.1 },
  props: [
    { art: 'door', x: 32, y: FLOOR_Y, layer: 'back' },
    { art: 'column', x: 240, y: FLOOR_Y, layer: 'front' },
    { art: 'bell', x: 700, y: 168, layer: 'back' },
    { art: 'column', x: 860, y: FLOOR_Y, layer: 'front' },
  ],
  labels: [
    { x: 96, y: 228, text: 'THE OSSUARY', color: 'bone' },
    { x: 96, y: 276, text: 'A SECRET OF THE GALLERY', color: 'brassDark', size: 8 },
  ],
  spawn: { x: 80, y: FLOOR_Y },
  enemies: [
    { kind: 'ghoul', x: 400, y: FLOOR_Y, patrol: { min: 320, max: 520 } },
    { kind: 'adept', x: 496, y: UPPER_LEDGE_Y, facing: -1 },
  ],
  pickups: [
    { id: 'ossuary-light-step', x: 496, y: UPPER_LEDGE_Y - 28 },
    { id: 'ossuary-shard', x: 760, y: FLOOR_Y - 26 },
    { id: 'ossuary-health-shard', x: 340, y: MID_LEDGE_Y - 26 },
  ],
  anchors: [
    { id: 'ossuary-high', x: 464, y: 172 },
    { id: 'ossuary-mid', x: 340, y: 220 },
  ],
  exits: [
    {
      x: 8,
      y: 272,
      w: 48,
      h: 48,
      targetRoomId: 'drowned-gallery',
      spawn: { x: 840, y: FLOOR_Y },
    },
  ],
};

export const sunlessAqueduct: RoomDefinition = {
  id: 'sunless-aqueduct',
  name: 'The Sunless Aqueduct',
  rows: sliceRows({
    openings: [
      { side: 'left', top: 17, height: 3 },
      { side: 'right', top: 17, height: 3 },
    ],
    platforms: [
      { x: 15, y: 16, w: 6, h: 1, glyph: 'L' },
      { x: 25, y: 13, w: 7, h: 1, glyph: 'L' },
      { x: 40, y: 16, w: 6, h: 1, glyph: 'L' },
      { x: 47, y: 13, w: 6, h: 1, glyph: 'L' },
    ],
    decor: [
      { x: 8, glyph: 'p' },
      { x: 12, glyph: 'p' },
      { x: 34, glyph: 'p' },
      { x: 44, glyph: 'r' },
    ],
  }),
  legend: SLICE_LEGEND,
  backgrounds: ['far', 'mid'],
  ambient: { tint: 'deepWater', alpha: 0.24 },
  props: [
    { art: 'door', x: 32, y: FLOOR_Y, layer: 'back' },
    { art: 'door', x: 928, y: FLOOR_Y, layer: 'back' },
    { art: 'column', x: 200, y: FLOOR_Y, layer: 'front' },
    { art: 'column', x: 720, y: FLOOR_Y, layer: 'front' },
    { art: 'bell', x: 480, y: 142, layer: 'back' },
  ],
  labels: [
    { x: 96, y: 228, text: 'THE SUNLESS AQUEDUCT', color: 'bone' },
    { x: 96, y: 276, text: 'WEST · THE GALLERY', color: 'bone', size: 8 },
    { x: 744, y: 276, text: 'EAST · THE BELLOWS', color: 'echo', size: 8 },
  ],
  spawn: { x: 80, y: FLOOR_Y },
  enemies: [
    { kind: 'ghoul', x: 640, y: FLOOR_Y, patrol: { min: 520, max: 760 } },
    { kind: 'parishioner', x: 340, y: FLOOR_Y, patrol: { min: 260, max: 420 } },
    { kind: 'adept', x: 808, y: UPPER_LEDGE_Y, facing: -1 },
  ],
  pickups: [
    { id: 'aqueduct-wall-claw', x: 480, y: UPPER_LEDGE_Y - 30 },
    { id: 'aqueduct-shard-low', x: 300, y: MID_LEDGE_Y - 26 },
    { id: 'aqueduct-hookline', x: 800, y: UPPER_LEDGE_Y - 28 },
    { id: 'aqueduct-shard-high', x: 880, y: FLOOR_Y - 26 },
    { id: 'aqueduct-ember-greed', x: 680, y: MID_LEDGE_Y - 26 },
    { id: 'aqueduct-health-shard', x: 440, y: UPPER_LEDGE_Y - 28 },
  ],
  anchors: [
    { id: 'aqueduct-west', x: 120, y: 240 },
    { id: 'aqueduct-mid-west', x: 280, y: 220 },
    { id: 'aqueduct-upper-west', x: 430, y: 172 },
    { id: 'aqueduct-span', x: 560, y: 168 },
    { id: 'aqueduct-mid-east', x: 688, y: 220 },
    { id: 'aqueduct-hookline', x: 824, y: 160 },
  ],
  exits: [
    {
      x: 8,
      y: 272,
      w: 48,
      h: 48,
      targetRoomId: 'drowned-gallery',
      spawn: { x: 860, y: UPPER_LEDGE_Y },
    },
    {
      x: 904,
      y: 272,
      w: 56,
      h: 48,
      targetRoomId: 'bellows',
      spawn: { x: 80, y: FLOOR_Y },
    },
  ],
};

export const bellows: RoomDefinition = {
  id: 'bellows',
  name: 'The Lower Bellows',
  rows: sliceRows({
    openings: [
      { side: 'left', top: 17, height: 3 },
      { side: 'right', top: 17, height: 3 },
      { side: 'right', top: 10, height: 3 },
    ],
    platforms: [
      { x: 39, y: 16, w: 6, h: 1, glyph: 'L' },
      { x: 47, y: 13, w: 13, h: 1, glyph: 'L' },
    ],
    decor: [
      { x: 10, glyph: 'p' },
      { x: 24, glyph: 'r' },
      { x: 34, glyph: 'p' },
    ],
  }),
  legend: SLICE_LEGEND,
  backgrounds: ['far', 'mid'],
  ambient: { tint: 'cavern', alpha: 0.2 },
  props: [
    { art: 'door', x: 32, y: FLOOR_Y, layer: 'back' },
    { art: 'door', x: 928, y: FLOOR_Y, layer: 'back' },
    { art: 'door', x: 928, y: UPPER_LEDGE_Y, layer: 'back' },
    { art: 'bell', x: 400, y: 176, layer: 'back' },
    { art: 'column', x: 560, y: FLOOR_Y, layer: 'front' },
    { art: 'column', x: 840, y: FLOOR_Y, layer: 'front' },
  ],
  labels: [
    { x: 96, y: 228, text: 'THE LOWER BELLOWS', color: 'bone' },
    { x: 744, y: 228, text: 'THE WALL-CLAW SHAFT', color: 'echo' },
    { x: 744, y: 276, text: 'EAST · THE NAVE', color: 'brassDark', size: 8 },
  ],
  spawn: { x: 80, y: FLOOR_Y },
  enemies: [
    { kind: 'ghoul', x: 420, y: FLOOR_Y, patrol: { min: 320, max: 520 } },
    { kind: 'parishioner', x: 700, y: FLOOR_Y, patrol: { min: 620, max: 780 } },
    { kind: 'adept', x: 840, y: UPPER_LEDGE_Y, facing: -1 },
  ],
  pickups: [
    { id: 'bellows-shard-low', x: 660, y: MID_LEDGE_Y - 26 },
    { id: 'bellows-shard-high', x: 840, y: UPPER_LEDGE_Y - 28 },
  ],
  anchors: [
    { id: 'bellows-span', x: 480, y: 196 },
    { id: 'bellows-mid', x: 672, y: 220 },
    { id: 'bellows-high-east', x: 880, y: 172 },
  ],
  exits: [
    {
      x: 8,
      y: 272,
      w: 48,
      h: 48,
      targetRoomId: 'sunless-aqueduct',
      spawn: { x: 860, y: FLOOR_Y },
    },
    {
      x: 904,
      y: 272,
      w: 56,
      h: 48,
      targetRoomId: 'belfry-antechamber',
      spawn: { x: 880, y: FLOOR_Y },
    },
    {
      x: 904,
      y: 160,
      w: 56,
      h: 48,
      targetRoomId: 'wall-claw-shaft',
      spawn: { x: 80, y: FLOOR_Y },
    },
  ],
};

export const wallClawShaft: RoomDefinition = {
  id: 'wall-claw-shaft',
  name: 'The Wall-Claw Shaft',
  rows: sliceRows({
    openings: [{ side: 'left', top: 17, height: 3 }],
    // Two hanging pillars make a climbable slot without blocking the ground route:
    // the player can walk under them, jump onto either face, then alternate wall jumps.
    platforms: [{ x: 24, y: 5, w: 36, h: 1, glyph: 'L' }],
    stamps: [
      { x: 24, y: 6, w: 2, h: 9, glyph: '#' },
      { x: 31, y: 8, w: 2, h: 7, glyph: '#' },
    ],
    decor: [
      { x: 8, glyph: 'p' },
      { x: 14, glyph: 'p' },
    ],
  }),
  legend: SLICE_LEGEND,
  backgrounds: ['far', 'mid'],
  ambient: { tint: 'echo', alpha: 0.1 },
  props: [
    { art: 'door', x: 32, y: FLOOR_Y, layer: 'back' },
    { art: 'door', x: 912, y: 5 * 16, layer: 'back' },
    { art: 'column', x: 200, y: FLOOR_Y, layer: 'front' },
    { art: 'bell', x: 360, y: 150, layer: 'back' },
  ],
  labels: [
    { x: 64, y: 228, text: 'THE WALL-CLAW SHAFT', color: 'bone' },
    { x: 64, y: 276, text: 'WEST · THE BELLOWS', color: 'brassDark', size: 8 },
    { x: 720, y: 40, text: 'THE UPPER GALLERY', color: 'echo', size: 8 },
  ],
  spawn: { x: 80, y: FLOOR_Y },
  enemies: [],
  pickups: [
    { id: 'shaft-shard', x: 456, y: FLOOR_Y - 30 },
    { id: 'shaft-longline', x: 820, y: 56 },
  ],
  exits: [
    {
      x: 8,
      y: 272,
      w: 48,
      h: 48,
      targetRoomId: 'bellows',
      spawn: { x: 840, y: UPPER_LEDGE_Y },
    },
    {
      x: 880,
      y: 48,
      w: 64,
      h: 48,
      targetRoomId: 'upper-gallery',
      spawn: { x: 80, y: FLOOR_Y },
    },
  ],
};

export const upperGallery: RoomDefinition = {
  id: 'upper-gallery',
  name: 'The Upper Gallery',
  rows: sliceRows({
    openings: [
      { side: 'left', top: 17, height: 3 },
      { side: 'right', top: 10, height: 3 },
    ],
    platforms: [
      { x: 13, y: 16, w: 6, h: 1, glyph: 'L' },
      { x: 23, y: 13, w: 6, h: 1, glyph: 'L' },
      { x: 37, y: 16, w: 6, h: 1, glyph: 'L' },
      { x: 47, y: 13, w: 13, h: 1, glyph: 'L' },
    ],
    stamps: [
      { x: 32, y: 0, w: 3, h: 20, glyph: 'S' },
      { x: 57, y: 17, w: 3, h: 3, glyph: 'B' },
    ],
    decor: [
      { x: 10, glyph: 'p' },
      { x: 24, glyph: 'r' },
      { x: 44, glyph: 'p' },
    ],
  }),
  legend: SLICE_LEGEND,
  backgrounds: ['far', 'mid'],
  ambient: { tint: 'brass', alpha: 0.08 },
  props: [
    { art: 'door', x: 32, y: FLOOR_Y, layer: 'back' },
    { art: 'door', x: 928, y: UPPER_LEDGE_Y, layer: 'back' },
    { art: 'door', x: 928, y: FLOOR_Y, layer: 'back', tint: 'moss' },
    { art: 'bell', x: 680, y: 168, layer: 'back' },
    { art: 'column', x: 180, y: FLOOR_Y, layer: 'front' },
    { art: 'bench', x: 800, y: FLOOR_Y, layer: 'back' },
  ],
  labels: [
    { x: 96, y: 228, text: 'THE UPPER GALLERY', color: 'bone' },
    { x: 544, y: 228, text: 'THE TIDE DOOR', color: 'echo' },
    { x: 544, y: 276, text: 'IT ANSWERS ONLY THE TIDE-BELL', color: 'brassDark', size: 8 },
    { x: 744, y: 228, text: 'A DROP INTO THE TERRACE', color: 'bone', size: 8 },
  ],
  spawn: { x: 80, y: FLOOR_Y },
  enemies: [
    { kind: 'parishioner', x: 680, y: FLOOR_Y, patrol: { min: 600, max: 740 } },
    { kind: 'adept', x: 424, y: UPPER_LEDGE_Y, facing: -1 },
  ],
  pickups: [
    { id: 'upper-shard-low', x: 300, y: MID_LEDGE_Y - 26 },
    { id: 'upper-shard-high', x: 820, y: UPPER_LEDGE_Y - 28 },
  ],
  anchors: [
    { id: 'upper-mid-west', x: 240, y: 220 },
    { id: 'upper-high-west', x: 416, y: 172 },
    { id: 'upper-mid-east', x: 640, y: 220 },
    { id: 'upper-high-east', x: 760, y: 172 },
    { id: 'upper-terrace-door', x: 896, y: 172 },
  ],
  benches: [
    {
      id: 'upper-tide-watch',
      name: 'Tide-Watch Stone',
      x: 800,
      y: FLOOR_Y,
      spawn: { x: 760, y: FLOOR_Y },
    },
  ],
  ending: {
    x: 592,
    y: 272,
    w: 48,
    h: 48,
    title: 'THE BELL REMEMBERS',
    subtitle: 'The Tide-Bell answers. Far below, the drowned bells begin to ring.',
    requiresPickup: 'bellthief-tide-bell',
  },
  exits: [
    {
      x: 8,
      y: 272,
      w: 48,
      h: 48,
      targetRoomId: 'wall-claw-shaft',
      spawn: { x: 880, y: 80 },
    },
    {
      x: 904,
      y: 160,
      w: 56,
      h: 48,
      targetRoomId: 'belfry-terrace',
      spawn: { x: 80, y: 320 },
    },
    {
      x: 928,
      y: 272,
      w: 32,
      h: 48,
      targetRoomId: 'reliquary',
      spawn: { x: 80, y: 320 },
    },
  ],
};

export const reliquary: RoomDefinition = {
  id: 'reliquary',
  name: 'The Reliquary',
  rows: sliceRows({
    openings: [{ side: 'left', top: 17, height: 3 }],
    platforms: [
      { x: 17, y: 16, w: 6, h: 1, glyph: 'L' },
      { x: 27, y: 13, w: 7, h: 1, glyph: 'L' },
    ],
    decor: [
      { x: 12, glyph: 'p' },
      { x: 22, glyph: 'p' },
      { x: 36, glyph: 'r' },
    ],
  }),
  legend: SLICE_LEGEND,
  backgrounds: ['far', 'mid'],
  ambient: { tint: 'brass', alpha: 0.14 },
  props: [
    { art: 'door', x: 32, y: FLOOR_Y, layer: 'back' },
    { art: 'bell', x: 600, y: 152, layer: 'back' },
    { art: 'column', x: 220, y: FLOOR_Y, layer: 'front' },
    { art: 'column', x: 820, y: FLOOR_Y, layer: 'front' },
  ],
  labels: [
    { x: 96, y: 228, text: 'THE RELIQUARY', color: 'bone' },
    { x: 96, y: 276, text: 'A SECRET OF THE UPPER GALLERY', color: 'brassDark', size: 8 },
  ],
  spawn: { x: 80, y: FLOOR_Y },
  enemies: [
    { kind: 'ghoul', x: 620, y: FLOOR_Y, patrol: { min: 540, max: 720 } },
    { kind: 'adept', x: 496, y: UPPER_LEDGE_Y, facing: -1 },
  ],
  pickups: [
    { id: 'reliquary-long-reach', x: 496, y: UPPER_LEDGE_Y - 28 },
    { id: 'reliquary-health-shard', x: 340, y: MID_LEDGE_Y - 26 },
    { id: 'reliquary-shard', x: 760, y: FLOOR_Y - 26 },
  ],
  anchors: [
    { id: 'reliquary-high', x: 448, y: 172 },
    { id: 'reliquary-mid', x: 340, y: 220 },
  ],
  exits: [
    {
      x: 8,
      y: 272,
      w: 48,
      h: 48,
      targetRoomId: 'upper-gallery',
      spawn: { x: 840, y: FLOOR_Y },
    },
  ],
};

export const DROWNED_ROOMS: readonly RoomDefinition[] = [
  drownedGallery,
  ossuary,
  sunlessAqueduct,
  bellows,
  wallClawShaft,
  upperGallery,
  reliquary,
];
