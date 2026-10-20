import type { BossKind } from '../config/enemies';
import { BellwardError } from '../core/Errors';
import type { Rng } from '../core/Rng';
import { Boss } from '../enemies/Boss';
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
  onDefeated: (kind: BossKind) => void;
};

/**
 * Builds the room's boss encounter, or returns null when the arena is already claimed.
 * Content errors are loud: a declared boss without a spawn is an authoring mistake.
 */
export function spawnBoss(options: BossSpawnOptions): BossEncounter | null {
  const kind = options.room.definition.boss;
  if (!kind || options.claimed) return null;
  const spawn = options.room.definition.enemies.find((enemy) => enemy.kind === kind);
  if (!spawn) {
    throw new BellwardError(
      `room "${options.room.definition.id}" declares boss "${kind}" without a spawn`,
    );
  }
  return new BossEncounter(new Boss(kind, spawn, options.rng), {
    art: options.art,
    audio: options.audio,
    effects: options.effects,
    camera: options.camera,
    onDefeated: options.onDefeated,
    announce: options.announce,
  });
}
