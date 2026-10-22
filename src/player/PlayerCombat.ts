import { COMBAT } from '../config/combat';
import { PLAYER } from '../config/player';
import { SIM } from '../config/world';
import { approach } from '../core/Math2D';
import type { Rect, Vec2 } from '../core/Types';
import { isPressed, type InputSnapshot } from '../input/InputState';
import type { Body } from '../physics/Body';
import type { PlayerPose } from './PlayerPose';

export type CombatHost = {
  body: Body;
  pose: PlayerPose;
  facing: -1 | 1;
  grounded: boolean;
  direction(input: InputSnapshot): -1 | 0 | 1;
  /** Spends a perfect-parry window; true when this swing becomes a Hook Counter. */
  consumeCounter(): boolean;
};

/**
 * The two-stage light attack: buffering, combo window, damage window, swing identity
 * and the slowed ground drift while a swing is out. Pure simulation, no rendering.
 */
export class PlayerCombat {
  private stage: 1 | 2 = 1;
  private swingValue = 0;
  private bufferTicks = 0;
  private damageBonus = 0;
  private reachScale = 1;
  private counterBonusValue = 0;

  get attackId(): number {
    return this.swingValue;
  }

  /** Extra damage this swing carries from a perfect parry (0 = none). */
  get attackCounterBonus(): number {
    return this.counterBonusValue;
  }

  /** Posture damage this swing applies, including any counter bonus. */
  get attackPostureDamage(): number {
    return (
      Math.round(COMBAT.player.attackPosture * this.reachScale) +
      (this.counterBonusValue > 0 ? COMBAT.guard.counterPostureBonus : 0)
    );
  }

  /** Nail level and Long Reach feed the same swing without changing its timing. */
  setModifiers(damageBonus: number, reachScale: number): void {
    this.damageBonus = Math.max(0, Math.floor(damageBonus));
    this.reachScale = Math.max(1, reachScale);
  }

  tick(input: InputSnapshot): void {
    if (this.bufferTicks > 0) this.bufferTicks -= 1;
    if (isPressed(input, 'attack')) this.bufferTicks = PLAYER.attack.bufferTicks;
  }

  tryStart(host: CombatHost): boolean {
    if (this.bufferTicks <= 0) return false;
    if (host.pose.state === 'attack' || host.pose.state === 'dash') return false;
    this.bufferTicks = 0;
    this.start(host, 1);
    return true;
  }

  isActive(state: string, clipTick: number): boolean {
    if (state !== 'attack') return false;
    const window = this.window();
    return clipTick >= window.start && clipTick <= window.end;
  }

  attackHitbox(feet: Vec2, facing: -1 | 1, state: string, clipTick: number): Rect | null {
    if (!this.isActive(state, clipTick)) return null;
    const { forward, width, height, top } = COMBAT.player.attackBox;
    const reach = width * this.reachScale;
    const start = forward * this.reachScale;
    const x = facing === 1 ? feet.x + start : feet.x - start - reach;
    return { x, y: feet.y - top, w: reach, h: height };
  }

  attackDamage(state: string, clipTick: number): number {
    if (!this.isActive(state, clipTick)) return 0;
    const base = this.stage === 1 ? COMBAT.player.damage.stage1 : COMBAT.player.damage.stage2;
    return base + this.damageBonus;
  }

  step(host: CombatHost, input: InputSnapshot): void {
    const window = this.window();
    const pressed = isPressed(input, 'attack');
    if (
      this.stage === 1 &&
      host.pose.clipTick >= window.start &&
      host.pose.clipTick <= window.end
    ) {
      if (pressed) {
        this.start(host, 2);
        return;
      }
    }

    const total =
      this.stage === 1 ? PLAYER.attack.clipTicks.stage1 : PLAYER.attack.clipTicks.stage2;
    if (host.pose.clipTick >= total) {
      host.pose.setState(host.grounded ? 'idle' : 'fall', host.grounded ? 'idle' : 'fall');
      return;
    }

    // Swings drag: a fraction of ground control remains available.
    const dir = host.direction(input);
    const max = PLAYER.ground.maxRun * PLAYER.attack.speedScale;
    const accel =
      (host.grounded ? PLAYER.ground.accel : PLAYER.air.accel) * PLAYER.attack.speedScale;
    const decel = host.grounded ? PLAYER.ground.friction : PLAYER.air.drag;
    const target = dir * max;
    const rate = dir !== 0 ? accel : decel;
    host.body.vx = approach(host.body.vx, target, rate * SIM.dt);
  }

  private start(host: CombatHost, stage: 1 | 2): void {
    this.stage = stage;
    this.swingValue += 1;
    this.counterBonusValue = host.consumeCounter() ? COMBAT.guard.counterDamageBonus : 0;
    host.pose.setState('attack', stage === 1 ? 'attack1' : 'attack2');
    // Facing is locked for the swing; the art is directional.
    host.body.vx *= PLAYER.attack.speedScale;
    host.pose.emit(stage === 1 ? 'attack1' : 'attack2');
  }

  private window(): { start: number; end: number } {
    return this.stage === 1 ? PLAYER.attack.windows.stage1 : PLAYER.attack.windows.stage2;
  }
}
