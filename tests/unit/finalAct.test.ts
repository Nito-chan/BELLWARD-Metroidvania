import { describe, expect, it } from 'vitest';
import { FINAL_ACT, floodLineForLevel, isFlooded } from '../../src/config/finalAct';

describe('Last Keeper flood', () => {
  it('starts dry and maps each chain to one clear surface step', () => {
    expect(floodLineForLevel(0)).toBeNull();
    expect(floodLineForLevel(-1)).toBeNull();
    expect(floodLineForLevel(1)).toBe(304);
    expect(floodLineForLevel(2)).toBe(256);
    expect(floodLineForLevel(3)).toBe(224);
    expect(floodLineForLevel(4)).toBe(224);
    expect(floodLineForLevel(Number.NaN)).toBeNull();
    expect(FINAL_ACT.flood.levels).toEqual([304, 256, 224]);
  });

  it('floods the floor, then the low ledges, never the high ledges or rings', () => {
    const floor = 320;
    const lowLedge = 272;
    const highLedge = 208;
    const ringHang = 200;

    expect(isFlooded(floor, floodLineForLevel(0))).toBe(false);
    for (const level of [1, 2, 3]) {
      const line = floodLineForLevel(level);
      expect(isFlooded(floor, line)).toBe(true);
      expect(isFlooded(highLedge, line)).toBe(false);
      expect(isFlooded(ringHang, line)).toBe(false);
    }

    // The first raise leaves the low ledges dry; the second swallows them.
    expect(isFlooded(lowLedge, floodLineForLevel(1))).toBe(false);
    expect(isFlooded(lowLedge, floodLineForLevel(2))).toBe(true);
    expect(isFlooded(lowLedge, floodLineForLevel(3))).toBe(true);
  });

  it('treats feet exactly on the surface as dry and handles the no-water case', () => {
    expect(isFlooded(304, 304)).toBe(false);
    expect(isFlooded(305, 304)).toBe(true);
    expect(isFlooded(999, null)).toBe(false);
  });
});
