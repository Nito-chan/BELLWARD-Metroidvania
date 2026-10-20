import { Container, Graphics, Sprite, Texture } from 'pixi.js';
import { COMBAT } from '../config/combat';
import { PALETTE } from '../config/palette';
import { CAMERA } from '../config/render';
import { VIEW } from '../config/world';
import { CombatSystem, type CombatEvent } from '../combat/CombatSystem';
import { ProjectilePool } from '../combat/ProjectilePool';
import { BellwardError } from '../core/Errors';
import type { Rng } from '../core/Rng';
import type { SfxKey } from '../data/audio';
import type { SceneDebugState } from '../debug/DebugState';
import { createEnemy } from '../enemies/createEnemy';
import type { Enemy, EnemyContext } from '../enemies/Enemy';
import type { InputSnapshot } from '../input/InputState';
import { PlayerController, type PlayerEvent } from '../player/PlayerController';
import { Hud } from '../ui/Hud';
import type { Room } from '../world/Room';
import type { ArtProvider } from './ArtProvider';
import { Camera } from './Camera';
import { EffectsLayer } from './EffectsLayer';
import { EnemyView } from './EnemyView';
import { HeroView } from './HeroView';
import { ParallaxLayer } from './ParallaxLayer';
import { ProjectileView } from './ProjectileView';
import { PropLayer } from './PropLayer';
import { TileLayer } from './TileLayer';

type Mote = {
  readonly view: Sprite;
  readonly baseX: number;
  readonly phase: number;
  readonly speed: number;
};

type EnemyRecord = { readonly enemy: Enemy; readonly view: EnemyView };

/** The scene only needs one audio call; keeping it narrow makes RoomScene testable. */
export type SceneAudio = {
  playSfx(key: SfxKey): void;
};

const MOTE_COUNT = 28;

/**
 * Renders one room and drives its simulation: the player and enemies step against the
 * room's tilemap, combat resolves once per tick, and views sample the result. The camera
 * follows the hero with a look-ahead; render() only samples the interpolated camera, so
 * motion is smooth at any refresh rate.
 */
export class RoomScene {
  readonly view = new Container();
  private readonly camera: Camera;
  private readonly heroView: HeroView;
  private readonly player: PlayerController;
  private readonly backgrounds: ParallaxLayer[] = [];
  private readonly motes: Mote[] = [];
  private readonly world = new Container();
  private readonly actorLayer = new Container();
  private readonly enemyRecords: EnemyRecord[] = [];
  private readonly enemyBuffer: Enemy[] = [];
  private readonly projectiles = new ProjectilePool();
  private readonly projectileView: ProjectileView;
  private readonly effects: EffectsLayer;
  private readonly hud = new Hud();
  private readonly combat = new CombatSystem();
  private hitstopTicks = 0;
  private damageFlashTicks = 0;
  private resetRequestedValue = false;

