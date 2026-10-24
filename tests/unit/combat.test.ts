import { describe, expect, it } from 'vitest';
import { CombatSystem } from '../../src/combat/CombatSystem';
import { ProjectilePool } from '../../src/combat/ProjectilePool';
import { COMBAT } from '../../src/config/combat';
import { ENEMIES } from '../../src/config/enemies';
import type { ActionName } from '../../src/config/input';
import { TOLL, RESONANCE } from '../../src/config/weapons';
import type { EnemyHazard } from '../../src/enemies/Enemy';
import { MeleeEnemy } from '../../src/enemies/MeleeEnemy';
import type { InputSnapshot } from '../../src/input/InputState';
import { PlayerController } from '../../src/player/PlayerController';
import { Tilemap } from '../../src/world/Tilemap';

const LEGEND = { F: 'floor', f: 'floorFill' } as const;
const EMPTY = ' '.repeat(20);
const GROUND = Tilemap.fromRows(
  [...Array.from({ length: 8 }, () => EMPTY), 'F'.repeat(20), 'f'.repeat(20)],
  LEGEND,
);

class HazardEnemy extends MeleeEnemy {
  hazardId = 1;

  override activeHazard(): EnemyHazard | null {
    return {
      id: this.hazardId,
      box: { x: 0, y: 0, w: 400, h: 200 },
      damage: 1,
      unblockable: true,
      sourceX: this.feet.x,
    };
  }
}

class SealedEnemy extends MeleeEnemy {
  override get damageBlocked(): boolean {
    return true;
  }
}

function input(
  held: readonly ActionName[] = [],
  pressed: readonly ActionName[] = [],
): InputSnapshot {
  return { held: new Set(held), pressed: new Set(pressed), released: new Set() };
}

/** Runs the controller until spawn invulnerability has expired. */
function expireSpawnInvuln(player: PlayerController): void {
  for (let i = 0; i < COMBAT.player.spawnInvulnerableTicks; i += 1) {
    player.update(input(), GROUND);
  }
}

/** Presses attack and steps until the damage window is open. */
function swingUntilActive(player: PlayerController): void {
  player.update(input([], ['attack']), GROUND);
  for (let i = 0; i < 30 && !player.attackActive; i += 1) {
    player.update(input(), GROUND);
  }
  expect(player.attackActive).toBe(true);
}

describe('player damage', () => {
  it('ignores hits during spawn invulnerability', () => {
    const player = new PlayerController({ x: 80, y: 128 });
    expect(player.invulnerableTicks).toBeGreaterThan(0);
    expect(player.takeDamage(1, 200)).toBe(false);
    expect(player.hp).toBe(COMBAT.player.maxHp);
  });

  it('loses health, enters hurt, and knocks away from the source', () => {
    const player = new PlayerController({ x: 80, y: 128 });
    expireSpawnInvuln(player);

    expect(player.takeDamage(1, 200)).toBe(true);
    expect(player.hp).toBe(COMBAT.player.maxHp - 1);
    expect(player.state).toBe('hurt');
    expect(player.invulnerableTicks).toBe(COMBAT.player.invulnerableTicks);
    expect(player.body.vx).toBeLessThan(0);
    expect(player.facing).toBe(1);
    expect(player.events).toContain('hurt');
  });

  it('grants i-frames, so a second hit in the window is ignored', () => {
    const player = new PlayerController({ x: 80, y: 128 });
    expireSpawnInvuln(player);
    player.takeDamage(1, 200);
    expect(player.takeDamage(1, 200)).toBe(false);
    expect(player.hp).toBe(COMBAT.player.maxHp - 1);

    for (let i = 0; i < COMBAT.player.invulnerableTicks; i += 1) {
      player.update(input(), GROUND);
    }
    expect(player.takeDamage(1, 200)).toBe(true);
    expect(player.hp).toBe(COMBAT.player.maxHp - 2);
  });

  it('dies at zero health and starts the death clock', () => {
    const player = new PlayerController({ x: 80, y: 128 });
    expireSpawnInvuln(player);
    for (let hit = 0; hit < COMBAT.player.maxHp; hit += 1) {
      player.takeDamage(1, 200);
      if (!player.dead) {
        for (let i = 0; i < COMBAT.player.invulnerableTicks; i += 1) {
          player.update(input(), GROUND);
        }
      }
    }
    expect(player.hp).toBe(0);
    expect(player.dead).toBe(true);
    expect(player.state).toBe('dead');

    player.update(input(), GROUND);
    expect(player.deathElapsed).toBe(1);
  });

  it('opens a forward hitbox that mirrors with facing', () => {
    const player = new PlayerController({ x: 100, y: 128 });
    swingUntilActive(player);
    const box = player.attackHitbox();
    expect(box).not.toBeNull();
    const feet = player.feet;
    expect(box?.x).toBe(feet.x + COMBAT.player.attackBox.forward);
    expect(box?.y).toBe(feet.y - COMBAT.player.attackBox.top);
    expect(box?.w).toBe(COMBAT.player.attackBox.width);

    const mirrored = new PlayerController({ x: 100, y: 128 });
    mirrored.update(input(['left']), GROUND);
    expect(mirrored.facing).toBe(-1);
    swingUntilActive(mirrored);
    const left = mirrored.attackHitbox();
    const mirroredFeet = mirrored.feet;
    expect(left?.x).toBe(
      mirroredFeet.x - COMBAT.player.attackBox.forward - COMBAT.player.attackBox.width,
    );
  });
});

