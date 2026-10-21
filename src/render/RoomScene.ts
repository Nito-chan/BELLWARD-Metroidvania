import { Container } from 'pixi.js';
import { BOSS_REWARDS } from '../config/bossTypes';
import { COMBAT } from '../config/combat';
import { BOSS_KINDS, isBossKind, type BossKind } from '../config/enemies';
import { PICKUP } from '../config/pickups';
import { CAMERA } from '../config/render';
import { bodyRect, overlaps } from '../combat/geometry';
import { CombatSystem } from '../combat/CombatSystem';
import { ProjectilePool, type ProjectileSpawnOptions } from '../combat/ProjectilePool';
import { BellwardError } from '../core/Errors';
import type { Rng } from '../core/Rng';
import type { SceneDebugState } from '../debug/DebugState';
import { getPickup } from '../data/pickups';
import { createEnemy } from '../enemies/createEnemy';
import type { Enemy, EnemyContext } from '../enemies/Enemy';
import type { InputSnapshot } from '../input/InputState';
import type { PlayerLoadout } from '../player/PlayerLoadout';
import { PlayerController, type PlayerEvent } from '../player/PlayerController';
import { Banner } from '../ui/Banner';
import { Hud } from '../ui/Hud';
import { InteractPrompt } from '../ui/InteractPrompt';
import type { Room, RoomBench, RoomSpawn } from '../world/Room';
import type { ArtProvider } from './ArtProvider';
import { BenchInteraction } from './BenchInteraction';
import type { BossEncounter } from './BossEncounter';
import { spawnBoss } from './BossSpawn';
import { Camera } from './Camera';
import { CombatFeedback, type SceneAudio } from './CombatFeedback';
import { EffectsLayer } from './EffectsLayer';
import { EnemyView } from './EnemyView';
import { ExitGate, type ExitRequest } from './ExitGate';
import { HeroView } from './HeroView';
import { LabelLayer } from './LabelLayer';
import { PickupLayer } from './PickupLayer';
import { ProjectileView } from './ProjectileView';
import { PropLayer } from './PropLayer';
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
  /** The Tide-door ending already played in this run. */
  endingComplete?: boolean;
  /** Screen-reader announcement hook; the scene never touches the DOM. */
  announce?: (text: string) => void;
  /** Optional arrival banner shown above the HUD for a rest or respawn. */
  arrival?: RoomArrival;
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
  private readonly enemyRecords: EnemyRecord[] = [];
  private readonly enemyBuffer: Enemy[] = [];
  private readonly projectiles = new ProjectilePool();
  private readonly projectileView: ProjectileView;
  private readonly effects: EffectsLayer;
  private readonly hud = new Hud();
  private readonly combat = new CombatSystem();
  private readonly feedback: CombatFeedback;
  private readonly exitGate = new ExitGate();
  private bossEncounterValue: BossEncounter | null = null;
  private readonly bench: BenchInteraction;
  private readonly pickups: PickupLayer;
  private readonly tileLayer: TileLayer;
  private readonly altarPrompt = new InteractPrompt();
  private readonly banner = new Banner();
  private readonly announce: (text: string) => void;
  private readonly arrival: RoomArrival | null;
  private readonly canCollectPickup: (id: string) => boolean;
  private readonly sealOpen: boolean;
  private readonly pendingPickups: string[] = [];
  private sigilCount: number;
  private arenaClaimed: boolean;
  private secretBrokenValue = false;
  private secretBrokenThisVisit: boolean;
  private ordealClearedValue: boolean;
  private pendingBossDefeatValue: BossKind | null = null;
  private pendingOrdealDefeatValue: BossKind | null = null;
  private pendingEndingValue = false;
  /** Ending triggers are one-shot per run, so closing the card cannot reopen it. */
  private endingFired: boolean;
  private hitstopTicks = 0;
  private resetRequestedValue = false;

  constructor(
    private readonly room: Room,
    private readonly art: ArtProvider,
    private readonly rng: Rng,
    private readonly audio: SceneAudio,
    options: RoomSceneOptions = {},
  ) {
    this.camera = new Camera(room.bounds);
    const spawn = options.spawn ?? room.spawn;
    const maxHp = options.maxHp ?? COMBAT.player.maxHp;
    const hp = options.hp ?? maxHp;
    this.sigilCount = options.sigilCount ?? 0;
    this.arenaClaimed = options.bossRewardClaimed ?? false;
    this.ordealClearedValue = options.ordealCleared ?? false;
    this.sealOpen = options.sealOpen ?? false;
    this.endingFired = options.endingComplete ?? false;
    this.secretBrokenThisVisit = options.secretBroken ?? false;
    this.announce = options.announce ?? (() => undefined);
    this.arrival = options.arrival ?? null;
    this.canCollectPickup =
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

    for (const enemySpawn of room.definition.enemies) {
      if (!isBossKind(enemySpawn.kind)) {
        const enemy = createEnemy(enemySpawn, rng.fork());
        const view = new EnemyView(art, enemySpawn.kind);
        view.sync(enemy);
        this.enemyRecords.push({ enemy, view });
        this.actorLayer.addChild(view.view);
      }
    }
    this.bossEncounterValue = spawnBoss({
      room,
      art,
      audio,
      effects: this.effects,
      camera: this.camera,
      rng: rng.fork(),
      claimed: this.arenaClaimed,
      announce: options.announce,
      onDefeated: (kind, ordeal) => this.onBossDefeated(kind, ordeal),
    });
    if (this.bossEncounterValue) {
      this.actorLayer.addChild(this.bossEncounterValue.actorView.view);
    }

    this.world.addChild(this.actorLayer);
    this.world.addChild(this.effects.view, this.projectileView.view);
    this.world.addChild(new PropLayer(room.definition.props, 'front', art).view);
    this.view.addChild(this.world);
    this.view.addChild(this.backdrop.overlayView);
    this.view.addChild(this.bench.screenView);
    if (room.definition.ordeal) this.view.addChild(this.altarPrompt.view);
    this.view.addChild(this.hud.view);
    this.view.addChild(this.banner.view);
    if (this.bossEncounterValue) this.view.addChild(this.bossEncounterValue.overlay);
    this.hud.setHealth(this.player.hp, this.player.maxHp);
    this.hud.setFocus(this.player.focusValue, this.player.maxFocus, this.player.healProgress);
    this.hud.setShards(options.shards ?? 0);
    this.hud.setSigils(this.sigilCount, BOSS_KINDS.length);
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
    const kind = this.pendingBossDefeatValue;
    this.pendingBossDefeatValue = null;
    return kind;
  }

  /** A first-time Ordeal clear that RunSession should persist. */
  consumeOrdealDefeat(): BossKind | null {
    const kind = this.pendingOrdealDefeatValue;
    this.pendingOrdealDefeatValue = null;
    return kind;
  }

  /** Pickup ids granted this tick; RunSession records them in the run save. */
  consumePickups(): readonly string[] {
    if (this.pendingPickups.length === 0) return [];
    return this.pendingPickups.splice(0, this.pendingPickups.length);
  }

  /** True on the tick the secret wall shattered; RunSession persists the room id. */
  consumeSecretBroken(): boolean {
    const broken = this.secretBrokenValue;
    this.secretBrokenValue = false;
    return broken;
  }

  /** True once the Tide-door ending fires. RunSession opens the ending overlay. */
  consumeEnding(): boolean {
    const ended = this.pendingEndingValue;
    this.pendingEndingValue = false;
    return ended;
  }

  /** Applies a new durable loadout/shards snapshot while the room stays loaded. */
  applyProgress(loadout: PlayerLoadout, shards: number): void {
    this.player.applyLoadout(loadout);
    this.hud.setShards(shards);
    this.hud.setHealth(this.player.hp, this.player.maxHp);
    this.hud.setFocus(this.player.focusValue, this.player.maxFocus, this.player.healProgress);
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
    return this.bossEncounterValue?.debugDamage(amount) ?? false;
  }

  debugBreakWard(): boolean {
    return this.bossEncounterValue?.debugBreakWard() ?? false;
  }

  debugDefeatBoss(): void {
    this.bossEncounterValue?.debugDefeat();
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
    this.bossEncounterValue?.update(context);

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
    this.updatePickups();
    this.tryBreakSecret();
    this.syncViews(tickCount);
    this.updateHud();
    this.bench.update(this.player.feet, this.player.dead, input.pressed.has('interact'), tickCount);
    this.updateOrdeal(input);
    this.updateEnding();
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
      boss: this.bossEncounterValue,
      bench: this.bench.focused,
      projectiles: this.projectiles.activeCount,
      pickupsRemaining: this.pickups.remaining,
      secretBroken: this.secretBrokenThisVisit,
      sealOpen: this.sealOpen,
      hitstop: this.hitstopTicks,
    });
  }

  private enemies(): readonly Enemy[] {
    this.enemyBuffer.length = 0;
    for (const record of this.enemyRecords) this.enemyBuffer.push(record.enemy);
    if (this.bossEncounterValue) this.enemyBuffer.push(this.bossEncounterValue.boss);
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

  /** First clear of a boss grants one mask and records the sigil for the run. */
  private onBossDefeated(kind: BossKind, ordeal: boolean): void {
    if (ordeal) {
      this.pendingOrdealDefeatValue = kind;
      this.ordealClearedValue = true;
      this.hud.setHealth(this.player.hp, this.player.maxHp);
      return;
    }
    this.arenaClaimed = true;
    this.player.grantMaxHp(BOSS_REWARDS.maxHpPerSigil);
    this.sigilCount += 1;
    this.pendingBossDefeatValue = kind;
    this.hud.setSigils(this.sigilCount, BOSS_KINDS.length);
    this.hud.setHealth(this.player.hp, this.player.maxHp);
  }

  /** Walks over a collectible and asks the run whether it may be granted. */
  private updatePickups(): void {
    if (this.player.dead) return;
    const feet = this.player.feet;
    for (const placement of this.room.definition.pickups ?? []) {
      if (!this.pickups.has(placement.id)) continue;
      if (Math.abs(feet.x - placement.x) > PICKUP.radiusX) continue;
      if (Math.abs(feet.y - placement.y) > PICKUP.radiusY) continue;
      if (!this.canCollectPickup(placement.id)) continue;
      this.pickups.collect(placement.id);
      this.pendingPickups.push(placement.id);
      const def = getPickup(placement.id);
      this.effects.spark(placement.x, placement.y, 1);
      this.audio.playSfx('bell');
      this.banner.show(def.name.toUpperCase(), def.description, 120);
      this.announce(`${def.name}. ${def.description}`);
    }
  }

  /** A nail swing against cracked masonry opens a one-way secret passage. */
  private tryBreakSecret(): void {
    if (this.secretBrokenValue || !this.player.attackActive) return;
    const hitbox = this.player.attackHitbox();
    if (!hitbox || !this.room.tilemap.hasRoleInRect('breakable', hitbox)) return;
    this.room.tilemap.removeAll('breakable');
    this.tileLayer.removeRole('breakable');
    this.secretBrokenValue = true;
    this.secretBrokenThisVisit = true;
    this.effects.spark(hitbox.x + hitbox.w / 2, hitbox.y + hitbox.h / 2, this.player.facing);
    this.audio.playSfx('bossWard');
    this.camera.shake(4, 12);
    this.banner.show('A HIDDEN PASSAGE', 'The cracked stone gives way.', 150);
    this.announce('A hidden passage opens.');
  }

  /**
   * A claimed arena's altar relights the boss as a harder Ordeal. The prompt and the
   * spawn both live here so the run only has to persist the clear, not the encounter.
   */
  private updateOrdeal(input: InputSnapshot): void {
    const ordeal = this.room.definition.ordeal;
    if (
      !ordeal ||
      !this.arenaClaimed ||
      this.ordealClearedValue ||
      this.bossEncounterValue ||
      this.player.dead
    ) {
      this.altarPrompt.hide();
      return;
    }
    if (!overlaps(bodyRect(this.player.body), ordeal)) {
      this.altarPrompt.hide();
      return;
    }
    this.altarPrompt.show('RELIGHT THE ORDEAL', 'INTERACT · FACE THE HARDER MEMORY');
    if (!input.pressed.has('interact')) return;
    this.startOrdeal();
  }

  private startOrdeal(): void {
    const kind = this.room.definition.boss;
    if (!kind) return;
    const encounter = spawnBoss({
      room: this.room,
      art: this.art,
      audio: this.audio,
      effects: this.effects,
      camera: this.camera,
      rng: this.rng.fork(),
      claimed: true,
      allowClaimed: true,
      variant: 'ordeal',
      announce: this.announce,
      onDefeated: (defeated, ordeal) => this.onBossDefeated(defeated, ordeal),
    });
    if (!encounter) {
      throw new BellwardError(`room "${this.room.definition.id}" could not relight its Ordeal`);
    }
    this.bossEncounterValue = encounter;
    this.arenaClaimed = true;
    this.actorLayer.addChild(encounter.actorView.view);
    this.view.addChild(encounter.overlay);
    this.altarPrompt.hide();
    this.audio.playSfx('bossWard');
    this.announce(`${encounter.boss.title} returns.`);
  }

  /** The Tide door ending fires once; the run owns the actual ending screen. */
  private updateEnding(): void {
    const ending = this.room.definition.ending;
    if (!ending || !this.sealOpen || this.endingFired || this.pendingEndingValue) return;
    if (this.player.dead || !overlaps(bodyRect(this.player.body), ending)) return;
    this.endingFired = true;
    this.pendingEndingValue = true;
    this.banner.show(ending.title, ending.subtitle, 240);
    this.announce(`${ending.title}. ${ending.subtitle}`);
    this.audio.playSfx('bell');
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
      this.bossEncounterValue?.alive ?? false,
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
    const blinking = this.player.invulnerableTicks > 0 && !this.player.dead;
    this.heroView.view.alpha = blinking && Math.floor(tickCount / 4) % 2 === 0 ? 0.5 : 1;

    for (const record of this.enemyRecords) record.view.sync(record.enemy);
    this.projectileView.sync(this.projectiles, tickCount);
    this.effects.update();
  }

  private updateHud(): void {
    this.hud.setHealth(this.player.hp, this.player.maxHp);
    this.hud.setFocus(this.player.focusValue, this.player.maxFocus, this.player.healProgress);
    this.hud.setDamage(this.feedback.damageAlpha);
    const death = this.player.dead
      ? Math.min(1, this.player.deathElapsed / COMBAT.player.deathTicks)
      : 0;
    this.hud.setDeath(death);
  }
}
