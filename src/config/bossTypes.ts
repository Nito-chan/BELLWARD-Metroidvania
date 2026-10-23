import type { SfxKey } from '../data/audio';
import type { AttackBoxDef, BossKind } from './enemies';

/**
 * Data contract for a boss encounter. A boss is a sequence of phases; each phase owns a
 * weighted pool of telegraphed patterns. All durations are fixed simulation ticks so a
 * pattern reads the same on every machine and can be asserted in a unit test.
 */

/** Projectile visuals. The pool stores this as data; the view only maps it to a tint. */
export type BossProjectileStyle = 'spore' | 'wave' | 'coin' | 'bell';

/**
 * Pattern archetypes:
 * - `charge` / `dash` travel across the floor while their box is open;
 * - `sweep` is a rooted low box;
 * - `slam` / `dive` send ground waves outward;
 * - `rain` drops shots from the ceiling over time;
 * - `fan` / `ring` fire aimed or radial volleys;
 * - `teleport` vanishes and reappears behind the player before striking.
 */
export type BossPatternKind =
  'charge' | 'dash' | 'sweep' | 'slam' | 'dive' | 'rain' | 'fan' | 'ring' | 'teleport';

export type BossPatternDef = {
  readonly id: string;
  readonly kind: BossPatternKind;
  /** Relative chance inside a phase. Must be positive. */
  readonly weight: number;
  /** Warning window. Every pattern must be at least `BOSS_FAIRNESS.minTelegraphTicks`. */
  readonly telegraphTicks: number;
  readonly activeTicks: number;
  readonly recoverTicks: number;
  readonly cooldownTicks: number;
  readonly damage: number;
  /** The melee box opened during the active window, if the pattern has one. */
  readonly box?: AttackBoxDef;
  /** Horizontal speed during the active window, px/s. */
  readonly speed?: number;
  /**
   * A red pattern: guard cannot stop it and a perfect parry does not answer it. The
   * telegraph turns blood-red and the player must move.
   */
  readonly unblockable?: boolean;
  /** End the active window in a stagger after hitting a wall. */
  readonly wallStunTicks?: number;
  /** Bellbearer only: a wall impact breaks the back-mounted bell shield. */
  readonly breakWardOnWall?: boolean;
  /** Teleport patterns hide the body this many ticks before the strike. */
  readonly hideTicks?: number;
  /** Spawn ground waves at the start of the active window. */
  readonly shockwave?: boolean;
  /** Number of shots for fan/ring, or the total rain shots in one active window. */
  readonly shots?: number;
  /** Fan spread, radians total. */
  readonly spreadRadians?: number;
  readonly shotSpeed?: number;
  readonly shotGravity?: number;
  readonly shotLifeTicks?: number;
  readonly shotStyle?: BossProjectileStyle;
  /** Rain only: ticks between volleys. */
  readonly shotIntervalTicks?: number;
  /** Optional distance filter, measured feet-center to feet-center. */
  readonly minRange?: number;
  readonly maxRange?: number;
  readonly tellSfx: SfxKey;
  readonly activeSfx?: SfxKey;
};

export type BossPhaseDef = {
  readonly id: string;
  readonly name: string;
  /** Entered when HP falls to this fraction of maximum (the first phase is at 1). */
  readonly threshold: number;
  readonly patterns: readonly string[];
  /** Idle gap between patterns, inclusive tick bounds. */
  readonly idleTicks: readonly [number, number];
  /** Invulnerable transition on entering this phase. */
  readonly transitionTicks: number;
  /** Multiplier applied to pattern movement speeds in this phase. */
  readonly speedScale: number;
};

export type BossDef = {
  readonly kind: BossKind;
  readonly introTicks: number;
  /** Ticks the corpse lingers before its view fades out. */
  readonly deathFadeTicks: number;
  /** A shield that blocks every hit until its wall-charge condition is met. */
  readonly gate?: 'bellShield';
  /** The Last Keeper's phases are mechanic-driven rather than health-based. */
  readonly mode?: 'lastKeeper';
  readonly wardBreakStunTicks?: number;
  /** Human-readable reward name used by the victory banner and progress log. */
  readonly rewardName: string;
  readonly phases: readonly BossPhaseDef[];
};

/** Boss fairness constants, asserted by the content tests rather than trusted by sight. */
export const BOSS_FAIRNESS = {
  minTelegraphTicks: 18,
  minIdleTicks: 20,
  maxIdleTicks: 150,
  /**
   * The Bellbearer's shield only shatters when the charge crashes into a wall while the
   * player is close enough to have deliberately baited it there. Without this guard the
   * boss's first arena-wide charge would always solve its own gate.
   */
  wardBreakRadius: 64,
} as const;

/** One sigil is worth one extra mask for the current run; M7 persists it. */
export const BOSS_REWARDS = {
  maxHpPerSigil: 1,
} as const;
