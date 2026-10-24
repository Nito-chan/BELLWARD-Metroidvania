import { COMBAT } from '../config/combat';
import { RENDER } from '../config/render';
import { SIM } from '../config/world';
import type { Rect } from '../core/Types';
import type { Tilemap } from '../world/Tilemap';
import type { Enemy } from '../enemies/Enemy';
import { circleOverlapsRect } from './geometry';

/** Projectile visuals. The pool stores this as data; the view maps it to a tint. */
export type ProjectileStyle = 'fire' | 'spore' | 'wave' | 'coin' | 'bell';

/** Optional data attached when a pattern spawns a shot. */
export type ProjectileSpawnOptions = {
  readonly style?: ProjectileStyle;
  /** Downward acceleration, px/s². Defaults to 0 (straight-line orb). */
  readonly gravity?: number;
  /** 'enemy' shots can hurt the player; 'player' shots (Toll waves) hurt enemies instead. */
  readonly owner?: 'enemy' | 'player';
  /** Posture damage the shot applies to an enemy (player-owned waves only). */
  readonly posture?: number;
};

/** One fixed pool slot. Inactive slots keep their last numbers; `active` is the truth. */
export type Projectile = {
  /** Stable slot index, used by the view to keep a sprite per slot. */
  readonly index: number;
  /** Monotonic identity for one spawn; ritual mechanics allow one answer per wave. */
  spawnId: number;
  active: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  gravity: number;
  style: ProjectileStyle;
  damage: number;
  /** Posture damage the shot applies to an enemy (player-owned waves only). */
  posture: number;
  ticksLeft: number;
  /** Lifetime at spawn, so a view can animate one shot without external state. */
  maxLifeTicks: number;
  /** 'enemy' shots can hurt the player; 'player' shots (Toll waves) hurt enemies instead. */
  owner: 'enemy' | 'player';
  /** Enemies this shot has already passed through, so a piercing wave hits each once. */
  readonly hitEnemies: Set<Enemy>;
};

/** A projectile that ended this tick, with enough data to spawn feedback. */
export type ProjectileHit = {
  x: number;
  y: number;
  damage: number;
  style: ProjectileStyle;
  kind: 'player' | 'tile';
  /** Who fired it: enemy shots hurt the player, player shots never do. */
  owner: 'enemy' | 'player';
};

/**
 * Fixed-capacity projectile pool. No allocation after construction: adapters spawn into
 * a free slot, and when every slot is busy the shortest-lived shot is recycled (the pool
 * never silently drops the new cast, and one runaway orb cannot starve the caster).
 */
export class ProjectilePool {
  private readonly slots: Projectile[];
  private nextSpawnId = 1;

  constructor(capacity: number = COMBAT.projectilePoolSize) {
    this.slots = Array.from({ length: capacity }, (_, index) => ({
      index,
      spawnId: 0,
      active: false,
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      gravity: 0,
      style: 'fire' as const,
      damage: 0,
      posture: 0,
      ticksLeft: 0,
      maxLifeTicks: 0,
      owner: 'enemy' as const,
      hitEnemies: new Set<Enemy>(),
    }));
  }

  get activeCount(): number {
    return this.slots.reduce((count, slot) => (slot.active ? count + 1 : count), 0);
  }

  /** All slots, including inactive ones; views sync one sprite per slot. */
  get all(): readonly Projectile[] {
    return this.slots;
  }

  spawn(
    x: number,
    y: number,
    dirX: number,
    dirY: number,
    speed: number,
    damage: number,
    lifeTicks: number,
    options: ProjectileSpawnOptions = {},
  ): void {
    const length = Math.hypot(dirX, dirY);
    if (length <= 0) return;
    const slot = this.acquire();
    slot.spawnId = this.nextSpawnId;
    this.nextSpawnId += 1;
    slot.active = true;
    slot.x = x;
    slot.y = y;
    slot.vx = (dirX / length) * speed;
    slot.vy = (dirY / length) * speed;
    slot.gravity = options.gravity ?? 0;
    slot.style = options.style ?? 'fire';
    slot.damage = damage;
    slot.posture = options.posture ?? 0;
    slot.ticksLeft = lifeTicks;
    slot.maxLifeTicks = lifeTicks;
    slot.owner = options.owner ?? 'enemy';
    slot.hitEnemies.clear();
  }

  /** Moves every live projectile and returns the ones that ended this tick. */
  update(tilemap: Tilemap, target: Rect): ProjectileHit[] {
    const hits: ProjectileHit[] = [];
    const radius = COMBAT.projectileRadius;
    for (const slot of this.slots) {
      if (!slot.active) continue;
      slot.vy += slot.gravity * SIM.dt;
      slot.x += slot.vx * SIM.dt;
      slot.y += slot.vy * SIM.dt;
      slot.ticksLeft -= 1;

      if (circleOverlapsRect(slot.x, slot.y, radius, target)) {
        hits.push({
          x: slot.x,
          y: slot.y,
          damage: slot.damage,
          style: slot.style,
          kind: 'player',
          owner: slot.owner,
        });
        slot.active = false;
        continue;
      }

      const tx = Math.floor(slot.x / RENDER.tileSize);
      const ty = Math.floor(slot.y / RENDER.tileSize);
      if (tilemap.isSolid(tx, ty)) {
        hits.push({
          x: slot.x,
          y: slot.y,
          damage: slot.damage,
          style: slot.style,
          kind: 'tile',
          owner: slot.owner,
        });
        slot.active = false;
        continue;
      }

      if (slot.ticksLeft <= 0) slot.active = false;
    }
    return hits;
  }

  reset(): void {
    for (const slot of this.slots) slot.active = false;
  }

  private acquire(): Projectile {
    let candidate: Projectile | null = null;
    for (const slot of this.slots) {
      if (!slot.active) return slot;
      if (candidate === null || slot.ticksLeft < candidate.ticksLeft) candidate = slot;
    }
    // Every slot is busy; recycle the one that would expire first. The loop above always
    // finds a candidate because the pool capacity is fixed and positive.
    return candidate as Projectile;
  }
}
