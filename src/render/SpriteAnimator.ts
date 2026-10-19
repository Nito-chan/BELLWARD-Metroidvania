import { BellwardError } from '../core/Errors';
import type { AnimationClip, AnimationSet } from './Animation';

/**
 * Deterministic frame-clock animator. Advanced exactly once per fixed simulation tick,
 * never from render time, so animations are replay-stable and speed does not depend on
 * the display refresh rate.
 */
export class SpriteAnimator {
  private clip: AnimationClip;
  private clipName: string;
  private frameIndex = 0;
  private ticksLeft: number;
  private complete = false;

  constructor(
    private readonly clips: AnimationSet,
    initial: string,
  ) {
    const clip = clips[initial];
    if (clip === undefined) {
      throw new BellwardError(`animation "${initial}" is not defined`);
    }
    validateClip(initial, clip);
    this.clip = clip;
    this.clipName = initial;
    this.ticksLeft = clip.frames[0]?.ticks ?? 0;
  }

  /** Name of the clip currently playing (or last played). */
  get animation(): string {
    return this.clipName;
  }

  /** Current frame index inside the sprite sheet. */
  get frame(): number {
    return this.clip.frames[this.frameIndex]?.frame ?? 0;
  }

  /** True once a non-looping clip has reached its final frame. */
  get finished(): boolean {
    return this.complete;
  }

  /**
   * Switches clips. Re-playing the active clip is a no-op unless `restart` is true,
   * which makes "hold run while already running" free and "re-trigger attack" explicit.
   */
  play(name: string, restart = false): void {
    if (name === this.clipName && !restart) return;
    const clip = this.clips[name];
    if (clip === undefined) {
      throw new BellwardError(`animation "${name}" is not defined`);
    }
    validateClip(name, clip);
    this.clipName = name;
    this.clip = clip;
    this.frameIndex = 0;
    this.ticksLeft = clip.frames[0]?.ticks ?? 0;
    this.complete = false;
  }

  /** Advances the frame clock by one fixed tick. */
  tick(): void {
    if (this.complete) return;

    this.ticksLeft -= 1;
    if (this.ticksLeft > 0) return;

    const nextIndex = this.frameIndex + 1;
    if (nextIndex < this.clip.frames.length) {
      this.frameIndex = nextIndex;
      this.ticksLeft = this.clip.frames[nextIndex]?.ticks ?? 0;
      return;
    }

    if (this.clip.loop) {
      this.frameIndex = 0;
      this.ticksLeft = this.clip.frames[0]?.ticks ?? 0;
      return;
    }

    // Hold the last frame; the owning state machine decides when to change clips.
    this.complete = true;
    this.ticksLeft = 0;
  }
}

function validateClip(name: string, clip: AnimationClip): void {
  if (clip.frames.length === 0) {
    throw new BellwardError(`animation "${name}" has no frames`);
  }
  for (const frame of clip.frames) {
    if (!Number.isInteger(frame.frame) || frame.frame < 0) {
      throw new BellwardError(
        `animation "${name}" has invalid frame index ${String(frame.frame)} (must be an integer >= 0)`,
      );
    }
    if (!Number.isInteger(frame.ticks) || frame.ticks <= 0) {
      throw new BellwardError(
        `animation "${name}" has invalid duration ${String(frame.ticks)} ticks (must be an integer > 0)`,
      );
    }
  }
}
