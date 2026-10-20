import { COMBAT } from '../config/combat';
import { SIM } from '../config/world';
import type { Vec2 } from '../core/Types';
import type { Body } from '../physics/Body';
import { moveAndCollide } from '../physics/TileCollision';
import type { Tilemap } from '../world/Tilemap';
import { applyGravity, decayHorizontal } from './playerMotion';
import type { PlayerPose } from './PlayerPose';
import type { PlayerVitals } from './PlayerVitals';

export type ReactionHost = {
  body: Body;
  pose: PlayerPose;
  vitals: PlayerVitals;
  feet: Vec2;
  facing: -1 | 1;
  setFacing(direction: -1 | 1): void;
};

/**
 * Hit reaction and death: who owns the body, how long control is lost, and the clock the
 * scene uses to fade into a reset. Damage immunity itself lives in PlayerVitals.
 */
export class PlayerReaction {
  private hurtTicksValue = 0;
  private deathElapsedValue = 0;

  get hurt(): boolean {
    return this.hurtTicksValue > 0;
  }

  get deathElapsed(): number {
    return this.deathElapsedValue;
  }

  takeDamage(host: ReactionHost, amount: number, sourceX: number): boolean {
    if (!host.vitals.damage(amount)) return false;

    const away = host.feet.x < sourceX ? -1 : 1;
    host.setFacing(away === 1 ? -1 : 1);
    host.body.vx = away * COMBAT.player.knockback.x;
    host.body.vy = COMBAT.player.knockback.y;
    host.pose.forceState('hurt');
    this.hurtTicksValue = COMBAT.player.hurtTicks;
    host.pose.emit('hurt');

    if (host.vitals.dead) {
      host.pose.forceState('dead');
      this.deathElapsedValue = 0;
      host.pose.emit('death');
    }
    return true;
  }

  stepHurt(host: ReactionHost, tilemap: Tilemap, jumpHeld: boolean): void {
    this.hurtTicksValue -= 1;
    host.pose.tickClip();
    decayHorizontal(host.body, COMBAT.player.hurtFriction);
    applyGravity(host.body, jumpHeld);
    moveAndCollide(tilemap, host.body, SIM.dt);
    if (this.hurtTicksValue <= 0) {
      host.pose.setState(
        host.body.grounded ? 'idle' : 'fall',
        host.body.grounded ? 'idle' : 'fall',
      );
    }
  }

  stepDead(host: ReactionHost, tilemap: Tilemap, jumpHeld: boolean): void {
    this.deathElapsedValue += 1;
    host.pose.tickClip();
    decayHorizontal(host.body, COMBAT.player.hurtFriction);
    applyGravity(host.body, jumpHeld);
    moveAndCollide(tilemap, host.body, SIM.dt);
  }
}
