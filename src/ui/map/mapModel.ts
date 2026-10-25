/**
 * Pure Tideglass model. Every visible fact comes from durable run progress plus the
 * authored atlas; the screen never reads room internals or invents a connection.
 */
import { MAP, type MapPin } from '../../config/map';
import { BOSS_KINDS, ENEMIES, type BossKind } from '../../config/enemies';
import { RENDER } from '../../config/render';
import { getRoom } from '../../data/rooms';
import type { RoomExit } from '../../world/Room';
import {
  MAP_ATLAS,
  MAP_ATLAS_BY_ID,
  atlasRect,
  type MapAtlasDoor,
  type MapAtlasRoom,
} from './mapAtlas';
import { buildRoomGeometry } from './mapGeometry';
import type {
  MapDoorKind,
  MapDoorSnapshot,
  MapDoorState,
  MapLinkSnapshot,
  MapLinkState,
  MapRect,
  MapRoomSnapshot,
  MapRoomState,
  MapSide,
  MapSnapshot,
} from './mapTypes';

export type MapModelInput = {
  readonly currentRoomId: string;
  readonly playerPosition: { readonly x: number; readonly y: number } | null;
  readonly visitedRoomIds: readonly string[];
  readonly sigils: readonly BossKind[];
  readonly checkpoint: { readonly name: string; readonly roomId: string } | null;
  readonly pickups: readonly string[];
  readonly brokenSecrets: readonly string[];
  readonly pins: readonly MapPin[];
  readonly tideglass: boolean;
  readonly tideDoorOpened: boolean;
  readonly endingSeen: boolean;
  readonly arsenal: boolean;
  readonly hasTideBell: boolean;
};

type DoorCandidate = {
  readonly source: MapAtlasRoom;
  readonly door: MapAtlasDoor;
  readonly kind: MapDoorKind;
  readonly requirement: string | null;
  readonly targetState: MapRoomState;
};

const RITUAL_BELLS: readonly BossKind[] = BOSS_KINDS.filter((kind) => kind !== 'lastKeeper');

/** Builds the render data for the Tideglass from durable run facts only. */
export function buildMapSnapshot(input: MapModelInput): MapSnapshot {
  const visited = new Set(input.visitedRoomIds);
  visited.add(input.currentRoomId);
  const sigils = new Set(input.sigils);
  const collected = new Set(input.pickups);
  const broken = new Set(input.brokenSecrets);
  const pinned = new Set(input.pins.map((pin) => pin.roomId));

  const states = new Map<string, MapRoomState>();
  for (const atlas of MAP_ATLAS) {
    states.set(
      atlas.roomId,
      atlas.roomId === input.currentRoomId
        ? 'current'
        : visited.has(atlas.roomId)
          ? 'charted'
          : 'unheard',
    );
  }

  // A ghost is only revealed through a door in a charted room. Secret seams must be
  // broken (or the room already entered) before their destination can even be a ghost.
  for (const atlas of MAP_ATLAS) {
    if (!isCharted(states.get(atlas.roomId))) continue;
    for (const door of atlas.doors) {
      if (!doorVisible(atlas, door, visited, broken)) continue;
      if (states.get(door.targetRoomId) === 'unheard') {
        states.set(door.targetRoomId, 'ghost');
      }
    }
  }

  const rooms = MAP_ATLAS.map((atlas) =>
    buildRoom(atlas, {
      input,
      state: states.get(atlas.roomId) ?? 'unheard',
      states,
      visited,
      sigils,
      collected,
      broken,
      pinned,
    }),
  );

  const candidates: DoorCandidate[] = [];
  for (const atlas of MAP_ATLAS) {
    const sourceState = states.get(atlas.roomId);
    if (!isCharted(sourceState)) continue;
    for (const door of atlas.doors) {
      if (!doorVisible(atlas, door, visited, broken)) continue;
      const targetState = states.get(door.targetRoomId);
      if (targetState === undefined || targetState === 'unheard') continue;
      const target = MAP_ATLAS_BY_ID[door.targetRoomId];
      if (!target) continue;
      const definition = getRoom(atlas.roomId);
      const exit = (definition.exits ?? []).find(
        (entry) => entry.targetRoomId === door.targetRoomId,
      );
      if (!exit) continue;
      const requirement = doorRequirement(exit, door, input);
      candidates.push({
        source: atlas,
        door,
        kind: requirement ? 'sealed' : doorKind(door, target),
        requirement,
        targetState,
      });
    }
  }
  const links = buildLinks(candidates, states);

  const chartedCount = rooms.filter((room) => isCharted(room.state)).length;
  const ghostCount = rooms.filter((room) => room.state === 'ghost').length;
  const sweptCount = rooms.filter((room) => isCharted(room.state) && room.swept).length;
  const sealedCount = links.filter((link) => link.state === 'sealed').length;
  const sigilCount = RITUAL_BELLS.filter((kind) => sigils.has(kind)).length;
  const visiblePins = input.pins.filter((pin) => isCharted(states.get(pin.roomId)));

  const currentAtlas = MAP_ATLAS_BY_ID[input.currentRoomId];
  const currentRect = currentAtlas ? atlasRect(currentAtlas) : null;
  const currentPosition =
    currentRect !== null ? worldToChart(currentRect, input.playerPosition) : null;

  return {
    rooms,
    links,
    currentRoomId: input.currentRoomId,
    currentPosition,
    bounds: atlasBounds(),
    chartedCount,
    totalCount: rooms.length,
    ghostCount,
    sealedCount,
    sweptCount,
    sigilCount: input.sigils.length,
    bossCount: BOSS_KINDS.length,
    checkpoint: input.checkpoint,
    lead: leadFor(input, sigilCount),
    pins: visiblePins,
    pinCount: visiblePins.length,
    pinLimit: MAP.pinLimit,
    tideglass: input.tideglass,
    endingSeen: input.endingSeen,
    hasTideBell: input.hasTideBell,
    arsenal: input.arsenal,
  };
}

