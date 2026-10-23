import { COMBAT } from '../config/combat';
import { ENEMIES, type ActorKind, type EnemyStats } from '../config/enemies';
import { RENDER } from '../config/render';
import { SIM } from '../config/world';
import { bodyRect, forwardBox } from '../combat/geometry';
import type { ProjectileSpawnOptions } from '../combat/ProjectilePool';
import { approach } from '../core/Math2D';
import type { Rect, Vec2 } from '../core/Types';
import { bodyFeet, createBody, type Body } from '../physics/Body';
import { moveAndCollide, type MoveResult } from '../physics/TileCollision';
import type { EnemySpawn } from '../world/Room';
import type { Tilemap } from '../world/Tilemap';

/** Shared FSM states. `active` is the only state with a damaging melee hitbox open. */
export type EnemyState =
  | 'intro'
  | 'idle'
  | 'patrol'
  | 'chase'
  | 'windup'
  | 'active'
  | 'recover'
  | 'phase'
  | 'stagger'
  | 'dead';

/** What an enemy is allowed to know about the player. Keeps the simulation testable. */
export type EnemyTarget = {
  feet: Vec2;
  dead: boolean;
};

/** Everything an enemy needs from the scene. Passed per tick, never stored. */
export type EnemyContext = {
  tilemap: Tilemap;
  player: EnemyTarget;
  /** Room bounds, used by bosses for arena-wide rain patterns. */
  arena?: Rect;
  castProjectile: (
    x: number,
    y: number,
    dirX: number,
    dirY: number,
    speed: number,
    damage: number,
    lifeTicks: number,
    options?: ProjectileSpawnOptions,
  ) => void;
};

/** What a posture hit did. `broken` is the moment before a KNELL becomes possible. */
export type PostureResult = 'none' | 'damaged' | 'broken';

/**
 * Base for every enemy: tile physics, health, hit reaction, the animation contract and
 * small steering helpers. Subclasses own only their decision making (`think`).
 *
 * The base deliberately has no Pixi or DOM dependency; scenes read the public getters
 * once per tick and feed a view.
 */
export abstract class Enemy {
  readonly kind: ActorKind;
  readonly stats: EnemyStats;
  readonly body: Body;
  facing: -1 | 1;
  hp: number;
  protected stateValue: EnemyState = 'idle';
  protected stateTicks = 0;
  protected cooldownTicks = 0;
  protected flashTicks = 0;
  protected animationValue = 'idle';
  protected restartedValue = true;
  protected readonly patrolMin: number;
  protected readonly patrolMax: number;
  private postureValue: number;
  private postureRegenTicks = 0;
  private postureBrokenTicks = 0;
  private resonanceTicks = 0;
  private attackValue = 0;

  constructor(kind: ActorKind, spawn: EnemySpawn) {
    this.kind = kind;
    this.stats = ENEMIES[kind];
    this.hp = this.stats.hp;
    this.postureValue = this.stats.posture;
    this.facing = spawn.facing ?? 1;
    const { w, h } = this.stats.body;
    this.body = createBody(spawn.x - w / 2, spawn.y - h, w, h);
    this.patrolMin = spawn.patrol?.min ?? spawn.x;
    this.patrolMax = spawn.patrol?.max ?? spawn.x;
  }

  /** Feet-center in world pixels. */
  get feet(): Vec2 {
    return bodyFeet(this.body);
  }

  get state(): EnemyState {
    return this.stateValue;
  }

  get alive(): boolean {
    return this.stateValue !== 'dead';
  }

  get animation(): string {
    return this.animationValue;
  }

  /** True for exactly one tick after a clip change, so looping clips do not freeze. */
  get restarted(): boolean {
    return this.restartedValue;
  }

  get flash(): boolean {
    return this.flashTicks > 0;
  }

  get grounded(): boolean {
    return this.body.grounded;
  }

  /** Current posture; at zero the actor is open to a KNELL. */
  get posture(): number {
    return this.postureValue;
  }

  get postureMax(): number {
    return this.stats.posture;
  }

  /** 0..1 for posture bars. */
  get postureRatio(): number {
    return this.postureMax > 0 ? this.postureValue / this.postureMax : 0;
  }

  /** How many ticks remain on the Toll's resonance mark (0 when unmarked). */
  get resonance(): number {
    return this.resonanceTicks;
  }

  /** Marks the enemy so the next Nail or Censer hit deals bonus damage and posture. */
  markResonance(ticks: number): void {
    this.resonanceTicks = Math.max(this.resonanceTicks, ticks);
  }

  /** Consumes the resonance mark (the next Nail/Censer hit spends it). */
  consumeResonance(): void {
    this.resonanceTicks = 0;
  }

