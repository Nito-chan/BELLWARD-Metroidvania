import { describe, expect, it } from 'vitest';
import { COMBAT } from '../../src/config/combat';
import type { ActionName } from '../../src/config/input';
import { PLAYER } from '../../src/config/player';
import type { InputSnapshot } from '../../src/input/InputState';
import { STARTER_LOADOUT } from '../../src/player/PlayerLoadout';
import { PlayerController } from '../../src/player/PlayerController';
import { Tilemap } from '../../src/world/Tilemap';

const LEGEND = { F: 'floor', f: 'floorFill', '#': 'wall', L: 'ledge' } as const;

/** Flat ground, 320 px of headroom. Floor top at y=128. */
const GROUND = Tilemap.fromRows(
  [...Array.from({ length: 8 }, () => ' '.repeat(20)), 'F'.repeat(20), 'f'.repeat(20)],
  LEGEND,
);

/** A right-hand wall from y=32 to the floor, for wall-contact probes. */
const WALL = Tilemap.fromRows(
  [
    '          ',
    '          ',
    '     #    ',
    '     #    ',
    '     #    ',
    '     #    ',
    '     #    ',
    '     #    ',
    'FFFFFFFFFF',
    'ffffffffff',
  ],
  LEGEND,
);

function input(
  held: readonly ActionName[] = [],
  pressed: readonly ActionName[] = [],
): InputSnapshot {
  return { held: new Set(held), pressed: new Set(pressed), released: new Set() };
}

function step(
  controller: PlayerController,
  map: Tilemap,
  count: number,
  held: readonly ActionName[] = [],
  pressedFirst: readonly ActionName[] = [],
): void {
  for (let i = 0; i < count; i += 1) {
    controller.update(input(held, i === 0 ? pressedFirst : []), map);
  }
}

function airborneNextToWall(wallClaw: boolean): PlayerController {
  const controller = new PlayerController(
    { x: 80, y: 128 },
    { loadout: { ...STARTER_LOADOUT, wallClaw } },
  );
  controller.body.y = 64;
  controller.body.vy = 0;
  return controller;
}

function findWall(controller: PlayerController, map: Tilemap): boolean {
  for (let i = 0; i < 12; i += 1) {
    controller.update(input(['right']), map);
    if (controller.wallContact === 1) return true;
  }
  return false;
}

describe('Focus and the mend channel', () => {
  it('spends 33 Focus over 54 held ticks to restore one mask', () => {
    const controller = new PlayerController({ x: 80, y: 128 }, { hp: 3, maxHp: 5, focus: 33 });
    controller.update(input(), GROUND);
    controller.update(input(['heal'], ['heal']), GROUND);
    expect(controller.state).toBe('heal');
    step(controller, GROUND, PLAYER.heal.ticks, ['heal']);
    expect(controller.hp).toBe(4);
    expect(controller.focusValue).toBe(0);
    expect(controller.state).toBe('idle');
  });

  it('refuses to start with less than one heal in the bar', () => {
    const controller = new PlayerController({ x: 80, y: 128 }, { hp: 3, maxHp: 5, focus: 32 });
    controller.update(input(['heal'], ['heal']), GROUND);
    expect(controller.state).not.toBe('heal');
    step(controller, GROUND, 60, ['heal']);
    expect(controller.hp).toBe(3);
  });

  it('quickens Quick Mend to 36 ticks and keeps Focus change between heals', () => {
    const controller = new PlayerController(
      { x: 80, y: 128 },
      {
        hp: 3,
        maxHp: 5,
        focus: 33,
        loadout: { ...STARTER_LOADOUT, charms: ['quickMend'] },
      },
    );
    controller.update(input(), GROUND);
    controller.update(input(['heal'], ['heal']), GROUND);
    step(controller, GROUND, 36, ['heal']);
    expect(controller.hp).toBe(4);
    expect(controller.focusValue).toBe(0);

    for (let i = 0; i < 3; i += 1) controller.gainFocusOnHit();
    expect(controller.focusValue).toBe(33);
  });

  it('gathers more Focus with Ember Greed', () => {
    const plain = new PlayerController({ x: 80, y: 128 });
    const greedy = new PlayerController(
      { x: 80, y: 128 },
      { loadout: { ...STARTER_LOADOUT, charms: ['emberGreed'] } },
    );
    for (let i = 0; i < 2; i += 1) {
      plain.gainFocusOnHit();
      greedy.gainFocusOnHit();
    }
    expect(plain.focusValue).toBe(22);
    expect(greedy.focusValue).toBe(34);
  });

  it('lets Sturdy Shell absorb one interrupting hit', () => {
    const controller = new PlayerController(
      { x: 80, y: 128 },
      {
        hp: 3,
        maxHp: 5,
        focus: 33,
        loadout: { ...STARTER_LOADOUT, charms: ['sturdyShell'] },
      },
    );
    controller.update(input(), GROUND);
    step(controller, GROUND, COMBAT.player.spawnInvulnerableTicks);
    controller.update(input(['heal'], ['heal']), GROUND);
    expect(controller.state).toBe('heal');
    expect(controller.takeDamage(1, controller.feet.x + 1)).toBe(false);
    expect(controller.hp).toBe(3);
    expect(controller.invulnerableTicks).toBeGreaterThan(0);

    const unshielded = new PlayerController({ x: 80, y: 128 }, { hp: 3, maxHp: 5, focus: 33 });
    unshielded.update(input(), GROUND);
    step(unshielded, GROUND, COMBAT.player.spawnInvulnerableTicks);
    unshielded.update(input(['heal'], ['heal']), GROUND);
    expect(unshielded.takeDamage(1, unshielded.feet.x + 1)).toBe(true);
    expect(unshielded.hp).toBe(2);
  });
});

describe('Wall Claw', () => {
  it('cannot cling without the ability', () => {
    const controller = airborneNextToWall(false);
    expect(findWall(controller, WALL)).toBe(false);
    expect(controller.wallSliding).toBe(false);
  });

  it('clings, slides and kicks away once the ability is owned', () => {
    const controller = airborneNextToWall(true);
    expect(findWall(controller, WALL)).toBe(true);
    controller.update(input(['right']), WALL);
    expect(controller.wallSliding).toBe(true);
    expect(controller.body.vy).toBeLessThanOrEqual(PLAYER.wall.slideSpeed);

    controller.update(input(['right'], ['jump']), WALL);
    expect(controller.body.vy).toBeLessThan(0);
    expect(controller.body.vx).toBeLessThan(0);
    expect(controller.facing).toBe(-1);
  });
});