type BuildContext = {
  readonly input: MapModelInput;
  readonly state: MapRoomState;
  readonly states: ReadonlyMap<string, MapRoomState>;
  readonly visited: ReadonlySet<string>;
  readonly sigils: ReadonlySet<BossKind>;
  readonly collected: ReadonlySet<string>;
  readonly broken: ReadonlySet<string>;
  readonly pinned: ReadonlySet<string>;
};

function buildRoom(atlas: MapAtlasRoom, context: BuildContext): MapRoomSnapshot {
  const definition = getRoom(atlas.roomId);
  const state = context.state;
  const seen = isCharted(state);
  const rect = atlasRect(atlas);
  const charted = state === 'current' || state === 'charted';
  const collected = (definition.pickups ?? []).filter((pickup) =>
    context.collected.has(pickup.id),
  ).length;
  const pickupTotal = definition.pickups?.length ?? 0;
  const boss = definition.boss ?? null;
  const bossClaimed = boss ? context.sigils.has(boss) : false;
  const benchName = definition.benches?.[0]?.name ?? null;

  if (!seen) {
    const ghost = state === 'ghost';
    return {
      roomId: atlas.roomId,
      name: ghost ? 'Uncharted chamber' : 'Unheard',
      label: ghost ? 'Uncharted' : 'Unheard',
      kicker: '?',
      region: atlas.region,
      note: ghost
        ? 'A door in a charted room opens toward this place. The glass has not touched it.'
        : 'The glass is dark here.',
      row: atlas.row,
      col: atlas.col,
      state,
      swept: false,
      rect,
      geometry: null,
      exits: [],
      benchName: null,
      bossName: null,
      bossKind: null,
      bossClaimed: false,
      pickupTotal: 0,
      pickupFound: 0,
      secret: atlas.secret === true,
      secretFound: false,
      remainingBoss: false,
      remainingPickups: 0,
      remainingSecret: false,
      pinned: false,
      ariaLabel: ghost
        ? 'Uncharted chamber. A door in a charted room opens toward it.'
        : 'Unheard place.',
    };
  }

  const secretTargets = atlas.doors
    .map((door) => MAP_ATLAS_BY_ID[door.targetRoomId])
    .filter((target): target is MapAtlasRoom => target?.secret === true);
  const secretFound =
    secretTargets.some((target) => context.visited.has(target.roomId)) ||
    context.broken.has(atlas.roomId);
  const secretRemains = secretTargets.length > 0 && !secretFound;
  const remainingBoss = boss !== null && !bossClaimed;
  const remainingPickups = Math.max(0, pickupTotal - collected);
  const hasObjectives = pickupTotal > 0 || boss !== null || secretTargets.length > 0;
  const swept =
    charted && hasObjectives && !remainingBoss && remainingPickups === 0 && !secretRemains;

  const exits: MapDoorSnapshot[] = [];
  for (const exit of definition.exits ?? []) {
    const door = atlas.doors.find((entry) => entry.targetRoomId === exit.targetRoomId);
    if (!door) continue;
    if (!doorVisible(atlas, door, context.visited, context.broken)) continue;
    const targetAtlas = MAP_ATLAS_BY_ID[exit.targetRoomId];
    const targetState = context.states.get(exit.targetRoomId) ?? 'unheard';
    const targetName =
      targetAtlas && isCharted(targetState) ? getRoom(targetAtlas.roomId).name : null;
    const requirement = doorRequirement(exit, door, context.input);
    const kind: MapDoorKind = requirement ? 'sealed' : doorKind(door, targetAtlas);
    const doorState: MapDoorState = requirement
      ? 'sealed'
      : kind === 'drop'
        ? 'drop'
        : kind === 'secret'
          ? 'secret'
          : targetName === null
            ? 'unknown'
            : 'open';
    exits.push({
      targetRoomId: exit.targetRoomId,
      targetName,
      side: door.side,
      at: door.at,
      kind,
      state: doorState,
      requirement,
      ariaLabel: doorAria(door.side, targetName, doorState, requirement),
    });
  }

  const pin = context.pinned.has(atlas.roomId);
  const ariaParts = [
    definition.name,
    state === 'current' ? 'current chamber' : 'charted',
    swept ? 'swept' : '',
    benchName ? `rest point ${benchName}` : '',
    boss ? `bell ${ENEMIES[boss].displayName} ${bossClaimed ? 'claimed' : 'unclaimed'}` : '',
    remainingPickups > 0
      ? `${remainingPickups} pickup${remainingPickups === 1 ? '' : 's'} remain`
      : '',
    secretRemains ? 'secret seam still unbroken' : '',
    pin ? 'marked in wax' : '',
  ].filter((part) => part.length > 0);

  return {
    roomId: atlas.roomId,
    name: definition.name,
    label: atlas.label,
    kicker: atlas.kicker,
    region: atlas.region,
    note: atlas.note,
    row: atlas.row,
    col: atlas.col,
    state,
    swept,
    rect,
    geometry: buildRoomGeometry(definition, {
      secretBroken: context.broken.has(atlas.roomId),
      sealOpen: context.input.hasTideBell,
    }),
    exits,
    benchName,
    bossName: boss ? ENEMIES[boss].displayName : null,
    bossKind: boss,
    bossClaimed,
    pickupTotal,
    pickupFound: collected,
    secret: atlas.secret === true,
    secretFound: atlas.secret === true ? true : secretFound,
    remainingBoss,
    remainingPickups,
    remainingSecret: secretRemains,
    pinned: pin,
    ariaLabel: `${ariaParts.join('. ')}.`,
  };
}

