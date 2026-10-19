import { BellwardError } from './Errors';

/**
 * Deterministic PRNG (mulberry32, by Tommy Ettinger — public domain).
 * All gameplay randomness must come from here, never Math.random(), so that
 * replays, saves and tests are reproducible.
 */
export class Rng {
  private state: number;

  constructor(seed: number) {
    if (!Number.isFinite(seed)) {
      throw new BellwardError(`Rng seed must be a finite number, got ${seed}`);
    }
    this.state = seed >>> 0;
  }

  /** Uniform float in [0, 1). */
  next(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Uniform integer in [min, max] (both inclusive). */
  int(min: number, max: number): number {
    if (!Number.isInteger(min) || !Number.isInteger(max) || min > max) {
      throw new BellwardError(`Rng.int invalid bounds: [${min}, ${max}]`);
    }
    return min + Math.floor(this.next() * (max - min + 1));
  }

  /** Uniform float in [min, max). */
  float(min: number, max: number): number {
    if (!(min < max)) {
      throw new BellwardError(`Rng.float invalid bounds: [${min}, ${max}]`);
    }
    return min + this.next() * (max - min);
  }

  /** True with probability `p` (0 → never, 1 → always). */
  chance(p: number): boolean {
    if (p < 0 || p > 1) {
      throw new BellwardError(`Rng.chance probability must be in [0, 1], got ${p}`);
    }
    return this.next() < p;
  }

  /** Uniform element of `items`; throws on empty input. */
  pick<T>(items: readonly T[]): T {
    // Safe by construction: pickIndex validated the index against this length.
    return items[this.pickIndex(items.length)] as T;
  }

  /** Uniform index in [0, count); throws on empty input. */
  pickIndex(count: number): number {
    if (!Number.isInteger(count) || count <= 0) {
      throw new BellwardError(`Rng.pickIndex count must be a positive integer, got ${count}`);
    }
    return Math.floor(this.next() * count);
  }

  /** A new independent RNG derived from this stream (per-subsystem streams). */
  fork(): Rng {
    return new Rng(Math.floor(this.next() * 0xffffffff));
  }

  /** Snapshot for save files and test reproducibility. */
  getState(): number {
    return this.state;
  }

  /** Restores a snapshot previously returned by getState(). */
  setState(state: number): void {
    if (!Number.isInteger(state) || state < 0 || state > 0xffffffff) {
      throw new BellwardError(`Rng.setState expects a uint32, got ${state}`);
    }
    this.state = state;
  }
}
