import { COMBAT } from '../config/combat';
import { PLAYER } from '../config/player';
import { SIM } from '../config/world';
import {
  WEAPON_PROFILES,
  type CenserProfile,
  type TollProfile,
  type WeaponId,
  type WeaponProfile,
} from '../config/weapons';
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
 * Per-weapon attack logic: buffering, combo window, damage window, swing identity and
 * the slowed ground drift while a swing is out. Pure simulation, no rendering.
 *
 * Nail keeps its two-stage timing from `config/player.ts`; Censer and Toll are
 * single-stage weapons whose profiles live in `config/weapons.ts`. Hookline lives on
 * `cast` and is never here.
 */
export class PlayerCombat {
  private stage: 1 | 2 = 1;
  private swingValue = 0;
  private bufferTicks = 0;
  private damageBonus = 0;
  private reachScale = 1;
  private counterBonusValue = 0;
  private weaponValue: WeaponId = 'nail';
  private tollCooldownValue = 0;

  get attackId(): number {
    return this.swingValue;
  }

  /** The weapon this swing will use. Nail, Censer or Toll. */
  get weapon(): WeaponId {
    return this.weaponValue;
  }

  /** Ticks before another Toll ring may start (0 when ready). */
  get tollCooldown(): number {
    return this.tollCooldownValue;
  }

  /** The active profile; Nail's legacy numbers come from PLAYER/COMBAT. */
  get profile(): WeaponProfile {
    return this.weaponValue === 'nail' ? NAIL_PROFILE : WEAPON_PROFILES[this.weaponValue];
  }

  /** Extra damage this swing carries from a perfect parry (0 = none). */
  get attackCounterBonus(): number {
    return this.counterBonusValue;
  }

  /** Posture damage this swing applies, including any counter bonus. */
  get attackPostureDamage(): number {
    if (this.weaponValue === 'nail') {
      return (
        Math.round(COMBAT.player.attackPosture * this.reachScale) +
        (this.counterBonusValue > 0 ? COMBAT.guard.counterPostureBonus : 0)
      );
    }
    return (
      Math.round(this.profile.posture * this.reachScale) +
      (this.counterBonusValue > 0 ? COMBAT.guard.counterPostureBonus : 0)
    );
  }

  /** Nail level and Long Reach feed the same swing without changing its timing. */
  setModifiers(damageBonus: number, reachScale: number): void {
    this.damageBonus = Math.max(0, Math.floor(damageBonus));
    this.reachScale = Math.max(1, reachScale);
  }

  /** Switches the attack weapon mid-run; takes effect on the next swing press. */
  setWeapon(weapon: WeaponId): void {
    this.weaponValue = weapon;
  }

  tick(input: InputSnapshot): void {
    if (this.tollCooldownValue > 0) this.tollCooldownValue -= 1;
    if (this.bufferTicks > 0) this.bufferTicks -= 1;
    if (isPressed(input, 'attack')) this.bufferTicks = PLAYER.attack.bufferTicks;
  }

  tryStart(host: CombatHost): boolean {
    if (this.bufferTicks <= 0) return false;
    if (host.pose.state === 'attack' || host.pose.state === 'dash') return false;
    if (this.weaponValue === 'toll' && this.tollCooldownValue > 0) return false;
    this.bufferTicks = 0;
    if (this.weaponValue === 'nail') this.start(host, 1);
    else this.start(host);
    return true;
  }

  isActive(state: string, clipTick: number): boolean {
    if (state !== 'attack') return false;
    if (this.weaponValue === 'nail') {
      const window = this.window();
      return clipTick >= window.start && clipTick <= window.end;
    }
    const p = this.profile;
    return clipTick >= p.active.start && clipTick <= p.active.end;
  }

