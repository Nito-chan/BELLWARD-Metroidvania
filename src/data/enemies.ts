import type { EnemyKind } from '../config/enemies';
import type { AnimationClip, CharacterArt } from '../render/Animation';
import type { ArtKey } from './art';

/**
 * Packed art for the three M4 enemy kinds. Frame sizes and pivots were measured from
 * the sheets (M4): the parishioner is a 40x47 town walker, the ghoul a 57x60 church
 * 16-frame walk, and the adept an 81x66 wizard (frames 0-4 idle, 5-14 cast).
 *
 * As with the hero, an enemy falls back as a whole: a partially loaded kind would be
 * missing a clip at runtime, so ArtProvider only uses the packed art when every
 * required sheet is present.
 */
export const ENEMY_ART: Readonly<Record<EnemyKind, CharacterArt>> = {
  parishioner: {
    textureKey: 'enemy.parishioner.walk',
    sheet: { frameWidth: 40, frameHeight: 47, columns: 6 },
    origin: { x: 20, y: 47 },
    animations: {
      idle: {
        textureKey: 'enemy.parishioner.idle',
        loop: true,
        frames: [0, 1, 2, 3, 4].map((frame) => ({ frame, ticks: 10 })),
      },
      walk: {
        loop: true,
        frames: [0, 1, 2, 3, 4, 5].map((frame) => ({ frame, ticks: 6 })),
      },
      hurt: {
        textureKey: 'enemy.parishioner.idle',
        loop: false,
        frames: [0, 1, 2].map((frame) => ({ frame, ticks: 4 })),
      },
    },
  },
  ghoul: {
    textureKey: 'enemy.ghoul',
    sheet: { frameWidth: 57, frameHeight: 60, columns: 16 },
    origin: { x: 28, y: 60 },
    animations: {
      // A slow sway assembled from the walk cycle; the fire head keeps moving.
      idle: { loop: true, frames: [0, 4, 8, 12].map((frame) => ({ frame, ticks: 9 })) },
      walk: { loop: true, frames: frameRange(0, 16, 4) },
      hurt: { loop: false, frames: [0, 5, 10].map((frame) => ({ frame, ticks: 4 })) },
    },
  },
  adept: {
    textureKey: 'enemy.adept',
    sheet: { frameWidth: 81, frameHeight: 66, columns: 15 },
    origin: { x: 40, y: 66 },
    animations: {
      idle: { loop: true, frames: frameRange(0, 5, 10) },
      // Frames 5-14 are the cast: the flame grows, then leaves the hands.
      cast: { loop: false, frames: frameRange(5, 15, 3) },
      hurt: { loop: false, frames: frameRange(0, 4, 4) },
    },
  },
};

/** Every sheet a kind needs before the packed art is considered usable. */
export const ENEMY_REQUIRED: Readonly<Record<EnemyKind, readonly ArtKey[]>> = {
  parishioner: ['enemy.parishioner.idle', 'enemy.parishioner.walk'],
  ghoul: ['enemy.ghoul'],
  adept: ['enemy.adept'],
};

function frameRange(start: number, end: number, ticks: number): AnimationClip['frames'] {
  return Array.from({ length: end - start }, (_, offset) => ({ frame: start + offset, ticks }));
}