function buildLinks(
  candidates: readonly DoorCandidate[],
  states: ReadonlyMap<string, MapRoomState>,
): MapLinkSnapshot[] {
  const pairs = new Map<string, DoorCandidate[]>();
  for (const candidate of candidates) {
    const key = pairKey(candidate.source.roomId, candidate.door.targetRoomId);
    const list = pairs.get(key);
    if (list) list.push(candidate);
    else pairs.set(key, [candidate]);
  }

  const links: MapLinkSnapshot[] = [];
  for (const [key, list] of pairs) {
    const first = list[0];
    if (!first) continue;
    const sealed = list.find((candidate) => candidate.requirement !== null);
    const chosen =
      sealed ??
      list.find((candidate) => candidate.kind === 'secret') ??
      list.find((candidate) => candidate.kind === 'drop') ??
      list.find((candidate) => candidate.kind === 'bell') ??
      first;
    const targetAtlas = MAP_ATLAS_BY_ID[chosen.door.targetRoomId];
    if (!targetAtlas) continue;

    const fromRect = atlasRect(chosen.source);
    const toRect = atlasRect(targetAtlas);
    const fromPoint = edgePoint(fromRect, chosen.door.side, chosen.door.at);
    const reverse = list.find(
      (candidate) =>
        candidate.source.roomId === targetAtlas.roomId &&
        candidate.door.targetRoomId === chosen.source.roomId,
    );
    const targetSide = reverse?.door.side ?? chosen.door.targetSide ?? opposite(chosen.door.side);
    const targetAt = reverse?.door.at ?? chosen.door.targetAt ?? chosen.door.at;
    const toPoint = edgePoint(toRect, targetSide, targetAt);

    const targetState = states.get(targetAtlas.roomId) ?? 'unheard';
    const sourceState = states.get(chosen.source.roomId) ?? 'unheard';
    const ghost = sourceState === 'ghost' || targetState === 'ghost';
    const kind = chosen.requirement
      ? 'sealed'
      : list.some((candidate) => candidate.kind === 'secret')
        ? 'secret'
        : list.some((candidate) => candidate.kind === 'drop')
          ? 'drop'
          : list.some((candidate) => candidate.kind === 'bell')
            ? 'bell'
            : 'open';
    const state: MapLinkState = chosen.requirement
      ? 'sealed'
      : ghost
        ? 'ghost'
        : kind === 'secret'
          ? 'secret'
          : kind === 'drop'
            ? 'drop'
            : 'open';

    links.push({
      id: key,
      from: chosen.source.roomId,
      to: targetAtlas.roomId,
      fromPoint,
      toPoint,
      midPoint: {
        x: (fromPoint.x + toPoint.x) / 2,
        y: (fromPoint.y + toPoint.y) / 2,
      },
      path: linkPath(fromPoint, toPoint),
      state,
      kind,
      oneWay:
        kind === 'drop' ||
        !list.some(
          (candidate) =>
            candidate.source.roomId === targetAtlas.roomId &&
            candidate.door.targetRoomId === chosen.source.roomId,
        ),
      requirement: chosen.requirement,
    });
  }
  return links.sort((a, b) => a.id.localeCompare(b.id));
}