  constructor(
    private readonly room: Room,
    private readonly art: ArtProvider,
    rng: Rng,
    private readonly audio: SceneAudio,
  ) {
    this.camera = new Camera(room.bounds);
    this.player = new PlayerController(room.spawn);
    this.camera.snapTo(room.spawn.x, room.spawn.y + CAMERA.focusOffsetY);

    // A layer only travels (roomWidth - viewWidth) * factor pixels across the whole
    // room, so each background needs a short strip — not an infinite tiling shader.
    const panRange = Math.max(0, room.bounds.w - VIEW.width);
    for (const key of room.definition.backgrounds) {
      const background = art.background(key);
      if (!background) {
        throw new BellwardError(
          `room "${room.definition.id}" requests unknown background "${key}"`,
        );
      }
      const layer = new ParallaxLayer(background, panRange * background.factor);
      this.backgrounds.push(layer);
      this.view.addChild(layer.view);
    }

    this.world.addChild(new TileLayer(room.tilemap, art).view);
    this.world.addChild(new PropLayer(room.definition.props, 'back', art).view);

    this.actorLayer.sortableChildren = true;
    this.heroView = new HeroView(art);
    this.heroView.setPose({
      x: room.spawn.x,
      y: room.spawn.y,
      facing: 1,
      animation: 'idle',
      restart: true,
      grounded: true,
    });
    this.actorLayer.addChild(this.heroView.view);

    for (const spawn of room.definition.enemies) {
      const enemy = createEnemy(spawn);
      const view = new EnemyView(art, spawn.kind);
      view.sync(enemy);
      this.enemyRecords.push({ enemy, view });
      this.actorLayer.addChild(view.view);
    }
    this.world.addChild(this.actorLayer);

    this.effects = new EffectsLayer(art);
    this.projectileView = new ProjectileView(art, this.projectiles);
    this.world.addChild(this.effects.view, this.projectileView.view);
    this.world.addChild(new PropLayer(room.definition.props, 'front', art).view);
    this.view.addChild(this.world);

    const ambient = new Graphics()
      .rect(0, 0, VIEW.width, VIEW.height)
      .fill(PALETTE[room.definition.ambient.tint]);
    ambient.alpha = room.definition.ambient.alpha;
    this.view.addChild(ambient);

    const moteLayer = new Container();
    for (let i = 0; i < MOTE_COUNT; i += 1) {
      // One shared white texture means the motes batch into a single draw call.
      const mote = new Sprite(Texture.WHITE);
      mote.anchor.set(0.5);
      mote.width = 3;
      mote.height = 3;
      mote.tint = PALETTE.echo;
      moteLayer.addChild(mote);
      this.motes.push({
        view: mote,
        baseX: rng.float(0, VIEW.width),
        phase: rng.float(0, Math.PI * 2),
        speed: rng.float(0.3, 0.9),
      });
    }
    this.view.addChild(moteLayer);
    this.view.addChild(this.hud.view);
    this.hud.setHealth(this.player.hp, this.player.maxHp);
  }

  /** True once the death sequence finished; the Game rebuilds the room on the next tick. */
  get resetRequested(): boolean {
    return this.resetRequestedValue;
  }

  /** Advances the simulation by one fixed tick and returns what that tick produced. */
  update(tickCount: number, input: InputSnapshot): readonly PlayerEvent[] {
    if (this.resetRequestedValue) return [];
    if (this.hitstopTicks > 0) {
      this.hitstopTicks -= 1;
      return [];
    }

    this.player.update(input, this.room.tilemap);

    const context: EnemyContext = {
      tilemap: this.room.tilemap,
      player: { feet: this.player.feet, dead: this.player.dead },
      castProjectile: (x, y, dirX, dirY, speed, damage, lifeTicks) => {
        this.projectiles.spawn(x, y, dirX, dirY, speed, damage, lifeTicks);
        this.audio.playSfx('fireball');
      },
    };
    for (const record of this.enemyRecords) record.enemy.update(context);

    const result = this.combat.resolve(
      this.player,
      this.enemies(),
      this.projectiles,
      this.room.tilemap,
    );
    if (result.hitstop > this.hitstopTicks) this.hitstopTicks = result.hitstop;
    this.applyCombat(result.events);

    this.removeFallenEnemies();
    this.syncViews(tickCount);
    this.updateHud();

    const feet = this.player.feet;
    this.camera.update(
      feet.x + this.player.facing * CAMERA.lookAheadX,
      feet.y + CAMERA.focusOffsetY,
    );
    this.updateMotes(tickCount);

    if (this.player.dead && this.player.deathElapsed >= COMBAT.player.deathTicks) {
      this.resetRequestedValue = true;
    }
    return this.player.events;
  }

  /** Samples the interpolated camera and snaps the world to whole pixels. */
  render(alpha: number): void {
    const view = this.camera.view(alpha);
    const x = Math.round(view.x);
    const y = Math.round(view.y);
    this.world.position.set(-x, -y);
    for (const layer of this.backgrounds) layer.follow({ x, y });
  }

  /** Detaches and destroys the whole scene (used when the room resets after a death). */
  destroy(): void {
    this.view.removeFromParent();
    this.view.destroy({ children: true });
  }

