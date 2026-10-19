import { describe, expect, it } from 'vitest';
import { Rng } from '../../src/core/Rng';

function sample(rng: Rng, count: number): number[] {
  return Array.from({ length: count }, () => rng.next());
}

describe('Rng (mulberry32)', () => {
  it('produces identical streams for identical seeds', () => {
    expect(sample(new Rng(1234), 100)).toEqual(sample(new Rng(1234), 100));
  });

  it('produces different streams for different seeds', () => {
    expect(sample(new Rng(1), 10)).not.toEqual(sample(new Rng(2), 10));
  });

  it('stays in [0, 1)', () => {
    const rng = new Rng(99);
    for (let i = 0; i < 1000; i += 1) {
      const value = rng.next();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });

  it('int() respects inclusive bounds and reaches them', () => {
    const rng = new Rng(7);
    const seen = new Set<number>();
    for (let i = 0; i < 500; i += 1) {
      const value = rng.int(3, 7);
      expect(value).toBeGreaterThanOrEqual(3);
      expect(value).toBeLessThanOrEqual(7);
      expect(Number.isInteger(value)).toBe(true);
      seen.add(value);
    }
    expect([...seen].sort()).toEqual([3, 4, 5, 6, 7]);
  });

  it('float() respects bounds', () => {
    const rng = new Rng(21);
    for (let i = 0; i < 200; i += 1) {
      const value = rng.float(-2.5, 4.5);
      expect(value).toBeGreaterThanOrEqual(-2.5);
      expect(value).toBeLessThan(4.5);
    }
  });

  it('chance() handles the deterministic edges', () => {
    const rng = new Rng(3);
    expect(rng.chance(0)).toBe(false);
    expect(rng.chance(1)).toBe(true);
  });

  it('pick() returns elements and throws on empty input', () => {
    const rng = new Rng(5);
    const items = ['a', 'b', 'c'] as const;
    expect(items).toContain(rng.pick(items));
    expect(() => rng.pick([])).toThrow();
    expect(() => rng.pickIndex(0)).toThrow();
  });

  it('fork() is deterministic and independent from the parent stream', () => {
    const parentA = new Rng(42);
    const parentB = new Rng(42);
    const forkA = parentA.fork();
    const forkB = parentB.fork();

    expect(sample(forkA, 20)).toEqual(sample(forkB, 20));
    expect(parentA.next()).toBe(parentB.next());
  });

  it('getState()/setState() restores the exact stream', () => {
    const rng = new Rng(88);
    sample(rng, 17);
    const snapshot = rng.getState();
    const expected = sample(rng, 10);

    rng.setState(snapshot);
    expect(sample(rng, 10)).toEqual(expected);
  });

  it('rejects invalid input', () => {
    expect(() => new Rng(Number.NaN)).toThrow();
    expect(() => new Rng(Number.POSITIVE_INFINITY)).toThrow();
    expect(() => new Rng(1).int(5, 2)).toThrow();
    expect(() => new Rng(1).float(2, 2)).toThrow();
    expect(() => new Rng(1).chance(1.5)).toThrow();
  });
});
