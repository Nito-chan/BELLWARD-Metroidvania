import { describe, expect, it } from 'vitest';
import { FINAL_ACT } from '../../src/config/finalAct';
import { HOOK } from '../../src/config/hookline';
import { PLAYER } from '../../src/config/player';
import { BENCHES } from '../../src/data/benches';
import { belfryTerrace } from '../../src/data/rooms/belfry-terrace';
import { belfryAntechamber } from '../../src/data/rooms/belfry-antechamber';
import { ALL_ROOMS, ROOMS, getRoom } from '../../src/data/rooms';
import { BellwardError } from '../../src/core/Errors';
import { createRoom, isStandingPoint } from '../../src/world/Room';
import { canHangAt } from '../../src/world/hookGeometry';

describe('createRoom', () => {
  it('builds the belfry terrace with the expected dimensions', () => {
    const room = createRoom(belfryTerrace);
    expect(room.tilemap.width).toBe(60);
    expect(room.tilemap.height).toBe(24);
    expect(room.bounds).toEqual({ x: 0, y: 0, w: 960, h: 384 });
    expect(room.tilemap.tileCount).toBe(421);
    expect(room.spawn).toEqual({ x: 420, y: 320 });
  });

  it('keeps the traversal routes walkable', () => {
    const room = createRoom(belfryTerrace);
    // The left tower's beams climb 32 px at a time up to the bridge.
    expect(room.tilemap.roleAt(10, 18)).toBe('ledge');
    expect(room.tilemap.roleAt(14, 16)).toBe('ledge');
    expect(room.tilemap.roleAt(18, 14)).toBe('ledge');
    expect(room.tilemap.roleAt(20, 12)).toBe('ledge');
    expect(room.tilemap.isOneWay(20, 12)).toBe(true);
    // Walkway steps onto the dais.
    expect(room.tilemap.roleAt(42, 19)).toBe('floor');
    expect(room.tilemap.roleAt(43, 19)).toBe('floor');
    expect(room.tilemap.roleAt(43, 18)).toBe('floor');
    expect(room.tilemap.roleAt(44, 16)).toBe('floor');
  });

  it('spawns the hero on solid ground', () => {
    const room = createRoom(belfryTerrace);
    const tx = Math.floor(room.spawn.x / 16);
    const ty = Math.floor(room.spawn.y / 16);
    expect(room.tilemap.roleAt(tx, ty)).toBe('floor');
    expect(room.tilemap.isSolid(tx, ty)).toBe(true);
  });

  it('keeps every prop inside the room horizontally', () => {
    for (const prop of belfryTerrace.props) {
      expect(prop.x).toBeGreaterThanOrEqual(0);
      expect(prop.x).toBeLessThan(960);
      expect(prop.y).toBeGreaterThan(0);
      expect(prop.y).toBeLessThanOrEqual(384);
      expect(['back', 'front']).toContain(prop.layer);
    }
  });

  it('uses only declared background keys', () => {
    for (const key of belfryTerrace.backgrounds) {
      expect(['far', 'mid', 'near']).toContain(key);
    }
  });

  it('rejects a spawn outside the map', () => {
    expect(() => createRoom({ ...belfryTerrace, spawn: { x: -1, y: 10 } })).toThrow(
      /spawn .* is outside/,
    );
    expect(() => createRoom({ ...belfryTerrace, spawn: { x: 960, y: 10 } })).toThrow(
      /spawn .* is outside/,
    );
  });

  it('places the four story enemies on solid ground within their beats', () => {
    const room = createRoom(belfryTerrace);
    expect(belfryTerrace.enemies.map((enemy) => enemy.kind)).toEqual([
      'parishioner',
      'parishioner',
      'ghoul',
      'adept',
    ]);
    for (const enemy of belfryTerrace.enemies) {
      expect(room.tilemap.isSolid(Math.floor(enemy.x / 16), Math.floor(enemy.y / 16))).toBe(true);
      if (enemy.patrol) {
        expect(enemy.x).toBeGreaterThanOrEqual(enemy.patrol.min);
        expect(enemy.x).toBeLessThanOrEqual(enemy.patrol.max);
      }
    }
  });

  it('rejects enemy spawns with no ground under their feet', () => {
    expect(() =>
      createRoom({
        ...belfryTerrace,
        enemies: [{ kind: 'parishioner', x: 500, y: 200 }],
      }),
    ).toThrow(/not on solid ground/);
  });

  it('rejects an unknown enemy kind from bad data', () => {
    expect(() =>
      createRoom({
        ...belfryTerrace,
        enemies: [{ kind: 'revenant' as never, x: 150, y: 320 }],
      }),
    ).toThrow(/unknown enemy kind/);
  });

  it('rejects enemy bodies that overlap a wall', () => {
    expect(() =>
      createRoom({
        ...belfryTerrace,
        enemies: [{ kind: 'adept', x: 30, y: 320 }],
      }),
    ).toThrow(/body overlaps wall/);
  });

  it('rejects patrol beats that are inverted, outside the room, or miss the spawn', () => {
    expect(() =>
      createRoom({
        ...belfryTerrace,
        enemies: [{ kind: 'parishioner', x: 150, y: 320, patrol: { min: 200, max: 150 } }],
      }),
    ).toThrow(/patrol min .* must be less than max/);
    expect(() =>
      createRoom({
        ...belfryTerrace,
        enemies: [{ kind: 'parishioner', x: 150, y: 320, patrol: { min: -10, max: 150 } }],
      }),
    ).toThrow(/leaves the room/);
    expect(() =>
      createRoom({
        ...belfryTerrace,
        enemies: [{ kind: 'parishioner', x: 150, y: 320, patrol: { min: 200, max: 300 } }],
      }),
    ).toThrow(/outside patrol/);
  });

  it('rejects invalid ambient alpha', () => {
    expect(() =>
      createRoom({
        ...belfryTerrace,
        ambient: { tint: 'deepWater', alpha: 1.5 },
      }),
    ).toThrow(/ambient alpha/);
    expect(() =>
      createRoom({
        ...belfryTerrace,
        ambient: { tint: 'deepWater', alpha: -0.1 },
      }),
    ).toThrow(BellwardError);
  });
});

