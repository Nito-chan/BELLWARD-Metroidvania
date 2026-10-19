import { BellwardError } from './Errors';

/**
 * Accumulator-based fixed timestep ("Fix Your Timestep" pattern).
 * Converts variable real elapsed time into an integer number of simulation steps,
 * clamping stalls so a slow frame can never trigger a spiral of death.
 */
export class FixedTimestep {
  /** Fixed step size, in seconds. */
  readonly dt: number;
  /** Upper bound applied to a single advance() call, in seconds. */
  readonly maxFrameTime: number;
  private accumulator = 0;

  constructor(dt: number, maxFrameTime: number) {
    if (!(dt > 0) || !Number.isFinite(dt)) {
      throw new BellwardError(`FixedTimestep dt must be a positive finite number, got ${dt}`);
    }
    if (!(maxFrameTime >= dt) || !Number.isFinite(maxFrameTime)) {
      throw new BellwardError(
        `FixedTimestep maxFrameTime must be finite and >= dt (${dt}), got ${maxFrameTime}`,
      );
    }
    this.dt = dt;
    this.maxFrameTime = maxFrameTime;
  }

  /**
   * Adds `elapsedSeconds` (clamped to maxFrameTime) to the accumulator and returns
   * how many fixed steps should run now. Negative input counts as zero; non-finite
   * input throws because it means the caller's clock is broken.
   */
  advance(elapsedSeconds: number): number {
    if (!Number.isFinite(elapsedSeconds)) {
      throw new BellwardError(`FixedTimestep.advance got non-finite time: ${elapsedSeconds}`);
    }
    const clamped = Math.min(Math.max(elapsedSeconds, 0), this.maxFrameTime);
    this.accumulator += clamped;
    // The epsilon absorbs floating-point drift so an exact-dt schedule never loses ticks.
    const steps = Math.floor(this.accumulator / this.dt + 1e-9);
    this.accumulator -= steps * this.dt;
    return steps;
  }

  /** Interpolation factor in [0, 1) for rendering between the previous and next tick. */
  get alpha(): number {
    if (this.accumulator <= 0) return 0;
    const alpha = this.accumulator / this.dt;
    return alpha >= 1 ? 0 : alpha;
  }

  /** Drops any partial step (used on reset / teleport / save-load). */
  reset(): void {
    this.accumulator = 0;
  }
}
