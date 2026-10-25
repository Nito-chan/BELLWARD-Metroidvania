/**
 * The authored Tideglass atlas. It is the only hand-placed geography in the chart:
 * every room in the slice appears exactly once, and every door the player can walk
 * through has an explicit side and position. If a room or exit is added without a
 * placement, module load fails loudly instead of hiding the omission behind a guess.
 */
import { MAP } from '../../config/map';
import { BellwardError } from '../../core/Errors';
import { ALL_ROOMS, ROOMS } from '../../data/rooms';
import type { MapDoorKind, MapRect, MapSide } from './mapTypes';

export type MapAtlasDoor = {
  readonly targetRoomId: string;
  readonly side: MapSide;
  /** 0..1 along the room edge. */
  readonly at: number;
  readonly kind?: MapDoorKind;
  /** For a one-way passage, where it arrives on the target's edge. */
  readonly targetSide?: MapSide;
  readonly targetAt?: number;
  /** A Tide door needs both the Tide-Bell and the Ward of Four. */
  readonly seal?: 'arsenal' | 'tide';
};

export type MapAtlasRoom = {
  readonly roomId: string;
  readonly region: string;
  readonly col: number;
  readonly row: number;
  readonly label: string;
  readonly kicker: string;
  readonly note: string;
  /** Secret places stay absent until their seam is broken or they are entered. */
  readonly secret?: boolean;
  readonly doors: readonly MapAtlasDoor[];
};

export const MAP_ATLAS: readonly MapAtlasRoom[] = [
  {
    roomId: 'belfry-terrace',
    region: 'The Bell Nave',
    col: 2,
    row: 1,
    label: 'Belfry Terrace',
    kicker: 'ENTRY',
    note: 'The last open sky. A broken bell hangs above the Weeping Stone.',
    doors: [
      { targetRoomId: 'drowned-gallery', side: 'west', at: 0.75 },
      { targetRoomId: 'belfry-antechamber', side: 'south', at: 0.82 },
    ],
  },
  {
    roomId: 'belfry-antechamber',
    region: 'The Bell Nave',
    col: 2,
    row: 2,
    label: 'Bell Nave',
    kicker: 'HUB',
    note: 'Three doors, three bells. The Keeper\u2019s Rest keeps the middle watch.',
    doors: [
      { targetRoomId: 'belfry-terrace', side: 'north', at: 0.82 },
      { targetRoomId: 'bellbearer-arena', side: 'east', at: 0.28, kind: 'bell' },
      { targetRoomId: 'warden-arena', side: 'east', at: 0.68, kind: 'bell' },
      { targetRoomId: 'bellthief-arena', side: 'east', at: 0.92, kind: 'bell' },
      { targetRoomId: 'bellows', side: 'west', at: 0.95 },
    ],
  },
  {
    roomId: 'bellbearer-arena',
    region: 'The Three Bells',
    col: 3,
    row: 1,
    label: 'Undercroft',
    kicker: 'I',
    note: 'The Bellbearer\u2019s ring. The first sigil cools in the wax.',
    doors: [{ targetRoomId: 'belfry-antechamber', side: 'west', at: 0.5, kind: 'bell' }],
  },
  {
    roomId: 'warden-arena',
    region: 'The Three Bells',
    col: 3,
    row: 2,
    label: 'Moss Choir',
    kicker: 'II',
    note: 'The Warden\u2019s green silence. A bell waits under the moss.',
    doors: [{ targetRoomId: 'belfry-antechamber', side: 'west', at: 0.5, kind: 'bell' }],
  },
  {
    roomId: 'bellthief-arena',
    region: 'The Three Bells',
    col: 3,
    row: 3,
    label: 'Silent Vault',
    kicker: 'III',
    note: 'The Bell Thief\u2019s vault. The third bell has no tongue.',
    doors: [{ targetRoomId: 'belfry-antechamber', side: 'west', at: 0.5, kind: 'bell' }],
  },
  {
    roomId: 'drowned-gallery',
    region: 'The Drowned Foundations',
    col: 0,
    row: 1,
    label: 'Drowned Gallery',
    kicker: 'WEST',
    note: 'The water has taken the west wall. A hard blow answers somewhere.',
    doors: [
      { targetRoomId: 'belfry-terrace', side: 'east', at: 0.48 },
      { targetRoomId: 'sunless-aqueduct', side: 'south', at: 0.5 },
      { targetRoomId: 'ossuary', side: 'north', at: 0.5, kind: 'secret' },
    ],
  },
  {
    roomId: 'ossuary',
    region: 'The Drowned Foundations',
    col: 0,
    row: 0,
    label: 'Ossuary',
    kicker: 'SECRET',
    note: 'A shelf of bones behind the gallery. The dead keep their own door.',
    secret: true,
    doors: [{ targetRoomId: 'drowned-gallery', side: 'south', at: 0.5, kind: 'secret' }],
  },
  {
    roomId: 'sunless-aqueduct',
    region: 'The Drowned Foundations',
    col: 0,
    row: 2,
    label: 'Aqueduct',
    kicker: 'LOW',
    note: 'The old water road. The Hookline waits on the high ledge.',
    doors: [
      { targetRoomId: 'drowned-gallery', side: 'north', at: 0.5 },
      { targetRoomId: 'bellows', side: 'east', at: 0.8 },
    ],
  },
  {
    roomId: 'bellows',
    region: 'The Drowned Foundations',
    col: 1,
    row: 3,
    label: 'Lower Bellows',
    kicker: 'LOW',
    note: 'The lungs of the tower. The shaft breathes above.',
    doors: [
      { targetRoomId: 'sunless-aqueduct', side: 'west', at: 0.1 },
      { targetRoomId: 'belfry-antechamber', side: 'east', at: 0.05 },
      { targetRoomId: 'wall-claw-shaft', side: 'north', at: 0.8 },
    ],
  },
  {
    roomId: 'wall-claw-shaft',
    region: 'The Drowned Foundations',
    col: 1,
    row: 2,
    label: 'Wall-Claw Shaft',
    kicker: 'CLIMB',
    note: 'A climb of rusted beams. The Hookline remembers the way.',
    doors: [
      { targetRoomId: 'bellows', side: 'south', at: 0.8 },
      { targetRoomId: 'upper-gallery', side: 'north', at: 0.25 },
    ],
  },
  {
    roomId: 'upper-gallery',
    region: 'The Upper Belfry',
    col: 1,
    row: 0,
    label: 'Upper Gallery',
    kicker: 'HIGH',
    note: 'The Tide door. It answers only the Tide-Bell.',
    doors: [
      { targetRoomId: 'wall-claw-shaft', side: 'south', at: 0.25 },
      {
        targetRoomId: 'belfry-terrace',
        side: 'east',
        at: 0.85,
        kind: 'drop',
        targetSide: 'north',
        targetAt: 0.25,
      },
      { targetRoomId: 'reliquary', side: 'east', at: 0.5, kind: 'secret' },
      { targetRoomId: 'last-bell', side: 'north', at: 0.5, kind: 'sealed', seal: 'tide' },
    ],
  },
  {
    roomId: 'reliquary',
    region: 'The Upper Belfry',
    col: 2,
    row: 0,
    label: 'Reliquary',
    kicker: 'SECRET',
    note: 'A secret chapel. Something long-reach waits on the ledge.',
    secret: true,
    doors: [{ targetRoomId: 'upper-gallery', side: 'west', at: 0.5, kind: 'secret' }],
  },
  {
    roomId: 'last-bell',
    region: 'The Last Bell',
    col: 1,
    row: -1,
    label: 'The Last Bell',
    kicker: 'ABOVE',
    note: 'The Keeper\u2019s last watch. The great bell has no tongue.',
    doors: [{ targetRoomId: 'upper-gallery', side: 'south', at: 0.5 }],
  },
] as const;

