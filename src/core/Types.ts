/** Shared primitive types. Pure data: no logic, no imports. */

/** A point in world space, in virtual pixels. */
export type Vec2 = {
  x: number;
  y: number;
};

/** An axis-aligned rectangle; `x`/`y` is the top-left corner in world space. */
export type Rect = {
  x: number;
  y: number;
  w: number;
  h: number;
};

/**
 * The typed map of every cross-system event. Systems communicate through
 * `EventBus<GameEvents>`; emitting an untyped event name is a compile error.
 */
export type GameEvents = {
  /** An entity died this tick (enemy, boss, or the player). */
  entityDied: { entityId: number };
  /**
   * The dropped Echo was recovered. The design doc listed this event under an old
   * placeholder name; the rename is recorded in docs/DECISIONS.md (D011).
   */
  echoRecovered: { amount: number };
  /** The player took damage. */
  playerHit: { sourceId: number; damage: number };
  /** A whole simulated second elapsed (telemetry for overlays/tests). */
  secondElapsed: { seconds: number };
};
