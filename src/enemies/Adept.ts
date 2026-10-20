import type { CastDef } from '../config/enemies';
import { BellwardError } from '../core/Errors';
import type { EnemySpawn } from '../world/Room';
import { Enemy, type EnemyContext } from './Enemy';

/**
 * The Cinder Adept: a rooted caster. It faces the player, commits to a long, readable
 * cast, and releases a fireball at a fixed tick inside the animation. Any hit interrupts
 * the cast before the projectile leaves, which is the fight's core counter-play.
 *
 *   idle -> windup (spawn projectile mid-clip) -> recover -> idle
 *                \-> stagger (cast cancelled)
 */
export class Adept extends Enemy {
  private readonly cast: CastDef;
  private castSpawned = false;

  constructor(spawn: EnemySpawn) {
    super('adept', spawn);
    const cast = this.stats.cast;
    if (!cast) {
      throw new BellwardError('adept has no cast block in ENEMIES');
    }
    this.cast = cast;
    this.beginState('idle', 0, 'idle');
  }

  protected think(ctx: EnemyContext): void {
    switch (this.stateValue) {
      case 'idle': {
        if (this.canSee(ctx, this.cast.range, this.cast.verticalRange)) {
          this.facePlayer(ctx);
          if (this.cooldownTicks <= 0) {
            this.cooldownTicks = this.cast.cooldownTicks;
            this.castSpawned = false;
            this.beginState('windup', this.cast.windupTicks, 'cast');
          }
        }
        this.body.vx = 0;
        break;
      }

      case 'windup': {
        this.body.vx = 0;
        const spawnAt = this.cast.windupTicks - this.cast.spawnTick;
        if (!this.castSpawned && this.stateTicks <= spawnAt) {
          this.release(ctx);
          this.castSpawned = true;
        }
        if (this.stateTicks <= 0) {
          this.beginState('recover', this.cast.recoverTicks, 'cast');
        }
        break;
      }

      case 'recover':
        this.body.vx = 0;
        if (this.stateTicks <= 0) this.beginState('idle', 0, 'idle');
        break;

      case 'stagger':
        this.brake(700);
        if (this.stateTicks <= 0) this.beginState('idle', 0, 'idle');
        break;

      case 'patrol':
      case 'chase':
      case 'active':
      case 'dead':
        break;
    }
  }

  /** Aim at the player's chest and hand the shot to the scene's projectile sink. */
  private release(ctx: EnemyContext): void {
    const feet = this.feet;
    const originX = feet.x + this.facing * 14;
    const originY = feet.y - 36;
    const targetX = ctx.player.feet.x;
    const targetY = ctx.player.feet.y - 22;
    const dx = targetX - originX;
    const dy = targetY - originY;
    const length = Math.hypot(dx, dy);
    if (length <= 0) return;
    ctx.castProjectile(
      originX,
      originY,
      dx / length,
      dy / length,
      this.cast.projectile.speed,
      this.cast.projectile.damage,
      this.cast.projectile.lifeTicks,
    );
  }
}
