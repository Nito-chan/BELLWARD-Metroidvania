/** Presentation constants: tile grid, camera feel and parallax depth. No gameplay numbers here. */

export const RENDER = {
  /** Edge length of one map tile, in virtual pixels. All candidate tilesets use a 16px grid. */
  tileSize: 16,
  /**
   * How many texture sources may share one Pixi batch. The generated batch shader
   * evaluates this many texture lookups for *every* pixel, so the default (16) turns
   * full-screen quads into a shader-loop benchmark: measured 15 fps vs 60 fps on
   * software WebGL. Two keeps the loop tiny and still batches the common cases.
   * See docs/DECISIONS.md D018.
   */
  maxBatchableTextures: 2,
  /** Draw order inside the world container. Higher values are drawn later (on top). */
  depth: {
    background: 0,
    tiles: 10,
    props: 20,
    actors: 30,
    foreground: 40,
  },
} as const;

export const CAMERA = {
  /** The focus point may drift this far from the screen center before the camera follows. */
  deadzone: { x: 40, y: 24 },
  /** Exponential smoothing applied once per fixed tick (0 = frozen, 1 = instant). */
  smoothing: 0.14,
} as const;

export const PARALLAX = {
  /** Camera scroll multiplier per background layer. 0 pins a layer to the screen. */
  far: 0.2,
  mid: 0.5,
  near: 0.8,
} as const;

/**
 * M1 showcase scene parameters. The scripted patrol exists only to prove the camera,
 * parallax and animation pipeline; M2's real player controller replaces it entirely.
 */
export const DEMO = {
  patrol: {
    /** Leftmost / rightmost feet position, in world pixels. */
    minX: 96,
    maxX: 680,
    /** Walk speed in pixels per second. */
    speed: 90,
    /** Idle pause at each end, in simulation ticks. */
    pauseTicks: 90,
  },
  /** The camera focuses slightly above the hero's feet. */
  focusOffsetY: -10,
} as const;
