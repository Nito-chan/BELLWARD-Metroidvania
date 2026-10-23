import { BENCH } from '../config/bench';
import { ENEMIES, type ActorKind, type BossKind } from '../config/enemies';
import type { PaletteName } from '../config/palette';
import { PLAYER } from '../config/player';
import { RENDER } from '../config/render';
import { BellwardError } from '../core/Errors';
import type { Rect, Vec2 } from '../core/Types';
import type { MusicKey } from '../data/audio';
import { getPickup, isPickupId } from '../data/pickups';
import { canHangAt } from './hookGeometry';
import { Tilemap } from './Tilemap';
import type { TileRole } from './tiles';

/** Art keys for background layers, far to near. Resolved by the active art provider. */
export type BackgroundKey = 'far' | 'mid' | 'near';

/** Art keys for props. Resolved by the active art provider. */
export type PropKey = 'balustrade' | 'column' | 'bell' | 'door' | 'bench' | 'altar';

/** Depth band for a prop: behind the hero, or in front of the hero. */
export type PropLayerName = 'back' | 'front';

export type RoomProp = {
  /** Logical art key; the renderer picks packed art or its procedural equivalent. */
  art: PropKey;
  /** World position of the prop's bottom-center anchor, in pixels. */
  x: number;
  y: number;
  /** `back` props sit behind actors; `front` props occlude them. */
  layer: PropLayerName;
  /** Optional multiplicative tint, used to distinguish otherwise identical doors. */
  tint?: PaletteName;
};

export type RoomSpawn = {
  /** Feet position (bottom-center of the hero), in world pixels. */
  x: number;
  y: number;
};

/**
 * A rest point. `id` is the stable save id, while `x`/`y` place the stone bench in the
 * world and `spawn` is where the hero stands when the room is rebuilt after resting or a
 * death. The bench art is procedural and anchored at its bottom-center like every prop.
 */
export type RoomBench = {
  id: string;
  name: string;
  x: number;
  y: number;
  spawn: RoomSpawn;
};

/**
 * One enemy placed in a room. `x`/`y` is the feet-center, so level data reads like the
 * hero spawn. `patrol` is an optional horizontal beat, in world pixels.
 */
export type EnemySpawn = {
  kind: ActorKind;
  x: number;
  y: number;
  /** Initial facing; defaults to right. */
  facing?: -1 | 1;
  patrol?: { min: number; max: number };
};

/** A collectible placed in the room. The registry owns its meaning. */
export type RoomPickupPlacement = {
  id: string;
  /** Feet-level pickup center, in world pixels. It bobs visually but never moves. */
  x: number;
  y: number;
};

/**
 * A brass grapple ring for the Hookline. `x`/`y` is the ring centre; the hero's feet
 * settle `HOOK.hangOffsetY` below it. Ids are stable so a future chart can remember
 * discovered rings without depending on array order.
 */
export type RoomAnchor = {
  id: string;
  x: number;
  y: number;
};

/** The altar that relights a claimed arena for the optional hard-mode Ordeal. */
export type RoomOrdeal = {
  x: number;
  y: number;
  w: number;
  h: number;
};

/** The one ending trigger in the slice, behind the Tide door. */
export type RoomEnding = {
  x: number;
  y: number;
  w: number;
  h: number;
  title: string;
  subtitle: string;
  /** The physical key that must be owned before this can fire. */
  requiresPickup: string;
};

/** A world-space trigger that walks the player into another room. */
export type RoomExit = {
  x: number;
  y: number;
  w: number;
  h: number;
  targetRoomId: string;
  /** Feet position in the destination room. */
  spawn: RoomSpawn;
};

/** A carved plaque or other short world-space label. */
export type RoomLabel = {
  x: number;
  y: number;
  text: string;
  color: PaletteName;
  alpha?: number;
  size?: number;
};

