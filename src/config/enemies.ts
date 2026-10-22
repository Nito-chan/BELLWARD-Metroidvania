/**
 * Actor tuning. One entry per enemy or boss kind; behavior classes read these numbers
 * and never hard-code a speed, range, damage or duration.
 *
 * The three regular enemies cover three combat verbs:
 * - `parishioner` shuffles and claws: the slow, readable introduction;
 * - `ghoul` charges and lunges: punishes standing still;
 * - `adept` holds ground and throws fire: forces the player to close the distance.
 *
 * Bosses share the same body/health/physics contract, but their attack vocabulary is
 * authored in `config/bosses.ts` because a boss is a sequence of telegraphed phases,
 * not one melee loop.
 */
export type EnemyKind = 'parishioner' | 'ghoul' | 'adept';
export type BossKind = 'bellbearer' | 'wardenMoss' | 'bellThief';
export type ActorKind = EnemyKind | BossKind;

/** A forward hitbox, relative to the owner's feet-center. Mirrors COMBAT.player.attackBox. */
export type AttackBoxDef = {
  readonly forward: number;
  readonly width: number;
  readonly height: number;
  /** Distance from the feet up to the box's top edge. */
  readonly top: number;
};

export type MeleeDef = {
  /** Distance (feet-center to feet-center) at which the attack starts. */
  readonly range: number;
  readonly damage: number;
  readonly windupTicks: number;
  readonly activeTicks: number;
  readonly recoverTicks: number;
  readonly cooldownTicks: number;
  readonly box: AttackBoxDef;
  /** Forward speed while the active window is open (0 = rooted). */
  readonly lungeSpeed: number;
  /** A red attack: guard cannot stop it, so the tell must be answered with a step. */
  readonly unblockable?: boolean;
};

export type CastDef = {
  /** Horizontal and vertical range at which the enemy commits to a cast. */
  readonly range: number;
  readonly verticalRange: number;
  readonly windupTicks: number;
  /** Tick inside the windup at which the projectile leaves the caster. */
  readonly spawnTick: number;
  readonly recoverTicks: number;
  readonly cooldownTicks: number;
  readonly projectile: {
    readonly speed: number;
    readonly damage: number;
    readonly lifeTicks: number;
  };
};

export type EnemyStats = {
  readonly displayName: string;
  readonly hp: number;
  /** Collision box, narrower than the sprite. */
  readonly body: { readonly w: number; readonly h: number };
  readonly patrolSpeed: number;
  readonly chaseSpeed: number;
  /** Distance at which an idle enemy notices the player. */
  readonly aggroRange: number;
  /** Distance past which a chasing enemy gives up (must exceed aggroRange). */
  readonly deaggroRange: number;
  /** Vertical tolerance for noticing/casting, in pixels. */
  readonly verticalRange: number;
  /** Ticks of hit-stun after a player hit. */
  readonly staggerTicks: number;
  /** Posture ceiling. Hits and parries fill it; at zero the actor is open to a KNELL. */
  readonly posture: number;
  readonly contactDamage: number;
  readonly melee?: MeleeDef;
  readonly cast?: CastDef;
};

export const ENEMIES: Readonly<Record<ActorKind, EnemyStats>> = {
  parishioner: {
    displayName: 'Drowned Parishioner',
    hp: 3,
    body: { w: 14, h: 40 },
    patrolSpeed: 22,
    chaseSpeed: 46,
    aggroRange: 100,
    deaggroRange: 190,
    verticalRange: 36,
    staggerTicks: 14,
    posture: 24,
    contactDamage: 1,
    melee: {
      range: 24,
      damage: 1,
      windupTicks: 20,
      activeTicks: 8,
      recoverTicks: 24,
      cooldownTicks: 40,
      box: { forward: 2, width: 22, height: 30, top: 34 },
      lungeSpeed: 0,
    },
  },
  ghoul: {
    displayName: 'Burning Ghoul',
    hp: 5,
    body: { w: 18, h: 52 },
    patrolSpeed: 32,
    chaseSpeed: 86,
    aggroRange: 150,
    deaggroRange: 260,
    verticalRange: 40,
    staggerTicks: 10,
    posture: 36,
    contactDamage: 1,
    melee: {
      range: 44,
      damage: 2,
      windupTicks: 16,
      activeTicks: 10,
      recoverTicks: 26,
      cooldownTicks: 50,
      box: { forward: 2, width: 28, height: 38, top: 46 },
      lungeSpeed: 190,
      unblockable: true,
    },
  },
  adept: {
    displayName: 'Cinder Adept',
    hp: 4,
    body: { w: 16, h: 56 },
    // The adept never walks; it holds its ground and casts.
    patrolSpeed: 0,
    chaseSpeed: 0,
    aggroRange: 150,
    deaggroRange: 210,
    verticalRange: 32,
    staggerTicks: 12,
    posture: 28,
    contactDamage: 1,
    cast: {
      range: 150,
      verticalRange: 32,
      windupTicks: 30,
      spawnTick: 18,
      recoverTicks: 20,
      cooldownTicks: 140,
      projectile: { speed: 165, damage: 1, lifeTicks: 120 },
    },
  },
  bellbearer: {
    displayName: 'The Bellbearer',
    hp: 16,
    body: { w: 26, h: 54 },
    patrolSpeed: 0,
    chaseSpeed: 0,
    aggroRange: 0,
    deaggroRange: 0,
    verticalRange: 0,
    staggerTicks: 0,
    posture: 90,
    contactDamage: 1,
  },
  wardenMoss: {
    displayName: 'Warden Moss',
    hp: 26,
    body: { w: 30, h: 58 },
    patrolSpeed: 0,
    chaseSpeed: 0,
    aggroRange: 0,
    deaggroRange: 0,
    verticalRange: 0,
    staggerTicks: 0,
    posture: 120,
    contactDamage: 1,
  },
  bellThief: {
    displayName: 'The Bell Thief',
    hp: 32,
    body: { w: 24, h: 58 },
    patrolSpeed: 0,
    chaseSpeed: 0,
    aggroRange: 0,
    deaggroRange: 0,
    verticalRange: 0,
    staggerTicks: 0,
    posture: 150,
    contactDamage: 1,
  },
};

export const ENEMY_KINDS: readonly EnemyKind[] = ['parishioner', 'ghoul', 'adept'];
export const BOSS_KINDS: readonly BossKind[] = ['bellbearer', 'wardenMoss', 'bellThief'];
export const ACTOR_KINDS: readonly ActorKind[] = [...ENEMY_KINDS, ...BOSS_KINDS];

export function isBossKind(kind: ActorKind): kind is BossKind {
  return (BOSS_KINDS as readonly ActorKind[]).includes(kind);
}

export function isEnemyKind(kind: ActorKind): kind is EnemyKind {
  return (ENEMY_KINDS as readonly ActorKind[]).includes(kind);
}
