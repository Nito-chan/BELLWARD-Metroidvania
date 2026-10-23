import { Container } from 'pixi.js';
import { COMBAT } from '../config/combat';
import { BOSS_KINDS, isBossKind, type BossKind } from '../config/enemies';
import { CAMERA } from '../config/render';
import { CombatSystem } from '../combat/CombatSystem';
import { ProjectilePool, type ProjectileSpawnOptions } from '../combat/ProjectilePool';
import type { Rng } from '../core/Rng';
import type { SceneDebugState } from '../debug/DebugState';
import { createEnemy } from '../enemies/createEnemy';
import type { Enemy, EnemyContext } from '../enemies/Enemy';
import type { InputSnapshot } from '../input/InputState';
import type { PlayerLoadout } from '../player/PlayerLoadout';
import { PlayerController, type PlayerEvent } from '../player/PlayerController';
import { TOLL } from '../config/weapons';
import { Banner } from '../ui/Banner';
import { Hud } from '../ui/Hud';
import type { Room, RoomBench, RoomSpawn } from '../world/Room';
import type { ArtProvider } from './ArtProvider';
import { BenchInteraction } from './BenchInteraction';
import { BossDirector } from './BossDirector';
import { Camera } from './Camera';
import { CombatFeedback, type SceneAudio } from './CombatFeedback';
import { EffectsLayer } from './EffectsLayer';
import { EnemyView } from './EnemyView';
import { ExitGate, type ExitRequest } from './ExitGate';
import { HeroView } from './HeroView';
import { HookLayer } from './HookLayer';
import { LabelLayer } from './LabelLayer';
import { PickupLayer } from './PickupLayer';
import { ProjectileView } from './ProjectileView';
import { PropLayer } from './PropLayer';
import { RoomObjectives } from './RoomObjectives';
import { SceneBackdrop } from './SceneBackdrop';
import { buildSceneDebugState } from './SceneDebug';
import { TileLayer } from './TileLayer';

type EnemyRecord = { readonly enemy: Enemy; readonly view: EnemyView };

export type RoomSceneOptions = {
  /** Feet position for the hero; defaults to the room's authored spawn. */
  spawn?: RoomSpawn;
  hp?: number;
  maxHp?: number;
  focus?: number;
  loadout?: PlayerLoadout;
  shards?: number;
  /** Sigils already recovered this run, for the HUD row. */
  sigilCount?: number;
  /** True when the room's boss was already defeated earlier in the run. */
  bossRewardClaimed?: boolean;
  /** Pickups already granted; their views are not built. */
  collectedPickups?: readonly string[];
  /** Content-aware gate: keys stay inert until their sigil is claimed. */
  canCollectPickup?: (id: string) => boolean;
  /** A secret wall in this room was already shattered in this run. */
  secretBroken?: boolean;
  /** The Tide-Bell is owned, so the sealed door is already open. */
  sealOpen?: boolean;
  /** This arena's Ordeal was already cleared. */
  ordealCleared?: boolean;
  /** The earned final ending already played in this run. */
  endingSeen?: boolean;
  /** Screen-reader announcement hook; the scene never touches the DOM. */
  announce?: (text: string) => void;
  /** Optional arrival banner shown above the HUD for a rest or respawn. */
  arrival?: RoomArrival;
  /** Accessibility: camera kicks are inert when false. Defaults to enabled. */
  screenShake?: boolean;
};

