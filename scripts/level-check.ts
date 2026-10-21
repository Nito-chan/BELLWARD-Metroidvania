/**
 * Level contract check. Run after content edits; it is intentionally stricter than the
 * runtime room validator. A room can be internally valid yet still strand a pickup, point
 * an exit at a blocked spawn, or leave a boss two rooms from the nearest bench.
 */
import { PICKUP } from '../src/config/pickups';
import { BENCHES } from '../src/data/benches';
import { PICKUP_IDS, PICKUPS, type PickupKind } from '../src/data/pickups';
import { ALL_ROOMS, DEFAULT_ROOM_ID, getRoom } from '../src/data/rooms';
import { MAP_LAYOUT } from '../src/ui/map/mapLayout';
import { createRoom, isStandingPoint } from '../src/world/Room';
import type { RoomDefinition } from '../src/world/Room';
import type { Tilemap } from '../src/world/Tilemap';

const REQUIRED_ROOMS = [
  'belfry-terrace',
  'belfry-antechamber',
  'bellbearer-arena',
  'warden-arena',
  'bellthief-arena',
  'drowned-gallery',
  'sunless-aqueduct',
  'bellows',
  'wall-claw-shaft',
  'upper-gallery',
  'ossuary',
  'reliquary',
] as const;

const errors: string[] = [];
const fail = (message: string): void => {
  errors.push(message);
};

const check = (condition: boolean, message: string): void => {
  if (!condition) fail(message);
};

function solidTopAt(tilemap: Tilemap, x: number, fromY: number): number | null {
  const tx = Math.floor(x / 16);
  const start = Math.max(0, Math.floor(fromY / 16));
  for (let ty = start; ty < tilemap.height; ty += 1) {
    if (tilemap.isSolid(tx, ty)) return ty * 16;
  }
  return null;
}

function checkPickupSupport(room: RoomDefinition, pickupId: string, x: number, y: number): void {
  const tilemap = createRoom(room).tilemap;
  if (tilemap.isSolid(Math.floor(x / 16), Math.floor(y / 16))) {
    fail(`${room.id}/${pickupId} sits inside solid geometry`);
    return;
  }
  const support = solidTopAt(tilemap, x, y);
  const dropped =
    solidTopAt(tilemap, x - PICKUP.radiusX, y) ?? solidTopAt(tilemap, x + PICKUP.radiusX, y);
  const closest = support ?? dropped;
  if (closest === null || closest < y || closest - y > PICKUP.radiusY + 2) {
    fail(`${room.id}/${pickupId} has no reachable support within the pickup aura`);
  }
}

function directedCycles(): boolean {
  const state = new Map<string, 0 | 1 | 2>();
  const walk = (id: string): boolean => {
    state.set(id, 1);
    for (const exit of getRoom(id).exits ?? []) {
      const next = state.get(exit.targetRoomId) ?? 0;
      if (next === 1) return true;
      if (next === 0 && walk(exit.targetRoomId)) return true;
    }
    state.set(id, 2);
    return false;
  };
  return walk(DEFAULT_ROOM_ID);
}

function undirectedDistances(from: string): Map<string, number> {
  const adjacency = new Map<string, Set<string>>();
  for (const room of ALL_ROOMS) adjacency.set(room.id, new Set());
  for (const room of ALL_ROOMS) {
    for (const exit of room.exits ?? []) {
      adjacency.get(room.id)?.add(exit.targetRoomId);
      adjacency.get(exit.targetRoomId)?.add(room.id);
    }
  }
  const distance = new Map<string, number>([[from, 0]]);
  const queue = [from];
  while (queue.length > 0) {
    const id = queue.shift() as string;
    const nextDistance = (distance.get(id) ?? 0) + 1;
    for (const next of adjacency.get(id) ?? []) {
      if (distance.has(next)) continue;
      distance.set(next, nextDistance);
      queue.push(next);
    }
  }
  return distance;
}

function checkReachability(): void {
  const seen = new Set<string>([DEFAULT_ROOM_ID]);
  const queue = [DEFAULT_ROOM_ID];
  while (queue.length > 0) {
    const id = queue.shift() as string;
    for (const exit of getRoom(id).exits ?? []) {
      if (seen.has(exit.targetRoomId)) continue;
      seen.add(exit.targetRoomId);
      queue.push(exit.targetRoomId);
    }
  }
  for (const room of ALL_ROOMS)
    check(seen.has(room.id), `room "${room.id}" is unreachable from the terrace`);
}

function checkBenchProximity(): void {
  const benchRooms = new Set([...BENCHES.values()].map((bench) => bench.roomId));
  for (const room of ALL_ROOMS) {
    if (!room.boss) continue;
    const distances = undirectedDistances(room.id);
    const nearest = Math.min(
      ...[...benchRooms].map((id) => distances.get(id) ?? Number.POSITIVE_INFINITY),
    );
    check(nearest <= 2, `boss room "${room.id}" is ${nearest} rooms from the nearest bench`);
  }
}