function doorKind(door: MapAtlasDoor, target: MapAtlasRoom | undefined): MapDoorKind {
  if (door.kind) return door.kind;
  return target ? (getRoom(target.roomId).boss ? 'bell' : 'open') : 'open';
}

function doorRequirement(exit: RoomExit, door: MapAtlasDoor, input: MapModelInput): string | null {
  const missing: string[] = [];
  if (door.seal === 'tide') {
    if (!input.hasTideBell) missing.push('the Tide-Bell');
    if (!input.arsenal) missing.push('the Ward of Four');
  } else if (exit.requiresArsenal || door.seal === 'arsenal') {
    if (!input.arsenal) missing.push('the Ward of Four');
  }
  if (missing.length === 0) return null;
  if (missing.length === 1) return missing[0] ?? null;
  return `${missing[0]} and ${missing[1]}`;
}

function doorVisible(
  source: MapAtlasRoom,
  door: MapAtlasDoor,
  visited: ReadonlySet<string>,
  broken: ReadonlySet<string>,
): boolean {
  const target = MAP_ATLAS_BY_ID[door.targetRoomId];
  if (!target?.secret) return true;
  return visited.has(target.roomId) || broken.has(source.roomId);
}

function doorAria(
  side: MapSide,
  targetName: string | null,
  state: MapDoorState,
  requirement: string | null,
): string {
  const target = targetName ?? 'an uncharted chamber';
  if (state === 'sealed')
    return `${sideLabel(side)} passage to ${target}, sealed until ${requirement}.`;
  if (state === 'unknown') return `${sideLabel(side)} passage to ${target}, beyond the glass.`;
  if (state === 'secret') return `${sideLabel(side)} hidden seam to ${target}.`;
  if (state === 'drop') return `${sideLabel(side)} one-way drop to ${target}.`;
  return `${sideLabel(side)} passage to ${target}, open.`;
}

