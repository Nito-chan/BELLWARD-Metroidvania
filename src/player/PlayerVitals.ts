import { COMBAT } from '../config/combat';
import { BellwardError } from '../core/Errors';

/**
 * The player's survivability: health, invulnerability frames and death. Kept apart from
 * the locomotion state machine so both are testable in isolation and the controller file
 * stays focused on movement.
 */
export class PlayerVitals {
  private maxHpValue: number;
  private hpValue: number;
  private invulnerableTicksValue: number = COMBAT.player.spawnInvulnerableTicks;

  constructor(maxHp: number = COMBAT.player.maxHp, hp: number = maxHp) {
    if (!Number.isInteger(maxHp) || maxHp <= 0) {
      throw new BellwardError(`player max HP must be a positive integer, got ${maxHp}`);
    }
    this.maxHpValue = maxHp;
    this.hpValue = Math.max(1, Math.min(maxHp, Math.floor(hp)));
  }

  get hp(): number {
    return this.hpValue;
  }

  get maxHp(): number {
    return this.maxHpValue;
  }

  /** Boss sigil reward: raise the ceiling and immediately fill the new mask. */
  grantMaxHp(amount: number): void {
    const gain = Math.max(0, Math.floor(amount));
    if (gain === 0) return;
    this.maxHpValue += gain;
    this.hpValue += gain;
  }

  /** Remaining invulnerability ticks (0 = hittable). */
  get invulnerableTicks(): number {
    return this.invulnerableTicksValue;
  }

  get dead(): boolean {
    return this.hpValue <= 0;
  }

  /** True when a hit would land right now. */
  get canBeHit(): boolean {
    return !this.dead && this.invulnerableTicksValue <= 0;
  }

  /** Advances the invulnerability clock by one fixed tick. */
  tick(): void {
    if (this.invulnerableTicksValue > 0) this.invulnerableTicksValue -= 1;
  }

  /** DEV-only: extend i-frames for deterministic state-machine probes. */
  debugProtect(ticks: number): void {
    this.invulnerableTicksValue = Math.max(
      this.invulnerableTicksValue,
      Math.max(0, Math.floor(ticks)),
    );
  }

  /**
   * Applies damage. Returns false when the hit was ignored (dead or invulnerable), so
   * the caller never plays a hit reaction for a hit that did not happen.
   */
  damage(amount: number): boolean {
    if (!this.canBeHit) return false;
    const applied = Math.max(0, Math.floor(amount));
    if (applied === 0) return false;
    this.hpValue = Math.max(0, this.hpValue - applied);
    this.invulnerableTicksValue = COMBAT.player.invulnerableTicks;
    return true;
  }
}
