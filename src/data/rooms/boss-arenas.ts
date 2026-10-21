import type { RoomDefinition } from '../../world/Room';
import { ARENA_LEGEND, arenaRows } from './arena-layout';

/**
 * Three boss rooms, each 60x24. The return door is on the left; the boss waits on the
 * right. The door only opens after the boss falls (RoomScene locks exits while the boss is
 * alive), so every fight is a commitment and every victory has a physical walk back.
 *
 * One-way ledges lift the player above ground waves, while rain and radial volleys keep
 * the upper shelves from becoming safe camps.
 */
export const bellbearerArena: RoomDefinition = {
  id: 'bellbearer-arena',
  name: 'The Ringing Undercroft',
  rows: arenaRows(),
  legend: ARENA_LEGEND,
  backgrounds: ['far', 'mid'],
  ambient: { tint: 'deepWater', alpha: 0.22 },
  props: [
    { art: 'door', x: 32, y: 320, layer: 'back' },
    { art: 'bell', x: 420, y: 148, layer: 'back' },
    { art: 'bell', x: 700, y: 126, layer: 'back' },
    { art: 'column', x: 210, y: 320, layer: 'back' },
    { art: 'column', x: 840, y: 320, layer: 'back' },
    { art: 'altar', x: 864, y: 320, layer: 'back' },
  ],
  labels: [{ x: 72, y: 228, text: 'ANTECHAMBER', color: 'bone' }],
  spawn: { x: 120, y: 320 },
  ordeal: { x: 840, y: 272, w: 48, h: 48 },
  exits: [
    {
      x: 8,
      y: 260,
      w: 48,
      h: 60,
      targetRoomId: 'belfry-antechamber',
      spawn: { x: 160, y: 320 },
    },
  ],
  enemies: [{ kind: 'bellbearer', x: 560, y: 320, facing: -1 }],
  boss: 'bellbearer',
  music: 'bossAbyss',
};

export const wardenArena: RoomDefinition = {
  id: 'warden-arena',
  name: 'The Moss Choir',
  rows: arenaRows(),
  legend: ARENA_LEGEND,
  backgrounds: ['far', 'mid'],
  ambient: { tint: 'moss', alpha: 0.16 },
  props: [
    { art: 'door', x: 32, y: 320, layer: 'back' },
    { art: 'bell', x: 360, y: 180, layer: 'back' },
    { art: 'bell', x: 760, y: 136, layer: 'back' },
    { art: 'column', x: 160, y: 320, layer: 'front' },
    { art: 'column', x: 880, y: 320, layer: 'front' },
    { art: 'altar', x: 840, y: 320, layer: 'back' },
  ],
  labels: [{ x: 72, y: 228, text: 'ANTECHAMBER', color: 'bone' }],
  spawn: { x: 120, y: 320 },
  ordeal: { x: 816, y: 272, w: 48, h: 48 },
  exits: [
    {
      x: 8,
      y: 260,
      w: 48,
      h: 60,
      targetRoomId: 'belfry-antechamber',
      spawn: { x: 480, y: 320 },
    },
  ],
  enemies: [{ kind: 'wardenMoss', x: 560, y: 320, facing: -1 }],
  boss: 'wardenMoss',
  music: 'bossCitadel',
};

export const bellthiefArena: RoomDefinition = {
  id: 'bellthief-arena',
  name: 'The Silent Vault',
  rows: arenaRows(),
  legend: ARENA_LEGEND,
  backgrounds: ['far', 'mid'],
  ambient: { tint: 'brass', alpha: 0.1 },
  props: [
    { art: 'door', x: 32, y: 320, layer: 'back' },
    { art: 'bell', x: 250, y: 160, layer: 'back' },
    { art: 'bell', x: 520, y: 112, layer: 'back' },
    { art: 'bell', x: 790, y: 172, layer: 'back' },
    { art: 'column', x: 340, y: 320, layer: 'front' },
    { art: 'column', x: 700, y: 320, layer: 'front' },
    { art: 'altar', x: 864, y: 320, layer: 'back' },
  ],
  labels: [{ x: 72, y: 228, text: 'ANTECHAMBER', color: 'bone' }],
  spawn: { x: 120, y: 320 },
  ordeal: { x: 840, y: 272, w: 48, h: 48 },
  pickups: [
    { id: 'bellthief-sturdy-shell', x: 660, y: 296 },
    { id: 'bellthief-tide-bell', x: 760, y: 296 },
  ],
  exits: [
    {
      x: 8,
      y: 260,
      w: 48,
      h: 60,
      targetRoomId: 'belfry-antechamber',
      spawn: { x: 800, y: 320 },
    },
  ],
  enemies: [{ kind: 'bellThief', x: 560, y: 320, facing: -1 }],
  boss: 'bellThief',
  music: 'bossCitadel',
};