export type RoomArrival = {
  readonly title: string;
  readonly subtitle: string;
};

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
  private readonly backdrop: SceneBackdrop;
  private readonly world = new Container();
  private readonly actorLayer = new Container();
  private readonly hookLayer: HookLayer;
  private readonly enemyRecords: EnemyRecord[] = [];
  private readonly enemyBuffer: Enemy[] = [];
  private readonly projectiles = new ProjectilePool();
  private readonly projectileView: ProjectileView;
  private readonly effects: EffectsLayer;
  private readonly hud = new Hud();
  private readonly combat = new CombatSystem();
  private readonly feedback: CombatFeedback;
  private readonly exitGate = new ExitGate();
  private readonly bossDirector: BossDirector;
  private readonly bench: BenchInteraction;
  private readonly pickups: PickupLayer;
  private readonly tileLayer: TileLayer;
  private readonly banner = new Banner();
  private readonly announce: (text: string) => void;
  private readonly arrival: RoomArrival | null;
  private readonly sealOpen: boolean;
  private readonly objectives: RoomObjectives;
  private hitstopTicks = 0;
  private resetRequestedValue = false;

  constructor(
    private readonly room: Room,
    private readonly art: ArtProvider,
    rng: Rng,
    private readonly audio: SceneAudio,
    options: RoomSceneOptions = {},
  ) {
    this.camera = new Camera(room.bounds);
    this.camera.setShakeEnabled(options.screenShake ?? true);
    const spawn = options.spawn ?? room.spawn;
    const maxHp = options.maxHp ?? COMBAT.player.maxHp;
    const hp = options.hp ?? maxHp;
    this.sealOpen = options.sealOpen ?? false;
    this.announce = options.announce ?? (() => undefined);
    this.arrival = options.arrival ?? null;
    const canCollectPickup: (id: string) => boolean =
      options.canCollectPickup ?? ((id) => !(options.collectedPickups ?? []).includes(id));
    if (options.secretBroken) room.tilemap.removeAll('breakable');
    if (this.sealOpen) room.tilemap.removeAll('sealedDoor');
    this.player = new PlayerController(spawn, {
      maxHp,
      hp,
      focus: options.focus,
      loadout: options.loadout,
    });
    this.camera.snapTo(spawn.x, spawn.y + CAMERA.focusOffsetY);
    this.backdrop = new SceneBackdrop(room, art, rng.fork());
    this.view.addChild(this.backdrop.backgroundView);

    this.tileLayer = new TileLayer(room.tilemap, art);
    this.world.addChild(this.tileLayer.view);
    this.world.addChild(new PropLayer(room.definition.props, 'back', art).view);
    this.pickups = new PickupLayer(
      room.definition.pickups ?? [],
      new Set(options.collectedPickups ?? []),
    );
    this.world.addChild(this.pickups.view);
    if (room.definition.labels && room.definition.labels.length > 0) {
      this.world.addChild(new LabelLayer(room.definition.labels).view);
    }
    this.bench = new BenchInteraction(room.definition.benches ?? [], art, this.announce);
    this.world.addChild(this.bench.worldView);

    this.actorLayer.sortableChildren = true;
    this.heroView = new HeroView(art);
    this.heroView.setPose({
      x: spawn.x,
      y: spawn.y,
      facing: 1,
      animation: 'idle',
      restart: true,
      grounded: true,
    });
    this.actorLayer.addChild(this.heroView.view);

    this.effects = new EffectsLayer(art);
    this.feedback = new CombatFeedback(audio, this.effects, this.camera);
    this.projectileView = new ProjectileView(art, this.projectiles);
    this.hookLayer = new HookLayer(room.definition.anchors ?? []);

    this.objectives = new RoomObjectives({
      room,
      player: this.player,
      pickups: this.pickups,
      tileLayer: this.tileLayer,
      effects: this.effects,
      camera: this.camera,
      banner: this.banner,
      hud: this.hud,
      audio,
      announce: this.announce,
      canCollectPickup,
      secretBroken: options.secretBroken,
      sealOpen: this.sealOpen,
      bossRewardClaimed: options.bossRewardClaimed,
      ordealCleared: options.ordealCleared,
      sigilCount: options.sigilCount,
      endingSeen: options.endingSeen,
    });

    for (const enemySpawn of room.definition.enemies) {
      if (!isBossKind(enemySpawn.kind)) {
        const enemy = createEnemy(enemySpawn, rng.fork());
        const view = new EnemyView(art, enemySpawn.kind);
        view.sync(enemy);
        this.enemyRecords.push({ enemy, view });
        this.actorLayer.addChild(view.view);
      }
    }
    this.bossDirector = new BossDirector({
      room,
      art,
      audio,
      effects: this.effects,
      camera: this.camera,
      rng,
      player: this.player,
      objectives: this.objectives,
      announce: this.announce,
      onSpawn: (encounter) => {
        this.actorLayer.addChild(encounter.actorView.view);
        this.view.addChild(encounter.overlay);
      },
    });

    this.world.addChild(this.actorLayer);
    this.world.addChild(this.hookLayer.view);
    this.world.addChild(this.effects.view, this.projectileView.view);
    this.world.addChild(new PropLayer(room.definition.props, 'front', art).view);
    this.view.addChild(this.world);
    this.view.addChild(this.backdrop.overlayView);
    this.view.addChild(this.bench.screenView);
    if (room.definition.ordeal) this.view.addChild(this.bossDirector.prompt.view);
    this.view.addChild(this.hud.view);
    this.view.addChild(this.banner.view);
    // Boss overlays must sit above the HUD; re-adding moves the initial overlay to the top.
    if (this.bossDirector.encounter) this.view.addChild(this.bossDirector.encounter.overlay);
    this.hud.setHealth(this.player.hp, this.player.maxHp);
    this.hud.setFocus(this.player.focusValue, this.player.maxFocus, this.player.healProgress);
    this.hud.setPosture(this.player.posture, this.player.maxPosture, this.player.guardBroken);
    this.hud.setShards(options.shards ?? 0);
    this.hud.setSigils(this.objectives.sigilCount, BOSS_KINDS.length);
    if (this.arrival) {
      this.banner.show(this.arrival.title, this.arrival.subtitle);
      this.announce(`${this.arrival.title}. ${this.arrival.subtitle}.`);
    }
  }

  /** True once the death sequence finished; RunSession rebuilds the room on the next tick. */
  get resetRequested(): boolean {
    return this.resetRequestedValue;
  }

  /** HP carried into the next room or reset. */
  /** The title screen shows the room without its combat HUD; gameplay turns it back on. */
  setHudVisible(visible: boolean): void {
    this.hud.view.visible = visible;
  }

  /** The ending plates repeat the trigger's banner copy, so the world banner is retired. */
  hideBanner(): void {
    this.banner.hide();
  }

  get vitals(): { hp: number; maxHp: number } {
    return { hp: this.player.hp, maxHp: this.player.maxHp };
  }

  /** Focus carried between rooms; benches refill it. */
  get focus(): number {
    return this.player.focusValue;
  }

  /** A door the player walked into, or null. Consumed by RunSession after update. */
  get exitRequested(): ExitRequest | null {
    return this.exitGate.request;
  }

  /** A first-time boss reward that RunSession should record as a run sigil. */
  consumeBossDefeat(): BossKind | null {
    return this.objectives.consumeBossDefeat();
  }

  /** A first-time Ordeal clear that RunSession should persist. */
  consumeOrdealDefeat(): BossKind | null {
    return this.objectives.consumeOrdealDefeat();
  }

  /** Pickup ids granted this tick; RunSession records them in the run save. */
  consumePickups(): readonly string[] {
    return this.objectives.consumePickups();
  }

  /** True on the tick the secret wall shattered; RunSession persists the room id. */
  consumeSecretBroken(): boolean {
    return this.objectives.consumeSecretBroken();
  }

  /** True once the Tide-door ending fires. RunSession opens the ending overlay. */
  consumeEnding(): boolean {
    return this.objectives.consumeEnding();
  }

  /** Applies a new durable loadout/shards snapshot while the room stays loaded. */
  applyProgress(loadout: PlayerLoadout, shards: number): void {
    this.player.applyLoadout(loadout);
    this.hud.setShards(shards);
    this.hud.setHealth(this.player.hp, this.player.maxHp);
    this.hud.setFocus(this.player.focusValue, this.player.maxFocus, this.player.healProgress);
  }

  /** Accessibility: applies the screen-shake toggle to the live room immediately. */
  setScreenShake(enabled: boolean): void {
    this.camera.setShakeEnabled(enabled);
  }

  /** A mask shard completed a set: raise the ceiling and fill the new mask. */
  grantMaxHp(amount: number): void {
    this.player.grantMaxHp(amount);
  }

  /** A bench the player invoked this tick; RunSession saves and rebuilds the room. */
  consumeBenchRest(): RoomBench | null {
    return this.bench.consumeRest();
  }

  /** DEV-only: kill the hero through the real damage path for respawn coverage. */
  debugKillPlayer(): boolean {
    if (!this.player.dead) this.player.takeDamage(999, this.player.feet.x + 1);
    return this.player.dead;
  }

  /** DEV-only: hold i-frames open while a probe inspects boss phases. */
  debugProtectPlayer(ticks: number): boolean {
    if (this.player.dead) return false;
    this.player.debugProtect(ticks);
    return true;
  }

  /** DEV-only E2E hooks. They route through the real damage/ward/defeat paths. */
  debugDamageBoss(amount: number): boolean {
    return this.bossDirector.debugDamage(amount);
  }

  debugBreakWard(): boolean {
    return this.bossDirector.debugBreakWard();
  }

  debugDefeatBoss(): void {
    this.bossDirector.debugDefeat();
  }

  /** Advances the simulation by one fixed tick and returns what that tick produced. */
  update(tickCount: number, input: InputSnapshot): readonly PlayerEvent[] {
    if (this.resetRequestedValue) return [];
    if (this.hitstopTicks > 0) {
      this.hitstopTicks -= 1;
      return [];
    }

    this.player.update(input, this.room.tilemap, this.room.definition.anchors ?? []);

    // A Toll ring launches at the start of its active window: a piercing note that
    // applies resonance. It is a player-owned projectile, so it never hurts the hero.
    if (
      this.player.currentWeapon === 'toll' &&
      this.player.attackActive &&
      this.player.clipTick === TOLL.active.start
    ) {
      const feet = this.player.feet;
      this.projectiles.spawn(
        feet.x + this.player.facing * 10,
        feet.y - 16,
        this.player.facing,
        0,
        TOLL.wave.speed,
        TOLL.damage,
        TOLL.wave.lifeTicks,
        { style: 'bell', owner: 'player', posture: TOLL.posture },
      );
    }

    const context: EnemyContext = {
      tilemap: this.room.tilemap,
      player: { feet: this.player.feet, dead: this.player.dead },
      arena: this.room.bounds,
      castProjectile: (
        x: number,
        y: number,
        dirX: number,
        dirY: number,
        speed: number,
        damage: number,
        lifeTicks: number,
        options?: ProjectileSpawnOptions,
      ) => {
        this.projectiles.spawn(x, y, dirX, dirY, speed, damage, lifeTicks, options);
        if (!options?.style || options.style === 'fire') this.audio.playSfx('fireball');
      },
    };
    for (const record of this.enemyRecords) record.enemy.update(context);
    this.bossDirector.updateBoss(context);

    const result = this.combat.resolve(
      this.player,
      this.enemies(),
      this.projectiles,
      this.room.tilemap,
    );
    if (result.hitstop > this.hitstopTicks) this.hitstopTicks = result.hitstop;
    this.feedback.apply(result.events);
    this.feedback.update();

    this.removeFallenEnemies();
    this.objectives.updatePickups();
    this.objectives.tryBreakSecret();
    this.syncViews(tickCount);
    this.updateHud();
    this.bench.update(this.player.feet, this.player.dead, input.pressed.has('interact'), tickCount);
    this.bossDirector.updateOrdeal(this.player.dead, input);
    this.objectives.updateEnding();
    this.banner.tick();
    this.pickups.update(tickCount);

    const feet = this.player.feet;
    this.camera.update(
      feet.x + this.player.facing * CAMERA.lookAheadX,
      feet.y + CAMERA.focusOffsetY,
    );
    this.backdrop.update(tickCount);

    if (this.player.dead && this.player.deathElapsed >= COMBAT.player.deathTicks) {
      this.resetRequestedValue = true;
    }
    if (!this.player.dead) this.updateExit();
    return this.player.events;
  }

  /** Samples the interpolated camera and snaps the world to whole pixels. */
  render(alpha: number): void {
    const view = this.camera.view(alpha);
    const x = Math.round(view.x);
    const y = Math.round(view.y);
    this.world.position.set(-x, -y);
    this.backdrop.follow({ x, y });
  }

  /** Detaches and destroys the whole scene (used when the room resets after a death). */
  destroy(): void {
    this.view.removeFromParent();
    this.view.destroy({ children: true });
  }

  debugState(): SceneDebugState {
    return buildSceneDebugState({
      room: this.room,
      art: this.art,
      camera: this.camera,
      player: this.player,
      enemies: this.enemyRecords.map((record) => record.enemy),
      boss: this.bossDirector.encounter,
      bench: this.bench.focused,
      projectiles: this.projectiles.activeCount,
      pickupsRemaining: this.pickups.remaining,
      secretBroken: this.objectives.secretBrokenThisVisit,
      sealOpen: this.sealOpen,
      hitstop: this.hitstopTicks,
    });
  }

  private enemies(): readonly Enemy[] {
    this.enemyBuffer.length = 0;
    for (const record of this.enemyRecords) this.enemyBuffer.push(record.enemy);
    if (this.bossDirector.boss) this.enemyBuffer.push(this.bossDirector.boss);
    return this.enemyBuffer;
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

  /**
   * Door triggers are armed only after the player leaves every trigger, so a destination
   * spawn that happens to touch its own doorway does not bounce the player back.
   * Boss arenas keep their exit locked until the boss is dead.
   */
  private updateExit(): void {
    this.exitGate.update(
      this.player.body,
      this.room.definition.exits ?? [],
      this.bossDirector.alive,
    );
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
    this.heroView.setGuard(this.player.guarding, this.player.perfectParryWindow);
    const blinking = this.player.invulnerableTicks > 0 && !this.player.dead;
    this.heroView.view.alpha = blinking && Math.floor(tickCount / 4) % 2 === 0 ? 0.5 : 1;

    for (const record of this.enemyRecords) record.view.sync(record.enemy);
    this.projectileView.sync(this.projectiles, tickCount);
    this.hookLayer.update(this.player, tickCount);
    this.effects.update();
  }

  private updateHud(): void {
    this.hud.setHealth(this.player.hp, this.player.maxHp);
    this.hud.setFocus(this.player.focusValue, this.player.maxFocus, this.player.healProgress);
    this.hud.setPosture(this.player.posture, this.player.maxPosture, this.player.guardBroken);
    this.hud.setDamage(this.feedback.damageAlpha);
    const death = this.player.dead
      ? Math.min(1, this.player.deathElapsed / COMBAT.player.deathTicks)
      : 0;
    this.hud.setDeath(death);
  }
}
