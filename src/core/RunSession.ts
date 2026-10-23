/**
 * Owns one continuous run: the current scene, the last safe room/spawn, durable progression,
 * bench checkpoints, respawns and the region-chart snapshot. Game keeps the renderer, loop,
 * input and menus; this class keeps the save/room lifecycle in one testable place.
 */
import type { Container } from 'pixi.js';
import type { AudioManager } from '../audio/AudioManager';
import { PLAYER } from '../config/player';
import { ORDEAL } from '../config/progression';
import type { Rng } from '../core/Rng';
import { getBench, type BenchRef } from '../data/benches';
import { DEFAULT_ROOM_ID, getRoom } from '../data/rooms';
import type { InputSnapshot } from '../input/InputState';
import { RunProgress } from '../save/RunProgress';
import type { SaveReason } from '../save/runSave';
import { buildMapSnapshot } from '../ui/map/mapModel';
import type { MapSnapshot } from '../ui/map/mapTypes';
import type { ArtProvider } from '../render/ArtProvider';
import { RoomScene, type RoomArrival } from '../render/RoomScene';
import { createRoom, isStandingPoint, type RoomBench, type RoomSpawn } from '../world/Room';
import { BellwardError } from './Errors';
import type { PlayerEvent } from '../player/PlayerController';

export type RunSessionDeps = {
  readonly art: ArtProvider;
  readonly audio: AudioManager;
  readonly rng: Rng;
  readonly stage: Container;
  readonly announce: (text: string) => void;
  /** Called after a rest rebuilt the room, so Game can open the bench equipment screen. */
  readonly onBench?: (bench: BenchRef) => void;
  /** Called when the Tide-door ending fires. */
  readonly onEnding?: (title: string, subtitle: string) => void;
  /** Current accessibility preference for camera kicks. */
  readonly screenShake?: () => boolean;
};

export class RunSession {
  readonly progress = new RunProgress();
  private deps: RunSessionDeps | null = null;
  private sceneValue: RoomScene | null = null;
  private roomIdValue = DEFAULT_ROOM_ID;
  /** Last safe feet position in the current room; written to storage with the run. */
  private roomSpawn: RoomSpawn = { ...getRoom(DEFAULT_ROOM_ID).spawn };

  get scene(): RoomScene | null {
    return this.sceneValue;
  }

  get roomId(): string {
    return this.roomIdValue;
  }

  /** Mounts the resumed or fresh run. Called once, after art and the renderer are ready. */
  begin(deps: RunSessionDeps): void {
    if (this.deps) throw new BellwardError('RunSession.begin() called twice');
    this.deps = deps;
    const resume = this.progress.resume;
    if (resume) {
      this.enter(resume.roomId, resume.spawn, { hp: resume.hp, maxHp: this.progress.maxHp }, null);
      return;
    }
    this.enter(DEFAULT_ROOM_ID, undefined, undefined, null);
  }

  /** Discards the restored run and mounts a fresh one at the terrace. */
  newRun(): void {
    this.progress.reset();
    this.enter(DEFAULT_ROOM_ID, undefined, undefined, null);
  }

  /**
   * Writes the first-ever save only once the player actually leaves the title, so merely
   * looking at the threshold never creates a climb to continue. A loaded run already has
   * a valid document; starting it must not rewrite storage with a boot marker.
   */
  saveStart(): void {
    if (this.progress.present) return;
    this.persist('boot');
  }

  /** Advances the active scene and resolves every run-level consequence of that tick. */
  tick(tickCount: number, input: InputSnapshot): readonly PlayerEvent[] {
    const scene = this.sceneValue;
    if (!scene) return [];
    const events = scene.update(tickCount, input);

    for (const pickupId of scene.consumePickups()) {
      const beforeMax = this.progress.maxHp;
      if (!this.progress.collectPickup(pickupId)) continue;
      const gained = this.progress.maxHp - beforeMax;
      if (gained > 0) scene.grantMaxHp(gained);
      scene.applyProgress(this.progress.loadout, this.progress.shards);
      this.persist('reward');
    }

    const defeated = scene.consumeBossDefeat();
    if (defeated && this.progress.addSigil(defeated)) {
      scene.applyProgress(this.progress.loadout, this.progress.shards);
      this.persist('reward');
    }

    const ordeal = scene.consumeOrdealDefeat();
    if (ordeal && this.progress.addOrdeal(ordeal)) {
      this.progress.grantShards(ORDEAL.shardReward);
      scene.applyProgress(this.progress.loadout, this.progress.shards);
      this.persist('reward');
    }

    if (scene.consumeSecretBroken() && this.progress.breakSecret(this.roomIdValue)) {
      this.persist('reward');
    }

    if (scene.consumeEnding()) {
      if (this.progress.markTideDoorOpened()) this.persist('reward');
      const definition = getRoom(this.roomIdValue);
      this.deps?.onEnding?.(
        definition.ending?.title ?? 'THE TIDE-BELL ANSWERS',
        definition.ending?.subtitle ?? 'The last door opens. Far below, a bell is still ringing.',
      );
    }

    const vitals = scene.vitals;
    const focus = scene.focus;
    const bench = scene.consumeBenchRest();
    const exit = scene.exitRequested;
    if (bench) {
      this.restAtBench(bench);
    } else if (exit) {
      this.enter(exit.roomId, exit.spawn, { ...vitals, focus });
    } else if (scene.resetRequested) {
      this.respawn();
    }
    return events;
  }