function sideLabel(side: MapSide): string {
  if (side === 'north') return 'North';
  if (side === 'east') return 'East';
  if (side === 'south') return 'South';
  return 'West';
}

function opposite(side: MapSide): MapSide {
  if (side === 'north') return 'south';
  if (side === 'south') return 'north';
  if (side === 'east') return 'west';
  return 'east';
}

function edgePoint(rect: MapRect, side: MapSide, at: number): { x: number; y: number } {
  const t = Math.max(0, Math.min(1, at));
  if (side === 'west') return { x: rect.x, y: rect.y + rect.h * t };
  if (side === 'east') return { x: rect.x + rect.w, y: rect.y + rect.h * t };
  if (side === 'north') return { x: rect.x + rect.w * t, y: rect.y };
  return { x: rect.x + rect.w * t, y: rect.y + rect.h };
}

function linkPath(from: { x: number; y: number }, to: { x: number; y: number }): string {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const bend = Math.max(8, Math.min(30, Math.hypot(dx, dy) * 0.26));
  if (Math.abs(dx) >= Math.abs(dy)) {
    const sign = Math.sign(dx) || 1;
    return `M ${from.x} ${from.y} C ${from.x + sign * bend} ${from.y}, ${to.x - sign * bend} ${to.y}, ${to.x} ${to.y}`;
  }
  const sign = Math.sign(dy) || 1;
  return `M ${from.x} ${from.y} C ${from.x} ${from.y + sign * bend}, ${to.x} ${to.y - sign * bend}, ${to.x} ${to.y}`;
}

function pairKey(a: string, b: string): string {
  return a < b ? `${a}--${b}` : `${b}--${a}`;
}

function atlasBounds(): MapRect {
  const rects = MAP_ATLAS.map(atlasRect);
  const minX = Math.min(...rects.map((rect) => rect.x));
  const minY = Math.min(...rects.map((rect) => rect.y));
  const maxX = Math.max(...rects.map((rect) => rect.x + rect.w));
  const maxY = Math.max(...rects.map((rect) => rect.y + rect.h));
  const pad = MAP.tileSize * 2;
  return { x: minX - pad, y: minY - pad, w: maxX - minX + pad * 2, h: maxY - minY + pad * 2 };
}

function worldToChart(
  rect: MapRect,
  position: { readonly x: number; readonly y: number } | null,
): { x: number; y: number } {
  if (!position) {
    return { x: rect.x + rect.w / 2, y: rect.y + rect.h * 0.78 };
  }
  const x = rect.x + clamp((position.x / RENDER.tileSize) * MAP.tileSize, 0, rect.w);
  const y = rect.y + clamp((position.y / RENDER.tileSize) * MAP.tileSize, 0, rect.h);
  return { x, y };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function isCharted(state: MapRoomState | undefined): boolean {
  return state === 'current' || state === 'charted';
}

function leadFor(input: MapModelInput, sigilCount: number): string {
  if (!input.tideglass) return 'The glass is dark. It waits on the Weeping Stone.';
  if (input.endingSeen) return 'The Last Bell has answered. Nothing on this chart is waiting.';
  if (sigilCount < RITUAL_BELLS.length) {
    const remaining = RITUAL_BELLS.length - sigilCount;
    return sigilCount === 0
      ? 'Three bells wait in the Nave. The east doors are warm.'
      : `${remaining} bell${remaining === 1 ? '' : 's'} still silent. The Nave remembers all three.`;
  }
  if (!input.arsenal) return 'Three bells are yours. The Ward of Four is not yet whole.';
  if (!input.hasTideBell) {
    return 'The Tide door waits in the Upper Gallery. The Tide-Bell is still in the Vault.';
  }
  if (!input.tideDoorOpened) {
    return 'The Tide-Bell answers. The sealed door in the Upper Gallery is open.';
  }
  return 'The Last Bell waits above. The Keeper has not rung it.';
}