export type RoomDefinition = {
  id: string;
  name: string;
  /** ASCII layout, one character per tile. Rows must all be the same length. */
  rows: readonly string[];
  /** Maps every non-space glyph to a semantic tile role. */
  legend: Readonly<Record<string, TileRole>>;
  /** Parallax layers to build behind the room, far to near. */
  backgrounds: readonly BackgroundKey[];
  /** Colour wash applied above the world container. Alpha 0 disables it. */
  ambient: { tint: PaletteName; alpha: number };
  props: readonly RoomProp[];
  spawn: RoomSpawn;
  /** Enemies to spawn when the room is (re)entered. */
  enemies: readonly EnemySpawn[];
  /** Music loop requested on entry; defaults to the terrace theme. */
  music?: MusicKey;
  /** The one boss encounter in this room, if any. */
  boss?: BossKind;
  /** Walk-through doorways to other rooms. */
  exits?: readonly RoomExit[];
  /** World-space labels (boss door plaques). */
  labels?: readonly RoomLabel[];
  /** Rest points. Each bench saves its spawn as the run's respawn checkpoint. */
  benches?: readonly RoomBench[];
  /** Collectibles in this room. Ids are stable save facts. */
  pickups?: readonly RoomPickupPlacement[];
  /** Brass Hookline rings authored in world space. */
  anchors?: readonly RoomAnchor[];
  /** Optional Ordeal altar, available only in a claimed arena. */
  ordeal?: RoomOrdeal;
  /** The Tide-door ending, present only in the upper gallery. */
  ending?: RoomEnding;
};

export type Room = {
  definition: RoomDefinition;
  tilemap: Tilemap;
  /** Camera bounds and collision bounds, in world pixels. */
  bounds: Rect;
  spawn: Vec2;
};

/** Builds a room from its definition, validating the layout and spawn placement. */
export function createRoom(definition: RoomDefinition): Room {
  const tilemap = Tilemap.fromRows(definition.rows, definition.legend);

  const { x, y } = definition.spawn;
  const insideX = x >= 0 && x < tilemap.pixelWidth;
  const insideY = y >= 0 && y <= tilemap.pixelHeight;
  if (!insideX || !insideY) {
    throw new BellwardError(
      `room "${definition.id}" spawn (${x},${y}) is outside ${tilemap.pixelWidth}x${tilemap.pixelHeight}`,
    );
  }
  if (!(definition.ambient.alpha >= 0 && definition.ambient.alpha <= 1)) {
    throw new BellwardError(
      `room "${definition.id}" ambient alpha must be within 0..1, got ${definition.ambient.alpha}`,
    );
  }

  validateEnemies(definition, tilemap);
  validateBoss(definition);
  validateExits(definition, tilemap);
  validateLabels(definition, tilemap);
  validateBenches(definition, tilemap);
  validatePickups(definition, tilemap);
  validateAnchors(definition, tilemap);
  validateOrdeal(definition, tilemap);
  validateEnding(definition, tilemap);

  return {
    definition,
    tilemap,
    bounds: { x: 0, y: 0, w: tilemap.pixelWidth, h: tilemap.pixelHeight },
    spawn: { x, y },
  };
}

/**
 * True when a feet-center position has solid ground under it and no wall cells in the
 * body volume. Used by bench validation and by the save loader, so a hand-edited save can
 * never put the hero inside masonry.
 */
export function isStandingPoint(
  tilemap: Tilemap,
  point: RoomSpawn,
  body: { readonly w: number; readonly h: number },
): boolean {
  const tile = RENDER.tileSize;
  if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) return false;
  if (point.x < 0 || point.x >= tilemap.pixelWidth) return false;
  if (point.y <= 0 || point.y > tilemap.pixelHeight) return false;

  const footTx = Math.floor(point.x / tile);
  const groundTy = Math.floor(point.y / tile);
  if (!tilemap.isSolid(footTx, groundTy)) return false;

  const leftTx = Math.floor((point.x - body.w / 2) / tile);
  const rightTx = Math.floor((point.x + body.w / 2 - 0.001) / tile);
  const topTy = Math.floor((point.y - body.h + 0.001) / tile);
  for (let ty = topTy; ty < groundTy; ty += 1) {
    for (let tx = leftTx; tx <= rightTx; tx += 1) {
      if (tilemap.isWall(tx, ty)) return false;
    }
  }
  return true;
}

