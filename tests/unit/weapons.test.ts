import { describe, expect, it } from 'vitest';
import { ProjectilePool } from '../../src/combat/ProjectilePool';
import { COMBAT } from '../../src/config/combat';
import type { ActionName } from '../../src/config/input';
import { CENSER, TOLL, WEAPON_ORDER, nextWeapon, type WeaponId } from '../../src/config/weapons';
import { PlayerController } from '../../src/player/PlayerController';
import { PlayerCombat } from '../../src/player/PlayerCombat';
import { Tilemap } from '../../src/world/Tilemap';

const LEGEND = { F: 'floor', f: 'floorFill' } as const;
const EMPTY = ' '.repeat(20);
const GROUND = Tilemap.fromRows(
  [...Array.from({ length: 8 }, () => EMPTY), 'F'.repeat(20), 'f'.repeat(20)],
  LEGEND,
);

function input(pressed: readonly ActionName[] = []): Parameters<PlayerController['update']>[0] {
  return { held: new Set<ActionName>(), pressed: new Set(pressed), released: new Set() };
}

describe('weapon cycle', () => {
  it('cycles Nail → Censer → Toll → Nail when all are owned', () => {
    const owned = new Set<WeaponId>(['nail', 'censer', 'toll']);
    expect(nextWeapon('nail', owned)).toBe('censer');
    expect(nextWeapon('censer', owned)).toBe('toll');
    expect(nextWeapon('toll', owned)).toBe('nail');
  });

  it('skips weapons the run does not own', () => {
    const owned = new Set<WeaponId>(['nail', 'toll']);
    expect(nextWeapon('nail', owned)).toBe('toll');
    expect(nextWeapon('toll', owned)).toBe('nail');
  });

  it('never leaves the cycle when nothing else is owned', () => {
    const owned = new Set<WeaponId>(['nail']);
    expect(nextWeapon('nail', owned)).toBe('nail');
  });

  it('orders the arsenal Nail, Censer, Toll', () => {
    expect(WEAPON_ORDER).toEqual(['nail', 'censer', 'toll']);
  });
});

describe('weapon profiles', () => {
  it('Censer is a slow committed melee swing with no focus', () => {
    expect(CENSER.kind).toBe('melee');
    expect(CENSER.clipTicks).toBe(26);
    expect(CENSER.damage).toBe(3);
    expect(CENSER.posture).toBe(30);
    expect(CENSER.focusGain).toBe(0);
    expect(CENSER.hitbox.width).toBe(40);
  });

  it('Toll is a piercing wave with a cooldown and resonance', () => {
    expect(TOLL.kind).toBe('wave');
    expect(TOLL.clipTicks).toBe(20);
    expect(TOLL.cooldownTicks).toBe(45);
    expect(TOLL.wave.speed).toBe(240);
    expect(TOLL.wave.lifeTicks).toBe(60);
    expect(TOLL.focusGain).toBe(0);
  });
});

describe('PlayerCombat weapon profiles', () => {
  it('Nail keeps its two-stage damage and grants focus', () => {
    const combat = new PlayerCombat();
    expect(combat.weapon).toBe('nail');
    expect(combat.focusGain()).toBe(11);
  });

  it('Censer deals 3 damage and 30 posture and grants no focus', () => {
    const combat = new PlayerCombat();
    combat.setWeapon('censer');
    expect(combat.weapon).toBe('censer');
    expect(combat.focusGain()).toBe(0);
  });

  it('Toll deals 1 damage, 24 posture, grants no focus and starts on cooldown', () => {
    const combat = new PlayerCombat();
    combat.setWeapon('toll');
    expect(combat.tollCooldown).toBe(0);
    expect(combat.focusGain()).toBe(0);
  });
});

describe('PlayerController weapon switching', () => {
  it('starts with only the Nail owned', () => {
    const player = new PlayerController({ x: 100, y: 128 });
    expect(player.currentWeapon).toBe('nail');
    expect(player.weaponOwned).toEqual(['nail']);
    expect(player.hasCenser).toBe(false);
    expect(player.hasToll).toBe(false);
  });

  it('applies Censer and Toll ownership from the loadout', () => {
    const player = new PlayerController({ x: 100, y: 128 });
    player.applyLoadout({
      charms: [],
      nailLevel: 0,
      wallClaw: false,
      hookline: false,
      longline: false,
      censer: true,
      toll: false,
    });
    expect(player.hasCenser).toBe(true);
    expect(player.hasToll).toBe(false);
    // The Nail stays equipped until the player cycles; acquiring never forces a switch.
    expect(player.currentWeapon).toBe('nail');
    expect(player.weaponOwned).toEqual(['nail', 'censer']);

    player.applyLoadout({
      charms: [],
      nailLevel: 0,
      wallClaw: false,
      hookline: false,
      longline: false,
      censer: false,
      toll: true,
    });
    expect(player.hasToll).toBe(true);
    expect(player.weaponOwned).toEqual(['nail', 'toll']);
  });

  it('cycles through owned weapons on the weapon action', () => {
    const player = new PlayerController({ x: 100, y: 128 });
    player.applyLoadout({
      charms: [],
      nailLevel: 0,
      wallClaw: false,
      hookline: false,
      longline: false,
      censer: true,
      toll: true,
    });
    expect(player.currentWeapon).toBe('nail');
    player.update(input(['weapon']), GROUND);
    expect(player.currentWeapon).toBe('censer');
    player.update(input(['weapon']), GROUND);
    expect(player.currentWeapon).toBe('toll');
    player.update(input(['weapon']), GROUND);
    expect(player.currentWeapon).toBe('nail');
  });

  it('does not cycle while a swing owns the hero', () => {
    const player = new PlayerController({ x: 100, y: 128 });
    player.applyLoadout({
      charms: [],
      nailLevel: 0,
      wallClaw: false,
      hookline: false,
      longline: false,
      censer: true,
      toll: true,
    });
    player.update(input(['attack']), GROUND);
    for (let i = 0; i < 30 && !player.attackActive; i += 1) {
      player.update(input(), GROUND);
    }
    const before = player.currentWeapon;
    player.update(input(['weapon']), GROUND);
    expect(player.currentWeapon).toBe(before);
  });

  it('Censer hitbox is wider than the Nail and deals 3 / 30', () => {
    const player = new PlayerController({ x: 100, y: 128 });
    player.applyLoadout({
      charms: [],
      nailLevel: 0,
      wallClaw: false,
      hookline: false,
      longline: false,
      censer: true,
      toll: false,
    });
    player.update(input(['weapon']), GROUND);
    expect(player.currentWeapon).toBe('censer');
    player.update(input(['attack']), GROUND);
    for (let i = 0; i < 30 && !player.attackActive; i += 1) {
      player.update(input(), GROUND);
    }
    const box = player.attackHitbox();
    expect(box).not.toBeNull();
    expect(box!.w).toBeGreaterThan(COMBAT.player.attackBox.width);
    expect(player.attackDamage).toBe(3);
    expect(player.attackPostureDamage).toBe(30);
    expect(player.focusGain).toBe(0);
  });

  it('Toll waves retain their spawn lifetime for the ring animation', () => {
    const pool = new ProjectilePool(1);
    pool.spawn(100, 100, 1, 0, TOLL.wave.speed, TOLL.damage, TOLL.wave.lifeTicks, {
      style: 'bell',
      owner: 'player',
    });
    const slot = pool.all[0]!;
    expect(slot.maxLifeTicks).toBe(TOLL.wave.lifeTicks);
    expect(slot.ticksLeft).toBe(TOLL.wave.lifeTicks);
  });
});
