import { BellwardError } from '../../core/Errors';
import type { RoomDefinition } from '../../world/Room';
import { belfryAntechamber } from './belfry-antechamber';
import { belfryTerrace } from './belfry-terrace';
import { bellbearerArena, bellthiefArena, wardenArena } from './boss-arenas';
import { DROWNED_ROOMS } from './drowned-rooms';

/** Every room in the vertical slice, keyed by its stable save id. */
export const ROOMS: Readonly<Record<string, RoomDefinition>> = {
  'belfry-terrace': belfryTerrace,
  'belfry-antechamber': belfryAntechamber,
  'bellbearer-arena': bellbearerArena,
  'warden-arena': wardenArena,
  'bellthief-arena': bellthiefArena,
  ...Object.fromEntries(DROWNED_ROOMS.map((room) => [room.id, room])),
};

export const DEFAULT_ROOM_ID = 'belfry-terrace';

export const ALL_ROOMS: readonly RoomDefinition[] = Object.values(ROOMS);

/** Resolves a room by id. Throws loudly so a broken door can never load an empty scene. */
export function getRoom(id: string): RoomDefinition {
  const room = ROOMS[id];
  if (!room) throw new BellwardError(`unknown room "${id}"`);
  return room;
}

/** Build-time graph check: every exit must point at a real room. */
for (const room of ALL_ROOMS) {
  for (const exit of room.exits ?? []) {
    if (!ROOMS[exit.targetRoomId]) {
      throw new BellwardError(`room "${room.id}" exit targets unknown room "${exit.targetRoomId}"`);
    }
  }
}
