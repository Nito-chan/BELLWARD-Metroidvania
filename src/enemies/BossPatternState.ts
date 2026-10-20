import { BOSS_PATTERNS } from '../config/bosses';
import type { BossPatternDef, BossPhaseDef } from '../config/bossTypes';
import type { Rng } from '../core/Rng';
import { chooseBossPattern } from './patternChoice';

/**
 * The boss's pattern clock, selection memory and rain-volley accounting. Keeping it out
 * of the FSM makes deterministic pacing testable and the Boss class readable.
 */
export class BossPatternState {
  private value: BossPatternDef | null = null;
  private tickValue = 0;
  private shotsValue = 0;
  private clockValue = 0;
  private lastId: string | null = null;
  private readonly cooldowns = new Map<string, number>();

  get pattern(): BossPatternDef | null {
    return this.value;
  }

  get tick(): number {
    return this.tickValue;
  }

  get clock(): number {
    return this.clockValue;
  }

  advanceClock(): void {
    this.clockValue += 1;
  }

  choose(phase: BossPhaseDef, rng: Rng, distance: number): BossPatternDef {
    return chooseBossPattern(
      phase,
      BOSS_PATTERNS,
      rng,
      distance,
      this.cooldowns,
      this.clockValue,
      this.lastId,
    );
  }

  begin(pattern: BossPatternDef): void {
    this.value = pattern;
    this.tickValue = 0;
    this.shotsValue = 0;
    this.lastId = pattern.id;
    this.cooldowns.set(pattern.id, this.clockValue + pattern.cooldownTicks);
  }

  /** Enter the active window: reset the per-window shot counter. */
  beginActive(pattern: BossPatternDef): void {
    this.tickValue = 0;
    this.shotsValue = pattern.kind === 'rain' ? 1 : 0;
  }

  advanceActive(): void {
    this.tickValue += 1;
  }

  /** Rain fires on its authored interval, up to the total shots for this window. */
  canFire(pattern: BossPatternDef): boolean {
    return (
      pattern.kind === 'rain' &&
      !!pattern.shotIntervalTicks &&
      this.tickValue % pattern.shotIntervalTicks === 0 &&
      this.shotsValue < (pattern.shots ?? Number.POSITIVE_INFINITY)
    );
  }

  recordShot(): void {
    this.shotsValue += 1;
  }

  clear(): void {
    this.value = null;
  }
}
