import { describe, expect, it } from 'vitest';
import { CAMERA } from '../../src/config/render';
import { VIEW } from '../../src/config/world';
import { Camera } from '../../src/render/Camera';

const BIG_ROOM = { x: 0, y: 0, w: 2000, h: 1000 };

describe('Camera', () => {
  it('rejects non-positive bounds', () => {
    expect(() => new Camera({ x: 0, y: 0, w: 0, h: 100 })).toThrow(/bounds must be positive/);
    expect(() => new Camera({ x: 0, y: 0, w: 100, h: -1 })).toThrow(/bounds must be positive/);
  });

  it('centers rooms smaller than the viewport', () => {
    const camera = new Camera({ x: 0, y: 0, w: 320, h: 200 });
    expect(camera.x).toBe((320 - VIEW.width) / 2);
    expect(camera.y).toBe((200 - VIEW.height) / 2);
  });

  it('snaps to the room center on construction of a large room', () => {
    const camera = new Camera(BIG_ROOM);
    expect(camera.x).toBe(1000 - VIEW.width / 2);
    expect(camera.y).toBe(500 - VIEW.height / 2);
  });

  it('holds still while the focus stays inside the deadzone', () => {
    const camera = new Camera(BIG_ROOM);
    const start = camera.x;
    camera.update(1000 + CAMERA.deadzone.x - 1, 500);
    expect(camera.x).toBe(start);
    camera.update(1000 - CAMERA.deadzone.x + 1, 500);
    expect(camera.x).toBe(start);
  });

  it('eases toward a focus beyond the deadzone', () => {
    const camera = new Camera(BIG_ROOM);
    camera.update(1100, 500);
    const desired = 680 + (1100 - 1000 - CAMERA.deadzone.x);
    const expected = 680 + (desired - 680) * CAMERA.smoothing;
    expect(camera.x).toBeCloseTo(expected, 6);
  });

  it('converges on a steady focus and stops there', () => {
    const camera = new Camera(BIG_ROOM);
    for (let i = 0; i < 400; i += 1) camera.update(1100, 500);
    const x = camera.x;
    camera.update(1100, 500);
    expect(camera.x).toBeCloseTo(x, 6);
    expect(camera.x).toBeCloseTo(1100 - VIEW.width / 2 - CAMERA.deadzone.x, 3);
  });

  it('clamps the view to the room edges', () => {
    const camera = new Camera(BIG_ROOM);
    for (let i = 0; i < 400; i += 1) camera.update(5000, 5000);
    expect(camera.x).toBe(2000 - VIEW.width);
    expect(camera.y).toBe(1000 - VIEW.height);
  });

  it('interpolates between the previous and current tick', () => {
    const camera = new Camera(BIG_ROOM);
    camera.update(1100, 500);
    const previous = 680;
    const current = camera.x;
    expect(camera.view(0).x).toBeCloseTo(previous, 6);
    expect(camera.view(1).x).toBeCloseTo(current, 6);
    expect(camera.view(0.5).x).toBeCloseTo((previous + current) / 2, 6);
  });

  it('re-clamps immediately when bounds shrink', () => {
    const camera = new Camera(BIG_ROOM);
    camera.setBounds({ x: 0, y: 0, w: 800, h: 500 });
    expect(camera.x).toBe(800 - VIEW.width);
    expect(camera.y).toBe(500 - VIEW.height);
    expect(camera.view(0)).toEqual({ x: camera.x, y: camera.y });
  });

  it('snapTo overrides smoothing and clamps', () => {
    const camera = new Camera(BIG_ROOM);
    camera.snapTo(100, 100);
    expect(camera.x).toBe(0);
    expect(camera.y).toBe(0);
    camera.snapTo(1950, 950);
    expect(camera.x).toBe(2000 - VIEW.width);
    expect(camera.y).toBe(1000 - VIEW.height);
  });

  it('is deterministic for identical input sequences', () => {
    const a = new Camera(BIG_ROOM);
    const b = new Camera(BIG_ROOM);
    for (const focus of [900, 1200, 400, 1600]) {
      a.update(focus, 500);
      b.update(focus, 500);
    }
    expect(a.view(0.25)).toEqual(b.view(0.25));
  });
});
