import { describe, expect, it } from 'vitest';
import { CombatSystem } from '../../src/combat/CombatSystem';
import { ProjectilePool } from '../../src/combat/ProjectilePool';
import { COMBAT } from '../../src/config/combat';
import { ENEMIES } from '../../src/config/enemies';
import type { ActionName } from '../../src/config/input';
import { MeleeEnemy } from '../../src/enemies/MeleeEnemy';
import type { InputSnapshot } from '../../src/input/InputState';
import { createBody } from '../../src/physics/Body';
import { PlayerController } from '../../src/player/PlayerController';
import { PlayerGuard, type GuardHost } from '../../src/player/PlayerGuard';
import { PlayerPose } from '../../src/player/PlayerPose';
import { Tilemap } from '../../src/world/Tilemap';

const LEGEND = { F: 'floor', f: 'floorFill' } as const;
const EMPTY = ' '.repeat(20);
const GROUND = Tilemap.fromRows(
  [...Array.from({ length: 8 }, () => EMPTY), 'F'.repeat(20), 'f'.repeat(20)],
  LEGEND,
);

function input(
  held: readonly ActionName[] = [],
  pressed: readonly ActionName[] = [],
): InputSnapshot {
  return { held: new Set(held), pressed: new Set(pressed), released: new Set() };
}

/** A minimal grounded host for the guard's pure state machine. */
function guardHost(): GuardHost {
  const body = createBody(100, 128, 14, 28);
  body.grounded = true;
  const pose = new PlayerPose();
  const host: GuardHost = {
    body,
    pose,
    facing: 1,
    grounded: true,
    busy: false,
    setFacing(direction) {
      host.facing = direction;
    },
  };
  return host;
}

function startGuard(guard: PlayerGuard, host: GuardHost): void {
  guard.tick(input(['guard'], ['guard']), host);
  expect(guard.active).toBe(true);
}

describe('the Keeper’s Guard', () => {
  it('perfect-parries on the opening beat and opens a counter window', () => {
    const guard = new PlayerGuard();
    const host = guardHost();
    startGuard(guard, host);

    expect(guard.perfectWindow).toBe(true);
    expect(guard.resolveIncoming(host, 200, false)).toBe('parry');
    expect(guard.posture).toBe(guard.maxPosture);
    expect(guard.counterReady).toBe(true);
    expect(host.pose.animation).toBe('parry');

    expect(guard.consumeCounter()).toBe(true);
    expect(guard.consumeCounter()).toBe(false);
  });

  it('blocks after the perfect window and spends posture', () => {
    const guard = new PlayerGuard();
    const host = guardHost();
    startGuard(guard, host);
    for (let i = 0; i < COMBAT.guard.perfectTicks; i += 1) guard.tick(input(['guard']), host);

    expect(guard.perfectWindow).toBe(false);
    expect(guard.resolveIncoming(host, 200, false)).toBe('block');
    expect(guard.posture).toBe(guard.maxPosture - COMBAT.guard.blockPostureCost);
  });

  it('cannot guard a red attack or a hit from behind', () => {
    const guard = new PlayerGuard();
    const host = guardHost();
    startGuard(guard, host);

    expect(guard.resolveIncoming(host, 200, true)).toBe('unblockable');
    expect(guard.resolveIncoming(host, 0, false)).toBe('hit');
    expect(guard.posture).toBe(guard.maxPosture);
    expect(guard.counterReady).toBe(false);
  });

  it('shatters when posture reaches zero and locks the guard out', () => {
    const guard = new PlayerGuard();
    const host = guardHost();
    startGuard(guard, host);
    for (let i = 0; i < COMBAT.guard.perfectTicks; i += 1) guard.tick(input(['guard']), host);

    for (let block = 0; block < 4; block += 1) {
      expect(guard.resolveIncoming(host, 200, false)).toBe('block');
    }
    expect(guard.posture).toBeGreaterThan(0);
    expect(guard.resolveIncoming(host, 200, false)).toBe('broken');
    expect(guard.broken).toBe(true);
    expect(guard.active).toBe(false);
    expect(guard.posture).toBe(0);

    guard.tick(input(['guard'], ['guard']), host);
    expect(guard.active).toBe(false);
  });

  it('shortens the deflect window when the guard is tapped repeatedly', () => {
    const guard = new PlayerGuard();
    const host = guardHost();
    startGuard(guard, host);
    guard.tick(input(['guard']), host);
    guard.tick(input(), host); // release
    for (let i = 0; i < COMBAT.guard.releaseLockTicks; i += 1) guard.tick(input(), host);

    startGuard(guard, host);
    expect(guard.deflectTicksRemaining).toBe(COMBAT.guard.deflectTicks[1]);
  });
});

