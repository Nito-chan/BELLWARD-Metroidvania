import { describe, expect, it } from 'vitest';
import { HOOK } from '../../src/config/hookline';
import { PLAYER } from '../../src/config/player';
import type { ActionName } from '../../src/config/input';
import type { InputSnapshot } from '../../src/input/InputState';
import { createBody } from '../../src/physics/Body';
import { PlayerController } from '../../src/player/PlayerController';
import { PlayerHook, type HookHost } from '../../src/player/PlayerHook';
import { STARTER_LOADOUT } from '../../src/player/PlayerLoadout';
import { PlayerPose } from '../../src/player/PlayerPose';
import { canHangAt, handPoint, hangFeet, hasHookLineOfSight } from '../../src/world/hookGeometry';
import type { RoomAnchor } from '../../src/world/Room';
import { Tilemap } from '../../src/world/Tilemap';

const WIDTH = 40;
const HEIGHT = 20;
const EMPTY = ' '.repeat(WIDTH);
const FLOOR = 'F'.repeat(WIDTH);
const FILL = 'f'.repeat(WIDTH);
const LEGEND = { F: 'floor', f: 'floorFill', '#': 'wall', L: 'ledge' } as const;

/** A flat test room with a 40x20 tile grid; edits are `row -> [[column, glyph]]`. */
function testMap(edits: Readonly<Record<number, readonly (readonly [number, string])[]>> = {}) {
  const rows = Array.from({ length: HEIGHT }, (_, y) => {
    if (y === 17) return FLOOR;
    if (y > 17) return FILL;
    return EMPTY;
  });
  for (const [row, cells] of Object.entries(edits)) {
    const index = Number(row);
    const line = rows[index];
    if (line === undefined) throw new Error(`testMap row ${row} is outside the map`);
    const chars = line.split('');
    for (const [column, glyph] of cells) chars[column] = glyph;
    rows[index] = chars.join('');
  }
  return Tilemap.fromRows(rows, LEGEND);
}

const FLAT = testMap();

function input(
  held: readonly ActionName[] = [],
  pressed: readonly ActionName[] = [],
): InputSnapshot {
  return { held: new Set(held), pressed: new Set(pressed), released: new Set() };
}

/** A standing host at feet (x, y), facing right unless told otherwise. */
function hookHost(x = 100, feetY = 272, facing: -1 | 1 = 1): HookHost {
  const body = createBody(x - 6, feetY - 34, 12, 34);
  body.grounded = true;
  const pose = new PlayerPose();
  const host: HookHost = {
    body,
    pose,
    facing,
    busy: false,
    setFacing(direction) {
      host.facing = direction;
    },
  };
  return host;
}

function advance(
  hook: PlayerHook,
  host: HookHost,
  anchors: readonly RoomAnchor[],
  ticks: number,
  snapshot: InputSnapshot = input(),
): void {
  for (let tick = 0; tick < ticks; tick += 1) {
    hook.tick(host, snapshot, anchors, FLAT);
    hook.step(host, FLAT);
  }
}

function advanceToHang(
  hook: PlayerHook,
  host: HookHost,
  anchors: readonly RoomAnchor[],
  limit = 40,
): void {
  for (let tick = 0; tick < limit && hook.phase !== 'hang'; tick += 1) {
    hook.tick(host, input(), anchors, FLAT);
    hook.step(host, FLAT);
  }
}

describe('Hookline geometry', () => {
  it('hangs the feet a fixed distance below the ring and starts the line at the hand', () => {
    expect(hangFeet({ x: 120, y: 80 })).toEqual({ x: 120, y: 80 + HOOK.hangOffsetY });
    expect(handPoint({ x: 120, y: 112 })).toEqual({ x: 120, y: 112 - HOOK.handOffsetY });
  });

  it('rejects a ring whose hang body would overlap masonry', () => {
    const blocked = testMap({
      12: [
        [5, '#'],
        [6, '#'],
        [7, '#'],
      ],
    });
    expect(canHangAt(blocked, { x: 100, y: 180 })).toBe(false);
    expect(canHangAt(FLAT, { x: 100, y: 180 })).toBe(true);
  });

  it('lets the line pass a one-way ledge but not a wall', () => {
    const wall = testMap({
      13: [
        [7, '#'],
        [8, '#'],
      ],
    });
    const ledge = testMap({
      13: [
        [7, 'L'],
        [8, 'L'],
      ],
    });
    const hand = { x: 100, y: 244 };
    const ring = { x: 140, y: 180 };
    expect(hasHookLineOfSight(wall, hand, ring)).toBe(false);
    expect(hasHookLineOfSight(ledge, hand, ring)).toBe(true);
  });
});

