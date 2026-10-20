import { BellwardError } from '../../core/Errors';
import { ALL_ROOMS, ROOMS } from '../../data/rooms';

/**
 * Hand-placed constellation for the five-room slice. Coordinates are percentages inside
 * the map field, not world coordinates: the graph is a stylized region chart, not a minimap.
 */
export type MapLayoutNode = {
  readonly x: number;
  readonly y: number;
  readonly label: string;
  readonly kicker: string;
};

export const MAP_LAYOUT: Readonly<Record<string, MapLayoutNode>> = {
  'belfry-terrace': { x: 13, y: 50, label: 'Terrace', kicker: 'ENTRY' },
  'belfry-antechamber': { x: 41, y: 50, label: 'Nave', kicker: 'HUB' },
  'bellbearer-arena': { x: 80, y: 17, label: 'Undercroft', kicker: 'I' },
  'warden-arena': { x: 80, y: 50, label: 'Moss Choir', kicker: 'II' },
  'bellthief-arena': { x: 80, y: 83, label: 'Vault', kicker: 'III' },
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
