import { describe, expect, it } from 'vitest';
import type { ActionName } from '../../src/config/input';
import { PLAYER } from '../../src/config/player';
import { CENSER, TOLL } from '../../src/config/weapons';
import { belfryTerrace } from '../../src/data/rooms/belfry-terrace';
import { HERO_ART } from '../../src/data/art';
import type { InputSnapshot } from '../../src/input/InputState';
import { PlayerController } from '../../src/player/PlayerController';
import { createRoom } from '../../src/world/Room';
import { Tilemap } from '../../src/world/Tilemap';

const LEGEND = { F: 'floor', f: 'floorFill', L: 'ledge' } as const;
const EMPTY = '          ';

/** Flat ground with ample headroom: floor top at y=128, 320 px of running room. */
const GROUND = Tilemap.fromRows(
  [...Array.from({ length: 8 }, () => ' '.repeat(20)), 'F'.repeat(20), 'f'.repeat(20)],
  LEGEND,
);

/** A one-way ledge at row 4 (top y=64) above the same floor. */
const LEDGE = Tilemap.fromRows(
  [EMPTY, EMPTY, EMPTY, EMPTY, '   LLL    ', EMPTY, EMPTY, EMPTY, 'FFFFFFFFFF', 'ffffffffff'],
  LEGEND,
);

/** Floor that ends at column 4 (x=64) with a deep pit below, for coyote tests. */
const EDGE = Tilemap.fromRows(
  [EMPTY, EMPTY, EMPTY, 'FFFF      ', 'ffff      ', ...Array.from({ length: 15 }, () => EMPTY)],
  LEGEND,
);

function input(
  held: readonly ActionName[] = [],
  pressed: readonly ActionName[] = [],
): InputSnapshot {
  return { held: new Set(held), pressed: new Set(pressed), released: new Set() };
}

