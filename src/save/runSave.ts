/**
 * The persisted run document. It stores durable run facts only: the last safe room/spawn,
 * masks, claimed sigils, charted rooms, the bench checkpoint, collectibles, shards,
 * charms, nail level, broken secret walls, cleared Ordeals and the ending flag. Enemies,
 * projectiles and boss phase timers intentionally reset, exactly as on a room transition.
 *
 * Loading is all-or-nothing. A v1 document is migrated in place (same storage key); a
 * corrupt, partial or future-versioned document starts a fresh run instead of booting
 * into an impossible state. Storage failures never break play.
 */
import { BOSS_REWARDS } from '../config/bossTypes';
import { COMBAT } from '../config/combat';
import { BOSS_KINDS, type BossKind } from '../config/enemies';
import { PLAYER } from '../config/player';
import { MAP, isMapPinKind, type MapPin } from '../config/map';
import { CHARMS, CHARM_SLOTS, CHARM_ORDER, NAIL, type CharmId } from '../config/progression';
import { SAVE } from '../config/save';
import { BellwardError } from '../core/Errors';
import { BENCHES } from '../data/benches';
import { healthShardCount, isPickupId, PICKUPS, getPickup } from '../data/pickups';
import { ALL_ROOMS, ROOMS } from '../data/rooms';
import { createRoom, isStandingPoint, type RoomSpawn } from '../world/Room';

export type SaveReason =
  'boot' | 'room' | 'bench' | 'reward' | 'respawn' | 'debug' | 'ending' | 'map';

export type RunSave = {
  readonly version: number;
  readonly roomId: string;
  readonly spawn: RoomSpawn;
  readonly hp: number;
  readonly sigils: readonly BossKind[];
  readonly visitedRooms: readonly string[];
  readonly checkpointBenchId: string | null;
  readonly pickups: readonly string[];
  readonly brokenSecrets: readonly string[];
  /** Wax marks pressed into the Tideglass. */
  readonly mapPins: readonly MapPin[];
  readonly charmsOwned: readonly CharmId[];
  readonly charmsEquipped: readonly CharmId[];
  readonly nailLevel: number;
  readonly shards: number;
  readonly ordeals: readonly BossKind[];
  /** The Tide door was crossed (midpoint card shown). Migrated from v2 sliceComplete. */
  readonly tideDoorOpened: boolean;
  /** The earned final ending was seen. */
  readonly endingSeen: boolean;
};

export type SaveStorage = Pick<Storage, 'getItem' | 'setItem'>;

/** Pickup ids that are actually placed in a room, used to reject impossible saves. */
const PLACED_PICKUPS: ReadonlySet<string> = new Set(
  ALL_ROOMS.flatMap((room) => (room.pickups ?? []).map((pickup) => pickup.id)),
);

/** localStorage when it exists and is reachable, else null (private mode, embedded). */
export function defaultRunStorage(): SaveStorage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

/** Base mask ceiling plus one per sigil. The single source of truth for boss HP. */
export function maxHpForSigils(count: number): number {
  if (!Number.isInteger(count) || count < 0 || count > BOSS_KINDS.length) {
    throw new BellwardError(`sigil count must be an integer within 0..${BOSS_KINDS.length}`);
  }
  return COMBAT.player.maxHp + count * BOSS_REWARDS.maxHpPerSigil;
}

/** Base masks + one per sigil + one per full set of four mask shards. */
export function maxHpForProgress(sigilCount: number, maskShards: number): number {
  if (!Number.isInteger(maskShards) || maskShards < 0) {
    throw new BellwardError(`mask shard count must be a non-negative integer`);
  }
  return maxHpForSigils(sigilCount) + Math.floor(maskShards / 4);
}

/** Reads and validates a run, migrating v1 in memory. Any problem returns null. */
export function loadRunSave(storage = defaultRunStorage()): RunSave | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(SAVE.storageKey);
    if (raw === null) return null;
    const parsed: unknown = JSON.parse(raw);
    const save = parseRunSave(migrateRunSave(parsed));
    if (save) return save;
    console.warn('[BELLWARD] ignoring invalid saved run; starting a fresh climb');
  } catch (error) {
    console.warn('[BELLWARD] ignoring unreadable saved run', error);
  }
  return null;
}

/**
 * Every old fact keeps its meaning. v2 introduced the collectible document, v3 renamed
 * the one-shot slice flag into tideDoorOpened and added endingSeen, and v4 adds wax marks
 * plus the Tideglass itself. A v3 save that had already stood on the terrace is granted
 * the Tideglass so existing climbers do not lose the chart they have earned.
 */
