import type { BossKind } from '../config/enemies';
import { BellwardError } from '../core/Errors';
import type { Rng } from '../core/Rng';
import { Boss, type BossVariant } from '../enemies/Boss';
import type { Room } from '../world/Room';
import type { ArtProvider } from './ArtProvider';
import { BossEncounter } from './BossEncounter';
import type { Camera } from './Camera';
import type { SceneAudio } from './CombatFeedback';
import type { EffectsLayer } from './EffectsLayer';

export type BossSpawnOptions = {
  room: Room;
  art: ArtProvider;
  audio: SceneAudio;
  effects: EffectsLayer;
  camera: Camera;
  rng: Rng;
  claimed: boolean;
  announce?: (text: string) => void;
  onDefeated: (kind: BossKind, ordeal: boolean) => void;
  /** Hard-mode rematch spawned from a claimed arena's altar. */
  variant?: BossVariant;
  /** Claimed arenas normally skip boss creation; an Ordeal altar overrides it. */
  allowClaimed?: boolean;
};

/**
 * Builds the room's boss encounter, or returns null when the arena is already claimed.
 * Content errors are loud: a declared boss without a spawn is an authoring mistake.
 */
export function spawnBoss(options: BossSpawnOptions): BossEncounter | null {
  const kind = options.room.definition.boss;
  if (!kind || (options.claimed && !options.allowClaimed)) return null;
  const spawn = options.room.definition.enemies.find((enemy) => enemy.kind === kind);
  if (!spawn) {
    throw new BellwardError(
      `room "${options.room.definition.id}" declares boss "${kind}" without a spawn`,
    );
  }
  return new BossEncounter(new Boss(kind, spawn, options.rng, options.variant ?? 'normal'), {
    art: options.art,
    audio: options.audio,
    effects: options.effects,
    camera: options.camera,
    onDefeated: options.onDefeated,
    announce: options.announce,
  });
}