/**
 * Fails loudly on bad level data: an enemy must stand on solid ground with room for its
 * body, a valid patrol beat, and a known kind. A typo can never ship as an invisible
 * floating enemy or a phantom spawn.
 */
function validateEnemies(definition: RoomDefinition, tilemap: Tilemap): void {
  const tile = RENDER.tileSize;
  definition.enemies.forEach((spawn, index) => {
    const label = `room "${definition.id}" enemy ${index} (${String(spawn.kind)})`;
    const stats = ENEMIES[spawn.kind];
    if (!stats) {
      throw new BellwardError(`${label}: unknown enemy kind`);
    }
    if (!Number.isFinite(spawn.x) || !Number.isFinite(spawn.y)) {
      throw new BellwardError(`${label}: spawn position must be finite`);
    }
    if (spawn.x < 0 || spawn.x >= tilemap.pixelWidth) {
      throw new BellwardError(`${label}: x=${spawn.x} is outside the room`);
    }
    if (spawn.y <= 0 || spawn.y > tilemap.pixelHeight) {
      throw new BellwardError(`${label}: y=${spawn.y} is outside the room`);
    }
    if (spawn.facing !== undefined && spawn.facing !== -1 && spawn.facing !== 1) {
      throw new BellwardError(`${label}: facing must be -1 or 1`);
    }

    const footTx = Math.floor(spawn.x / tile);
    const groundTy = Math.floor(spawn.y / tile);
    if (!tilemap.isSolid(footTx, groundTy)) {
      throw new BellwardError(`${label}: feet (${spawn.x},${spawn.y}) are not on solid ground`);
    }

    // Every cell the body occupies must be free of walls (one-way platforms are fine:
    // a body can stand on them and pass upward through them).
    const leftTx = Math.floor((spawn.x - stats.body.w / 2) / tile);
    const rightTx = Math.floor((spawn.x + stats.body.w / 2 - 0.001) / tile);
    const topTy = Math.floor((spawn.y - stats.body.h + 0.001) / tile);
    for (let ty = topTy; ty < groundTy; ty += 1) {
      for (let tx = leftTx; tx <= rightTx; tx += 1) {
        if (tilemap.isWall(tx, ty)) {
          throw new BellwardError(`${label}: body overlaps wall tile (${tx},${ty})`);
        }
      }
    }

    if (spawn.patrol) {
      const { min, max } = spawn.patrol;
      if (!(min < max)) {
        throw new BellwardError(`${label}: patrol min ${min} must be less than max ${max}`);
      }
      if (min < 0 || max > tilemap.pixelWidth) {
        throw new BellwardError(`${label}: patrol ${min}..${max} leaves the room`);
      }
      if (spawn.x < min || spawn.x > max) {
        throw new BellwardError(`${label}: spawn x=${spawn.x} is outside patrol ${min}..${max}`);
      }
    }
  });
}

/** A declared boss must be present exactly once, so the HUD never guesses. */
function validateBoss(definition: RoomDefinition): void {
  if (!definition.boss) return;
  const matches = definition.enemies.filter((enemy) => enemy.kind === definition.boss);
  if (matches.length !== 1) {
    throw new BellwardError(
      `room "${definition.id}" boss "${definition.boss}" must have exactly one spawn, found ${matches.length}`,
    );
  }
  if (definition.enemies.length !== 1) {
    throw new BellwardError(
      `room "${definition.id}" is a boss arena and cannot mix regular enemy spawns`,
    );
  }
}

