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
} as const;

/** Shared shape for the midpoint and final ending cards. */
export type EndingCopy = {
  readonly eyebrow: string;
  readonly title: string;
  readonly subtitle: string;
  readonly closeLabel: string;
};
