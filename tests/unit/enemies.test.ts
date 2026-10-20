import { describe, expect, it } from 'vitest';
import { ENEMIES } from '../../src/config/enemies';
import { Adept } from '../../src/enemies/Adept';
import type { EnemyContext } from '../../src/enemies/Enemy';
import { MeleeEnemy } from '../../src/enemies/MeleeEnemy';
import { Tilemap } from '../../src/world/Tilemap';

const LEGEND = { F: 'floor', f: 'floorFill' } as const;
const EMPTY = ' '.repeat(48);
const GROUND = Tilemap.fromRows(
  [...Array.from({ length: 8 }, () => EMPTY), 'F'.repeat(48), 'f'.repeat(48)],
  LEGEND,
);
/** A short shelf, columns 0..5, ending at x=96. */
const SHELF = Tilemap.fromRows(
  [
    ...Array.from({ length: 8 }, () => ' '.repeat(12)),
    `${'F'.repeat(6)}${' '.repeat(6)}`,
    `${'f'.repeat(6)}${' '.repeat(6)}`,
  ],
  LEGEND,
);

const FEET_Y = 128;

function context(
  tilemap: Tilemap,
  playerX = 600,
  playerY = FEET_Y,
  shots: number[][] = [],
): EnemyContext {
  return {
    tilemap,
    player: { feet: { x: playerX, y: playerY }, dead: false },
    castProjectile: (...args: number[]) => shots.push(args),
  };
}

/** Steps an enemy and records every distinct state it passes through. */
function stepRecording(enemy: MeleeEnemy | Adept, ctx: EnemyContext, ticks: number): string[] {
  const seen: string[] = [enemy.state];
  for (let i = 0; i < ticks; i += 1) {
    enemy.update(ctx);
    if (seen[seen.length - 1] !== enemy.state) seen.push(enemy.state);
  }
  return seen;
}

describe('MeleeEnemy patrol', () => {
  it('walks its beat, turns at both ends and stays inside the bounds', () => {
    const enemy = new MeleeEnemy('parishioner', {
      kind: 'parishioner',
      x: 200,
      y: FEET_Y,
      patrol: { min: 180, max: 220 },
    });
    const ctx = context(GROUND);
    const facings = new Set<number>();
    let min = Infinity;
    let max = -Infinity;
    for (let i = 0; i < 240; i += 1) {
      enemy.update(ctx);
      facings.add(enemy.facing);
      min = Math.min(min, enemy.feet.x);
      max = Math.max(max, enemy.feet.x);
    }
    expect(enemy.state).toBe('patrol');
    expect(facings).toEqual(new Set([-1, 1]));
    expect(min).toBeGreaterThanOrEqual(179);
    expect(max).toBeLessThanOrEqual(221);
  });

  it('refuses to walk off a ledge', () => {
    const enemy = new MeleeEnemy('ghoul', {
      kind: 'ghoul',
      x: 60,
      y: FEET_Y,
      patrol: { min: 40, max: 90 },
    });
    const ctx = context(SHELF);
    for (let i = 0; i < 120; i += 1) enemy.update(ctx);
    expect(enemy.grounded).toBe(true);
    expect(enemy.feet.x).toBeLessThan(96);
    expect(enemy.feet.x).toBeGreaterThan(60);
  });

  it('stands still when a spawn has no patrol beat', () => {
    const enemy = new MeleeEnemy('parishioner', {
      kind: 'parishioner',
      x: 200,
      y: FEET_Y,
    });
    const ctx = context(GROUND);
    for (let i = 0; i < 30; i += 1) enemy.update(ctx);
    expect(enemy.state).toBe('patrol');
    expect(enemy.feet.x).toBe(200);
  });
});