export function migrateRunSave(value: unknown): unknown {
  if (!isRecord(value)) return value;
  const version = value.version;
  if (version === 1) {
    const v2 = {
      ...value,
      version: 2,
      pickups: [],
      brokenSecrets: [],
      charmsOwned: [],
      charmsEquipped: [],
      nailLevel: 0,
      shards: 0,
      ordeals: [],
      sliceComplete: false,
    };
    return migrateRunSave(v2);
  }
  if (version === 2) {
    const v3 = {
      ...value,
      version: 3,
      /** The old one-shot slice flag becomes the Tide-door opening. */
      tideDoorOpened: !!value.sliceComplete,
      /** The earned final ending is unseen until the Last Keeper is solved. */
      endingSeen: false,
    };
    return migrateRunSave(v3);
  }
  if (version === 3) {
    const visited = Array.isArray(value.visitedRooms)
      ? value.visitedRooms.filter((entry): entry is string => typeof entry === 'string')
      : [];
    const pickups = Array.isArray(value.pickups)
      ? value.pickups.filter((entry): entry is string => typeof entry === 'string')
      : [];
    const inheritGlass =
      visited.includes('belfry-terrace') && !pickups.includes('terrace-tideglass');
    return {
      ...value,
      version: SAVE.version,
      pickups: inheritGlass ? [...pickups, 'terrace-tideglass'] : pickups,
      mapPins: [],
    };
  }
  return value;
}

/** Persists a run document. Returns false when storage is unavailable or rejects the write. */
export function writeRunSave(save: RunSave, storage = defaultRunStorage()): boolean {
  if (!storage) return false;
  try {
    storage.setItem(SAVE.storageKey, JSON.stringify(save));
    return true;
  } catch (error) {
    console.warn('[BELLWARD] could not persist the run', error);
    return false;
  }
}

/**
 * Pure content-aware validation. Exported so the unit suite can exercise every rejection
 * without a browser localStorage. Unknown rooms, benches, sigils, pickups, charms,
 * impossible HP, overfull charm belts and bad standings all fail.
 */
export function parseRunSave(value: unknown): RunSave | null {
  if (!isRecord(value) || value.version !== SAVE.version) return null;
  if (typeof value.roomId !== 'string') return null;
  const definition = ROOMS[value.roomId];
  if (!definition) return null;
  const roomId = value.roomId;

  const spawn = parseSpawn(value.spawn);
  if (!spawn) return null;
  const room = createRoom(definition);
  if (!isStandingPoint(room.tilemap, spawn, PLAYER.size)) return null;

  const sigils = parseSigils(value.sigils);
  if (!sigils) return null;
  const pickups = parsePickupIds(value.pickups, sigils);
  if (!pickups) return null;
  const brokenSecrets = parseBrokenSecrets(value.brokenSecrets);
  if (!brokenSecrets) return null;
  const healthShards = healthShardCount(pickups);
  if (
    typeof value.hp !== 'number' ||
    !Number.isInteger(value.hp) ||
    value.hp < 1 ||
    value.hp > maxHpForProgress(sigils.length, healthShards)
  ) {
    return null;
  }

  const visitedRooms = parseVisited(value.visitedRooms);
  if (!visitedRooms || !visitedRooms.includes(roomId)) return null;
  const mapPins = parseMapPins(value.mapPins, visitedRooms);
  if (!mapPins) return null;

  let checkpointBenchId: string | null = null;
  if (value.checkpointBenchId !== null) {
    if (typeof value.checkpointBenchId !== 'string') return null;
    const bench = BENCHES.get(value.checkpointBenchId);
    if (!bench || !visitedRooms.includes(bench.roomId)) return null;
    checkpointBenchId = value.checkpointBenchId;
  }

  const charmsOwned = parseCharmsOwned(value.charmsOwned, pickups);
  if (!charmsOwned) return null;
  const charmsEquipped = parseCharmsEquipped(value.charmsEquipped, charmsOwned);
  if (!charmsEquipped) return null;

  if (
    typeof value.nailLevel !== 'number' ||
    !Number.isInteger(value.nailLevel) ||
    value.nailLevel < 0 ||
    value.nailLevel > NAIL.maxLevel
  ) {
    return null;
  }
  if (
    typeof value.shards !== 'number' ||
    !Number.isInteger(value.shards) ||
    value.shards < 0 ||
    value.shards > 999_999
  ) {
    return null;
  }
  const ordeals = parseOrdeals(value.ordeals, sigils);
  if (!ordeals) return null;
  if (typeof value.tideDoorOpened !== 'boolean') return null;
  if (typeof value.endingSeen !== 'boolean') return null;

  return {
    version: SAVE.version,
    roomId,
    spawn: { x: spawn.x, y: spawn.y },
    hp: value.hp,
    sigils,
    visitedRooms,
    checkpointBenchId,
    pickups,
    brokenSecrets,
    mapPins,
    charmsOwned,
    charmsEquipped,
    nailLevel: value.nailLevel,
    shards: value.shards,
    ordeals,
    tideDoorOpened: value.tideDoorOpened,
    endingSeen: value.endingSeen,
  };
}

