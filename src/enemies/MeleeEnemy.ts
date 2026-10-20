import type { EnemyStats } from '../config/enemies';
import { BellwardError } from '../core/Errors';
import type { EnemySpawn } from '../world/Room';
import { Enemy, type EnemyContext } from './Enemy';

/**
 * The shared grounded melee FSM, used by the parishioner and the ghoul. Their feel is
 * entirely data: the parishioner claws in place, the ghoul commits to a fast lunge.
 *
 *   patrol/idle -> chase -> windup -> active -> recover -> chase
 *                             \-> stagger (interrupted by any hit)
 */
export class MeleeEnemy extends Enemy {
  private readonly melee: NonNullable<EnemyStats['melee']>;

  constructor(kind: 'parishioner' | 'ghoul', spawn: EnemySpawn) {
    super(kind, spawn);
    const melee = this.stats.melee;
    if (!melee) {
      throw new BellwardError(`melee enemy "${kind}" has no melee block in ENEMIES`);
    }
    this.melee = melee;
    this.beginState('patrol', 0, 'walk');
  }

  protected think(ctx: EnemyContext): void {
    switch (this.stateValue) {
      case 'idle':
      case 'patrol':
        this.patrol(ctx);
        if (this.canSee(ctx, this.stats.aggroRange, this.stats.verticalRange)) {
          this.beginState('chase', 0, 'walk');
        }
        break;

      case 'chase': {
        if (!this.canSee(ctx, this.stats.deaggroRange, this.stats.verticalRange)) {
          this.beginState('patrol', 0, 'walk');
          break;
        }
        if (Math.abs(this.horizontalDelta(ctx)) <= this.melee.range && this.cooldownTicks <= 0) {
          this.facePlayer(ctx);
          this.body.vx = 0;
          this.cooldownTicks = this.melee.cooldownTicks;
          this.beginState('windup', this.melee.windupTicks, 'idle');
          break;
        }
        const dir = this.horizontalDelta(ctx) >= 0 ? 1 : -1;
        this.walk(dir, this.stats.chaseSpeed, ctx.tilemap);
        break;
      }

      case 'windup':
        this.body.vx = 0;
        if (this.stateTicks <= 0) {
          this.beginState('active', this.melee.activeTicks, 'walk');
        }
        break;

      case 'active':
        if (this.melee.lungeSpeed > 0 && this.hasGroundAhead(this.facing, ctx.tilemap)) {
          this.body.vx = this.facing * this.melee.lungeSpeed;
        } else {
          this.body.vx = 0;
        }
        if (this.stateTicks <= 0) {
          this.beginState('recover', this.melee.recoverTicks, 'idle');
        }
        break;

      case 'recover':
        this.brake(1200);
        if (this.stateTicks <= 0) this.beginState('chase', 0, 'walk');
        break;

      case 'stagger':
        this.brake(700);
        if (this.stateTicks <= 0) this.beginState('chase', 0, 'walk');
        break;

      case 'dead':
        break;
    }
  }

  /** Walk between the spawn's patrol bounds, turning at each end and at ledges. */
  private patrol(ctx: EnemyContext): void {
    if (this.patrolMax <= this.patrolMin) {
      this.body.vx = 0;
      return;
    }
    if (this.facing === 1 && this.feet.x >= this.patrolMax) this.facing = -1;
    else if (this.facing === -1 && this.feet.x <= this.patrolMin) this.facing = 1;
    this.walk(this.facing, this.stats.patrolSpeed, ctx.tilemap);
  }
}
