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
    hitShake: { strength: 2, ticks: 6 },
    /** Knockback applied to an enemy by a player hit. */
    knockback: { x: 120, y: -70 },
  },
  /** Radius used for projectile-vs-tile and projectile-vs-body checks, in pixels. */
  projectileRadius: 5,
  /** Fixed projectile slots; the pool reuses the shortest-lived slot when exhausted. */
  projectilePoolSize: 12,
  /** Radius drawn for projectile hit sparks, in pixels. */
  sparkRadius: 3,
} as const;