describe('M6 rooms and the bell nave graph', () => {
  it('builds every room with unique ids and a solid authored spawn', () => {
    expect(new Set(ALL_ROOMS.map((room) => room.id)).size).toBe(ALL_ROOMS.length);
    for (const definition of ALL_ROOMS) {
      const room = createRoom(definition);
      expect(room.tilemap.pixelWidth).toBe(960);
      expect(
        room.tilemap.isSolid(Math.floor(room.spawn.x / 16), Math.floor(room.spawn.y / 16)),
      ).toBe(true);
    }
    expect(Object.keys(ROOMS).sort()).toEqual(ALL_ROOMS.map((room) => room.id).sort());
    expect(() => getRoom('missing-room')).toThrow(/unknown room/);
  });

  it('puts exactly one declared boss in each arena and none in the nave or terrace', () => {
    for (const definition of ALL_ROOMS) {
      const bosses = definition.enemies.filter((enemy) => enemy.kind === definition.boss);
      if (definition.boss) {
        expect(bosses).toHaveLength(1);
        expect(definition.enemies).toHaveLength(1);
        expect(definition.name.length).toBeGreaterThan(0);
      } else {
        expect(bosses).toHaveLength(0);
      }
    }
    expect(belfryAntechamber.enemies).toEqual([]);
    expect(belfryAntechamber.exits?.map((exit) => exit.targetRoomId).sort()).toEqual([
      'belfry-terrace',
      'bellbearer-arena',
      'bellows',
      'bellthief-arena',
      'warden-arena',
    ]);
    expect(belfryTerrace.exits?.map((exit) => exit.targetRoomId).sort()).toEqual([
      'belfry-antechamber',
      'drowned-gallery',
    ]);
  });

  it('keeps every exit trigger inside the source and its destination spawn clear', () => {
    for (const definition of ALL_ROOMS) {
      const source = createRoom(definition);
      const sourceSpawnBody = {
        x: source.spawn.x - 6,
        y: source.spawn.y - 40,
        w: 12,
        h: 40,
      };
      for (const sourceExit of source.definition.exits ?? []) {
        // A spawn inside its own room's door would immediately re-trigger on entry.
        expect(
          sourceSpawnBody.x < sourceExit.x + sourceExit.w &&
            sourceSpawnBody.x + sourceSpawnBody.w > sourceExit.x &&
            sourceSpawnBody.y < sourceExit.y + sourceExit.h &&
            sourceSpawnBody.y + sourceSpawnBody.h > sourceExit.y,
        ).toBe(false);
      }
      for (const exit of source.definition.exits ?? []) {
        expect(exit.x + exit.w).toBeLessThanOrEqual(source.tilemap.pixelWidth);
        expect(exit.y + exit.h).toBeLessThanOrEqual(source.tilemap.pixelHeight);
        const target = createRoom(getRoom(exit.targetRoomId));
        // Destination spawns may overlap a doorway; RoomScene arms exits only after the
        // player has left every trigger, so a return door does not bounce the player.
        expect(
          target.tilemap.isSolid(Math.floor(exit.spawn.x / 16), Math.floor(exit.spawn.y / 16)),
        ).toBe(true);
        expect(
          target.tilemap.isWall(
            Math.floor((exit.spawn.x - 6) / 16),
            Math.floor((exit.spawn.y - 40) / 16),
          ),
        ).toBe(false);
      }
    }
  });

  it('keeps arena ledges off the boss spawn column', () => {
    for (const id of ['bellbearer-arena', 'warden-arena', 'bellthief-arena']) {
      const room = createRoom(getRoom(id));
      // Boss spawns are at x=560 (column 35); both shelves stay clear of that body.
      expect(room.tilemap.roleAt(11, 17)).toBe('ledge');
      expect(room.tilemap.roleAt(48, 17)).toBe('ledge');
      expect(room.tilemap.roleAt(35, 17)).not.toBe('ledge');
      expect(room.tilemap.roleAt(35, 13)).not.toBe('ledge');
    }
  });

  it('rejects a boss declaration without exactly one matching spawn', () => {
    expect(() =>
      createRoom({
        ...belfryAntechamber,
        boss: 'bellbearer',
      }),
    ).toThrow(/exactly one spawn/);
    expect(() =>
      createRoom({
        ...belfryAntechamber,
        boss: 'bellbearer',
        enemies: [{ kind: 'bellbearer', x: 760, y: 320 }],
      }),
    ).not.toThrow();
  });

  it('indexes every bench and gives it solid ground and a clear respawn', () => {
    expect([...BENCHES.keys()]).toEqual([
      'terrace-weeping-stone',
      'nave-bell-keepers-rest',
      'upper-tide-watch',
    ]);
    for (const bench of BENCHES.values()) {
      const room = createRoom(getRoom(bench.roomId));
      expect(room.tilemap.isSolid(Math.floor(bench.x / 16), Math.floor(bench.y / 16))).toBe(true);
      expect(isStandingPoint(room.tilemap, bench.spawn, PLAYER.size)).toBe(true);
    }
  });

  it('rejects duplicate bench ids and blocked bench spawns', () => {
    const [bench] = belfryTerrace.benches ?? [];
    expect(bench).toBeDefined();
    if (!bench) return;

    expect(() =>
      createRoom({
        ...belfryTerrace,
        benches: [bench, { ...bench, name: 'Echo of the Stone' }],
      }),
    ).toThrow(/duplicate bench id/);

    expect(() =>
      createRoom({
        ...belfryTerrace,
        benches: [{ ...bench, spawn: { x: 10, y: 300 } }],
      }),
    ).toThrow(/clear standing point/);

    expect(() =>
      createRoom({
        ...belfryTerrace,
        benches: [{ ...bench, y: 300 }],
      }),
    ).toThrow(/not on solid ground/);

    expect(() =>
      createRoom({
        ...belfryTerrace,
        benches: [{ ...bench, spawn: { x: bench.x + 47, y: bench.y } }],
      }),
    ).toThrow(/outside its interaction range/);
  });
});