function checkContent(): void {
  const placements = new Map<string, string>();
  let breakableRooms = 0;
  let sealedRooms = 0;
  let endings = 0;

  for (const room of ALL_ROOMS) {
    const instance = createRoom(room);
    for (const pickup of room.pickups ?? []) {
      if (placements.has(pickup.id)) {
        fail(
          `pickup "${pickup.id}" is placed in both "${placements.get(pickup.id)}" and "${room.id}"`,
        );
      }
      placements.set(pickup.id, room.id);
      if (!PICKUP_IDS.includes(pickup.id)) fail(`${room.id} places unknown pickup "${pickup.id}"`);
      checkPickupSupport(room, pickup.id, pickup.x, pickup.y);
    }
    let breakable = 0;
    let sealed = 0;
    instance.tilemap.forEachTile((_x, _y, role) => {
      if (role === 'breakable') breakable += 1;
      if (role === 'sealedDoor') sealed += 1;
    });
    if (breakable > 0) breakableRooms += 1;
    if (sealed > 0) sealedRooms += 1;
    if (room.ending) endings += 1;
    if (room.ordeal) check(Boolean(room.boss), `${room.id} has an Ordeal without a boss`);
  }

  for (const id of PICKUP_IDS) {
    check(placements.has(id), `pickup "${id}" exists in the registry but is not placed`);
  }
  check(
    placements.size === PICKUP_IDS.length,
    `placed pickup count ${placements.size} != registry ${PICKUP_IDS.length}`,
  );
  check(breakableRooms === 2, `expected 2 breakable-secret rooms, found ${breakableRooms}`);
  check(sealedRooms === 1, `expected 1 sealed-door room, found ${sealedRooms}`);
  check(endings === 1, `expected 1 ending trigger, found ${endings}`);

  const byKind = (kind: PickupKind): number =>
    Object.values(PICKUPS).filter((pickup) => pickup.kind === kind).length;
  check(byKind('healthShard') === 4, `expected 4 mask shards, found ${byKind('healthShard')}`);
  check(byKind('charm') === 5, `expected 5 charms, found ${byKind('charm')}`);
  check(byKind('ability') === 1, `expected 1 traversal ability, found ${byKind('ability')}`);
  check(byKind('key') === 1, `expected 1 key, found ${byKind('key')}`);

  check(
    PICKUPS['aqueduct-wall-claw']?.kind === 'ability',
    'the Wall Claw must remain an ability pickup',
  );
  const tideBell = PICKUPS['bellthief-tide-bell'];
  check(tideBell?.kind === 'key', 'the Tide-Bell must remain a key pickup');
  check(tideBell?.requiresSigil === 'bellThief', 'the Tide-Bell must require the Bell Thief sigil');

  const upper = getRoom('upper-gallery');
  check(
    upper.ending?.requiresPickup === 'bellthief-tide-bell',
    'the Tide door must require the Tide-Bell',
  );

  const bossRooms = ALL_ROOMS.filter((room) => room.boss);
  check(bossRooms.length === 3, `expected 3 boss rooms, found ${bossRooms.length}`);
  check(
    bossRooms.every((room) => room.ordeal !== undefined),
    'every boss arena needs an Ordeal altar trigger',
  );
}

function checkBenches(): void {
  const ids = new Set<string>();
  for (const room of ALL_ROOMS) {
    for (const bench of room.benches ?? []) {
      check(!ids.has(bench.id), `duplicate bench id "${bench.id}"`);
      ids.add(bench.id);
      const instance = createRoom(room);
      check(
        isStandingPoint(instance.tilemap, bench.spawn, { w: 18, h: 48 }),
        `${room.id}/${bench.id} spawn is not standing`,
      );
      check(
        instance.tilemap.isSolid(Math.floor(bench.x / 16), Math.floor(bench.y / 16)),
        `${room.id}/${bench.id} is not on solid ground`,
      );
    }
  }
  check(ids.size === BENCHES.size, `${ids.size} bench rows but ${BENCHES.size} indexed benches`);
  check(ids.size >= 3, `expected at least 3 benches, found ${ids.size}`);
}

function checkRooms(): void {
  check(ALL_ROOMS.length === 12, `expected 12 rooms, found ${ALL_ROOMS.length}`);
  for (const id of REQUIRED_ROOMS) {
    check(
      ALL_ROOMS.some((room) => room.id === id),
      `missing required room "${id}"`,
    );
  }
  for (const room of ALL_ROOMS) {
    const instance = createRoom(room);
    check(
      isStandingPoint(instance.tilemap, room.spawn, { w: 18, h: 48 }),
      `${room.id} spawn is not standing`,
    );
    check(MAP_LAYOUT[room.id] !== undefined, `${room.id} has no map position`);
    for (const exit of room.exits ?? []) {
      const target = createRoom(getRoom(exit.targetRoomId));
      check(
        isStandingPoint(target.tilemap, exit.spawn, { w: 18, h: 48 }),
        `${room.id} -> ${exit.targetRoomId} spawn is not standing`,
      );
    }
  }
  check(directedCycles(), 'the room graph has no cycle; the region cannot loop');
}

function main(): void {
  const order = new Map(REQUIRED_ROOMS.map((id, index) => [id, index]));
  const ids = ALL_ROOMS.map((room) => room.id);
  check(new Set(ids).size === ids.length, 'duplicate room ids');
  for (const id of ids)
    check(order.has(id as (typeof REQUIRED_ROOMS)[number]), `unexpected room "${id}"`);

  checkRooms();
  checkReachability();
  checkBenches();
  checkBenchProximity();
  checkContent();

  if (errors.length > 0) {
    console.error(`level:check failed with ${errors.length} issue(s):`);
    for (const error of errors) console.error(`  - ${error}`);
    process.exitCode = 1;
    return;
  }
  console.log(
    `level:check ok — ${ALL_ROOMS.length} rooms, ${PICKUP_IDS.length} pickups, ${BENCHES.size} benches, 3 Ordeals.`,
  );
}

main();
