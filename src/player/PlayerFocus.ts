import { PLAYER } from '../config/player';
import { BellwardError } from '../core/Errors';

/**
 * Focus is the heal currency. It deliberately carries change between heals: three nail
 * hits pay for one mend, and the remainder is not thrown away.
 */
export class PlayerFocus {
  private value = 0;

  constructor(readonly max: number = PLAYER.focus.max) {
    if (!Number.isInteger(max) || max <= 0) {
      throw new BellwardError(`focus maximum must be a positive integer, got ${max}`);
    }
  }

  get current(): number {
    return this.value;
  }

  get full(): boolean {
    return this.value >= this.max;
  }

  get canHeal(): boolean {
    return this.value >= PLAYER.heal.cost;
  }

  /** Adds Focus, clamped. Returns the amount actually gained. */
  gain(amount: number): number {
    const before = this.value;
    this.value = Math.min(this.max, this.value + Math.max(0, Math.floor(amount)));
    return this.value - before;
  }

  /** Spends the heal cost. Returns false when the bar is short. */
  spendHeal(): boolean {
    if (!this.canHeal) return false;
    this.value -= PLAYER.heal.cost;
    return true;
  }

  refill(): void {
    this.value = this.max;
  }
}
