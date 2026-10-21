/** Collectible presentation and pickup affordance. */
export const PICKUP = {
  /** Horizontal reach of the hero's pickup aura, pixels. */
  radiusX: 18,
  /** Vertical reach, measured from the feet; generous because pickups float. */
  radiusY: 34,
  /** Ticks a pickup remains on screen after being granted (view bookkeeping). */
  fadeTicks: 0,
} as const;