describe('the Hookline', () => {
  const overhead: readonly RoomAnchor[] = [{ id: 'overhead', x: 100, y: 180 }];

  it('does nothing until the ability is owned', () => {
    const hook = new PlayerHook();
    const host = hookHost();
    expect(hook.tick(host, input(['cast'], ['cast']), overhead, FLAT)).toBe('none');
    expect(hook.active).toBe(false);
    expect(hook.candidateId).toBeNull();
  });

  it('casts, pulls, and settles into a hang at the ring', () => {
    const hook = new PlayerHook();
    hook.setEnabled(true);
    const host = hookHost();

    expect(hook.tick(host, input(['cast'], ['cast']), overhead, FLAT)).toBe('started');
    expect(hook.phase).toBe('zip');
    expect(hook.anchorId).toBe('overhead');
    expect(host.pose.animation).toBe('hook');

    advanceToHang(hook, host, overhead);
    expect(hook.phase).toBe('hang');
    expect(host.body.x + host.body.w / 2).toBeCloseTo(100, 5);
    expect(host.body.y + host.body.h).toBeCloseTo(180 + HOOK.hangOffsetY, 5);
    expect(host.body.vx).toBe(0);
    expect(host.body.vy).toBe(0);
  });

  it('holds for the hang window, then starts the cooldown', () => {
    const two: readonly RoomAnchor[] = [
      { id: 'overhead', x: 100, y: 180 },
      { id: 'next', x: 220, y: 180 },
    ];
    const hook = new PlayerHook();
    hook.setEnabled(true);
    const host = hookHost();
    hook.tick(host, input(['cast'], ['cast']), two, FLAT);
    advanceToHang(hook, host, two);
    expect(hook.phase).toBe('hang');

    advance(hook, host, two, HOOK.hangTicks - 1);
    expect(hook.phase).toBe('hang');
    advance(hook, host, two, 1);
    expect(hook.active).toBe(false);
    expect(hook.cooldownTicks).toBe(HOOK.cooldownTicks);

    for (let tick = 0; tick < HOOK.cooldownTicks - 1; tick += 1) {
      expect(hook.tick(host, input(['cast'], ['cast']), two, FLAT)).toBe('none');
      hook.step(host, FLAT);
    }
    expect(hook.cooldownTicks).toBe(1);
    expect(hook.tick(host, input(['cast'], ['cast']), two, FLAT)).toBe('started');
  });

  it('leaves a ring behind the facing direction alone', () => {
    const behind: readonly RoomAnchor[] = [{ id: 'behind', x: 60, y: 180 }];
    const hook = new PlayerHook();
    hook.setEnabled(true);
    const host = hookHost(100, 272, 1);

    hook.tick(host, input(), behind, FLAT);
    expect(hook.candidateId).toBeNull();

    host.facing = -1;
    hook.tick(host, input(), behind, FLAT);
    expect(hook.candidateId).toBe('behind');
  });

  it('honours the base range and the Longline upgrade', () => {
    const far: readonly RoomAnchor[] = [{ id: 'far', x: 100, y: 44 }];
    const hook = new PlayerHook();
    hook.setEnabled(true);
    const host = hookHost();

    hook.tick(host, input(), far, FLAT);
    expect(hook.candidateId).toBeNull();

    hook.setRange(HOOK.range.long);
    hook.tick(host, input(), far, FLAT);
    expect(hook.candidateId).toBe('far');
  });

  it('skips a ring with no line of sight', () => {
    const walled = testMap({
      13: [
        [7, '#'],
        [8, '#'],
      ],
    });
    const ring: readonly RoomAnchor[] = [{ id: 'walled', x: 140, y: 180 }];
    const hook = new PlayerHook();
    hook.setEnabled(true);
    const host = hookHost();

    hook.tick(host, input(), ring, walled);
    expect(hook.candidateId).toBeNull();
  });

  it('retargets to another ring while hanging', () => {
    const two: readonly RoomAnchor[] = [
      { id: 'low', x: 100, y: 180 },
      { id: 'high', x: 100, y: 120 },
    ];
    const hook = new PlayerHook();
    hook.setEnabled(true);
    const host = hookHost();
    hook.tick(host, input(['cast'], ['cast']), two, FLAT);
    advanceToHang(hook, host, two);
    expect(hook.anchorId).toBe('low');

    expect(hook.tick(host, input(['cast'], ['cast']), two, FLAT)).toBe('retargeted');
    expect(hook.phase).toBe('zip');
    expect(hook.anchorId).toBe('high');
  });

  it('jumps off the ring in the held direction', () => {
    const hook = new PlayerHook();
    hook.setEnabled(true);
    const host = hookHost();
    hook.tick(host, input(['cast'], ['cast']), overhead, FLAT);
    advanceToHang(hook, host, overhead);

    expect(hook.tick(host, input(['left'], ['jump']), overhead, FLAT)).toBe('jumped');
    expect(hook.active).toBe(false);
    expect(host.facing).toBe(-1);
    expect(host.body.vx).toBe(-HOOK.jumpX);
    expect(host.body.vy).toBe(-HOOK.jumpY);
    expect(host.pose.animation).toBe('jump');
  });

  it('drops through a platform below the hang', () => {
    const hook = new PlayerHook();
    hook.setEnabled(true);
    const host = hookHost();
    hook.tick(host, input(['cast'], ['cast']), overhead, FLAT);
    advanceToHang(hook, host, overhead);

    expect(hook.tick(host, input(['down']), overhead, FLAT)).toBe('dropped');
    expect(hook.active).toBe(false);
    expect(host.body.dropThroughTicks).toBe(PLAYER.dropThroughTicks);
    expect(host.body.vy).toBe(PLAYER.dropThroughSpeed);
  });

  it('cuts the pull when the body strikes a wall before the ring', () => {
    const walled = testMap({
      13: [
        [10, '#'],
        [11, '#'],
      ],
      14: [
        [10, '#'],
        [11, '#'],
      ],
      15: [
        [10, '#'],
        [11, '#'],
      ],
    });
    const ring: readonly RoomAnchor[] = [{ id: 'past-wall', x: 200, y: 180 }];
    const hook = new PlayerHook();
    hook.setEnabled(true);
    const host = hookHost();
    hook.tick(host, input(['cast'], ['cast']), ring, walled);
    expect(hook.active).toBe(true);

    for (let tick = 0; tick < 40 && hook.active; tick += 1) {
      hook.tick(host, input(), ring, walled);
      hook.step(host, walled);
    }
    expect(hook.active).toBe(false);
    expect(host.body.x + host.body.w / 2).toBeLessThan(200);
    expect(hook.cooldownTicks).toBe(HOOK.cooldownTicks);
  });
});

