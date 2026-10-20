import { COMBAT } from '../config/combat';

/**
 * The player's survivability: health, invulnerability frames and death. Kept apart from
 * the locomotion state machine so both are testable in isolation and the controller file
 * stays focused on movement.
 */
export class PlayerVitals {
  private hpValue: number = COMBAT.player.maxHp;
  private invulnerableTicksValue: number = COMBAT.player.spawnInvulnerableTicks;

  get hp(): number {
    return this.hpValue;
  }

  get maxHp(): number {
    return COMBAT.player.maxHp;
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
