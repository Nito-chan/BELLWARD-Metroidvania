/** Debug tooling configuration (F1 overlay and future dev tools). */
export const DEBUG = {
  /**
   * Overlay text refresh interval in rendered frames. ~6 updates/second at 60 fps:
   * frequent enough to be live, cheap enough to never matter for the frame budget.
   */
  overlayUpdateEveryFrames: 10,
  /**
   * E2E-only i-frame extension (120 simulated seconds). Phase probes should fail on FSM
   * behavior, never on a headless frame stall letting the boss land a fifth hit.
   */
  protectTicks: 7_200,
} as const;
