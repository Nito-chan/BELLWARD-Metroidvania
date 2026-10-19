import { describe, expect, it } from 'vitest';
import { belfryTerrace } from '../../src/data/rooms/belfry-terrace';
import { BellwardError } from '../../src/core/Errors';
import { createRoom } from '../../src/world/Room';

describe('createRoom', () => {
  it('builds the belfry terrace with the expected dimensions', () => {
    const room = createRoom(belfryTerrace);
    expect(room.tilemap.width).toBe(60);
    expect(room.tilemap.height).toBe(24);
    expect(room.bounds).toEqual({ x: 0, y: 0, w: 960, h: 384 });
    expect(room.tilemap.tileCount).toBe(449);
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
