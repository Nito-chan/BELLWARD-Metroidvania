import type { BossKind } from '../config/enemies';
import type { SfxKey } from '../data/audio';

/** Things a boss did that the scene should hear, feel or announce. */
export type BossEvent =
  | { type: 'tell'; patternId: string; sfx: SfxKey }
  | { type: 'attack'; patternId: string; sfx: SfxKey | null }
  | { type: 'phase'; phase: number; name: string }
  | { type: 'wardBreak'; x: number; y: number }
  | { type: 'wallHit'; x: number; y: number }
  | { type: 'defeated'; kind: BossKind };
