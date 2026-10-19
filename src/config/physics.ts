/**
 * Collision solver constants. Deliberately separate from player tuning: the solver is
 * shared by every moving body (enemies, bosses and projectiles later).
 */
export const PHYSICS = {
  /**
   * Movement is split into sub-steps no longer than this, in pixels. Keeping each step
   * shorter than the 16px tile grid means no velocity can tunnel through a surface.
   */
  maxStep: 8,
  /**
   * When a rising body clips the corner of a ceiling by at most this many pixels, it is
   * nudged sideways instead of stopped. This is the "corner forgiveness" that makes a
   * jump next to a ledge edge feel fair rather than fussy.
   */
  cornerCorrection: 6,
} as const;
