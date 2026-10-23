/**
 * Hookline tuning. The Hookline is the second traversal ability: a thrown line that
 * pulls the Keeper to a brass ring, holds for a beat, then hands control back. Longline
 * is its range upgrade. The numbers are feel constants; the unit suite proves the
 * derived behaviour (range gate, hang length, cooldown) so retuning is visible.
 */
export const HOOK = {
  /** The line leaves the hand this far above the feet. */
  handOffsetY: 28,
  /** Feet hang this far below the ring, so the hero is always clear of the mount. */
  hangOffsetY: 28,
  /** Hand-to-ring reach in pixels, before and after Longline. */
  range: { base: 176, long: 220 },
  /** Pull speed toward the ring, px/s. */
  zipSpeed: 420,
  /** Ticks the hero holds the ring before the grip gives out. */
  hangTicks: 18,
  /** Ticks after letting go before another hook may start. */
  cooldownTicks: 12,
  /** Rings closer than this are ignored: a zero-length pull has no value. */
  minRange: 24,
  /** Rings more than this far below the hand are ignored, so a hook never yanks down. */
  maxDrop: 44,
  /** A ring behind the facing direction by more than this is not auto-targeted. */
  backwardAllowance: 20,
  /** Score bonus for a ring ahead of the hero, px subtracted from the distance. */
  facingBias: 14,
  /** Score penalty for a ring below the hero, px added to the distance. */
  dropBias: 30,
  /** A zip this close to the target snaps into the hang. */
  snapDistance: 10,
  /** Jump-off launch, px/s. The vertical is deliberately softer than a full jump. */
  jumpX: 210,
  jumpY: 500,
  /** Rope drawing: segments and the sag at the middle of a hang. */
  ropeSegments: 10,
  ropeSag: 3,
  /** Radius of the target reticle around the best ring. */
  reticleRadius: 9,
  /** How far a rope sample advances per line-of-sight probe, px. */
  sightStep: 4,
} as const;
