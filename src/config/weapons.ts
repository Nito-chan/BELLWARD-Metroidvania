/**
 * Weapon profiles for the attack arsenal: Nail, Censer, Toll.
 *
 * Nail keeps its existing two-stage timing in `config/player.ts` and `config/combat.ts`;
 * Censer and Toll are single-strike weapons whose profiles live here. Hookline is the
 * fourth weapon but stays on `cast` and is never part of the attack cycle.
 *
 * Numbers are gameplay constants; the unit suite asserts derived behaviour so retuning
 * is a visible, tested change rather than a silent drift.
 */

import { COMBAT } from './combat';
import { PLAYER } from './player';

/** The three weapons that share the attack button, in cycle order. */
export type WeaponId = 'nail' | 'censer' | 'toll';

/** Hookline stays on `cast` and is never part of the attack cycle. */
export const HOOKLINE_ID = 'hookline' as const;

/** Cycle order: Nail → Censer → Toll → Nail. Only owned weapons appear in the cycle. */
export const WEAPON_ORDER: readonly WeaponId[] = ['nail', 'censer', 'toll'];

/** The weapon the run starts with. */
export const STARTER_WEAPON: WeaponId = 'nail';

export type WeaponKind = 'melee' | 'wave';

export type WeaponProfile = {
  readonly id: WeaponId;
  readonly kind: WeaponKind;
  /** Clip length in ticks; the swing owns the hero for this long. */
  readonly clipTicks: number;
  /** Active damage window, ticks since the swing started. */
  readonly active: { readonly start: number; readonly end: number };
  /** Movement speed scale while the swing is active. */
  readonly speedScale: number;
  /** Damage dealt by a landed hit. */
  readonly damage: number;
  /** Posture damage dealt by a landed hit. */
  readonly posture: number;
  /** Focus gained per enemy hit (0 = none; the Nail is the Focus engine). */
  readonly focusGain: number;
};

/** The Toll's resonance mark: how long a hit enemy stays marked, and the bonus the next
 * Nail or Censer hit deals to a resonant enemy (consuming the mark). */
export const RESONANCE = {
  ticks: 180,
  damageBonus: 2,
  postureBonus: 10,
} as const;

export type CenserProfile = WeaponProfile & {
  readonly kind: 'melee';
  /** Hitbox, relative to feet-center and extending toward facing. */
  readonly hitbox: {
    readonly forward: number;
    readonly width: number;
    readonly height: number;
    readonly top: number;
  };
  /** Leaves a brine cloud at the target that ticks posture for 90 ticks. */
  readonly cloud: true;
};

export type TollProfile = WeaponProfile & {
  readonly kind: 'wave';
  /** Ring projectile: speed, life, reach and size. */
  readonly wave: {
    readonly speed: number; // px/s
    readonly lifeTicks: number;
    readonly range: number; // px
    readonly size: { readonly w: number; readonly h: number };
  };
  /** Cooldown before another ring may start. */
  readonly cooldownTicks: number;
  /** Resonance mark: how long a hit enemy stays marked (ticks). */
  readonly resonanceTicks: number;
  /** Bonus the next Nail/Censer hit deals to a resonant enemy. */
  readonly resonanceDamageBonus: number;
  readonly resonancePostureBonus: number;
};

export const CENSER: CenserProfile = {
  id: 'censer',
  kind: 'melee',
  clipTicks: 26,
  active: { start: 9, end: 15 },
  speedScale: 0.35,
  damage: 3,
  posture: 30,
  focusGain: 0,
  hitbox: { forward: 6, width: 40, height: 52, top: 48 },
  cloud: true,
};

export const TOLL: TollProfile = {
  id: 'toll',
  kind: 'wave',
  clipTicks: 20,
  active: { start: 6, end: 11 },
  speedScale: 0.4,
  damage: 1,
  posture: 24,
  focusGain: 0,
  wave: { speed: 240, lifeTicks: 60, range: 240, size: { w: 22, h: 30 } },
  cooldownTicks: 45,
  resonanceTicks: RESONANCE.ticks,
  resonanceDamageBonus: RESONANCE.damageBonus,
  resonancePostureBonus: RESONANCE.postureBonus,
};

/** The legacy Nail profile expressed as a WeaponProfile for shared helpers. */
export const NAIL_PROFILE: WeaponProfile = {
  id: 'nail',
  kind: 'melee',
  clipTicks: PLAYER.attack.clipTicks.stage1,
  active: PLAYER.attack.windows.stage1,
  speedScale: PLAYER.attack.speedScale,
  damage: COMBAT.player.damage.stage1,
  posture: COMBAT.player.attackPosture,
  focusGain: PLAYER.focus.gainPerHit,
};

export const WEAPON_PROFILES: Readonly<Record<WeaponId, WeaponProfile>> = {
  nail: NAIL_PROFILE,
  censer: CENSER,
  toll: TOLL,
};

/**
 * Advances the cycle one step, skipping weapons the player does not own. The Nail is
 * always owned; Hookline is excluded because it lives on `cast`.
 */
export function nextWeapon(current: WeaponId, owned: ReadonlySet<WeaponId>): WeaponId {
  let index = WEAPON_ORDER.indexOf(current);
  let next = WEAPON_ORDER[(index + 1) % WEAPON_ORDER.length] as WeaponId;
  while (!owned.has(next) && next !== current) {
    index = WEAPON_ORDER.indexOf(next);
    next = WEAPON_ORDER[(index + 1) % WEAPON_ORDER.length] as WeaponId;
  }
  return next;
}