  attackHitbox(feet: Vec2, facing: -1 | 1, state: string, clipTick: number): Rect | null {
    if (!this.isActive(state, clipTick)) return null;
    const p = this.profile;
    const kind = p.kind;
    if (kind === 'wave') return null; // Toll has no melee hitbox; the wave spawns separately.
    const hitbox =
      this.weaponValue === 'censer' ? (p as CenserProfile).hitbox : COMBAT.player.attackBox;
    const reach = hitbox.width * this.reachScale;
    const start = hitbox.forward * this.reachScale;
    const x = facing === 1 ? feet.x + start : feet.x - start - reach;
    return { x, y: feet.y - hitbox.top, w: reach, h: hitbox.height };
  }

  attackDamage(state: string, clipTick: number): number {
    if (!this.isActive(state, clipTick)) return 0;
    if (this.weaponValue === 'nail') {
      const base = this.stage === 1 ? COMBAT.player.damage.stage1 : COMBAT.player.damage.stage2;
      return base + this.damageBonus;
    }
    return Math.floor(this.profile.damage + this.damageBonus);
  }

  /** Focus gained on a landed hit; Toll and Censer grant none by design. */
  focusGain(): number {
    if (this.weaponValue === 'nail') return PLAYER.focus.gainPerHit;
    return this.profile.focusGain;
  }

  step(host: CombatHost, input: InputSnapshot): void {
    if (this.weaponValue === 'nail') {
      this.stepNail(host, input);
      return;
    }
    this.stepSingle(host, input);
  }

  private stepNail(host: CombatHost, input: InputSnapshot): void {
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

  private stepSingle(host: CombatHost, input: InputSnapshot): void {
    const total = this.profile.clipTicks;
    if (host.pose.clipTick >= total) {
      host.pose.setState(host.grounded ? 'idle' : 'fall', host.grounded ? 'idle' : 'fall');
      return;
    }

    const dir = host.direction(input);
    const max = PLAYER.ground.maxRun * this.profile.speedScale;
    const accel =
      (host.grounded ? PLAYER.ground.accel : PLAYER.air.accel) * this.profile.speedScale;
    const decel = host.grounded ? PLAYER.ground.friction : PLAYER.air.drag;
    const target = dir * max;
    const rate = dir !== 0 ? accel : decel;
    host.body.vx = approach(host.body.vx, target, rate * SIM.dt);
  }

  private start(host: CombatHost, stage?: 1 | 2): void {
    if (this.weaponValue === 'nail') {
      this.stage = stage ?? 1;
      this.swingValue += 1;
      this.counterBonusValue = host.consumeCounter() ? COMBAT.guard.counterDamageBonus : 0;
      host.pose.setState('attack', stage === 1 ? 'attack1' : 'attack2');
      host.body.vx *= PLAYER.attack.speedScale;
      host.pose.emit(stage === 1 ? 'attack1' : 'attack2');
      return;
    }
    this.swingValue += 1;
    this.counterBonusValue = host.consumeCounter() ? COMBAT.guard.counterDamageBonus : 0;
    host.pose.setState('attack', `${this.weaponValue}1`);
    host.body.vx *= this.profile.speedScale;
    host.pose.emit(`${this.weaponValue}1`);
    if (this.weaponValue === 'toll') {
      this.tollCooldownValue = (this.profile as TollProfile).cooldownTicks;
    }
  }

  private window(): { start: number; end: number } {
    return this.stage === 1 ? PLAYER.attack.windows.stage1 : PLAYER.attack.windows.stage2;
  }
}

/** The legacy Nail profile expressed as a WeaponProfile for shared helpers. */
export const NAIL_PROFILE: WeaponProfile = {
  id: 'nail',
  kind: 'melee',
  clipTicks: PLAYER.attack.clipTicks.stage1,
  active: PLAYER.attack.windows.stage1,
  speedScale: PLAYER.attack.speedScale,
  damage: COMBAT.player.damage.stage1,
  posture: COMBAT.player.attackPosture,
  focusGain: PLAYER.focus.gainPerHit,
};