function parseSpawn(value: unknown): RoomSpawn | null {
  if (!isRecord(value)) return null;
  if (typeof value.x !== 'number' || typeof value.y !== 'number') return null;
  if (!Number.isFinite(value.x) || !Number.isFinite(value.y)) return null;
  return { x: value.x, y: value.y };
}

function parseMapPins(value: unknown, visitedRooms: readonly string[]): MapPin[] | null {
  if (!Array.isArray(value) || value.length > MAP.savePinLimit) return null;
  const pins: MapPin[] = [];
  const rooms = new Set<string>();
  for (const entry of value) {
    if (!isRecord(entry)) return null;
    if (typeof entry.roomId !== 'string' || !ROOMS[entry.roomId]) return null;
    if (!isMapPinKind(entry.kind)) return null;
    if (rooms.has(entry.roomId)) return null;
    if (!visitedRooms.includes(entry.roomId)) return null;
    rooms.add(entry.roomId);
    pins.push({ roomId: entry.roomId, kind: entry.kind });
  }
  return pins;
}

function parseSigils(value: unknown): BossKind[] | null {
  if (!Array.isArray(value) || value.length > BOSS_KINDS.length) return null;
  const sigils: BossKind[] = [];
  for (const entry of value) {
    if (typeof entry !== 'string' || !(BOSS_KINDS as readonly string[]).includes(entry)) {
      return null;
    }
    if (sigils.includes(entry as BossKind)) return null;
    sigils.push(entry as BossKind);
  }
  return sigils;
}

function parseVisited(value: unknown): string[] | null {
  if (!Array.isArray(value) || value.length === 0) return null;
  const visited: string[] = [];
  for (const entry of value) {
    if (typeof entry !== 'string' || !ROOMS[entry]) return null;
    if (visited.includes(entry)) return null;
    visited.push(entry);
  }
  return visited;
}

function parsePickupIds(value: unknown, sigils: readonly BossKind[]): string[] | null {
  if (!Array.isArray(value) || value.length > PLACED_PICKUPS.size) return null;
  const pickups: string[] = [];
  for (const entry of value) {
    if (typeof entry !== 'string' || !isPickupId(entry) || !PLACED_PICKUPS.has(entry)) {
      return null;
    }
    if (pickups.includes(entry)) return null;
    const requires = getPickup(entry).requiresSigil;
    if (requires && !sigils.includes(requires)) return null;
    pickups.push(entry);
  }
  return pickups;
}

function parseBrokenSecrets(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  const secrets: string[] = [];
  for (const entry of value) {
    if (typeof entry !== 'string' || !ROOMS[entry] || secrets.includes(entry)) return null;
    secrets.push(entry);
  }
  return secrets;
}

/** Charms are durable facts independent of the pickup list, but both must agree. */
function parseCharmsOwned(value: unknown, pickups: readonly string[]): CharmId[] | null {
  if (!Array.isArray(value) || value.length > CHARM_ORDER.length) return null;
  const owned: CharmId[] = [];
  for (const entry of value) {
    if (typeof entry !== 'string' || !CHARM_ORDER.includes(entry as CharmId)) return null;
    if (owned.includes(entry as CharmId)) return null;
    owned.push(entry as CharmId);
  }
  for (const pickup of pickups) {
    const charm = PICKUPS[pickup]?.charm;
    if (charm && !owned.includes(charm)) return null;
  }
  for (const charmId of owned) {
    const granted = pickups.some((pickup) => PICKUPS[pickup]?.charm === charmId);
    if (!granted) return null;
  }
  return owned;
}

function parseCharmsEquipped(value: unknown, owned: readonly CharmId[]): CharmId[] | null {
  if (!Array.isArray(value)) return null;
  const equipped: CharmId[] = [];
  let slots = 0;
  for (const entry of value) {
    if (typeof entry !== 'string' || !CHARM_ORDER.includes(entry as CharmId)) return null;
    if (!owned.includes(entry as CharmId) || equipped.includes(entry as CharmId)) return null;
    equipped.push(entry as CharmId);
    slots += CHARMS[entry as CharmId].cost;
  }
  return slots <= CHARM_SLOTS ? equipped : null;
}

function parseOrdeals(value: unknown, sigils: readonly BossKind[]): BossKind[] | null {
  if (!Array.isArray(value) || value.length > BOSS_KINDS.length) return null;
  const ordeals: BossKind[] = [];
  for (const entry of value) {
    if (typeof entry !== 'string' || !(BOSS_KINDS as readonly string[]).includes(entry)) {
      return null;
    }
    if (ordeals.includes(entry as BossKind) || !sigils.includes(entry as BossKind)) return null;
    ordeals.push(entry as BossKind);
  }
  return ordeals;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