  /** True while the actor is open and the next hit becomes a KNELL. */
  get postureBroken(): boolean {
    return this.postureBrokenTicks > 0;
  }

  /** A red attack: the guard is useless against it. */
  get attackUnblockable(): boolean {
    return this.stats.melee?.unblockable ?? false;
  }

  /** Combat may target this enemy. Bosses hide during teleports and phase transitions. */
  get targetable(): boolean {
    return this.alive;
  }

  /** Body contact can hurt the player. A hidden boss has no body in the room. */
  get contactHazard(): boolean {
    return this.alive;
  }

  /** True when a player swing should clang off instead of applying damage. */
  get damageBlocked(): boolean {
    return false;
  }

  /** Called when a swing hits a blocked target; bosses use it to flash their ward. */
  onDeflect(_sourceX: number): void {
    // Regular enemies are never guarded.
  }

  /** 0 before a wind-up, rising to 1 on the active frame. Drives the telegraph arc. */
  get telegraph(): number {
    if (this.stateValue !== 'windup' || !this.stats.melee) return 0;
    return 1 - this.stateTicks / this.stats.melee.windupTicks;
  }

  /** The damaging melee box while the active window is open. */
  attackHitbox(): Rect | null {
    if (this.stateValue !== 'active' || !this.stats.melee) return null;
    const feet = this.feet;
    return forwardBox(feet.x, feet.y, this.facing, this.stats.melee.box);
  }

  /** Damage of the active melee window (0 when closed). */
  get attackDamage(): number {
    if (this.stateValue !== 'active' || !this.stats.melee) return 0;
    return this.stats.melee.damage;
  }

  /**
   * Increments once per active attack window, so the combat pass can land a guard
   * reaction (block or parry) exactly once per swing instead of once per active tick.
   */
  get attackId(): number {
    return this.attackValue;
  }

  /** The body box used for contact damage (not the sprite's visual bounds). */
  bounds(): Rect {
    return bodyRect(this.body);
  }

  /**
   * Applies a player hit. Returns false when the enemy is already dead, true otherwise.
   * A surviving enemy is interrupted into a stagger; its current wind-up or cast is lost.
   */
  takeDamage(amount: number, sourceX: number): boolean {
    if (!this.alive) return false;
    const applied = Math.max(0, Math.floor(amount));
    if (applied === 0) return false;

    this.hp = Math.max(0, this.hp - applied);
    this.flashTicks = 4;
    if (this.hp <= 0) {
      this.stateValue = 'dead';
      this.stateTicks = 0;
      this.body.vx = 0;
      this.body.vy = 0;
      return true;
    }

    const away = this.feet.x < sourceX ? -1 : 1;
    this.facing = away === 1 ? -1 : 1;
    this.body.vx = away * COMBAT.enemy.knockback.x;
    this.body.vy = COMBAT.enemy.knockback.y;
    this.stateValue = 'stagger';
    this.stateTicks = this.stats.staggerTicks;
    this.restartClip('hurt');
    return true;
  }

  /**
   * Fills posture. At zero the actor staggers open for `COMBAT.posture.brokenTicks`;
   * when that opens, the next player hit is a KNELL. Returns what changed.
   */
  takePostureDamage(amount: number, sourceX: number): PostureResult {
    if (!this.alive || this.postureBrokenTicks > 0) return 'none';
    const applied = Math.max(0, Math.floor(amount));
    if (applied === 0) return 'none';

    this.postureRegenTicks = COMBAT.posture.enemyRegenDelayTicks;
    this.postureValue = Math.max(0, this.postureValue - applied);
    if (this.postureValue > 0) return 'damaged';

    this.postureBrokenTicks = COMBAT.posture.brokenTicks;
    const away = this.feet.x < sourceX ? -1 : 1;
    this.body.vx = away * COMBAT.enemy.knockback.x;
    this.body.vy = COMBAT.enemy.knockback.y;
    this.stateValue = 'stagger';
    this.stateTicks = COMBAT.posture.brokenTicks;
    this.restartClip('hurt');
    return 'broken';
  }

  /**
   * Fills posture without the knockback or stagger of a real hit: used by lingering
   * effects such as the Censer's brine cloud. Returns what changed.
   */
  applyPosture(amount: number): PostureResult {
    if (!this.alive || this.postureBrokenTicks > 0) return 'none';
    const applied = Math.max(0, Math.floor(amount));
    if (applied === 0) return 'none';

    this.postureRegenTicks = COMBAT.posture.enemyRegenDelayTicks;
    this.postureValue = Math.max(0, this.postureValue - applied);
    if (this.postureValue > 0) return 'damaged';

    this.postureBrokenTicks = COMBAT.posture.brokenTicks;
    this.stateValue = 'stagger';
    this.stateTicks = COMBAT.posture.brokenTicks;
    this.restartClip('hurt');
    return 'broken';
  }