describe('CombatSystem', () => {
  it('lands a player hit once per swing, even while the window spans ticks', () => {
    const player = new PlayerController({ x: 100, y: 128 });
    swingUntilActive(player);
    const enemy = new MeleeEnemy('parishioner', {
      kind: 'parishioner',
      x: 125,
      y: 128,
      patrol: { min: 120, max: 130 },
    });
    const combat = new CombatSystem();
    const pool = new ProjectilePool();

    const first = combat.resolve(player, [enemy], pool, GROUND);
    expect(enemy.hp).toBe(2);
    expect(first.events.some((event) => event.type === 'enemyHit')).toBe(true);
    expect(first.hitstop).toBe(COMBAT.enemy.hitstopTicks);

    combat.resolve(player, [enemy], pool, GROUND);
    expect(enemy.hp).toBe(2);
  });

  it('chains into the heavy swing and lands stage-two damage', () => {
    const player = new PlayerController({ x: 100, y: 128 });
    swingUntilActive(player);
    const lightSwing = player.attackId;

    // A press inside the stage-one window re-triggers immediately as stage two.
    player.update(input([], ['attack']), GROUND);
    expect(player.attackId).toBe(lightSwing + 1);
    for (let i = 0; i < 30 && player.attackDamage === 0; i += 1) {
      player.update(input(), GROUND);
    }
    expect(player.attackDamage).toBe(COMBAT.player.damage.stage2);

    const enemy = new MeleeEnemy('ghoul', {
      kind: 'ghoul',
      x: 125,
      y: 128,
      patrol: { min: 120, max: 130 },
    });
    new CombatSystem().resolve(player, [enemy], new ProjectilePool(), GROUND);
    expect(enemy.hp).toBe(ENEMIES.ghoul.hp - COMBAT.player.damage.stage2);
  });

  it('reports a killing blow and never hits the corpse again', () => {
    const player = new PlayerController({ x: 100, y: 128 });
    swingUntilActive(player);
    const enemy = new MeleeEnemy('parishioner', {
      kind: 'parishioner',
      x: 125,
      y: 128,
      patrol: { min: 120, max: 130 },
    });
    enemy.takeDamage(enemy.hp - 1, 90);
    expect(enemy.hp).toBe(1);

    const combat = new CombatSystem();
    const pool = new ProjectilePool();
    const result = combat.resolve(player, [enemy], pool, GROUND);
    expect(enemy.alive).toBe(false);
    expect(enemy.hp).toBe(0);
    expect(result.events.some((event) => event.type === 'enemyHit' && event.killed)).toBe(true);

    expect(combat.resolve(player, [enemy], pool, GROUND).events).toHaveLength(0);
  });

  it('applies contact damage once, then respects the player i-frames', () => {
    const player = new PlayerController({ x: 100, y: 128 });
    expireSpawnInvuln(player);
    const enemy = new MeleeEnemy('parishioner', {
      kind: 'parishioner',
      x: 108,
      y: 128,
      patrol: { min: 100, max: 120 },
    });
    const combat = new CombatSystem();
    const pool = new ProjectilePool();

    const first = combat.resolve(player, [enemy], pool, GROUND);
    expect(player.hp).toBe(COMBAT.player.maxHp - 1);
    expect(
      first.events.some((event) => event.type === 'playerHit' && event.source === 'contact'),
    ).toBe(true);
    expect(first.hitstop).toBe(COMBAT.player.hitstopTicks);

    combat.resolve(player, [enemy], pool, GROUND);
    expect(player.hp).toBe(COMBAT.player.maxHp - 1);
  });

  it('uses the enemy melee hitbox and its damage value', () => {
    const player = new PlayerController({ x: 180, y: 128 });
    expireSpawnInvuln(player);
    const enemy = new MeleeEnemy('ghoul', {
      kind: 'ghoul',
      x: 160,
      y: 128,
      facing: 1,
      patrol: { min: 150, max: 170 },
    });
    const context = {
      tilemap: GROUND,
      player: { feet: player.feet, dead: false },
      castProjectile: () => undefined,
    };
    for (let i = 0; i < 60 && enemy.state !== 'active'; i += 1) enemy.update(context);
    expect(enemy.state).toBe('active');

    const result = new CombatSystem().resolve(player, [enemy], new ProjectilePool(), GROUND);
    expect(player.hp).toBe(COMBAT.player.maxHp - 2);
    const hit = result.events.find((event) => event.type === 'playerHit');
    expect(hit?.type === 'playerHit' ? hit.source : null).toBe('melee');
  });

  it('resolves a projectile impact on the player', () => {
    const player = new PlayerController({ x: 100, y: 128 });
    expireSpawnInvuln(player);
    const pool = new ProjectilePool();
    pool.spawn(player.feet.x - 40, player.feet.y - 20, 1, 0, 165, 1, 120);
    const combat = new CombatSystem();

    let result = combat.resolve(player, [], pool, GROUND);
    for (let i = 0; i < 30 && player.hp === COMBAT.player.maxHp; i += 1) {
      result = combat.resolve(player, [], pool, GROUND);
    }
    expect(player.hp).toBe(COMBAT.player.maxHp - 1);
    expect(
      result.events.some((event) => event.type === 'projectileHit' && event.surface === 'player'),
    ).toBe(true);
    expect(pool.activeCount).toBe(0);
  });

  it('lands an enemy shockwave once and lets i-frames ignore a new wave', () => {
    const player = new PlayerController({ x: 100, y: 128 });
    expireSpawnInvuln(player);
    const enemy = new HazardEnemy('parishioner', {
      kind: 'parishioner',
      x: 300,
      y: 128,
      patrol: { min: 300, max: 300 },
    });
    const combat = new CombatSystem();
    const pool = new ProjectilePool();

    const first = combat.resolve(player, [enemy], pool, GROUND);
    expect(player.hp).toBe(COMBAT.player.maxHp - 1);
    const hit = first.events.find((event) => event.type === 'playerHit');
    expect(hit?.type === 'playerHit' ? hit.source : null).toBe('shockwave');

    // The same hazard id cannot land twice.
    const repeat = combat.resolve(player, [enemy], pool, GROUND);
    expect(player.hp).toBe(COMBAT.player.maxHp - 1);
    expect(repeat.events.some((event) => event.type === 'playerHit')).toBe(false);

    // A fresh hazard that arrives during i-frames is ignored, then the next one lands.
    enemy.hazardId = 2;
    combat.resolve(player, [enemy], pool, GROUND);
    expect(player.hp).toBe(COMBAT.player.maxHp - 1);
    for (let i = 0; i < COMBAT.player.invulnerableTicks; i += 1) {
      player.update(input(), GROUND);
    }
    enemy.hazardId = 3;
    combat.resolve(player, [enemy], pool, GROUND);
    expect(player.hp).toBe(COMBAT.player.maxHp - 2);
  });

  it('does not emit a hit when a Toll wave strikes a damage-blocked boss', () => {
    const player = new PlayerController({ x: 100, y: 128 });
    const enemy = new SealedEnemy('ghoul', {
      kind: 'ghoul',
      x: 150,
      y: 128,
      patrol: { min: 150, max: 150 },
    });
    const hp = enemy.hp;
    const pool = new ProjectilePool();
    pool.spawn(
      enemy.feet.x,
      enemy.feet.y - 16,
      1,
      0,
      TOLL.wave.speed,
      TOLL.damage,
      TOLL.wave.lifeTicks,
      { style: 'bell', owner: 'player', posture: TOLL.posture },
    );

    const result = new CombatSystem().resolve(player, [enemy], pool, GROUND);
    expect(enemy.hp).toBe(hp);
    expect(result.events.some((event) => event.type === 'enemyHit')).toBe(false);
  });
});