function validateExits(definition: RoomDefinition, tilemap: Tilemap): void {
  for (const [index, exit] of (definition.exits ?? []).entries()) {
    const label = `room "${definition.id}" exit ${index}`;
    if (!Number.isFinite(exit.x) || !Number.isFinite(exit.y)) {
      throw new BellwardError(`${label}: position must be finite`);
    }
    if (!(exit.w > 0 && exit.h > 0)) {
      throw new BellwardError(`${label}: width and height must be positive`);
    }
    if (
      exit.x < 0 ||
      exit.y < 0 ||
      exit.x + exit.w > tilemap.pixelWidth ||
      exit.y + exit.h > tilemap.pixelHeight
    ) {
      throw new BellwardError(`${label}: trigger leaves the room`);
    }
    if (!exit.targetRoomId) throw new BellwardError(`${label}: target room is empty`);
    if (!Number.isFinite(exit.spawn.x) || !Number.isFinite(exit.spawn.y)) {
      throw new BellwardError(`${label}: destination spawn must be finite`);
    }
  }
}

function validateLabels(definition: RoomDefinition, tilemap: Tilemap): void {
  for (const [index, label] of (definition.labels ?? []).entries()) {
    const where = `room "${definition.id}" label ${index}`;
    if (!label.text.trim()) throw new BellwardError(`${where}: text is empty`);
    if (!Number.isFinite(label.x) || !Number.isFinite(label.y)) {
      throw new BellwardError(`${where}: position must be finite`);
    }
    if (
      label.x < 0 ||
      label.x > tilemap.pixelWidth ||
      label.y < 0 ||
      label.y > tilemap.pixelHeight
    ) {
      throw new BellwardError(`${where}: label leaves the room`);
    }
    if (label.alpha !== undefined && !(label.alpha >= 0 && label.alpha <= 1)) {
      throw new BellwardError(`${where}: alpha must be within 0..1`);
    }
    if (label.size !== undefined && !(label.size > 0)) {
      throw new BellwardError(`${where}: size must be positive`);
    }
  }
}

/** Benches must stand on the floor and their respawn point must fit the hero body. */
function validateBenches(definition: RoomDefinition, tilemap: Tilemap): void {
  const ids = new Set<string>();
  const tile = RENDER.tileSize;
  for (const [index, bench] of (definition.benches ?? []).entries()) {
    const where = `room "${definition.id}" bench ${index}`;
    if (!bench.id.trim()) throw new BellwardError(`${where}: id is empty`);
    if (ids.has(bench.id)) throw new BellwardError(`${where}: duplicate bench id "${bench.id}"`);
    ids.add(bench.id);
    if (!bench.name.trim()) throw new BellwardError(`${where}: name is empty`);
    if (!Number.isFinite(bench.x) || !Number.isFinite(bench.y)) {
      throw new BellwardError(`${where}: position must be finite`);
    }
    if (
      bench.x < 0 ||
      bench.x >= tilemap.pixelWidth ||
      bench.y <= 0 ||
      bench.y > tilemap.pixelHeight
    ) {
      throw new BellwardError(`${where}: marker (${bench.x},${bench.y}) leaves the room`);
    }
    if (!tilemap.isSolid(Math.floor(bench.x / tile), Math.floor(bench.y / tile))) {
      throw new BellwardError(`${where}: marker (${bench.x},${bench.y}) is not on solid ground`);
    }
    if (!isStandingPoint(tilemap, bench.spawn, PLAYER.size)) {
      throw new BellwardError(
        `${where}: spawn (${bench.spawn.x},${bench.spawn.y}) is not a clear standing point`,
      );
    }
    if (
      Math.abs(bench.spawn.x - bench.x) > BENCH.interactRadiusX ||
      Math.abs(bench.spawn.y - bench.y) > BENCH.interactRadiusY
    ) {
      throw new BellwardError(
        `${where}: spawn (${bench.spawn.x},${bench.spawn.y}) is outside its interaction range`,
      );
    }
  }
}

