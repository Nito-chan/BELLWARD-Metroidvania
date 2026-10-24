/**
 * Final-act interaction tuning. The great bell hangs above a 172 px drop from the floor,
 * so the authored centre hook ring is the stable interaction position. Keep the radius
 * generous enough that hanging at the ring is comfortably inside it.
 */
export const FINAL_ACT = {
  /**
   * World-space distance from the player's feet to the great bell for the final note.
   * The prompt appears at the same radius so the affordance and the action agree.
   */
  bellInteractRadius: 96,
  /** The earned ending card. The midpoint card keeps its distinct slice copy. */
  ending: {
    eyebrow: 'THE LAST BELL',
    title: 'THE BELL REMEMBERS',
    subtitle: 'The Keeper sets down the bell. The water is still.',
    closeLabel: 'Continue the climb',
  },
  /**
   * The Drowning Toll's three flood steps, as world-space surface Y values. Step one
   * covers the floor; step two swallows the low ledges; step three stops just below the
   * high ledges, so every raise changes the safe route without ever flooding the rings.
   */
  flood: {
    levels: [304, 256, 224],
    damage: 1,
  },
} as const;

/** Surface Y for a flood step, or null before the first chain breaks. */
export function floodLineForLevel(level: number): number | null {
  if (!Number.isFinite(level) || level < 1) return null;
  const levels = FINAL_ACT.flood.levels;
  return levels[Math.min(Math.floor(level), levels.length) - 1] ?? null;
}

/** True when the hero's feet are below the water surface. Ledges are feet-above safe. */
export function isFlooded(feetY: number, lineY: number | null): boolean {
  return lineY !== null && feetY > lineY;
}

/** Shared shape for the midpoint and final ending cards. */
export type EndingCopy = {
  readonly eyebrow: string;
  readonly title: string;
  readonly subtitle: string;
  readonly closeLabel: string;
};
