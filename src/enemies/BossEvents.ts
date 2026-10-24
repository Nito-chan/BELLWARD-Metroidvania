import type { BossKind } from '../config/enemies';
import type { SfxKey } from '../data/audio';

/** Things a boss did that the scene should hear, feel or announce. */
export type BossEvent =
  | {
      type: 'tell';
      patternId: string;
      sfx: SfxKey;
      /** World position of the tell, when relevant (chains, great bell). */
      x?: number;
      y?: number;
    }
  | { type: 'attack'; patternId: string; sfx: SfxKey | null }
  | { type: 'phase'; phase: number; name: string }
  | { type: 'wardBreak'; x: number; y: number }
  | { type: 'wallHit'; x: number; y: number }
  | {
      /** A correct Toll answer at the great bell. */
      type: 'answer';
      count: number;
      total: number;
      x: number;
      y: number;
    }
  | {
      /** An answer window closed without a Toll note. */
      type: 'miss';
      x: number;
      y: number;
    }
  | {
      /** A ground shockwave begins its telegraph; the box is in world pixels. */
      type: 'shockwave';
      x: number;
      y: number;
      w: number;
      h: number;
      windupTicks: number;
      activeTicks: number;
    }
  | { type: 'defeated'; kind: BossKind };
