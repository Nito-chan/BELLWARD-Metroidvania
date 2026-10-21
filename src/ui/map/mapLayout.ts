import { BellwardError } from '../../core/Errors';
import { ALL_ROOMS, ROOMS } from '../../data/rooms';

/**
 * Hand-placed constellation for the twelve-room region. Coordinates are percentages
 * inside the map field, not world coordinates: the graph is a stylized region chart,
 * not a minimap. Secret rooms sit off the main westward spine.
 */
export type MapLayoutNode = {
  readonly x: number;
  readonly y: number;
  readonly label: string;
  readonly kicker: string;
};

export const MAP_LAYOUT: Readonly<Record<string, MapLayoutNode>> = {
  'belfry-terrace': { x: 15, y: 50, label: 'Terrace', kicker: 'ENTRY' },
  'belfry-antechamber': { x: 61, y: 50, label: 'Nave', kicker: 'HUB' },
  'bellbearer-arena': { x: 83, y: 22, label: 'Undercroft', kicker: 'I' },
  'warden-arena': { x: 83, y: 50, label: 'Moss Choir', kicker: 'II' },
  'bellthief-arena': { x: 83, y: 78, label: 'Vault', kicker: 'III' },
  'drowned-gallery': { x: 15, y: 71, label: 'Gallery', kicker: 'WEST' },
  'sunless-aqueduct': { x: 30, y: 71, label: 'Aqueduct', kicker: 'LOW' },
  bellows: { x: 45, y: 71, label: 'Bellows', kicker: 'LOW' },
  'wall-claw-shaft': { x: 45, y: 54, label: 'Shaft', kicker: 'CLIMB' },
  'upper-gallery': { x: 30, y: 41, label: 'Upper Gallery', kicker: 'HIGH' },
  reliquary: { x: 30, y: 23, label: 'Reliquary', kicker: 'SECRET' },
  ossuary: { x: 15, y: 88, label: 'Ossuary', kicker: 'SECRET' },
};

// Fail loudly if content grows without a place on the chart (or leaves a stale node).
for (const room of ALL_ROOMS) {
  if (!MAP_LAYOUT[room.id]) {
    throw new BellwardError(`room "${room.id}" has no map layout position`);
  }
}
for (const roomId of Object.keys(MAP_LAYOUT)) {
  if (!ROOMS[roomId]) {
    throw new BellwardError(`map layout references unknown room "${roomId}"`);
  }
}