describe('MeleeEnemy attack cycle', () => {
  it('chases, telegraphs, strikes and recovers in order', () => {
    const enemy = new MeleeEnemy('parishioner', {
      kind: 'parishioner',
      x: 200,
      y: FEET_Y,
      patrol: { min: 180, max: 240 },
    });
    const seen = stepRecording(enemy, context(GROUND, 218), 80);
    const order = ['patrol', 'chase', 'windup', 'active', 'recover'].map((state) =>
      seen.indexOf(state),
    );
    expect(order).toEqual([...order].sort((a, b) => a - b));
    expect(order.every((index) => index >= 0)).toBe(true);
  });

  it('opens a damaging melee box only while active', () => {
    const enemy = new MeleeEnemy('parishioner', {
      kind: 'parishioner',
      x: 200,
      y: FEET_Y,
      patrol: { min: 180, max: 240 },
    });
    const ctx = context(GROUND, 218);
    expect(enemy.attackHitbox()).toBeNull();
    expect(enemy.attackDamage).toBe(0);
    for (let i = 0; i < 60 && enemy.state !== 'windup'; i += 1) enemy.update(ctx);
    expect(enemy.state).toBe('windup');
    enemy.update(ctx);
    expect(enemy.telegraph).toBeGreaterThan(0);
    expect(enemy.telegraph).toBeLessThanOrEqual(1);
    expect(enemy.attackHitbox()).toBeNull();

    for (let i = 0; i < 30 && enemy.state !== 'active'; i += 1) enemy.update(ctx);
    expect(enemy.state).toBe('active');
    const box = enemy.attackHitbox();
    expect(box).not.toBeNull();
    expect(box?.w).toBe(ENEMIES.parishioner.melee?.box.width);
    expect(enemy.attackDamage).toBe(ENEMIES.parishioner.melee?.damage);
    expect(enemy.telegraph).toBe(0);
  });

  it('staggers when hit, cancelling the wind-up', () => {
    const enemy = new MeleeEnemy('parishioner', {
      kind: 'parishioner',
      x: 200,
      y: FEET_Y,
      patrol: { min: 180, max: 240 },
    });
    const ctx = context(GROUND, 218);
    for (let i = 0; i < 60 && enemy.state !== 'windup'; i += 1) enemy.update(ctx);
    expect(enemy.state).toBe('windup');

    expect(enemy.takeDamage(1, 300)).toBe(true);
    expect(enemy.state).toBe('stagger');
    expect(enemy.hp).toBe(ENEMIES.parishioner.hp - 1);
    expect(enemy.flash).toBe(true);
    expect(enemy.facing).toBe(1);
    expect(enemy.body.vx).toBeLessThan(0);

    for (let i = 0; i < ENEMIES.parishioner.staggerTicks + 1; i += 1) enemy.update(ctx);
    expect(enemy.state).toBe('chase');
  });

  it('dies at zero health and ignores further hits and ticks', () => {
    const enemy = new MeleeEnemy('parishioner', {
      kind: 'parishioner',
      x: 200,
      y: FEET_Y,
    });
    const ctx = context(GROUND);
    enemy.update(ctx);
    expect(enemy.takeDamage(99, 300)).toBe(true);
    expect(enemy.alive).toBe(false);
    expect(enemy.state).toBe('dead');
    expect(enemy.hp).toBe(0);
    const feet = { ...enemy.feet };

    expect(enemy.takeDamage(1, 300)).toBe(false);
    enemy.update(ctx);
    expect(enemy.feet).toEqual(feet);
  });

  it('lunges forward during the ghoul active window', () => {
    const enemy = new MeleeEnemy('ghoul', {
      kind: 'ghoul',
      x: 200,
      y: FEET_Y,
      patrol: { min: 180, max: 240 },
    });
    const ctx = context(GROUND, 240);
    for (let i = 0; i < 80 && enemy.state !== 'active'; i += 1) enemy.update(ctx);
    expect(enemy.state).toBe('active');
    const before = enemy.feet.x;
    enemy.update(ctx);
    expect(enemy.body.vx).toBeGreaterThan(100);
    expect(enemy.feet.x).toBeGreaterThan(before);
  });
});

describe('Adept', () => {
  it('casts a fireball at the fixed tick, aimed at the player chest', () => {
    const shots: number[][] = [];
    const enemy = new Adept({ kind: 'adept', x: 400, y: FEET_Y });
    const ctx = context(GROUND, 500, FEET_Y, shots);
    for (let i = 0; i < 40 && shots.length === 0; i += 1) enemy.update(ctx);
    expect(shots).toHaveLength(1);
    const [x, y, dirX, dirY, speed, damage, life] = shots[0] ?? [];
    expect(x).toBeCloseTo(414, 5);
    expect(y).toBeCloseTo(FEET_Y - 36, 5);
    expect(dirX).toBeGreaterThan(0.9);
    expect(dirY).toBeGreaterThan(0);
    expect(speed).toBe(ENEMIES.adept.cast?.projectile.speed);
    expect(damage).toBe(ENEMIES.adept.cast?.projectile.damage);
    expect(life).toBe(ENEMIES.adept.cast?.projectile.lifeTicks);
    expect(enemy.state).toBe('windup');
    expect(enemy.flash).toBe(false);
  });

  it('releases exactly one shot per cast and recovers afterwards', () => {
    const shots: number[][] = [];
    const enemy = new Adept({ kind: 'adept', x: 400, y: FEET_Y });
    const ctx = context(GROUND, 500, FEET_Y, shots);
    const seen = stepRecording(enemy, ctx, 60);
    expect(shots).toHaveLength(1);
    expect(seen).toEqual(['idle', 'windup', 'recover', 'idle']);
  });

  it('cancels the cast when staggered before the release tick', () => {
    const shots: number[][] = [];
    const enemy = new Adept({ kind: 'adept', x: 400, y: FEET_Y });
    const ctx = context(GROUND, 500, FEET_Y, shots);
    for (let i = 0; i < 10; i += 1) enemy.update(ctx);
    expect(enemy.state).toBe('windup');
    enemy.takeDamage(1, 600);
    expect(enemy.state).toBe('stagger');
    for (let i = 0; i < 40; i += 1) enemy.update(ctx);
    expect(shots).toHaveLength(0);
    expect(enemy.hp).toBe(ENEMIES.adept.hp - 1);
  });

  it('holds its ground when the player is out of range', () => {
    const shots: number[][] = [];
    const enemy = new Adept({ kind: 'adept', x: 400, y: FEET_Y });
    const ctx = context(GROUND, 700, FEET_Y, shots);
    for (let i = 0; i < 60; i += 1) enemy.update(ctx);
    expect(shots).toHaveLength(0);
    expect(enemy.state).toBe('idle');
    expect(enemy.feet.x).toBe(400);
  });

  it('ignores a player outside its vertical tolerance', () => {
    const shots: number[][] = [];
    const enemy = new Adept({ kind: 'adept', x: 400, y: FEET_Y });
    const ctx = context(GROUND, 500, 220, shots);
    expect(enemy.state).toBe('idle');
    for (let i = 0; i < 60; i += 1) enemy.update(ctx);
    expect(shots).toHaveLength(0);
  });
});
