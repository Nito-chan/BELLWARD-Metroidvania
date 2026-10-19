import { describe, expect, it } from 'vitest';
import { FixedTimestep } from '../../src/core/FixedTimestep';

const DT = 1 / 60;
const MAX = 0.25;

describe('FixedTimestep', () => {
  it('rejects invalid dt and maxFrameTime', () => {
    expect(() => new FixedTimestep(0, MAX)).toThrow();
    expect(() => new FixedTimestep(-1, MAX)).toThrow();
    expect(() => new FixedTimestep(Number.NaN, MAX)).toThrow();
    expect(() => new FixedTimestep(DT, DT / 2)).toThrow();
  });

  it('runs no step for sub-step elapsed time and exposes alpha', () => {
    const ts = new FixedTimestep(DT, MAX);
    expect(ts.advance(DT * 0.25)).toBe(0);
    expect(ts.alpha).toBeCloseTo(0.25, 9);
  });

  it('runs exact steps and keeps the remainder', () => {
    const ts = new FixedTimestep(DT, MAX);
    expect(ts.advance(DT * 3.5)).toBe(3);
    expect(ts.alpha).toBeCloseTo(0.5, 9);
  });

  it('accumulates fractional frames until a full step is reached', () => {
    const ts = new FixedTimestep(DT, MAX);
    const eighth = DT / 8;
    let steps = 0;
    for (let i = 0; i < 7; i += 1) steps += ts.advance(eighth);
    expect(steps).toBe(0);
    steps += ts.advance(eighth);
    expect(steps).toBe(1);
    expect(ts.alpha).toBeCloseTo(0, 9);
  });

  it('clamps long stalls to maxFrameTime (spiral-of-death guard)', () => {
    const ts = new FixedTimestep(DT, MAX);
    expect(ts.advance(5)).toBe(15); // 0.25 s * 60 Hz
    expect(ts.alpha).toBeCloseTo(0, 9);
  });

  it('treats negative elapsed as zero and rejects non-finite input', () => {
    const ts = new FixedTimestep(DT, MAX);
    expect(ts.advance(-0.5)).toBe(0);
    expect(ts.alpha).toBe(0);
    expect(() => ts.advance(Number.POSITIVE_INFINITY)).toThrow();
  });

  it('stays exact across a second of typical 60 Hz frames', () => {
    const ts = new FixedTimestep(DT, MAX);
    let steps = 0;
    for (let i = 0; i < 60; i += 1) steps += ts.advance(1000 / 60 / 1000);
    expect(steps).toBe(60);
  });

  it('reset clears the pending partial step', () => {
    const ts = new FixedTimestep(DT, MAX);
    ts.advance(DT * 0.6);
    ts.reset();
    expect(ts.alpha).toBe(0);
    expect(ts.advance(DT * 0.5)).toBe(0);
  });
});