export const MAP_ATLAS_BY_ID: Readonly<Record<string, MapAtlasRoom>> = Object.freeze(
  Object.fromEntries(MAP_ATLAS.map((room) => [room.roomId, room])),
);

/** Placed room bounds in chart pixels. */
export function atlasRect(room: MapAtlasRoom): MapRect {
  return {
    x: room.col * MAP.columnStep * MAP.tileSize,
    y: room.row * MAP.rowStep * MAP.tileSize,
    w: MAP.roomWidth * MAP.tileSize,
    h: MAP.roomHeight * MAP.tileSize,
  };
}

/**
 * Module-load validation. Content growth must deliberately place a room and every one
 * of its walkable doors; a missing entry can never silently omit a region.
 */
function validateAtlas(): void {
  const placed = new Set<string>();
  for (const room of MAP_ATLAS) {
    if (placed.has(room.roomId)) {
      throw new BellwardError(`map atlas places room "${room.roomId}" twice`);
    }
    placed.add(room.roomId);
    const definition = ROOMS[room.roomId];
    if (!definition) {
      throw new BellwardError(`map atlas references unknown room "${room.roomId}"`);
    }
    const exits = definition.exits ?? [];
    const specTargets = new Set<string>();
    for (const door of room.doors) {
      if (door.targetRoomId === room.roomId) {
        throw new BellwardError(`map atlas room "${room.roomId}" has a door to itself`);
      }
      if (!ROOMS[door.targetRoomId]) {
        throw new BellwardError(
          `map atlas room "${room.roomId}" has a door to unknown room "${door.targetRoomId}"`,
        );
      }
      if (!(door.at >= 0 && door.at <= 1)) {
        throw new BellwardError(
          `map atlas door ${room.roomId} -> ${door.targetRoomId} has an out-of-range position`,
        );
      }
      if ((door.targetSide === undefined) !== (door.targetAt === undefined)) {
        throw new BellwardError(
          `map atlas door ${room.roomId} -> ${door.targetRoomId} needs both targetSide and targetAt`,
        );
      }
      if (door.targetAt !== undefined && !(door.targetAt >= 0 && door.targetAt <= 1)) {
        throw new BellwardError(
          `map atlas door ${room.roomId} -> ${door.targetRoomId} has an out-of-range target position`,
        );
      }
      if (specTargets.has(door.targetRoomId)) {
        throw new BellwardError(
          `map atlas room "${room.roomId}" lists two doors to "${door.targetRoomId}"`,
        );
      }
      specTargets.add(door.targetRoomId);
    }
    for (const exit of exits) {
      if (!specTargets.has(exit.targetRoomId)) {
        throw new BellwardError(`map atlas is missing door ${room.roomId} -> ${exit.targetRoomId}`);
      }
    }
    for (const target of specTargets) {
      if (!exits.some((exit) => exit.targetRoomId === target)) {
        throw new BellwardError(
          `map atlas door ${room.roomId} -> ${target} has no matching room exit`,
        );
      }
    }
  }

  for (const room of ALL_ROOMS) {
    if (!placed.has(room.id)) {
      throw new BellwardError(`map atlas does not place room "${room.id}"`);
    }
  }
}

validateAtlas();