describe('Hookline anchors', () => {
  it('authors 35 globally unique rings, each hanging in open space', () => {
    const ids = new Set<string>();
    const counts: Record<string, number> = {};
    for (const definition of ALL_ROOMS) {
      counts[definition.id] = definition.anchors?.length ?? 0;
      const room = createRoom(definition);
      for (const anchor of definition.anchors ?? []) {
        expect(ids.has(anchor.id)).toBe(false);
        ids.add(anchor.id);
        expect(room.tilemap.isSolid(Math.floor(anchor.x / 16), Math.floor(anchor.y / 16))).toBe(
          false,
        );
        expect(canHangAt(room.tilemap, anchor)).toBe(true);
      }
    }
    expect(ids.size).toBe(38);
    expect(counts['belfry-terrace']).toBe(5);
    expect(counts['drowned-gallery']).toBe(6);
    expect(counts['wall-claw-shaft']).toBe(0);
    expect(counts['belfry-antechamber']).toBe(0);
  });

  it('rejects duplicate, empty, outside, solid-mounted and blocked rings', () => {
    const [anchor] = belfryTerrace.anchors ?? [];
    expect(anchor).toBeDefined();
    if (!anchor) return;

    expect(() =>
      createRoom({ ...belfryTerrace, anchors: [anchor, { ...anchor, x: anchor.x + 2 }] }),
    ).toThrow(/duplicate anchor id/);

    expect(() => createRoom({ ...belfryTerrace, anchors: [{ ...anchor, id: ' ' }] })).toThrow(
      /id is empty/,
    );

    expect(() =>
      createRoom({ ...belfryTerrace, anchors: [{ ...anchor, id: 'outside', x: 960 }] }),
    ).toThrow(/leaves the room/);

    expect(() =>
      createRoom({ ...belfryTerrace, anchors: [{ ...anchor, id: 'solid', x: 8, y: 320 }] }),
    ).toThrow(/inside solid geometry/);

    expect(() =>
      createRoom({ ...belfryTerrace, anchors: [{ ...anchor, id: 'blocked', x: 420, y: 306 }] }),
    ).toThrow(/hang point .* overlaps geometry/);
  });
});

describe('The Last Bell', () => {
  it('puts the centre hang comfortably inside the final interaction radius', () => {
    const room = getRoom('last-bell');
    const act = room.lastKeeper;
    expect(act).toBeDefined();
    if (!act) return;
    const centre = act.chains.find((chain) => chain.id === 'last-bell-chain-center');
    expect(centre).toBeDefined();
    if (!centre) return;

    const hangFeet = { x: centre.x, y: centre.y + HOOK.hangOffsetY };
    const distance = Math.hypot(hangFeet.x - act.greatBell.x, hangFeet.y - act.greatBell.y);
    expect(FINAL_ACT.bellInteractRadius).toBeGreaterThanOrEqual(64);
    expect(distance).toBeLessThan(FINAL_ACT.bellInteractRadius);
  });

  it('uses the earned ending copy and leaves the midpoint card distinct', () => {
    expect(FINAL_ACT.ending).toEqual({
      eyebrow: 'THE LAST BELL',
      title: 'THE BELL REMEMBERS',
      subtitle: 'The Keeper sets down the bell. The water is still.',
      closeLabel: 'Continue the climb',
    });
    expect(FINAL_ACT.ending.eyebrow).not.toContain('END OF THE SLICE');
  });
});