function tick(
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

/** Steps until the controller has settled and then left the ledge under `EDGE`. */
function runOffLedge(controller: PlayerController, map: Tilemap): void {
  controller.update(input(), map);
  for (let i = 0; i < 200; i += 1) {
    controller.update(input(['right']), map);
    if (!controller.grounded) return;
  }
  throw new Error('the controller never left the ledge');
}

function clipDuration(name: keyof typeof HERO_ART.animations): number {
  const clip = HERO_ART.animations[name];
  if (!clip) throw new Error(`authored clip "${String(name)}" is missing`);
  return clip.frames.reduce((sum, frame) => sum + frame.ticks, 0);
}

describe('PlayerController movement', () => {
  it('accelerates to the run cap, holds it, then stops with friction', () => {
    const controller = new PlayerController({ x: 80, y: 128 });
    tick(controller, GROUND, 60, ['right']);

    expect(controller.body.vx).toBeCloseTo(PLAYER.ground.maxRun, 5);
    expect(controller.state).toBe('run');
    expect(controller.animation).toBe('run');
    expect(controller.facing).toBe(1);

    const xWhileRunning = controller.body.x;
    tick(controller, GROUND, 30);
    expect(controller.body.vx).toBe(0);
    expect(controller.body.x).toBeGreaterThan(xWhileRunning);
    expect(controller.state).toBe('idle');
  });

  it('skids when the input reverses, playing the turn clip', () => {
    const controller = new PlayerController({ x: 80, y: 128 });
    tick(controller, GROUND, 20, ['right']);
    expect(controller.body.vx).toBeCloseTo(PLAYER.ground.maxRun, 5);

    controller.update(input(['left'], ['left']), GROUND);
    expect(controller.state).toBe('skid');
    expect(controller.animation).toBe('turn');

    tick(controller, GROUND, 20, ['left']);
    expect(controller.body.vx).toBeCloseTo(-PLAYER.ground.maxRun, 5);
    expect(controller.state).toBe('run');
    expect(controller.facing).toBe(-1);
  });

  it('coyotes: a jump still fires shortly after running off a ledge', () => {
    const controller = new PlayerController({ x: 40, y: 48 });
    runOffLedge(controller, EDGE);
    expect(controller.grounded).toBe(false);

    tick(controller, EDGE, 4, ['right']);
    controller.update(input(['right', 'jump'], ['jump']), EDGE);
    expect(controller.body.vy).toBeLessThan(-PLAYER.jump.speed * 0.5);
  });

  it('coyote expires, so a late jump is just a fall', () => {
    const controller = new PlayerController({ x: 40, y: 48 });
    runOffLedge(controller, EDGE);
    tick(controller, EDGE, PLAYER.jump.coyoteTicks + 1, ['right']);

    controller.update(input(['right', 'jump'], ['jump']), EDGE);
    expect(controller.body.vy).toBeGreaterThan(0);
  });

  it('buffers a jump pressed just before landing', () => {
    const controller = new PlayerController({ x: 80, y: 10 });
    let fired = false;

    for (let i = 0; i < 120; i += 1) {
      const close = !controller.grounded && controller.feet.y > 128 - 24;
      controller.update(input(close ? ['jump'] : [], close ? ['jump'] : []), GROUND);
      if (close && controller.body.vy < 0) {
        fired = true;
        break;
      }
    }

    expect(fired).toBe(true);
  });
});

describe('PlayerController jump arc', () => {
  it('reaches the designed apex and lands back exactly on the floor', () => {
    const controller = new PlayerController({ x: 80, y: 128 });
    controller.update(input(['jump'], ['jump']), GROUND);

    let minFeet = controller.feet.y;
    for (let i = 0; i < 60; i += 1) {
      controller.update(input(['jump']), GROUND);
      minFeet = Math.min(minFeet, controller.feet.y);
    }

    const apex = 128 - minFeet;
    // Design target ≈70 px (config comments); asserted with margin for integration.
    expect(apex).toBeGreaterThan(60);
    expect(apex).toBeLessThan(85);
    expect(controller.grounded).toBe(true);
    expect(controller.feet.y).toBeCloseTo(128, 1);
    expect(controller.state).toBe('idle');
    expect(controller.jumpPeakY).toBeNull();
    expect(controller.lastJumpPeakY).not.toBeNull();
    expect(controller.lastJumpPeakY).toBeCloseTo(minFeet, 5);
  });

  it('ignores the initial floor settle when recording jump apexes', () => {
    const controller = new PlayerController({ x: 80, y: 128 });
    for (let i = 0; i < 10; i += 1) controller.update(input(), GROUND);
    expect(controller.lastJumpPeakY).toBeNull();
    expect(controller.jumpPeakY).toBeNull();
  });

  it('clips the arc when the jump button is released early', () => {
    const controller = new PlayerController({ x: 80, y: 128 });
    controller.update(input(['jump'], ['jump']), GROUND);
    controller.update(input(['jump']), GROUND);

    for (let i = 0; i < 60; i += 1) {
      controller.update(input(), GROUND);
    }

    const recordedApex = 128 - (controller.lastJumpPeakY ?? 128);
    expect(recordedApex).toBeGreaterThan(10);
    expect(recordedApex).toBeLessThan(45);
  });
});

describe('PlayerController attack and dash', () => {
  it('plays the swing, opens its window, then hands control back', () => {
    const controller = new PlayerController({ x: 80, y: 128 });
    controller.update(input(['attack'], ['attack']), GROUND);
    expect(controller.state).toBe('attack');
    expect(controller.animation).toBe('attack1');
    expect(controller.attackActive).toBe(false);

    let activeTicks = 0;
    let ticksInAttack = 0;
    while (controller.state === 'attack' && ticksInAttack < 60) {
      if (controller.attackActive) activeTicks += 1;
      controller.update(input(['right']), GROUND);
      ticksInAttack += 1;
    }

    const window = PLAYER.attack.windows.stage1;
    expect(activeTicks).toBe(window.end - window.start + 1);
    expect(ticksInAttack).toBe(PLAYER.attack.clipTicks.stage1);
    expect(controller.state).toBe('run');
  });

  it('chains into the second stage when attack is pressed inside the window', () => {
    const controller = new PlayerController({ x: 80, y: 128 });
    controller.update(input(['attack'], ['attack']), GROUND);
    tick(controller, GROUND, PLAYER.attack.windows.stage1.start + 1);

    controller.update(input(['attack'], ['attack']), GROUND);
    expect(controller.state).toBe('attack');
    expect(controller.animation).toBe('attack2');
  });

  it('drags while swinging: movement is capped to the attack scale', () => {
    const controller = new PlayerController({ x: 80, y: 128 });
    controller.update(input(['attack'], ['attack']), GROUND);
    tick(controller, GROUND, 6, ['right']);

    const cap = PLAYER.ground.maxRun * PLAYER.attack.speedScale + 1;
    expect(Math.abs(controller.body.vx)).toBeLessThanOrEqual(cap);
  });

  it('dashes at a fixed speed, then obeys the cooldown', () => {
    const controller = new PlayerController({ x: 80, y: 128 });
    const startX = controller.body.x;
    controller.update(input(['dash'], ['dash']), GROUND);
    expect(controller.state).toBe('dash');
    expect(controller.body.vx).toBe(PLAYER.dash.speed);

    tick(controller, GROUND, PLAYER.dash.ticks + 1);
    const dashDistance = controller.body.x - startX;
    expect(dashDistance).toBeGreaterThan((PLAYER.dash.speed * PLAYER.dash.ticks) / 60 / 2);
    expect(controller.state).not.toBe('dash');
    expect(controller.body.vx).toBeLessThan(PLAYER.dash.speed);

    // Inside the cooldown the second press is ignored.
    controller.update(input(['dash'], ['dash']), GROUND);
    expect(controller.state).not.toBe('dash');
  });
});

describe('PlayerController platforms and determinism', () => {
  it('drops through a one-way platform on down + jump', () => {
    const controller = new PlayerController({ x: 56, y: 64 });
    controller.update(input(), LEDGE);
    expect(controller.grounded).toBe(true);

    controller.update(input(['down', 'jump'], ['jump']), LEDGE);
    tick(controller, LEDGE, 7, ['down']);

    expect(controller.body.y + controller.body.h).toBeGreaterThan(80);
    expect(controller.grounded).toBe(false);
  });

  it('produces identical runs for identical input scripts', () => {
    const first = new PlayerController({ x: 80, y: 128 });
    const second = new PlayerController({ x: 80, y: 128 });
    const script: readonly (readonly ActionName[])[] = [
      ['right'],
      ['right'],
      ['right', 'jump'],
      ['right', 'jump'],
      ['right', 'jump'],
      ['right'],
      ['left'],
      ['left'],
      ['left', 'dash'],
      ['left'],
      ['attack'],
      ['left'],
    ];

    for (let i = 0; i < 180; i += 1) {
      const held = script[i % script.length] ?? [];
      const pressed = held.filter(
        (action) => action === 'jump' || action === 'dash' || action === 'attack',
      );
      first.update(input(held, pressed), GROUND);
      second.update(input(held, pressed), GROUND);
      expect(first.body).toEqual(second.body);
      expect(first.state).toBe(second.state);
      expect(first.animation).toBe(second.animation);
    }
  });

  it('keeps the authored hero clips and the controller timing in sync', () => {
    expect(clipDuration('attack1')).toBe(PLAYER.attack.clipTicks.stage1);
    expect(clipDuration('attack2')).toBe(PLAYER.attack.clipTicks.stage2);
    expect(PLAYER.attack.windows.stage1.end).toBeLessThan(clipDuration('attack1'));
    expect(PLAYER.attack.windows.stage2.end).toBeLessThan(clipDuration('attack2'));
    for (const name of ['idle', 'run', 'turn', 'jump', 'fall', 'dash'] as const) {
      expect(clipDuration(name)).toBeGreaterThan(0);
    }
  });

  it('authored a one-shot clip for every attack weapon', () => {
    expect(clipDuration('censer1')).toBe(CENSER.clipTicks);
    expect(clipDuration('toll1')).toBe(TOLL.clipTicks);
  });
});

describe('PlayerController in the belfry terrace', () => {
  const room = createRoom(belfryTerrace);

  it('spawns standing on the walkway', () => {
    const controller = new PlayerController(room.spawn);
    controller.update(input(), room.tilemap);
    expect(controller.grounded).toBe(true);
    expect(controller.feet.y).toBeCloseTo(320, 1);
  });

  it('is stopped by the dais step, never passing through it', () => {
    const controller = new PlayerController(room.spawn);
    tick(controller, room.tilemap, 200, ['right']);

    expect(controller.body.x).toBeCloseTo(672 - PLAYER.size.w, 1);
    expect(controller.grounded).toBe(true);
    expect(controller.body.vx).toBe(0);
  });

  it('jumps up through an ascent beam and lands on top of it', () => {
    const controller = new PlayerController({ x: 176, y: 320 });
    controller.update(input(), room.tilemap); // settle on the walkway
    expect(controller.grounded).toBe(true);
    controller.update(input(['jump'], ['jump']), room.tilemap);

    let ticks = 0;
    while (!controller.grounded && ticks < 120) {
      controller.update(input(['jump']), room.tilemap);
      ticks += 1;
    }

    expect(controller.grounded).toBe(true);
    expect(controller.feet.y).toBeCloseTo(288, 1);
  });

  it('walks into the west doorway and stops at the world edge', () => {
    const controller = new PlayerController(room.spawn);
    tick(controller, room.tilemap, 300, ['left']);
    expect(controller.body.x).toBeCloseTo(0, 1);
    expect(controller.grounded).toBe(true);
  });
});

/** Tall shaft: 16 rows of air above the same floor, so a fall can reach terminal speed. */
const SHAFT = Tilemap.fromRows(
  [...Array.from({ length: 16 }, () => ' '.repeat(20)), 'F'.repeat(20), 'f'.repeat(20)],
  LEGEND,
);

describe('PlayerController events', () => {
  /** Steps until a landing event fires; returns which grade of landing it was. */
  function drop(controller: PlayerController, map: Tilemap, ticks = 200): string | null {
    for (let i = 0; i < ticks; i += 1) {
      controller.update(input(), map);
      const landing = controller.events.find((event) => event === 'land' || event === 'landHeavy');
      if (landing) return landing;
    }
    return null;
  }

  it('emits jump on the launch tick and grades a normal landing as soft', () => {
    const controller = new PlayerController({ x: 80, y: 128 });
    controller.update(input(), GROUND); // settle on the floor
    expect(controller.events).toEqual([]);

    controller.update(input(['jump'], ['jump']), GROUND);
    expect(controller.events).toEqual(['jump']);

    // A full jump lands near 610 px/s: a thud, below the heavy threshold (700).
    expect(drop(controller, GROUND)).toBe('land');
  });

  it('grades a long drop as a heavy landing', () => {
    const controller = new PlayerController({ x: 80, y: 40 });
    expect(drop(controller, SHAFT)).toBe('landHeavy');
  });

  it('keeps a steady footstep cadence while running', () => {
    const controller = new PlayerController({ x: 40, y: 128 });
    controller.update(input(), GROUND);

    const footsteps: number[] = [];
    for (let i = 0; i < 110; i += 1) {
      controller.update(input(['right']), GROUND);
      if (controller.events.includes('footstep')) footsteps.push(i);
    }

    expect(footsteps.length).toBeGreaterThanOrEqual(4);
    for (let i = 1; i < footsteps.length; i += 1) {
      expect(footsteps[i]! - footsteps[i - 1]!).toBe(PLAYER.footstepTicks);
    }
  });

  it('emits skid when a fast reversal begins, and only once', () => {
    const controller = new PlayerController({ x: 80, y: 128 });
    tick(controller, GROUND, 20, ['right']);
    expect(controller.body.vx).toBeCloseTo(PLAYER.ground.maxRun, 5);

    controller.update(input(['left'], ['left']), GROUND);
    expect(controller.events).toContain('skid');

    let repeats = 0;
    for (let i = 0; i < 4; i += 1) {
      controller.update(input(['left']), GROUND);
      repeats += controller.events.filter((event) => event === 'skid').length;
    }
    expect(repeats).toBe(0);
  });

  it('emits attack and dash starts, including the chained second swing', () => {
    const controller = new PlayerController({ x: 80, y: 128 });
    controller.update(input(), GROUND);

    controller.update(input([], ['attack']), GROUND);
    expect(controller.events).toEqual(['attack1']);

    let chained = false;
    for (let i = 0; i < 10 && !chained; i += 1) {
      controller.update(input([], ['attack']), GROUND);
      chained = controller.events.includes('attack2');
    }
    expect(chained).toBe(true);

    const dasher = new PlayerController({ x: 80, y: 128 });
    dasher.update(input(), GROUND);
    dasher.update(input(['right'], ['dash']), GROUND);
    expect(dasher.events).toContain('dash');
  });
});
