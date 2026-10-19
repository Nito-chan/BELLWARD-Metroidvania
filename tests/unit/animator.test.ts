import { describe, expect, it } from 'vitest';
import { BellwardError } from '../../src/core/Errors';
import type { AnimationSet } from '../../src/render/Animation';
import { SpriteAnimator } from '../../src/render/SpriteAnimator';

const CLIPS: AnimationSet = {
  idle: {
    loop: true,
    frames: [
      { frame: 0, ticks: 2 },
      { frame: 1, ticks: 3 },
    ],
  },
  attack: {
    loop: false,
    frames: [
      { frame: 2, ticks: 1 },
      { frame: 3, ticks: 1 },
    ],
  },
};

describe('SpriteAnimator', () => {
  it('starts on the first frame of the initial clip', () => {
    const animator = new SpriteAnimator(CLIPS, 'idle');
    expect(animator.animation).toBe('idle');
    expect(animator.frame).toBe(0);
    expect(animator.finished).toBe(false);
  });

  it('advances after the frame duration expires', () => {
    const animator = new SpriteAnimator(CLIPS, 'idle');
    animator.tick();
    expect(animator.frame).toBe(0);
    animator.tick();
    expect(animator.frame).toBe(1);
  });

  it('wraps looping clips to frame zero', () => {
    const animator = new SpriteAnimator(CLIPS, 'idle');
    // Frame 0 lasts 2 ticks, frame 1 lasts 3 ticks; the sixth tick wraps to frame 0.
    for (let i = 0; i < 5; i += 1) animator.tick();
    expect(animator.frame).toBe(0);
    animator.tick();
    animator.tick();
    expect(animator.frame).toBe(1);
    expect(animator.finished).toBe(false);
  });

  it('holds the final frame of a one-shot clip', () => {
    const animator = new SpriteAnimator(CLIPS, 'idle');
    animator.play('attack');
    expect(animator.frame).toBe(2);
    animator.tick();
    expect(animator.frame).toBe(3);
    expect(animator.finished).toBe(false);
    animator.tick();
    expect(animator.frame).toBe(3);
    expect(animator.finished).toBe(true);
    animator.tick();
    expect(animator.frame).toBe(3);
  });

  it('ignores replaying the active clip unless restart is requested', () => {
    const animator = new SpriteAnimator(CLIPS, 'idle');
    animator.tick();
    animator.tick();
    animator.play('idle');
    expect(animator.frame).toBe(1);
    animator.play('idle', true);
    expect(animator.frame).toBe(0);
  });

  it('resets completion when restarting a finished clip', () => {
    const animator = new SpriteAnimator(CLIPS, 'attack');
    animator.tick();
    animator.tick();
    expect(animator.finished).toBe(true);
    animator.play('attack', true);
    expect(animator.finished).toBe(false);
    expect(animator.frame).toBe(2);
  });

  it('throws on unknown clips', () => {
    const animator = new SpriteAnimator(CLIPS, 'idle');
    expect(() => animator.play('cast')).toThrow(BellwardError);
    expect(() => new SpriteAnimator(CLIPS, 'cast')).toThrow(/not defined/);
  });

  it('validates clip data', () => {
    expect(() => new SpriteAnimator({ bad: { loop: true, frames: [] } }, 'bad')).toThrow(
      /no frames/,
    );
    expect(
      () => new SpriteAnimator({ bad: { loop: true, frames: [{ frame: 0, ticks: 0 }] } }, 'bad'),
    ).toThrow(/duration/);
    expect(
      () => new SpriteAnimator({ bad: { loop: true, frames: [{ frame: -1, ticks: 1 }] } }, 'bad'),
    ).toThrow(/frame index/);
  });
});
