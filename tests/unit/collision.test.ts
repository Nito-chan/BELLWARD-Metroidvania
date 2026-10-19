import { describe, expect, it } from 'vitest';
import { PHYSICS } from '../../src/config/physics';
import { PLAYER } from '../../src/config/player';
import { createBody } from '../../src/physics/Body';
import { moveAndCollide, type MoveResult } from '../../src/physics/TileCollision';
import { Tilemap } from '../../src/world/Tilemap';
import type { Body } from '../../src/physics/Body';

const LEGEND = { '#': 'wall', F: 'floor', f: 'floorFill', L: 'ledge' } as const;
const DT = 1 / 60;

/** Floor top at y=64, plenty of headroom above for fall and jump tests. */
const GROUND = Tilemap.fromRows(
  ['          ', '          ', '          ', '          ', 'FFFFFFFFFF', 'ffffffffff'],
  LEGEND,
);

/** A one-way ledge at row 2 (top y=32) above the same floor. */
const LEDGE = Tilemap.fromRows(
  ['          ', '          ', '   LLL    ', '          ', 'FFFFFFFFFF', 'ffffffffff'],
  LEGEND,
);

/** A wall at column 4, rows 0..2. */
const WALL = Tilemap.fromRows(
  ['    #     ', '    #     ', '    #     ', 'FFFFFFFFFF', 'ffffffffff'],
  LEGEND,
);

/** A two-row ceiling with a one-tile gap at column 3, above a floor at y=80. */
const CEILING_GAP = Tilemap.fromRows(
  [
    '### ######',
    '### ######',
    '          ',
    '          ',
    '          ',
    'FFFFFFFFFF',
    'ffffffffff',
  ],
  LEGEND,
);

/** A flat ceiling above a floor at y=48, for the negative corner-correction case. */
const CEILING_FLAT = Tilemap.fromRows(
  ['##########', '          ', '          ', 'FFFFFFFFFF', 'ffffffffff'],
  LEGEND,
);

/** Steps the body and reports whether each kind of contact happened at any point. */
function step(body: Body, map: Tilemap, ticks: number): MoveResult {
  const result: MoveResult = { hitX: false, hitGround: false, hitCeiling: false };
  for (let i = 0; i < ticks; i += 1) {
    const tick = moveAndCollide(map, body, DT);
    result.hitX = result.hitX || tick.hitX;
    result.hitGround = result.hitGround || tick.hitGround;
    result.hitCeiling = result.hitCeiling || tick.hitCeiling;
  }
  return result;
}

describe('moveAndCollide', () => {
  it('lands a falling body on the floor and stops it', () => {
    const body = createBody(40, 0, 12, 20);
    body.vy = 200;

    const result = step(body, GROUND, 40);

    expect(body.y + body.h).toBeCloseTo(64, 5);
    expect(body.vy).toBe(0);
    expect(body.grounded).toBe(true);
    expect(result.hitGround).toBe(true);
  });

  it('stops a body against a wall and keeps it grounded', () => {
    const body = createBody(10, 28, 12, 20);
    body.vx = 100;

    const result = step(body, WALL, 40);
    expect(body.x).toBeCloseTo(52, 5); // 64 - 12: flush against the wall at column 4
    expect(body.vx).toBe(0);
    expect(result.hitX).toBe(true);
  });

  it('treats out-of-bounds as a wall on every side', () => {
    const left = createBody(10, 28, 12, 20);
    left.vx = -100;
    expect(step(left, GROUND, 20).hitX).toBe(true);
    expect(left.x).toBeCloseTo(0, 5);

    const top = createBody(40, 4, 12, 20);
    top.vy = -100;
    expect(step(top, GROUND, 20).hitCeiling).toBe(true);
    expect(top.y).toBeCloseTo(0, 5);
  });

  it('catches a falling body on a one-way platform', () => {
    const body = createBody(52, 0, 12, 20);
    body.vy = 200;

    step(body, LEDGE, 30);
    expect(body.y + body.h).toBeCloseTo(32, 5);
    expect(body.grounded).toBe(true);
  });

  it('lets a rising body pass up through a one-way platform', () => {
    const body = createBody(52, 50, 12, 20);
    body.vy = -200;

    step(body, LEDGE, 15);
    expect(body.y + body.h).toBeLessThan(32);
    expect(body.grounded).toBe(false);
  });

  it('never blocks sideways movement on a one-way platform', () => {
    const body = createBody(30, 34, 12, 20); // overlaps the ledge row, moving right
    body.vx = 120;

    const result = step(body, LEDGE, 20);
    expect(result.hitX).toBe(false);
    expect(body.x).toBeGreaterThan(60);
  });

  it('drops a body through a one-way platform while drop-through is active', () => {
    const body = createBody(52, 12, 12, 20); // feet resting exactly on the ledge
    moveAndCollide(LEDGE, body, DT);
    expect(body.grounded).toBe(true);

    body.dropThroughTicks = PLAYER.dropThroughTicks;
    body.vy = PLAYER.dropThroughSpeed;
    step(body, LEDGE, 30);

    expect(body.y + body.h).toBeGreaterThan(48);
    expect(body.grounded).toBe(false);
  });

  it('nudges a rising body past a ceiling corner', () => {
    // The body starts 5px off-centre under the one-tile gap and must slide into it.
    const body = createBody(43, 60, 12, 20);
    body.vy = -200;

    step(body, CEILING_GAP, 40);
    expect(body.y).toBeCloseTo(0, 5);
    expect(body.grounded).toBe(false);
  });

  it('does not nudge a body under a flat ceiling', () => {
    const body = createBody(43, 28, 12, 20);
    body.vy = -200;

    const result = step(body, CEILING_FLAT, 40);
    expect(result.hitCeiling).toBe(true);
    expect(body.y).toBeCloseTo(16, 5); // stopped below the ceiling row
    expect(body.vy).toBe(0);
  });

  it('never tunnels through a surface at maximum speed', () => {
    // Sub-steps shorter than a tile are what make any reachable speed safe.
    expect(PHYSICS.maxStep).toBeLessThan(16);

    const body = createBody(52, 0, 12, 20);
    body.vy = PLAYER.jump.maxFall * 4;
    step(body, LEDGE, 5);
    expect(body.y + body.h).toBeCloseTo(32, 5);
  });

  it('rejects a non-positive dt', () => {
    const body = createBody(40, 0, 12, 20);
    expect(() => moveAndCollide(GROUND, body, 0)).toThrow(/positive dt/);
  });
});
