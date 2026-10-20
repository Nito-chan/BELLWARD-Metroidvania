import type { AnimationClip, SheetInfo } from '../render/Animation';

/**
 * One-shot and looping effect art. Effects are not characters: their pivot is an anchor
 * fraction, and each effect owns a single clip. Packed effects fall back independently.
 *
 * - `enemyDeath`: frames 1-8 of the church death sheet (frame 0 is a leftover caster
 *   pose), an eight-frame burst played once where the enemy fell;
 * - `fireball`: the adept's three-frame projectile loop.
 */
export type EffectKey = 'enemyDeath' | 'fireball';

export const EFFECT_KEYS: readonly EffectKey[] = ['enemyDeath', 'fireball'];

export type EffectArt = {
  readonly textureKey: string;
  readonly sheet: SheetInfo;
  /** Sprite anchor as a fraction of the frame (0..1). */
  readonly anchor: { readonly x: number; readonly y: number };
  readonly scale: number;
  readonly clip: AnimationClip;
};

export const EFFECT_ART: Readonly<Record<EffectKey, EffectArt>> = {
  enemyDeath: {
    textureKey: 'fx.enemyDeath',
    sheet: { frameWidth: 81, frameHeight: 66, columns: 9 },
    anchor: { x: 0.5, y: 0.55 },
    scale: 1,
    clip: { loop: false, frames: frameRange(1, 9, 3) },
  },
  fireball: {
    textureKey: 'fx.fireball',
    sheet: { frameWidth: 26, frameHeight: 26, columns: 3 },
    anchor: { x: 0.5, y: 0.5 },
    scale: 0.8,
    clip: { loop: true, frames: frameRange(0, 3, 4) },
  },
};

function frameRange(start: number, end: number, ticks: number): AnimationClip['frames'] {
  return Array.from({ length: end - start }, (_, offset) => ({ frame: start + offset, ticks }));
}