describe('ProjectilePool', () => {
  it('moves a projectile by speed * dt and expires it after its lifetime', () => {
    const pool = new ProjectilePool(2);
    pool.spawn(50, 100, 1, 0, 60, 1, 1);
    expect(pool.activeCount).toBe(1);
    pool.update(GROUND, { x: 0, y: 0, w: 1, h: 1 });
    expect(pool.activeCount).toBe(0);
    expect(pool.all[0]?.x).toBeCloseTo(51, 5);
  });

  it('reports a tile impact and deactivates the shot', () => {
    const pool = new ProjectilePool(2);
    pool.spawn(50, 130, 1, 0, 60, 1, 120);
    const hits = pool.update(GROUND, { x: 0, y: 0, w: 1, h: 1 });
    expect(hits).toEqual([
      { x: 51, y: 130, damage: 1, kind: 'tile', style: 'fire', owner: 'enemy' },
    ]);
    expect(pool.activeCount).toBe(0);
  });

  it('reuses the shortest-lived slot when the pool is full', () => {
    const pool = new ProjectilePool(2);
    pool.spawn(10, 50, 1, 0, 60, 1, 120);
    pool.spawn(10, 60, 1, 0, 60, 1, 60);
    pool.spawn(10, 70, 1, 0, 60, 1, 30);
    expect(pool.activeCount).toBe(2);
    expect(pool.all[1]?.y).toBe(70);
  });
});

