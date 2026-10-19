import { BellwardError } from './Errors';
import { FixedTimestep } from './FixedTimestep';

export type LoopOptions = {
  /** Fixed simulation step, in seconds. */
  dt: number;
  /** Spiral-of-death guard: longest stall simulated in a single frame. */
  maxFrameTime: number;
  /** One deterministic simulation tick. Must not render or touch the DOM. */
  step: () => void;
  /** Called once per displayed frame with the interpolation alpha in [0, 1). */
  render: (alpha: number) => void;
  /** Called when step()/render() throws; the loop stops either way. */
  onError?: (error: unknown) => void;
  /** Injectable frame scheduler (tests pass a manual one; default is requestAnimationFrame). */
  requestFrame?: (callback: (timeMs: number) => void) => number;
  cancelFrame?: (handle: number) => void;
};

export type LoopStats = {
  /** Total simulation ticks since start. */
  tickCount: number;
  /** Total rendered frames since start. */
  frameCount: number;
  /** Simulated seconds (tickCount * dt, drift-free). */
  simTime: number;
  /** Seconds of real time used by the last rendered frame (after time scaling). */
  lastFrameSeconds: number;
  /** Exponentially smoothed real frames per second (for the debug overlay). */
  smoothedFps: number;
};

/**
 * Owns the run loop: one animation-frame chain, one accumulator, a fixed 60 Hz
 * simulation and variable-rate rendering with an interpolation alpha.
 * Rendering never drives simulation; pause/time-scale affect simulation only.
 */
export class Loop {
  private readonly options: LoopOptions;
  private readonly timestep: FixedTimestep;
  private running = false;
  private paused = false;
  private timeScaleValue = 1;
  private pendingFrame: number | null = null;
  private lastTimeMs: number | null = null;

  readonly stats: LoopStats = {
    tickCount: 0,
    frameCount: 0,
    simTime: 0,
    lastFrameSeconds: 0,
    smoothedFps: 0,
  };

  constructor(options: LoopOptions) {
    this.options = options;
    this.timestep = new FixedTimestep(options.dt, options.maxFrameTime);
  }

  get isRunning(): boolean {
    return this.running;
  }

  get isPaused(): boolean {
    return this.paused;
  }

  /** Current simulation speed multiplier. */
  get timeScale(): number {
    return this.timeScaleValue;
  }

  /** The fixed simulation step, in seconds. */
  get dt(): number {
    return this.timestep.dt;
  }

  /** Starts the frame chain. Idempotent. */
  start(): void {
    if (this.running) return;
    this.running = true;
    this.lastTimeMs = null;
    this.schedule();
  }

  /** Stops the frame chain and cancels the pending frame. */
  stop(): void {
    if (!this.running) return;
    this.running = false;
    if (this.pendingFrame !== null) {
      this.cancel(this.pendingFrame);
      this.pendingFrame = null;
    }
  }

  /** Freezes simulation time (rendering continues; menus use this). */
  pause(): void {
    this.paused = true;
  }

  resume(): void {
    this.paused = false;
  }

  /** Simulation speed multiplier (slow-motion, hit-stop). Affects ticks, not rendering. */
  setTimeScale(scale: number): void {
    // Written as !(x >= 0) so NaN is rejected too.
    if (!(scale >= 0) || !Number.isFinite(scale)) {
      throw new BellwardError(`Loop.setTimeScale expects a finite number >= 0, got ${scale}`);
    }
    this.timeScaleValue = scale;
  }

  private readonly request = (callback: (timeMs: number) => void): number =>
    this.options.requestFrame
      ? this.options.requestFrame(callback)
      : requestAnimationFrame(callback);

  private readonly cancel = (handle: number): void => {
    if (this.options.cancelFrame) {
      this.options.cancelFrame(handle);
    } else {
      cancelAnimationFrame(handle);
    }
  };

  private schedule(): void {
    this.pendingFrame = this.request(this.onFrame);
  }

  private readonly onFrame = (timeMs: number): void => {
    this.pendingFrame = null;
    if (!this.running) return;

    let elapsedSeconds = 0;
    if (this.lastTimeMs !== null) {
      elapsedSeconds = (timeMs - this.lastTimeMs) / 1000;
    }
    this.lastTimeMs = timeMs;

    const scaled = elapsedSeconds * this.timeScaleValue;

    try {
      if (!this.paused) {
        const steps = this.timestep.advance(scaled);
        for (let i = 0; i < steps; i += 1) {
          this.options.step();
          this.stats.tickCount += 1;
        }
        this.stats.simTime = this.stats.tickCount * this.timestep.dt;
      }

      this.stats.lastFrameSeconds = scaled;
      if (elapsedSeconds > 0) {
        const instantFps = 1 / elapsedSeconds;
        this.stats.smoothedFps =
          this.stats.smoothedFps === 0
            ? instantFps
            : this.stats.smoothedFps * 0.9 + instantFps * 0.1;
      }
      this.stats.frameCount += 1;
      this.options.render(this.timestep.alpha);
    } catch (error) {
      this.stop();
      if (this.options.onError) {
        this.options.onError(error);
      } else {
        throw error;
      }
      return;
    }

    this.schedule();
  };
}
