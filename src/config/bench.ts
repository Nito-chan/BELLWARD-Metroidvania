/**
 * Bench interaction tuning. Distances are feet-center offsets in world pixels, so the
 * prompt appears naturally at either side of the stone seat without requiring pixel-perfect
 * alignment.
 */
export const BENCH = {
  /** Half-width of the rest interaction zone around the bench marker. */
  interactRadiusX: 46,
  /** Half-height of the rest interaction zone. */
  interactRadiusY: 30,
  /** Height of the floating focus diamond above the seat. */
  markerOffsetY: 50,
} as const;
