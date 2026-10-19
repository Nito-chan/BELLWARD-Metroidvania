/**
 * Player tuning. These numbers are the feel contract, and every derived figure quoted in
 * the comments is asserted by `tests/unit/player.test.ts` — so retuning is a visible,
 * tested change rather than a silent drift.
 */
export const PLAYER = {
  /** Collision box (AABB), feet-centered and deliberately narrower than the sprite. */
  size: { w: 12, h: 34 },
  ground: {
    /** Acceleration while a direction is held, px/s². */
    accel: 900,
    /** Run speed cap, px/s (8.75 tiles/s). */
    maxRun: 140,
    /** Deceleration when no direction is held, px/s². */
    friction: 1500,
    /** Deceleration when the input opposes the current motion (skid), px/s². */
    skidDecel: 2600,
  },
  air: {
    /** Air acceleration and cap: slightly weaker than ground control, by design. */
    accel: 700,
    maxRun: 140,
    /** Deceleration while airborne with no input, px/s². */
    drag: 300,
  },
  /**
   * Jump feel. Speed 560 with rise gravity 2100 gives an apex just under 75 px
   * (≈4.6 tiles), which clears the 64 px climb from the dais to the beam with margin.
   */
  jump: {
    /** Initial upward speed, px/s. */
    speed: 560,
    /** Gravity while rising, px/s². */
    gravity: 2100,
    /** Gravity while falling, px/s²: heavier than the rise, so falls read as decided. */
    fallGravity: 2500,
    /** Terminal fall speed, px/s. */
    maxFall: 760,
    /** Releasing jump early clamps the rise to this speed: a tap rises ≈30 px. */
    cutSpeed: 170,
    /** Near the apex (|vy| below this) gravity is scaled to lengthen the readable hang. */
    apexSpeed: 90,
    apexGravityScale: 0.55,
    /** Jump pressed within this many ticks of landing still fires on touchdown. */
    bufferTicks: 8,
    /** Ticks after walking off a ledge during which a jump still counts. */
    coyoteTicks: 7,
  },
  /** Dash: a short ground/air burst on a cooldown. Ability gating arrives with the map. */
  dash: {
    /** Dash speed, px/s. */
    speed: 300,
    /** Dash duration, ticks. */
    ticks: 11,
    /** Ticks before another dash may start. */
    cooldownTicks: 24,
    /** Fraction of dash speed kept when the dash ends (capped at run speed). */
    exitSpeedScale: 0.6,
  },
  attack: {
    /** Attack pressed within this many ticks of the swing ending still fires. */
    bufferTicks: 6,
    /** Fraction of ground control kept while swinging. */
    speedScale: 0.35,
    /**
     * Clip lengths in ticks. The unit suite cross-checks these against the authored
     * clips in `src/data/art.ts` so the windows below can never drift from the art.
     */
    clipTicks: { stage1: 16, stage2: 20 },
    /** Active damage windows, in ticks since the swing started (combat lands in M4). */
    windows: {
      stage1: { start: 4, end: 11 },
      stage2: { start: 5, end: 15 },
    },
  },
  /** Speed (px/s) above which a direction flip plays the turn clip instead of running. */
  skidMinSpeed: 70,
  /** Speed (px/s) below which the hero counts as standing still. */
  idleSpeed: 6,
  /** Down + jump ignores one-way platforms for this many ticks. */
  dropThroughTicks: 12,
  /** Downward nudge that starts a drop-through, px/s. */
  dropThroughSpeed: 40,
} as const;
