import { BOSS_KINDS, ENEMIES, type BossKind } from '../../config/enemies';
import { ALL_ROOMS, ROOMS, getRoom } from '../../data/rooms';
import { MAP_LAYOUT } from './mapLayout';
import type { MapLinkSnapshot, MapNodeSnapshot, MapSnapshot } from './mapTypes';

export type MapModelInput = {
  readonly currentRoomId: string;
  readonly visitedRoomIds: readonly string[];
  readonly sigils: readonly BossKind[];
  readonly checkpoint: { readonly name: string; readonly roomId: string } | null;
};

type RoomLink = { readonly from: string; readonly to: string };

const ROOM_LINKS: readonly RoomLink[] = collectLinks();

/** Builds the render data for the pause-flow map from durable run facts only. */
export function buildMapSnapshot(input: MapModelInput): MapSnapshot {
  const visited = new Set(input.visitedRoomIds);
  visited.add(input.currentRoomId);
  const claimed = new Set(input.sigils);
  const checkpoint = input.checkpoint;
  const nodes: MapNodeSnapshot[] = ALL_ROOMS.map((room) => {
    const layout = MAP_LAYOUT[room.id];
    if (!layout) throw new Error(`missing map layout for "${room.id}"`);

    const isCurrent = room.id === input.currentRoomId;
    const isVisited = visited.has(room.id);
    const state = isCurrent ? 'current' : isVisited ? 'visited' : 'unknown';
    const bossName = room.boss ? ENEMIES[room.boss].displayName : null;
    const signatureClaimed = room.boss ? claimed.has(room.boss) : false;
    const restPoint = checkpoint?.roomId === room.id;
    const detail = mapDetail(state, bossName, signatureClaimed);
    const pieces = isVisited ? [room.name, detail] : ['Uncharted chamber'];
    if (isVisited && bossName && !signatureClaimed) pieces.push(bossName);
    if (restPoint) pieces.push('rest point');

    return {
      roomId: room.id,
      label: isVisited ? layout.label : 'Unknown',
      kicker: isVisited ? layout.kicker : '?',
      state,
      detail: isVisited ? detail : 'Uncharted',
      ariaLabel: pieces.join(', '),
      x: layout.x,
      y: layout.y,
      restPoint,
    };
  });

  const links: MapLinkSnapshot[] = ROOM_LINKS.map((link) => ({
    ...link,
    revealed: visited.has(link.from) && visited.has(link.to),
  }));

  const checkpointRoom = checkpoint ? ROOMS[checkpoint.roomId] : undefined;
  return {
    nodes,
    links,
    currentRoomId: input.currentRoomId,
    visitedCount: nodes.filter((node) => node.state !== 'unknown').length,
    totalCount: nodes.length,
    sigilCount: claimed.size,
    bossCount: BOSS_KINDS.length,
    checkpoint: checkpoint ? { name: checkpoint.name, roomName: checkpointRoom?.name ?? '' } : null,
  };
}

function mapDetail(
  state: 'current' | 'visited' | 'unknown',
  bossName: string | null,
  claimed: boolean,
): string {
  if (state === 'current') return 'You are here';
  if (state === 'unknown') return 'Uncharted';
  if (claimed) return 'Sigil claimed';
  if (bossName) return 'The bell waits';
  return 'Charted';
}

/** Deduplicated undirected edges from the authored exit graph (terrace↔nave, nave↔arenas). */
function collectLinks(): readonly RoomLink[] {
  const seen = new Set<string>();
  const links: RoomLink[] = [];
  for (const room of ALL_ROOMS) {
    for (const exit of getRoom(room.id).exits ?? []) {
      if (exit.targetRoomId === room.id) continue;
      const [from, to] = [room.id, exit.targetRoomId].sort();
      if (!from || !to) continue;
      const key = `${from}>${to}`;
      if (seen.has(key)) continue;
      seen.add(key);
      links.push({ from, to });
    }
  }
  return links;
}
