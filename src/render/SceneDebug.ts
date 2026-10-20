import type { SceneDebugState } from '../debug/DebugState';
import type { Enemy } from '../enemies/Enemy';
import type { PlayerController } from '../player/PlayerController';
import type { Room } from '../world/Room';
import type { ArtProvider } from './ArtProvider';
import type { BossEncounter } from './BossEncounter';
import type { Camera } from './Camera';

export type SceneDebugInput = {
  room: Room;
  art: ArtProvider;
  camera: Camera;
  player: PlayerController;
  enemies: readonly Enemy[];
  boss: BossEncounter | null;
  projectiles: number;
  hitstop: number;
};

/** Builds the immutable E2E/F1 snapshot from the live scene. */
export function buildSceneDebugState(input: SceneDebugInput): SceneDebugState {
  const { player, room, camera } = input;
  const feet = player.feet;
  return {
    roomId: room.definition.id,
    roomName: room.definition.name,
    tiles: room.tilemap.tileCount,
    art: {
      mode: input.art.mode,
      loaded: input.art.loadedKeys(),
      failures: [...input.art.failures],
    },
    camera: { x: camera.x, y: camera.y },
    player: {
      x: feet.x,
      y: feet.y,
      vx: player.body.vx,
      vy: player.body.vy,
      state: player.state,
      animation: player.animation,
      facing: player.facing,
      grounded: player.grounded,
      jumpPeakY: player.jumpPeakY,
      lastJumpPeakY: player.lastJumpPeakY,
      clipTick: player.clipTick,
      hp: player.hp,
      maxHp: player.maxHp,
      invulnerableTicks: player.invulnerableTicks,
      dead: player.dead,
      attackActive: player.attackActive,
    },
    enemies: input.enemies.map((enemy) => {
      const position = enemy.feet;
      return {
        kind: enemy.kind,
        name: enemy.stats.displayName,
        x: position.x,
        y: position.y,
        hp: enemy.hp,
        maxHp: enemy.stats.hp,
        state: enemy.state,
        animation: enemy.animation,
        facing: enemy.facing,
      };
    }),
    boss: input.boss?.debugState() ?? null,
    exitLocked: input.boss?.alive ?? false,
    projectiles: input.projectiles,
    hitstop: input.hitstop,
  };
}