describe('Hookline in the player controller', () => {
  const anchors: readonly RoomAnchor[] = [{ id: 'overhead', x: 100, y: 180 }];

  it('starts from the cast input and exposes a live hook snapshot', () => {
    const player = new PlayerController(
      { x: 100, y: 272 },
      { loadout: { ...STARTER_LOADOUT, hookline: true } },
    );
    player.update(input(['cast'], ['cast']), FLAT, anchors);

    expect(player.hookEnabled).toBe(true);
    expect(player.hooking).toBe(true);
    expect(player.hookPhase).toBe('zip');
    expect(player.hookAnchorId).toBe('overhead');
    expect(player.hookRange).toBe(HOOK.range.base);
    expect(player.animation).toBe('hook');
  });

  it('applies Longline reach and cancels the line when the ability is removed', () => {
    const player = new PlayerController(
      { x: 100, y: 272 },
      { loadout: { ...STARTER_LOADOUT, hookline: true } },
    );
    player.applyLoadout({ ...STARTER_LOADOUT, hookline: true, longline: true });
    expect(player.hookRange).toBe(HOOK.range.long);

    player.update(input(['cast'], ['cast']), FLAT, anchors);
    expect(player.hooking).toBe(true);
    player.applyLoadout({ ...STARTER_LOADOUT });
    expect(player.hooking).toBe(false);
    expect(player.hookEnabled).toBe(false);
  });
});
