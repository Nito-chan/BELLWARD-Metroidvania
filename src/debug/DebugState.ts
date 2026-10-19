/** The read-only debug snapshot. This is the contract E2E tests and the F1 overlay use. */

/** Room/art snapshot for the active scene. */
export type SceneDebugState = {
  roomId: string;
  roomName: string;
  /** Number of non-empty tiles drawn for the room. */
  tiles: number;
  art: {
    mode: 'packed' | 'procedural';
    /** Packed texture keys that loaded successfully. */
    loaded: string[];
    /** Packed textures that fell back to procedural art. Should be empty in a healthy build. */
    failures: string[];
  };
  /** Smoothed camera top-left, in world pixels. */
  camera: { x: number; y: number };
  hero: {
    x: number;
    y: number;
    animation: string;
    facing: -1 | 1;
  };
};

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
  /** Active room snapshot; null until the scene mounts. */
  scene: SceneDebugState | null;
  /** Captured runtime errors; empty in a healthy session. */
  errors: string[];
};