  debugState(): SceneDebugState {
    const feet = this.player.feet;
    return {
      roomId: this.room.definition.id,
      roomName: this.room.definition.name,
      tiles: this.room.tilemap.tileCount,
      art: {
        mode: this.art.mode,
        loaded: this.art.loadedKeys(),
        failures: [...this.art.failures],
      },
      camera: { x: this.camera.x, y: this.camera.y },
      player: {
        x: feet.x,
        y: feet.y,
        vx: this.player.body.vx,
        vy: this.player.body.vy,
        state: this.player.state,
        animation: this.player.animation,
        facing: this.player.facing,
        grounded: this.player.grounded,
        jumpPeakY: this.player.jumpPeakY,
        lastJumpPeakY: this.player.lastJumpPeakY,
        clipTick: this.player.clipTick,
        hp: this.player.hp,
        maxHp: this.player.maxHp,
        invulnerableTicks: this.player.invulnerableTicks,
        dead: this.player.dead,
        attackActive: this.player.attackActive,
      },
      enemies: this.enemyRecords.map(({ enemy }) => {
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
      projectiles: this.projectiles.activeCount,
      hitstop: this.hitstopTicks,
    };
  }

  private enemies(): readonly Enemy[] {
    this.enemyBuffer.length = 0;
    for (const record of this.enemyRecords) this.enemyBuffer.push(record.enemy);
    return this.enemyBuffer;
  }

  private applyCombat(events: readonly CombatEvent[]): void {
    for (const event of events) {
      if (event.type === 'enemyHit') {
        this.effects.spark(event.x, event.y, event.facing);
        this.audio.playSfx(event.killed ? 'enemyDie' : 'enemyHurt');
        this.camera.shake(COMBAT.enemy.hitShake.strength, COMBAT.enemy.hitShake.ticks);
        if (event.killed) this.effects.death(event.enemy.feet.x, event.enemy.feet.y);
        continue;
      }
      if (event.type === 'playerHit') {
        this.damageFlashTicks = COMBAT.player.flashTicks;
        this.camera.shake(COMBAT.player.hurtShake.strength, COMBAT.player.hurtShake.ticks);
        continue;
      }
      // Projectile impact: a small spark on stone or flesh, plus the sizzle.
      this.effects.spark(event.x, event.y, 1);
      this.audio.playSfx('fireballHit');
    }
  }

  private removeFallenEnemies(): void {
    for (let i = this.enemyRecords.length - 1; i >= 0; i -= 1) {
      const record = this.enemyRecords[i];
      if (record && !record.enemy.alive) {
        record.view.destroy();
        this.enemyRecords.splice(i, 1);
      }
    }
  }

  private syncViews(tickCount: number): void {
    const feet = this.player.feet;
    this.heroView.setPose({
      x: feet.x,
      y: feet.y,
      facing: this.player.facing,
      animation: this.player.animation,
      restart: this.player.restarted,
      grounded: this.player.grounded,
    });
    this.heroView.tick();
    this.heroView.view.zIndex = feet.y + 0.1;
    const blinking = this.player.invulnerableTicks > 0 && !this.player.dead;
    this.heroView.view.alpha = blinking && Math.floor(tickCount / 4) % 2 === 0 ? 0.5 : 1;

    for (const record of this.enemyRecords) record.view.sync(record.enemy);
    this.projectileView.sync(this.projectiles, tickCount);
    this.effects.update();
  }

  private updateHud(): void {
    this.hud.setHealth(this.player.hp, this.player.maxHp);
    if (this.damageFlashTicks > 0) this.damageFlashTicks -= 1;
    this.hud.setDamage(this.damageFlashTicks / COMBAT.player.flashTicks);
    const death = this.player.dead
      ? Math.min(1, this.player.deathElapsed / COMBAT.player.deathTicks)
      : 0;
    this.hud.setDeath(death);
  }

  private updateMotes(tickCount: number): void {
    const t = tickCount / 60;
    const span = VIEW.height + 80;
    for (const mote of this.motes) {
      const travel = (mote.phase * 101 + t * mote.speed * 22) % span;
      const x = mote.baseX + Math.sin(t * 0.6 + mote.phase) * 16;
      mote.view.position.set(x, VIEW.height + 40 - travel);
      mote.view.alpha = 0.2 + 0.5 * (0.5 + 0.5 * Math.sin(t * 1.7 + mote.phase));
    }
  }
}
