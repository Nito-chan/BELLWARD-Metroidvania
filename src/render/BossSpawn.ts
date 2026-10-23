import type { BossKind } from '../config/enemies';
import { BellwardError } from '../core/Errors';
import type { Rng } from '../core/Rng';
import type { Vec2 } from '../core/Types';
import type { EnemySpawn, Room } from '../world/Room';
import { Boss, type BossVariant } from '../enemies/Boss';
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

/** Last Keeper data attached to the boss spawn for phase-2 chains and phase-3 bell. */
export type LastKeeperSpawnData = {
  /** The three chain positions in world space. */
  readonly chainTargets: Vec2[];
  /** The great bell position in world space. */
  readonly greatBell: Vec2;
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

  // Last Keeper arenas carry chain and great-bell positions for phase mechanics.
  const bossSpawn = spawn as EnemySpawn & { chainTargets?: Vec2[]; greatBell?: Vec2 };
  if (options.room.definition.lastKeeper) {
    const lk = options.room.definition.lastKeeper;
    bossSpawn.chainTargets = lk.chains.map((c) => ({ x: c.x, y: c.y }));
    bossSpawn.greatBell = { x: lk.greatBell.x, y: lk.greatBell.y };
  }

  return new BossEncounter(new Boss(kind, bossSpawn, options.rng, options.variant ?? 'normal'), {
    art: options.art,
    audio: options.audio,
    effects: options.effects,
    camera: options.camera,
    onDefeated: options.onDefeated,
    announce: options.announce,
  });
}
