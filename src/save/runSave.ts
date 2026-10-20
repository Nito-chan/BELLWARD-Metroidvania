/**
 * The persisted run document. It stores only durable run facts: the last safe room/spawn,
 * current masks, claimed sigils, charted rooms and the bench checkpoint. Enemies, projectiles
 * and boss phase timers intentionally reset, exactly as they do on a room transition.
 *
 * Loading is all-or-nothing. A corrupt, partial or future-versioned document starts a fresh
 * run instead of booting into an impossible state; storage failures never break play.
 */
import { BOSS_REWARDS } from '../config/bossTypes';
import { COMBAT } from '../config/combat';
import { BOSS_KINDS, type BossKind } from '../config/enemies';
import { PLAYER } from '../config/player';
import { SAVE } from '../config/save';
import { BellwardError } from '../core/Errors';
import { BENCHES } from '../data/benches';
import { ROOMS } from '../data/rooms';
import { createRoom, isStandingPoint, type RoomSpawn } from '../world/Room';

export type SaveReason = 'boot' | 'room' | 'bench' | 'reward' | 'respawn' | 'debug';

export type RunSave = {
  readonly version: number;
  readonly roomId: string;
  readonly spawn: RoomSpawn;
  readonly hp: number;
  readonly sigils: readonly BossKind[];
  readonly visitedRooms: readonly string[];
  readonly checkpointBenchId: string | null;
};

export type SaveStorage = Pick<Storage, 'getItem' | 'setItem'>;

/** localStorage when it exists and is reachable, else null (private mode, embedded). */
export function defaultRunStorage(): SaveStorage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

/** Base mask ceiling plus one per sigil. The single source of truth for run HP. */
export function maxHpForSigils(count: number): number {
  if (!Number.isInteger(count) || count < 0 || count > BOSS_KINDS.length) {
    throw new BellwardError(`sigil count must be an integer within 0..${BOSS_KINDS.length}`);
  }
  return COMBAT.player.maxHp + count * BOSS_REWARDS.maxHpPerSigil;
}

/** Reads and validates a run. Any problem returns null so Game can start cleanly. */
export function loadRunSave(storage = defaultRunStorage()): RunSave | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(SAVE.storageKey);
    if (raw === null) return null;
    const parsed: unknown = JSON.parse(raw);
    const save = parseRunSave(parsed);
    if (save) return save;
    console.warn('[BELLWARD] ignoring invalid saved run; starting a fresh climb');
  } catch (error) {
    console.warn('[BELLWARD] ignoring unreadable saved run', error);
  }
  return null;
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
 * without a browser localStorage. Unknown rooms, benches, sigils and bad standings all fail.
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
  if (
    typeof value.hp !== 'number' ||
    !Number.isInteger(value.hp) ||
    value.hp < 1 ||
    value.hp > maxHpForSigils(sigils.length)
  ) {
    return null;
  }

  const visitedRooms = parseVisited(value.visitedRooms);
  if (!visitedRooms || !visitedRooms.includes(roomId)) return null;

  let checkpointBenchId: string | null = null;
  if (value.checkpointBenchId !== null) {
    if (typeof value.checkpointBenchId !== 'string') return null;
    const bench = BENCHES.get(value.checkpointBenchId);
    if (!bench || !visitedRooms.includes(bench.roomId)) return null;
    checkpointBenchId = value.checkpointBenchId;
  }

  return {
    version: SAVE.version,
    roomId,
    spawn: { x: spawn.x, y: spawn.y },
    hp: value.hp,
    sigils,
    visitedRooms,
    checkpointBenchId,
  };
}

function parseSpawn(value: unknown): RoomSpawn | null {
  if (!isRecord(value)) return null;
  if (typeof value.x !== 'number' || typeof value.y !== 'number') return null;
  if (!Number.isFinite(value.x) || !Number.isFinite(value.y)) return null;
  return { x: value.x, y: value.y };
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
