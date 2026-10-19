import { describe, expect, it } from 'vitest';
import { RENDER } from '../../src/config/render';
import { BellwardError } from '../../src/core/Errors';
import { Tilemap } from '../../src/world/Tilemap';
import type { TileRole } from '../../src/world/tiles';

describe('Tilemap', () => {
  it('parses rectangular ASCII into a grid', () => {
    const map = Tilemap.fromRows(['##  ', '#   ', '    '], { '#': 'wall' });
    expect(map.width).toBe(4);
    expect(map.height).toBe(3);
    expect(map.pixelWidth).toBe(4 * RENDER.tileSize);
    expect(map.pixelHeight).toBe(3 * RENDER.tileSize);
    expect(map.tileCount).toBe(3);
    expect(map.roleAt(0, 0)).toBe('wall');
    expect(map.roleAt(1, 0)).toBe('wall');
    expect(map.roleAt(2, 0)).toBeNull();
  });

  it('counts only non-empty cells', () => {
    const map = Tilemap.fromRows(['# #', ' # ', '# #'], { '#': 'wall' });
    expect(map.tileCount).toBe(5);
    expect(map.width * map.height).toBe(9);
  });

  it('reports solid and one-way roles', () => {
    const map = Tilemap.fromRows(['#Lw', 'f  '], {
      '#': 'wall',
      L: 'ledge',
      w: 'window',
      f: 'floor',
    });
    expect(map.isSolid(0, 0)).toBe(true);
    expect(map.isOneWay(1, 0)).toBe(true);
    expect(map.isSolid(1, 0)).toBe(true);
    expect(map.isSolid(2, 0)).toBe(false);
    expect(map.isOneWay(0, 1)).toBe(false);
  });

  it('treats out-of-bounds as empty space', () => {
    const map = Tilemap.fromRows(['#'], { '#': 'wall' });
    expect(map.contains(-1, 0)).toBe(false);
    expect(map.contains(1, 0)).toBe(false);
    expect(map.roleAt(5, 5)).toBeNull();
    expect(map.isSolid(-1, 0)).toBe(false);
    expect(map.isOneWay(-1, -1)).toBe(false);
  });

  it('visits non-empty tiles in row-major order', () => {
    const map = Tilemap.fromRows(['# #', ' # '], { '#': 'wall' });
    const visited: string[] = [];
    map.forEachTile((tx, ty) => visited.push(`${tx},${ty}`));
    expect(visited).toEqual(['0,0', '2,0', '1,1']);
  });

  it('rejects empty layouts and empty rows', () => {
    expect(() => Tilemap.fromRows([], {})).toThrow(BellwardError);
    expect(() => Tilemap.fromRows([''], {})).toThrow(/must not be empty/);
  });

  it('rejects ragged rows', () => {
    expect(() => Tilemap.fromRows(['##', '#'], { '#': 'wall' })).toThrow(/rectangular/);
  });

  it('rejects glyphs missing from the legend', () => {
    expect(() => Tilemap.fromRows(['#?'], { '#': 'wall' })).toThrow(/missing from the legend/);
  });

  it('rejects malformed legend glyphs', () => {
    expect(() => Tilemap.fromRows(['#'], { '##': 'wall' })).toThrow(/single non-space/);
    expect(() => Tilemap.fromRows(['#'], { ' ': 'wall' })).toThrow(/single non-space/);
  });

  it('rejects roles that are not in the role table', () => {
    expect(() => Tilemap.fromRows(['#'], { '#': 'lava' as TileRole })).toThrow(/unknown role/);
  });
});