/** Runs the controller until spawn invulnerability has expired. */
function expireSpawnInvuln(player: PlayerController): void {
  for (let i = 0; i < COMBAT.player.spawnInvulnerableTicks; i += 1) {
    player.update(input(), GROUND);
  }
}

function activeEnemy(kind: 'parishioner' | 'ghoul', x: number, player: PlayerController) {
  const enemy = new MeleeEnemy(kind, {
    kind,
    x,
    y: 128,
    facing: -1,
    patrol: { min: x - 10, max: x + 10 },
  });
  const context = {
    tilemap: GROUND,
    player: { feet: player.feet, dead: false },
    castProjectile: () => undefined,
  };
  for (let i = 0; i < 60 && enemy.state !== 'active'; i += 1) enemy.update(context);
  expect(enemy.state).toBe('active');
  return enemy;
}

describe('guard in combat', () => {
  it('parries a melee strike, then pays it back with a counter swing', () => {
    const player = new PlayerController({ x: 100, y: 128 });
    expireSpawnInvuln(player);
    const enemy = activeEnemy('parishioner', 122, player);
    const combat = new CombatSystem();
    const pool = new ProjectilePool();

    player.update(input(['guard'], ['guard']), GROUND);
    expect(player.guarding).toBe(true);

    const parry = combat.resolve(player, [enemy], pool, GROUND);
    expect(parry.events.some((event) => event.type === 'playerParry')).toBe(true);
    expect(player.hp).toBe(COMBAT.player.maxHp);
    expect(player.counterReady).toBe(true);
    expect(enemy.posture).toBe(ENEMIES.parishioner.posture - COMBAT.guard.parryPostureDamage);

    player.update(input(), GROUND); // release the brace
    player.update(input([], ['attack']), GROUND);
    for (let i = 0; i < 30 && !player.attackActive; i += 1) player.update(input(), GROUND);
    expect(player.attackActive).toBe(true);

    const counter = combat.resolve(player, [enemy], pool, GROUND);
    const hit = counter.events.find((event) => event.type === 'enemyHit');
    expect(hit?.type === 'enemyHit' ? hit.damage : 0).toBe(
      COMBAT.player.damage.stage1 + COMBAT.guard.counterDamageBonus,
    );
  });

  it('spends posture once for one enemy swing, not once per active tick', () => {
    const player = new PlayerController({ x: 100, y: 128 });
    expireSpawnInvuln(player);
    const enemy = activeEnemy('parishioner', 122, player);
    const combat = new CombatSystem();
    const pool = new ProjectilePool();

    player.update(input(['guard'], ['guard']), GROUND);
    for (let i = 0; i < COMBAT.guard.perfectTicks; i += 1) {
      player.update(input(['guard']), GROUND);
    }

    const first = combat.resolve(player, [enemy], pool, GROUND);
    const second = combat.resolve(player, [enemy], pool, GROUND);
    expect(first.events.some((event) => event.type === 'playerBlock')).toBe(true);
    expect(second.events.some((event) => event.type === 'playerBlock')).toBe(false);
    expect(player.posture).toBe(COMBAT.guard.maxPosture - COMBAT.guard.blockPostureCost);
  });

  it('lets a red ghoul lunge through a held guard', () => {
    const player = new PlayerController({ x: 180, y: 128 });
    expireSpawnInvuln(player);
    const enemy = activeEnemy('ghoul', 160, player);
    const combat = new CombatSystem();

    player.update(input(['left']), GROUND); // face the ghoul
    player.update(input(['guard']), GROUND);
    expect(player.guarding).toBe(true);

    const result = combat.resolve(player, [enemy], new ProjectilePool(), GROUND);
    expect(player.hp).toBe(COMBAT.player.maxHp - (ENEMIES.ghoul.melee?.damage ?? 0));
    expect(result.events.some((event) => event.type === 'playerHit')).toBe(true);
  });

  it('turns a posture break into a KNELL with triple damage', () => {
    const player = new PlayerController({ x: 100, y: 128 });
    const enemy = new MeleeEnemy('parishioner', {
      kind: 'parishioner',
      x: 122,
      y: 128,
      patrol: { min: 112, max: 132 },
    });
    enemy.takePostureDamage(enemy.postureMax, 0);
    expect(enemy.postureBroken).toBe(true);

    player.update(input([], ['attack']), GROUND);
    for (let i = 0; i < 30 && !player.attackActive; i += 1) player.update(input(), GROUND);
    expect(player.attackActive).toBe(true);

    const result = new CombatSystem().resolve(player, [enemy], new ProjectilePool(), GROUND);
    const hit = result.events.find((event) => event.type === 'enemyHit');
    expect(hit?.type === 'enemyHit' ? hit.knell : false).toBe(true);
    expect(hit?.type === 'enemyHit' ? hit.damage : 0).toBe(
      COMBAT.player.damage.stage1 * COMBAT.knell.damageMultiplier,
    );
  });
});