describe('Censer and Toll', () => {
  it('a Toll wave marks an enemy with resonance and deals wave damage', () => {
    const player = new PlayerController({ x: 100, y: 128 });
    player.applyLoadout({
      charms: [],
      nailLevel: 0,
      wallClaw: false,
      hookline: false,
      longline: false,
      censer: false,
      toll: true,
    });
    const enemy = new MeleeEnemy('parishioner', {
      kind: 'parishioner',
      x: 120,
      y: 128,
      patrol: { min: 110, max: 130 },
    });
    const combat = new CombatSystem();
    const pool = new ProjectilePool();
    pool.spawn(
      enemy.feet.x,
      enemy.feet.y - 16,
      1,
      0,
      TOLL.wave.speed,
      TOLL.damage,
      TOLL.wave.lifeTicks,
      { style: 'bell', owner: 'player', posture: TOLL.posture },
    );

    combat.resolve(player, [enemy], pool, GROUND);

    expect(enemy.resonance).toBeGreaterThan(0);
    expect(enemy.hp).toBe(ENEMIES.parishioner.hp - TOLL.damage);
  });

  it('the next Nail hit on a resonant enemy deals bonus damage and consumes the mark', () => {
    const player = new PlayerController({ x: 100, y: 128 });
    expireSpawnInvuln(player);
    const enemy = new MeleeEnemy('ghoul', {
      kind: 'ghoul',
      x: 120,
      y: 128,
      patrol: { min: 110, max: 130 },
    });
    enemy.markResonance(RESONANCE.ticks);
    expect(enemy.resonance).toBeGreaterThan(0);

    const combat = new CombatSystem();
    const pool = new ProjectilePool();
    player.update(input([], ['attack']), GROUND);
    for (let i = 0; i < 30 && !player.attackActive; i += 1) player.update(input(), GROUND);

    const result = combat.resolve(player, [enemy], pool, GROUND);
    const hit = result.events.find((event) => event.type === 'enemyHit');
    expect(hit?.type === 'enemyHit' ? hit.damage : 0).toBe(
      COMBAT.player.damage.stage1 + RESONANCE.damageBonus,
    );
    expect(enemy.resonance).toBe(0);
    expect(enemy.hp).toBe(ENEMIES.ghoul.hp - (COMBAT.player.damage.stage1 + RESONANCE.damageBonus));
  });

  it('a Censer brine cloud pulses posture to enemies standing in it', () => {
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
    const enemy = new MeleeEnemy('parishioner', {
      kind: 'parishioner',
      x: 120,
      y: 128,
      patrol: { min: 110, max: 130 },
    });
    const startPosture = enemy.posture;
    const combat = new CombatSystem();
    const pool = new ProjectilePool();
    combat.spawnCenserCloud(enemy.feet.x, enemy.feet.y);

    // The cloud pulses posture every 15 ticks.
    for (let i = 0; i < 15; i += 1) combat.resolve(player, [enemy], pool, GROUND);

    expect(enemy.posture).toBeLessThan(startPosture);
    expect(enemy.posture).toBeGreaterThan(0);
  });

  it('exposes live brine clouds to the renderer with their full lifetime', () => {
    const player = new PlayerController({ x: 100, y: 128 });
    const pool = new ProjectilePool();
    const combat = new CombatSystem();
    expect(combat.activeCenserClouds).toEqual([]);

    combat.spawnCenserCloud(200, 300);
    expect(combat.activeCenserClouds).toEqual([
      { x: 200, y: 300, ticksLeft: 90, maxTicks: 90, radius: 24 },
    ]);

    combat.resolve(player, [], pool, GROUND);
    expect(combat.activeCenserClouds[0]?.ticksLeft).toBe(89);

    combat.reset();
    expect(combat.activeCenserClouds).toEqual([]);
  });
});
