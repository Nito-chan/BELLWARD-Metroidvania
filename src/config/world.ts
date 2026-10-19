/**
 * World / simulation constants. Every gameplay-tunable number lives under src/config —
 * logic files must not contain magic numbers (project rule). Values here are placeholders
 * until the owning milestone tunes them for real.
 */

/** Internal render resolution. All gameplay math runs in these units ("virtual pixels"). */
export const VIEW = {
  width: 640,
  height: 360,
} as const;

/** Simulation timing. The whole game is deterministic at a fixed 60 Hz step. */
export const SIM = {
  /** Fixed simulation step, in seconds (60 Hz). */
  dt: 1 / 60,
  /** Longest real-time stall simulated in one frame (spiral-of-death guard). */
  maxFrameTime: 0.25,
} as const;

/** World-level constants. */
export const WORLD = {
  /** Master seed for the gameplay RNG. Fixed so runs and replays are reproducible. */
  rngSeed: 0xb3115eed,
} as const;
