import { describe, expect, it, vi } from 'vitest';
import { Loop } from '../../src/core/Loop';

/** Deterministic frame scheduler: only ticks when the test says so. */
class ManualScheduler {
  private readonly queue = new Map<number, (timeMs: number) => void>();
  private nextId = 1;
  private nowMs = 0;

  readonly requestFrame = (callback: (timeMs: number) => void): number => {
    const id = this.nextId;
    this.nextId += 1;
    this.queue.set(id, callback);
    return id;
  };

  readonly cancelFrame = (handle: number): void => {
    this.queue.delete(handle);
  };

  get pendingCount(): number {
    return this.queue.size;
  }

  /** Advances the clock by `ms` and fires the frame callbacks scheduled so far. */
  tick(ms: number): void {
    this.nowMs += ms;
    const pending = [...this.queue.values()];
    this.queue.clear();
    for (const callback of pending) callback(this.nowMs);
  }
}

function createLoop(
  steps: number[],
  renders: number[],
): { loop: Loop; scheduler: ManualScheduler } {
  const scheduler = new ManualScheduler();
  const loop = new Loop({
    dt: 1 / 60,
    maxFrameTime: 0.25,
    step: () => steps.push(1),
    render: () => renders.push(1),
    requestFrame: scheduler.requestFrame,
    cancelFrame: scheduler.cancelFrame,
  });
  return { loop, scheduler };
}

describe('Loop', () => {
  it('runs 60 simulation steps per second of 60 Hz frames', () => {
    const steps: number[] = [];
    const renders: number[] = [];
    const { loop, scheduler } = createLoop(steps, renders);

    loop.start();
    scheduler.tick(0); // First frame: establishes the clock, no elapsed time yet.
    for (let i = 0; i < 60; i += 1) scheduler.tick(1000 / 60);

    expect(steps.length).toBe(60);
    expect(renders.length).toBe(61);
    expect(loop.stats.tickCount).toBe(60);
    expect(loop.stats.simTime).toBeCloseTo(1, 6);
    loop.stop();
  });

  it('clamps a long stall and never spirals', () => {
    const steps: number[] = [];
    const { loop, scheduler } = createLoop(steps, []);

    loop.start();
    scheduler.tick(0);
    scheduler.tick(10_000); // 10 s stall in one frame

    expect(steps.length).toBe(15); // exactly maxFrameTime (0.25 s) worth of ticks
    loop.stop();
  });

  it('setTimeScale slows the simulation rate', () => {
    const steps: number[] = [];
    const { loop, scheduler } = createLoop(steps, []);

    loop.start();
    loop.setTimeScale(0.5);
    scheduler.tick(0);
    for (let i = 0; i < 60; i += 1) scheduler.tick(1000 / 60);

    expect(loop.stats.tickCount).toBeGreaterThanOrEqual(29);
    expect(loop.stats.tickCount).toBeLessThanOrEqual(31);
    loop.stop();
  });

  it('pause stops steps but keeps rendering', () => {
    const steps: number[] = [];
    const renders: number[] = [];
    const { loop, scheduler } = createLoop(steps, renders);

    loop.start();
    scheduler.tick(0);
    loop.pause();
    for (let i = 0; i < 10; i += 1) scheduler.tick(1000 / 60);

    expect(steps.length).toBe(0);
    expect(renders.length).toBe(11);

    loop.resume();
    for (let i = 0; i < 10; i += 1) scheduler.tick(1000 / 60);
    expect(loop.stats.tickCount).toBeGreaterThanOrEqual(9);
    loop.stop();
  });

  it('stop cancels the pending frame', () => {
    const steps: number[] = [];
    const { loop, scheduler } = createLoop(steps, []);

    loop.start();
    expect(scheduler.pendingCount).toBe(1);
    loop.stop();
    expect(scheduler.pendingCount).toBe(0);

    scheduler.tick(1000);
    expect(steps.length).toBe(0);
  });

  it('reports step() errors and stops instead of looping on failure', () => {
    const scheduler = new ManualScheduler();
    const onError = vi.fn();
    const loop = new Loop({
      dt: 1 / 60,
      maxFrameTime: 0.25,
      step: () => {
        throw new Error('boom');
      },
      render: () => undefined,
      onError,
      requestFrame: scheduler.requestFrame,
      cancelFrame: scheduler.cancelFrame,
    });

    loop.start();
    scheduler.tick(0);
    scheduler.tick(1000);

    expect(onError).toHaveBeenCalledTimes(1);
    expect(loop.isRunning).toBe(false);
    expect(scheduler.pendingCount).toBe(0);
  });

  it('validates timeScale input', () => {
    const { loop } = createLoop([], []);
    expect(() => loop.setTimeScale(-1)).toThrow();
    expect(() => loop.setTimeScale(Number.NaN)).toThrow();
  });
});
