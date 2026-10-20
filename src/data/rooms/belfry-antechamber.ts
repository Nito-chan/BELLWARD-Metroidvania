import type { RoomDefinition } from '../../world/Room';
import { ARENA_LEGEND, arenaRows } from './arena-layout';

/**
 * The Bell Nave is the hub between the terrace and the three M6 arenas. It is intentionally
 * enemy-free: the player reads the three carved doors, chooses a fight, and can walk back
 * out to the terrace without a menu breaking the world.
 */
export const belfryAntechamber: RoomDefinition = {
  id: 'belfry-antechamber',
  name: 'The Bell Nave',
  rows: arenaRows(false),
  legend: ARENA_LEGEND,
  backgrounds: ['far', 'mid'],
  ambient: { tint: 'deepWater', alpha: 0.16 },
  props: [
    { art: 'door', x: 32, y: 320, layer: 'back' },
    { art: 'door', x: 160, y: 320, layer: 'back' },
    { art: 'door', x: 480, y: 320, layer: 'back' },
    { art: 'door', x: 800, y: 320, layer: 'back' },
    { art: 'bell', x: 160, y: 156, layer: 'back' },
    { art: 'bell', x: 480, y: 156, layer: 'back' },
    { art: 'bell', x: 800, y: 156, layer: 'back' },
    { art: 'balustrade', x: 300, y: 320, layer: 'back' },
    { art: 'balustrade', x: 620, y: 320, layer: 'back' },
    { art: 'column', x: 300, y: 320, layer: 'front' },
    { art: 'column', x: 620, y: 320, layer: 'front' },
  ],
  labels: [
    { x: 72, y: 228, text: 'TERRACE', color: 'bone' },
    { x: 160, y: 228, text: 'I · THE BELLBEARER', color: 'echo' },
    { x: 480, y: 228, text: 'II · WARDEN MOSS', color: 'moss' },
    { x: 800, y: 228, text: 'III · THE BELL THIEF', color: 'brass' },
  ],
  spawn: { x: 80, y: 320 },
  exits: [
    { x: 8, y: 260, w: 48, h: 60, targetRoomId: 'belfry-terrace', spawn: { x: 860, y: 320 } },
    {
      x: 136,
      y: 260,
      w: 48,
      h: 60,
      targetRoomId: 'bellbearer-arena',
      spawn: { x: 120, y: 320 },
    },
    {
      x: 456,
      y: 260,
      w: 48,
      h: 60,
      targetRoomId: 'warden-arena',
      spawn: { x: 120, y: 320 },
    },
    {
      x: 776,
      y: 260,
      w: 48,
      h: 60,
      targetRoomId: 'bellthief-arena',
      spawn: { x: 120, y: 320 },
    },
  ],
  enemies: [],
  music: 'terrace',
};
