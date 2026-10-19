/** Debug tooling configuration (F1 overlay and future dev tools). */
export const DEBUG = {
  /**
   * Overlay text refresh interval in rendered frames. ~6 updates/second at 60 fps:
   * frequent enough to be live, cheap enough to never matter for the frame budget.
   */
  overlayUpdateEveryFrames: 10,
} as const;
