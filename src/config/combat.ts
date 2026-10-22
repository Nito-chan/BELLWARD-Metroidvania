/**
 * Combat tuning: the player's survivability and the universal rules every hit obeys.
 * Per-enemy numbers live in `config/enemies.ts`; both files are asserted by the unit
 * suite so retuning is a visible, tested change (project rule: no gameplay numbers in
 * logic files).
 */
export const COMBAT = {
  player: {
    /** Five masks, the souls-like baseline. */
    maxHp: 5,
    /** Ticks of lost control after a hit (knockback owns the body during this time). */
    hurtTicks: 16,
    /** Invulnerability window after a hit, ticks. */
    invulnerableTicks: 60,
    /** Invulnerability granted on spawn, so a respawn is never instantly re-hit. */
    spawnInvulnerableTicks: 30,
    /** Ticks from death to the room reset. */
    deathTicks: 100,
    /** Knockback applied away from the damage source. */
    knockback: { x: 150, y: -170 },
    /** Horizontal bleed-off while hurt, px/s². */
    hurtFriction: 700,
    /** Damage per swing stage. Stage two is the chained heavy. */
    damage: { stage1: 1, stage2: 2 },
    /**
     * Swing hitbox, relative to the feet-center and extending toward facing.
     * The box starts `forward` pixels in front of the feet and is `width` wide.
     */
    attackBox: { forward: 4, width: 30, height: 24, top: 30 },
    /** Posture damage a Hookblade swing applies to its target. */
    attackPosture: 8,
    /** Freeze frames applied to the world on an impact (hitstop). */
    hitstopTicks: 4,
    hitShake: { strength: 2, ticks: 8 },
    hurtShake: { strength: 4, ticks: 12 },
    /** Red damage vignette fade, in ticks. */
    flashTicks: 16,
  },
  enemy: {
    /** Shared gravity for every grounded enemy. */
    gravity: 1800,
    maxFall: 620,
    hitstopTicks: 4,
    /** A guarded hit still freezes briefly, so the clang has weight. */
    blockedHitstopTicks: 2,
    hitShake: { strength: 2, ticks: 6 },
    /** Knockback applied to an enemy by a player hit. */
    knockback: { x: 120, y: -70 },
  },
  /**
   * The Keeper's Guard. Guard is held; the opening ticks of a fresh guard are the
   * deflect window, and the first beats of that window are the perfect parry. Repeated
   * taps inside `antiSpamWindowTicks` shrink the window on the authored ladder, so
   * mashing cannot make the hero invulnerable.
   */
  guard: {
    /** Player posture ceiling. Blocking spends it; parrying spends none. */
    maxPosture: 100,
    /** Deflect window by consecutive-guard count; the last value repeats. */
    deflectTicks: [10, 7, 5, 3],
    /** The opening ticks of a deflect that count as a perfect parry. */
    perfectTicks: 5,
    /** How long a fresh guard counts toward the anti-spam ladder. */
    antiSpamWindowTicks: 45,
    /** Ticks after releasing before guard may start again. */
    releaseLockTicks: 6,
    /** Posture spent when a block lands (perfect parries spend none). */
    blockPostureCost: 22,
    /** Ticks after the last posture change before it regenerates. */
    postureRegenDelayTicks: 45,
    /** Posture regained per tick once the delay has passed. */
    postureRegenPerTick: 0.55,
    /** Ticks of control loss after posture reaches zero. */
    brokenTicks: 60,
    /** Health lost when the guard shatters. */
    breakDamage: 1,
    /** Movement multiplier while guarding. */
    speedScale: 0.34,
    /** Posture added to the attacker by a perfect parry. */
    parryPostureDamage: 18,
    /** Ticks after a perfect parry in which the next swing is a counter. */
    counterTicks: 45,
    /** Extra damage the counter swing deals. */
    counterDamageBonus: 2,
    /** Extra posture the counter swing deals. */
    counterPostureBonus: 10,
    /** Ticks the parry animation owns the hero before guard resumes. */
    parryClipTicks: 10,
    parryShake: { strength: 3, ticks: 10 },
    blockShake: { strength: 2, ticks: 6 },
    breakShake: { strength: 5, ticks: 16 },
  },
  /**
   * A posture-broken enemy is open. The next player hit is the KNELL: a heavier strike
   * that ends lesser foes and takes a real bite out of a boss.
   */
  knell: {
    /** Damage multiplier applied to a hit that lands on a broken enemy. */
    damageMultiplier: 3,
    /** Freeze frames on the finisher. */
    hitstopTicks: 10,
    hitShake: { strength: 6, ticks: 18 },
  },
  /** Posture rules shared by every actor that can be broken. */
  posture: {
    /** Enemy posture regenerates after this many quiet ticks. */
    enemyRegenDelayTicks: 90,
    /** Enemy posture regained per tick once the delay has passed. */
    enemyRegenPerTick: 0.5,
    /** Ticks an enemy stays open after its posture fills. */
    brokenTicks: 70,
  },
  /** Radius used for projectile-vs-tile and projectile-vs-body checks, in pixels. */
  projectileRadius: 5,
  /** Fixed projectile slots; the pool reuses the shortest-lived slot when exhausted. */
  projectilePoolSize: 12,
  /** Radius drawn for projectile hit sparks, in pixels. */
  sparkRadius: 3,
} as const;