/** Pickup ids must be known and unique inside the room, with finite in-bounds anchors. */
function validatePickups(definition: RoomDefinition, tilemap: Tilemap): void {
  const ids = new Set<string>();
  for (const [index, pickup] of (definition.pickups ?? []).entries()) {
    const where = `room "${definition.id}" pickup ${index}`;
    if (!isPickupId(pickup.id)) {
      throw new BellwardError(`${where}: unknown pickup id "${pickup.id}"`);
    }
    if (ids.has(pickup.id)) throw new BellwardError(`${where}: duplicate id "${pickup.id}"`);
    ids.add(pickup.id);
    if (!Number.isFinite(pickup.x) || !Number.isFinite(pickup.y)) {
      throw new BellwardError(`${where}: position must be finite`);
    }
    if (
      pickup.x < 0 ||
      pickup.x >= tilemap.pixelWidth ||
      pickup.y <= 0 ||
      pickup.y > tilemap.pixelHeight
    ) {
      throw new BellwardError(`${where}: position (${pickup.x},${pickup.y}) leaves the room`);
    }
  }
}

/**
 * Rings must be unique, in bounds, in open space, and must leave a whole hero-sized
 * body clear at the hang point. Authored data can never create a rope that pulls the
 * Keeper into stone.
 */
function validateAnchors(definition: RoomDefinition, tilemap: Tilemap): void {
  const ids = new Set<string>();
  const tile = RENDER.tileSize;
  for (const [index, anchor] of (definition.anchors ?? []).entries()) {
    const where = `room "${definition.id}" anchor ${index}`;
    if (!anchor.id.trim()) throw new BellwardError(`${where}: id is empty`);
    if (ids.has(anchor.id)) throw new BellwardError(`${where}: duplicate anchor id "${anchor.id}"`);
    ids.add(anchor.id);
    if (!Number.isFinite(anchor.x) || !Number.isFinite(anchor.y)) {
      throw new BellwardError(`${where}: position must be finite`);
    }
    if (
      anchor.x < 0 ||
      anchor.x >= tilemap.pixelWidth ||
      anchor.y < 0 ||
      anchor.y >= tilemap.pixelHeight
    ) {
      throw new BellwardError(`${where}: ring (${anchor.x},${anchor.y}) leaves the room`);
    }
    if (tilemap.isSolid(Math.floor(anchor.x / tile), Math.floor(anchor.y / tile))) {
      throw new BellwardError(
        `${where}: ring (${anchor.x},${anchor.y}) sits inside solid geometry`,
      );
    }
    if (!canHangAt(tilemap, anchor)) {
      throw new BellwardError(
        `${where}: hang point below (${anchor.x},${anchor.y}) overlaps geometry`,
      );
    }
  }
}

function validateTrigger(
  where: string,
  trigger: { x: number; y: number; w: number; h: number },
  tilemap: Tilemap,
): void {
  if (![trigger.x, trigger.y, trigger.w, trigger.h].every(Number.isFinite)) {
    throw new BellwardError(`${where}: trigger bounds must be finite`);
  }
  if (!(trigger.w > 0 && trigger.h > 0)) {
    throw new BellwardError(`${where}: trigger must have positive size`);
  }
  if (
    trigger.x < 0 ||
    trigger.y < 0 ||
    trigger.x + trigger.w > tilemap.pixelWidth ||
    trigger.y + trigger.h > tilemap.pixelHeight
  ) {
    throw new BellwardError(`${where}: trigger leaves the room`);
  }
}

function validateOrdeal(definition: RoomDefinition, tilemap: Tilemap): void {
  if (!definition.ordeal) return;
  if (!definition.boss) {
    throw new BellwardError(`room "${definition.id}" has an Ordeal altar but no boss`);
  }
  validateTrigger(`room "${definition.id}" ordeal`, definition.ordeal, tilemap);
}

function validateEnding(definition: RoomDefinition, tilemap: Tilemap): void {
  if (!definition.ending) return;
  const where = `room "${definition.id}" ending`;
  validateTrigger(where, definition.ending, tilemap);
  if (!definition.ending.title.trim() || !definition.ending.subtitle.trim()) {
    throw new BellwardError(`${where}: title and subtitle are required`);
  }
  if (!isPickupId(definition.ending.requiresPickup)) {
    throw new BellwardError(`${where}: unknown key "${definition.ending.requiresPickup}"`);
  }
  if (getPickup(definition.ending.requiresPickup).kind !== 'key') {
    throw new BellwardError(`${where}: "${definition.ending.requiresPickup}" is not a key`);
  }
}
