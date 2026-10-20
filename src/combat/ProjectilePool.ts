import { COMBAT } from '../config/combat';
import { RENDER } from '../config/render';
import { SIM } from '../config/world';
import type { Rect } from '../core/Types';
import type { Tilemap } from '../world/Tilemap';
import { circleOverlapsRect } from './geometry';

/** One fixed pool slot. Inactive slots keep their last numbers; `active` is the truth. */
export type Projectile = {
  /** Stable slot index, used by the view to keep a sprite per slot. */
  readonly index: number;
  active: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  damage: number;
  ticksLeft: number;
};

/** A projectile that ended this tick, with enough data to spawn feedback. */
export type ProjectileHit = {
  x: number;
  y: number;
  damage: number;
  kind: 'player' | 'tile';
};

/**
 * Fixed-capacity projectile pool. No allocation after construction: adapters spawn into
 * a free slot, and when every slot is busy the shortest-lived shot is recycled (the pool
 * never silently drops the new cast, and one runaway orb cannot starve the caster).
 */
export class ProjectilePool {
  private readonly slots: Projectile[];

  constructor(capacity: number = COMBAT.projectilePoolSize) {
    this.slots = Array.from({ length: capacity }, (_, index) => ({
      index,
      active: false,
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      damage: 0,
      ticksLeft: 0,
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
  ): void {
    const length = Math.hypot(dirX, dirY);
    if (length <= 0) return;
    const slot = this.acquire();
    slot.active = true;
    slot.x = x;
    slot.y = y;
    slot.vx = (dirX / length) * speed;
    slot.vy = (dirY / length) * speed;
    slot.damage = damage;
    slot.ticksLeft = lifeTicks;
  }

  /** Moves every live projectile and returns the ones that ended this tick. */
  update(tilemap: Tilemap, target: Rect): ProjectileHit[] {
    const hits: ProjectileHit[] = [];
    const radius = COMBAT.projectileRadius;
    for (const slot of this.slots) {
      if (!slot.active) continue;
      slot.x += slot.vx * SIM.dt;
      slot.y += slot.vy * SIM.dt;
      slot.ticksLeft -= 1;

      if (circleOverlapsRect(slot.x, slot.y, radius, target)) {
        hits.push({ x: slot.x, y: slot.y, damage: slot.damage, kind: 'player' });
        slot.active = false;
        continue;
      }

      const tx = Math.floor(slot.x / RENDER.tileSize);
      const ty = Math.floor(slot.y / RENDER.tileSize);
      if (tilemap.isSolid(tx, ty)) {
        hits.push({ x: slot.x, y: slot.y, damage: slot.damage, kind: 'tile' });
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
