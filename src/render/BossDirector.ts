/**
 * Owns a room's boss encounter and the optional Ordeal relight. RoomScene keeps the
 * combat/render pipeline; this director keeps the boss lifecycle, altar prompt and the
 * one rule that a claimed arena can relight the same memory at higher tempo.
 */
import { bodyRect, overlaps } from '../combat/geometry';
import type { Rng } from '../core/Rng';
import { BellwardError } from '../core/Errors';
import type { BossKind } from '../config/enemies';
import type { Enemy, EnemyContext } from '../enemies/Enemy';
import type { InputSnapshot } from '../input/InputState';
import { InteractPrompt } from '../ui/InteractPrompt';
import type { Room } from '../world/Room';
import type { ArtProvider } from './ArtProvider';
import type { BossEncounter } from './BossEncounter';
import { spawnBoss } from './BossSpawn';
import type { Camera } from './Camera';
import type { SceneAudio } from './CombatFeedback';
import type { EffectsLayer } from './EffectsLayer';
import type { RoomObjectives } from './RoomObjectives';
import type { PlayerController } from '../player/PlayerController';

export type BossDirectorOptions = {
  readonly room: Room;
  readonly art: ArtProvider;
  readonly audio: SceneAudio;
  readonly effects: EffectsLayer;
  readonly camera: Camera;
  readonly rng: Rng;
  readonly player: PlayerController;
  readonly objectives: RoomObjectives;
  readonly announce: (text: string) => void;
  /** Adds an encounter's actor and overlay to the room's display layers. */
  readonly onSpawn: (encounter: BossEncounter) => void;
};

export class BossDirector {
  readonly prompt = new InteractPrompt();
  private encounterValue: BossEncounter | null = null;

  constructor(private readonly options: BossDirectorOptions) {
    const encounter = spawnBoss({
      room: options.room,
      art: options.art,
      audio: options.audio,
      effects: options.effects,
      camera: options.camera,
      rng: options.rng.fork(),
      claimed: options.objectives.arenaClaimed,
      announce: options.announce,
      onDefeated: (kind, ordeal) => this.onDefeated(kind, ordeal),
    });
    if (encounter) {
      this.encounterValue = encounter;
      options.onSpawn(encounter);
    }
  }

  get encounter(): BossEncounter | null {
    return this.encounterValue;
  }

  get boss(): Enemy | null {
    return this.encounterValue?.boss ?? null;
  }

  get alive(): boolean {
    return this.encounterValue?.alive ?? false;
  }

  updateBoss(context: EnemyContext): void {
    this.encounterValue?.update(context);
  }

  /** The prompt follows proximity; interaction relights the arena as an Ordeal. */
  updateOrdeal(dead: boolean, input: InputSnapshot): void {
    const ordeal = this.options.room.definition.ordeal;
    if (
      !ordeal ||
      !this.options.objectives.arenaClaimed ||
      this.options.objectives.ordealCleared ||
      this.encounterValue ||
      dead
    ) {
      this.prompt.hide();
      return;
    }
    if (!overlaps(bodyRect(this.options.player.body), ordeal)) {
      this.prompt.hide();
      return;
    }
    this.prompt.show('RELIGHT THE ORDEAL', 'INTERACT · FACE THE HARDER MEMORY');
    if (!input.pressed.has('interact')) return;
    this.startOrdeal();
  }

  debugDamage(amount: number): boolean {
    return this.encounterValue?.debugDamage(amount) ?? false;
  }

  debugBreakWard(): boolean {
    return this.encounterValue?.debugBreakWard() ?? false;
  }

  debugDefeat(): void {
    this.encounterValue?.debugDefeat();
  }

  private startOrdeal(): void {
    const kind = this.options.room.definition.boss;
    if (!kind) return;
    const encounter = spawnBoss({
      room: this.options.room,
      art: this.options.art,
      audio: this.options.audio,
      effects: this.options.effects,
      camera: this.options.camera,
      rng: this.options.rng.fork(),
      claimed: true,
      allowClaimed: true,
      variant: 'ordeal',
      announce: this.options.announce,
      onDefeated: (defeated, ordeal) => this.onDefeated(defeated, ordeal),
    });
    if (!encounter) {
      throw new BellwardError(
        `room "${this.options.room.definition.id}" could not relight its Ordeal`,
      );
    }
    this.encounterValue = encounter;
    this.options.onSpawn(encounter);
    this.prompt.hide();
    this.options.audio.playSfx('bossWard');
    this.options.announce(`${encounter.boss.title} returns.`);
  }

  private onDefeated(kind: BossKind, ordeal: boolean): void {
    this.options.objectives.onBossDefeated(kind, ordeal);
  }
}
