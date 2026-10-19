/** The read-only debug snapshot. This is the contract E2E tests and the F1 overlay use. */
export type GameDebugState = {
  /** True once boot() finished (renderer up, scene mounted, loop running). */
  ready: boolean;
  /** Backing-store size of the game canvas, in real pixels. */
  canvas: {
    width: number;
    height: number;
  };
  /** Rendered frames since boot. */
  frameCount: number;
  /** Simulation ticks since boot. */
  tickCount: number;
  /** Simulated seconds (tickCount * dt). */
  simTime: number;
  /** Smoothed real frames per second. */
  smoothedFps: number;
  /** Active renderer backend name (e.g. "webgl"). */
  renderer: string;
  /** Captured runtime errors; empty in a healthy session. */
  errors: string[];
};
