import { describe, expect, it } from 'vitest';
import { approach, clamp, lerp, overlap } from '../../src/core/Math2D';

describe('overlap', () => {
  const base = { x: 0, y: 0, w: 10, h: 10 };

  it('detects genuine intersections', () => {
    expect(overlap(base, { x: 5, y: 5, w: 10, h: 10 })).toBe(true);
    expect(overlap(base, { x: -5, y: -5, w: 10, h: 10 })).toBe(true);
  });

  it('treats edge-touching rectangles as not overlapping', () => {
    expect(overlap(base, { x: 10, y: 0, w: 10, h: 10 })).toBe(false);
    expect(overlap(base, { x: 0, y: 10, w: 10, h: 10 })).toBe(false);
  });

  it('rejects separated rectangles', () => {
    expect(overlap(base, { x: 50, y: 50, w: 5, h: 5 })).toBe(false);
  });

  it('treats containment as overlapping', () => {
    expect(overlap(base, { x: 2, y: 2, w: 3, h: 3 })).toBe(true);
  });
});

describe('clamp / lerp / approach', () => {
  it('clamps and validates the range', () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-1, 0, 10)).toBe(0);
    expect(clamp(11, 0, 10)).toBe(10);
    expect(() => clamp(1, 10, 0)).toThrow();
  });

  it('lerps', () => {
    expect(lerp(0, 10, 0.5)).toBe(5);
    expect(lerp(10, 0, 0.25)).toBe(7.5);
  });

  it('approaches the target without overshooting', () => {
    expect(approach(0, 10, 3)).toBe(3);
    expect(approach(0, 10, 99)).toBe(10);
    expect(approach(10, 0, 2.5)).toBe(7.5);
    expect(approach(5, 5, 3)).toBe(5);
    expect(() => approach(0, 10, -1)).toThrow();
    expect(() => approach(0, 10, Number.NaN)).toThrow();
  });
});