  /** Persists equipment/nail changes made while resting. */
  saveAtBench(): boolean {
    const scene = this.sceneValue;
    if (!scene) return false;
    this.progress.save({
      roomId: this.roomIdValue,
      spawn: this.roomSpawn,
      hp: scene.vitals.hp,
      reason: 'bench',
    });
    return true;
  }

  mapSnapshot(): MapSnapshot {
    const checkpoint = this.progress.checkpoint;
    return buildMapSnapshot({
      currentRoomId: this.roomIdValue,
      visitedRoomIds: this.progress.visitedRooms,
      sigils: this.progress.sigils,
      checkpoint: checkpoint ? { name: checkpoint.name, roomId: checkpoint.roomId } : null,
    });
  }

  /** DEV-only: jump straight into a room (optionally at a validated spawn) for E2E. */
  debugLoadRoom(roomId: string, spawn?: RoomSpawn): void {
    const maxHp = this.progress.maxHp;
    this.enter(roomId, spawn, { hp: maxHp, maxHp, focus: PLAYER.focus.max }, 'debug');
  }

  private enter(
    roomId: string,
    spawn?: RoomSpawn,
    carry?: { hp: number; maxHp: number; focus?: number },
    saveReason: SaveReason | null = 'room',
    arrival?: RoomArrival,
  ): void {
    const deps = this.deps;
    if (!deps) throw new BellwardError('RunSession.enter() called before begin()');
    const definition = getRoom(roomId);
    const room = createRoom(definition);
    const chosenSpawn = spawn ?? room.spawn;
    if (!isStandingPoint(room.tilemap, chosenSpawn, PLAYER.size)) {
      throw new BellwardError(
        `room "${roomId}" spawn (${chosenSpawn.x},${chosenSpawn.y}) is not a clear standing point`,
      );
    }

    const maxHp = carry?.maxHp ?? this.progress.maxHp;
    const hp = carry?.hp ?? maxHp;
    this.progress.visit(roomId);
    const scene = new RoomScene(room, deps.art, deps.rng.fork(), deps.audio, {
      spawn: chosenSpawn,
      hp,
      maxHp,
      focus: carry?.focus,
      loadout: this.progress.loadout,
      shards: this.progress.shards,
      sigilCount: this.progress.sigilCount,
      bossRewardClaimed: definition.boss ? this.progress.hasSigil(definition.boss) : false,
      collectedPickups: this.progress.pickups,
      canCollectPickup: (id) => this.progress.canCollectPickup(id),
      secretBroken: this.progress.hasBrokenSecret(roomId),
      sealOpen: this.progress.hasPickup('bellthief-tide-bell'),
      ordealCleared: definition.boss ? this.progress.hasOrdeal(definition.boss) : false,
      endingSeen: this.progress.endingSeen,
      announce: deps.announce,
      arrival,
      screenShake: deps.screenShake?.(),
    });

    const previous = this.sceneValue;
    this.sceneValue = scene;
    this.roomIdValue = roomId;
    this.roomSpawn = { x: chosenSpawn.x, y: chosenSpawn.y };
    deps.stage.addChild(scene.view);
    if (previous) previous.destroy();
    deps.audio.requestMusic(definition.music ?? 'terrace');
    if (saveReason) this.persist(saveReason);
  }

  /** Writes the active room's durable facts. Storage failure is non-fatal by design. */
  private persist(reason: SaveReason): void {
    const scene = this.sceneValue;
    if (!scene) return;
    this.progress.save({
      roomId: this.roomIdValue,
      spawn: this.roomSpawn,
      hp: scene.vitals.hp,
      reason,
    });
  }

  /** Saves the checkpoint, then rebuilds the room clean and restores every mask. */
  private restAtBench(bench: RoomBench): void {
    const ref = getBench(bench.id);
    this.progress.setCheckpoint(ref);
    this.deps?.audio.playSfx('bell');
    this.enter(
      ref.roomId,
      ref.spawn,
      { hp: this.progress.maxHp, maxHp: this.progress.maxHp, focus: PLAYER.focus.max },
      'bench',
      { title: 'RESTED', subtitle: `${ref.name.toUpperCase()} · SAVED` },
    );
    this.deps?.onBench?.(ref);
  }

  /** Replaces the dead room at the last bench (or the terrace) at full health. */
  private respawn(): void {
    const maxHp = this.progress.maxHp;
    const checkpoint = this.progress.checkpoint;
    if (checkpoint) {
      this.enter(
        checkpoint.roomId,
        checkpoint.spawn,
        { hp: maxHp, maxHp, focus: PLAYER.focus.max },
        'respawn',
        {
          title: 'THE BELLS REMEMBER',
          subtitle: `${getRoom(checkpoint.roomId).name.toUpperCase()} · ${checkpoint.name.toUpperCase()}`,
        },
      );
      return;
    }

    const room = getRoom(DEFAULT_ROOM_ID);
    this.enter(
      DEFAULT_ROOM_ID,
      room.spawn,
      { hp: maxHp, maxHp, focus: PLAYER.focus.max },
      'respawn',
      {
        title: 'THE BELLS REMEMBER',
        subtitle: room.name.toUpperCase(),
      },
    );
  }
}