  /** A perfect parry: no health lost, posture paid, and a bright flash for the read. */
  onParried(sourceX: number): void {
    if (!this.alive) return;
    this.flashTicks = 4;
    this.takePostureDamage(COMBAT.guard.parryPostureDamage, sourceX);
  }

  /** Advances one fixed tick. Dead enemies are removed by the scene and never update. */
  update(ctx: EnemyContext): void {
    if (!this.alive) return;
    this.restartedValue = false;
    if (this.cooldownTicks > 0) this.cooldownTicks -= 1;
    if (this.flashTicks > 0) this.flashTicks -= 1;
    if (this.stateTicks > 0) this.stateTicks -= 1;
    if (this.resonanceTicks > 0) this.resonanceTicks -= 1;
    if (this.postureBrokenTicks > 0) {
      this.postureBrokenTicks -= 1;
      if (this.postureBrokenTicks === 0) this.postureValue = this.postureMax;
    }
    if (this.postureRegenTicks > 0) this.postureRegenTicks -= 1;
    else if (this.postureBrokenTicks <= 0) {
      const regen =
        this.resonanceTicks > 0
          ? COMBAT.posture.enemyRegenPerTick * 0.5
          : COMBAT.posture.enemyRegenPerTick;
      this.postureValue = Math.min(this.postureMax, this.postureValue + regen);
    }

    const wasActive = this.stateValue === 'active';
    this.think(ctx);
    if (!wasActive && this.stateValue === 'active') this.attackValue += 1;

    this.body.vy = Math.min(COMBAT.enemy.maxFall, this.body.vy + COMBAT.enemy.gravity * SIM.dt);
    const move = moveAndCollide(ctx.tilemap, this.body, SIM.dt);
    if (move.hitX) {
      this.body.vx = 0;
      // Patrols turn around at walls; chasers wait for a player who comes back down.
      if (this.stateValue === 'patrol') this.facing = this.facing === 1 ? -1 : 1;
    }
    this.onMoveResolved(move, ctx);
  }

  /** Subclass decision making. Called once per tick before physics. */
  protected abstract think(ctx: EnemyContext): void;

  /** Called after tile collision. Bosses use it to notice wall impacts. */
  protected onMoveResolved(_move: MoveResult, _ctx: EnemyContext): void {
    // Most enemies do not care about the collision result.
  }

  protected beginState(state: EnemyState, ticks: number, clip: string): void {
    this.stateValue = state;
    this.stateTicks = ticks;
    this.beginClip(clip);
  }

  protected beginClip(name: string): void {
    if (this.animationValue === name) return;
    this.animationValue = name;
    this.restartedValue = true;
  }

  /** Forces the clip to restart even when it is already active (a second hit). */
  protected restartClip(name: string): void {
    this.animationValue = name;
    this.restartedValue = true;
  }

  /** True when the player is inside the range box and alive. */
  protected canSee(ctx: EnemyContext, range: number, vertical: number): boolean {
    if (ctx.player.dead) return false;
    const dx = Math.abs(ctx.player.feet.x - this.feet.x);
    const dy = Math.abs(ctx.player.feet.y - this.feet.y);
    return dx <= range && dy <= vertical;
  }

  protected horizontalDelta(ctx: EnemyContext): number {
    return ctx.player.feet.x - this.feet.x;
  }

  /** Turns to face the player without moving. */
  protected facePlayer(ctx: EnemyContext): void {
    const dx = this.horizontalDelta(ctx);
    if (dx !== 0) this.facing = dx > 0 ? 1 : -1;
  }

  /** Walks in `dir`, refusing to step off a ledge. */
  protected walk(dir: -1 | 1, speed: number, tilemap: Tilemap): void {
    this.facing = dir;
    if (!this.hasGroundAhead(dir, tilemap)) {
      this.body.vx = 0;
      return;
    }
    this.body.vx = dir * speed;
  }

  protected brake(rate: number): void {
    this.body.vx = approach(this.body.vx, 0, rate * SIM.dt);
  }

  /**
   * Ground probe one pixel past the leading foot. Uses solid tiles (one-way platforms
   * count), so a patrolling enemy walks the beam bridge but never off its edge.
   */
  protected hasGroundAhead(dir: -1 | 1, tilemap: Tilemap): boolean {
    const probeX = dir === 1 ? this.body.x + this.body.w + 2 : this.body.x - 2;
    const row = Math.floor((this.body.y + this.body.h + 2) / RENDER.tileSize);
    return tilemap.isSolid(Math.floor(probeX / RENDER.tileSize), row);
  }
}
