import { BOSSES, BOSS_PATTERNS } from '../config/bosses';
import {
  BOSS_FAIRNESS,
  type BossDef,
  type BossPatternDef,
  type BossPhaseDef,
} from '../config/bossTypes';
import type { BossKind } from '../config/enemies';
import { ORDEAL } from '../config/progression';
import { forwardBox } from '../combat/geometry';
import { clamp } from '../core/Math2D';
import type { Vec2 } from '../core/Types';
import type { Rng } from '../core/Rng';
import type { Rect } from '../core/Types';
import type { MoveResult } from '../physics/TileCollision';
import type { EnemySpawn } from '../world/Room';
import type { BossEvent } from './BossEvents';
import { BossPatternState } from './BossPatternState';
import { diveLandingX, teleportBehindX } from './bossPlacement';
import { launchPatternStart, launchRainVolley } from './bossProjectiles';
import { Enemy, type EnemyContext } from './Enemy';

/** A Toll wave passing through a world position, used for Last Keeper chains and answers. */
export type TollWaveAt = { readonly x: number; readonly y: number };

/** Last Keeper mechanic tuning. */
const LAST_KEEPER = {
  /** Radius (px) within which a Toll wave opens a chain. */
  chainRadius: 40,
  /** Ticks the Censer has to break a chain after Toll opens it. */
  chainWindowTicks: 60,
  /** Radius (px) within which a Toll wave answers the great bell. */
  bellRadius: 40,
  /** Ticks the player has to answer a boss ring. */
  answerWindowTicks: 24,
  /** Ticks of the phase 2 → phase 3 transition. */
  phase3TransitionTicks: 50,
} as const;

export type { BossEvent } from './BossEvents';

/**
 * Boss FSM on top of the shared Enemy body/physics:
 *
 *   intro -> idle -> windup -> active -> recover -> idle
 *                      \-> phase (invulnerable transition)
 *                      \-> stagger (shield break / wall crash)
 *
 * Patterns are data (`config/bosses.ts`); this class only executes their archetypes,
 * phases, gate rules and event stream. It never owns rendering or audio.
 */
export type BossVariant = 'normal' | 'ordeal';

export class Boss extends Enemy {
  readonly definition: BossDef;
  readonly variant: BossVariant;
  readonly maxHp: number;
  private readonly tempoScale: number;
  private readonly rng: Rng;
  private phaseIndexValue = 0;
  private wardedValue: boolean;
  private hiddenValue = false;
  private readonly patterns = new BossPatternState();
  private wardFlashTicks = 0;
  private deathElapsedValue = 0;
  private readonly eventBuffer: BossEvent[] = [];

  // Last Keeper mechanic state (only when definition.mode === 'lastKeeper')
  private lastKeeperModeValue = false;
  /** Chains broken in phase 2 (0..3). */
  private chainCountValue = 0;
  /** A chain is open and waiting for a Censer hit. */
  private chainOpenValue = false;
  /** Ticks remaining in the current Censer response window. */
  private chainWindowTicksValue = 0;
  /** The three chain positions in world space. */
  private chainTargetsValue: Vec2[] = [];
  /** The great bell position in world space. */
  private greatBellValue: Vec2 | null = null;
  /** Toll answers given in phase 3 (0..3). */
  private answerCountValue = 0;
  /** A boss ring is open and waiting for a Toll answer. */
  private answerWindowValue = false;
  /** Ticks remaining in the current answer window. */
  private answerWindowTicksValue = 0;
  /** All three answers given; the ritual is solved. */
  private ritualSolvedValue = false;
  /** Flood level in phase 2 (0..3, rises after each chain break). */
  private waterLevelValue = 0;

  constructor(kind: BossKind, spawn: EnemySpawn, rng: Rng, variant: BossVariant = 'normal') {
    super(kind, spawn);
    this.definition = BOSSES[kind];
    this.variant = variant;
    this.tempoScale = variant === 'ordeal' ? ORDEAL.tempoScale : 1;
    this.maxHp = variant === 'ordeal' ? Math.ceil(this.stats.hp * ORDEAL.hpScale) : this.stats.hp;
    this.hp = this.maxHp;
    this.rng = rng;
    this.wardedValue = this.definition.gate === 'bellShield';
    this.lastKeeperModeValue = this.definition.mode === 'lastKeeper';
    this.chainTargetsValue = (spawn as EnemySpawn & { chainTargets?: Vec2[] }).chainTargets ?? [];
    this.greatBellValue = (spawn as EnemySpawn & { greatBell?: Vec2 }).greatBell ?? null;
    this.beginState('intro', this.scaled(this.definition.introTicks), 'idle');
  }

  get title(): string {
    return this.variant === 'ordeal'
      ? `${this.stats.displayName} · Ordeal`
      : this.stats.displayName;
  }

  get phaseIndex(): number {
    return this.phaseIndexValue;
  }

  get phaseCount(): number {
    return this.definition.phases.length;
  }

  get phase(): BossPhaseDef {
    return this.definition.phases[this.phaseIndexValue] ?? this.definition.phases[0]!;
  }

  get warded(): boolean {
    return this.wardedValue;
  }

  get hidden(): boolean {
    return this.hiddenValue;
  }

  get pattern(): BossPatternDef | null {
    return this.patterns.pattern;
  }

  get wardFlash(): boolean {
    return this.wardFlashTicks > 0;
  }

  /** True when this is a Last Keeper encounter. */
  get lastKeeperMode(): boolean {
    return this.lastKeeperModeValue;
  }

  /** Chains broken in phase 2 (0..3). */
  get chainCount(): number {
    return this.chainCountValue;
  }

  /** A chain is open and waiting for a Censer hit. */
  get chainOpen(): boolean {
    return this.chainOpenValue;
  }

  /** The three chain positions in world space. */
  get chainTargets(): readonly Vec2[] {
    return this.chainTargetsValue;
  }

  /** The great bell position in world space. */
  get greatBell(): Vec2 | null {
    return this.greatBellValue;
  }

  /** Toll answers given in phase 3 (0..3). */
  get answerCount(): number {
    return this.answerCountValue;
  }

  /** A boss ring is open and waiting for a Toll answer. */
  get answerWindow(): boolean {
    return this.answerWindowValue;
  }

  /** All three answers given; the ritual is solved. */
  get ritualSolved(): boolean {
    return this.ritualSolvedValue;
  }

  /** Flood level in phase 2 (0..3, rises after each chain break). */
  get waterLevel(): number {
    return this.waterLevelValue;
  }

  get deathElapsed(): number {
    return this.deathElapsedValue;
  }

  override get targetable(): boolean {
    return this.alive && !this.hiddenValue;
  }

  override get contactHazard(): boolean {
    return this.alive && !this.hiddenValue;
  }

  override get damageBlocked(): boolean {
    return (
      this.wardedValue ||
      this.hiddenValue ||
      this.stateValue === 'intro' ||
      this.stateValue === 'phase'
    );
  }

  /** 0..1 warning fill for the current wind-up. */
  override get telegraph(): number {
    const pattern = this.pattern;
    if (this.stateValue !== 'windup' || !pattern) return 0;
    return clamp(1 - this.stateTicks / Math.max(1, pattern.telegraphTicks), 0, 1);
  }

  override attackHitbox(): Rect | null {
    const pattern = this.pattern;
    if (this.stateValue !== 'active' || !pattern?.box) return null;
    const feet = this.feet;
    return forwardBox(feet.x, feet.y, this.facing, pattern.box);
  }

  override get attackDamage(): number {
    const pattern = this.pattern;
    if (this.stateValue !== 'active' || !pattern?.box) return 0;
    return pattern.damage;
  }

  override get attackUnblockable(): boolean {
    return this.pattern?.unblockable ?? false;
  }

  override onDeflect(_sourceX: number): void {
    if (this.wardedValue) this.wardFlashTicks = 8;
  }

  override takeDamage(amount: number, _sourceX: number): boolean {
    if (!this.alive) return false;
    if (this.damageBlocked) {
      if (this.wardedValue) this.wardFlashTicks = 8;
      return false;
    }
    const applied = Math.max(0, Math.floor(amount));
    if (applied === 0) return false;

    // Last Keeper phase 2: health is gated at 1. Chains, not damage, end the phase.
    if (this.lastKeeperModeValue && this.phaseIndexValue === 1) {
      this.hp = Math.max(1, this.hp - applied);
      this.flashTicks = 4;
      return false;
    }

    this.hp = Math.max(0, this.hp - applied);
    this.flashTicks = 4;
    if (this.hp <= 0) {
      this.defeat();
      return true;
    }
    this.checkPhase();
    return true;
  }

  /** Break the bell shield immediately. Used by a wall charge and by E2E cheats. */
  forceBreakWard(): boolean {
    if (!this.wardedValue) return false;
    this.breakWard();
    return true;
  }

  /** Test/debug hook: start a specific pattern with its authored telegraph. */
  debugForcePattern(id: string): void {
    const pattern = this.findPattern(id);
    if (!pattern) return;
    this.beginPattern(pattern);
  }

  /** Test/debug hook: skip the fight without passing through phase gates. */
  debugDefeat(): void {
    if (this.alive) this.defeat();
  }

  /** Test hook: force an answer window open in phase 3. */
  debugForceAnswerWindow(): void {
    if (!this.lastKeeperModeValue || this.phaseIndexValue !== 2) return;
    this.answerWindowValue = true;
    this.answerWindowTicksValue = LAST_KEEPER.answerWindowTicks;
  }

  /** Called by the room scene when a Toll wave passes through this position. */
  tollAt(x: number, y: number): void {
    if (!this.lastKeeperModeValue) return;

    if (this.phaseIndexValue === 1) {
      // Phase 2: Toll opens the next chain for a 60-tick Censer window.
      if (!this.chainOpenValue && this.chainWindowTicksValue <= 0) {
        const target = this.chainTargetsValue[this.chainCountValue];
        if (target && Math.hypot(x - target.x, y - target.y) < LAST_KEEPER.chainRadius) {
          this.chainOpenValue = true;
          this.chainWindowTicksValue = LAST_KEEPER.chainWindowTicks;
          this.eventBuffer.push({
            type: 'tell',
            patternId: 'chain.open',
            sfx: 'bossBell',
            x: target.x,
            y: target.y,
          });
        }
      }
    } else if (this.phaseIndexValue === 2) {
      // Phase 3: Toll answers the great bell during an open answer window.
      if (this.answerWindowValue && this.answerWindowTicksValue > 0) {
        if (
          this.greatBellValue &&
          Math.hypot(x - this.greatBellValue.x, y - this.greatBellValue.y) < LAST_KEEPER.bellRadius
        ) {
          // Correct answer: light a pip and close the window.
          this.answerWindowValue = false;
          this.answerWindowTicksValue = 0;
          this.answerCountValue += 1;
          this.eventBuffer.push({
            type: 'wardBreak',
            x: this.greatBellValue.x,
            y: this.greatBellValue.y,
          });
          if (this.answerCountValue >= 3) {
            this.ritualSolvedValue = true;
            this.defeat();
          }
        }
      }
    }
  }

  /** Called by the room scene when a Censer swing hits this position. */
  censerAt(x: number, y: number): void {
    if (!this.lastKeeperModeValue || this.phaseIndexValue !== 1) return;
    if (!this.chainOpenValue || this.chainWindowTicksValue <= 0) return;

    const target = this.chainTargetsValue[this.chainCountValue];
    if (target && Math.hypot(x - target.x, y - target.y) < LAST_KEEPER.chainRadius) {
      // Chain broken: advance flood, open the next chain, or enter phase 3.
      this.chainOpenValue = false;
      this.chainWindowTicksValue = 0;
      this.chainCountValue += 1;
      this.waterLevelValue += 1;
      this.eventBuffer.push({
        type: 'wardBreak',
        x: target.x,
        y: target.y,
      });
      if (this.chainCountValue >= 3) {
        this.enterPhase3();
      }
    }
  }

  /** Enter phase 3 (The Answer): invulnerable, solved by Toll answers. */
  private enterPhase3(): void {
    this.phaseIndexValue = 2;
    this.patterns.clear();
    this.body.vx = 0;
    this.beginState('phase', this.scaled(LAST_KEEPER.phase3TransitionTicks), 'hurt');
    this.eventBuffer.push({ type: 'phase', phase: 2, name: 'The Answer' });
  }

  /** Process a Toll wave at a world position each tick. Called by the room scene. */
  processTollWave(x: number, y: number): void {
    this.tollAt(x, y);
  }

  consumeEvents(): BossEvent[] {
    return this.eventBuffer.splice(0, this.eventBuffer.length);
  }

  override update(ctx: EnemyContext): void {
    if (!this.alive) {
      this.deathElapsedValue += 1;
      return;
    }
    this.patterns.advanceClock();
    if (this.wardFlashTicks > 0) this.wardFlashTicks -= 1;
    super.update(ctx);
  }

  protected think(ctx: EnemyContext): void {
    // Last Keeper mechanic clocks, ticking in every state.
    if (this.lastKeeperModeValue) {
      if (this.chainWindowTicksValue > 0) {
        this.chainWindowTicksValue -= 1;
        if (this.chainWindowTicksValue === 0) this.chainOpenValue = false;
      }
      if (this.answerWindowTicksValue > 0) {
        this.answerWindowTicksValue -= 1;
        if (this.answerWindowTicksValue === 0) {
          this.answerWindowValue = false;
          // A missed answer sends a telegraphed shockwave; no progress lost.
          this.eventBuffer.push({ type: 'wallHit', x: this.feet.x, y: this.feet.y });
        }
      }
      // Phase 3: the keeper rings the great bell, opening an answer window.
      if (
        this.phaseIndexValue === 2 &&
        !this.answerWindowValue &&
        this.answerWindowTicksValue <= 0 &&
        this.answerCountValue < 3
      ) {
        this.answerWindowValue = true;
        this.answerWindowTicksValue = LAST_KEEPER.answerWindowTicks;
        this.eventBuffer.push({
          type: 'tell',
          patternId: 'answer.open',
          sfx: 'bossBell',
          x: this.greatBellValue?.x ?? this.feet.x,
          y: this.greatBellValue?.y ?? this.feet.y,
        });
      }
    }

    switch (this.stateValue) {
      case 'intro':
        this.body.vx = 0;
        this.facePlayer(ctx);
        if (this.stateTicks <= 0) this.beginIdle();
        return;
      case 'phase':
        this.body.vx = 0;
        if (this.stateTicks <= 0) this.beginIdle();
        return;
      case 'stagger':
        this.body.vx = 0;
        if (this.stateTicks <= 0) this.beginIdle();
        return;
      case 'idle':
        this.body.vx = 0;
        this.facePlayer(ctx);
        if (this.stateTicks <= 0) this.beginPattern(this.choosePattern(ctx));
        return;
      case 'windup':
        this.tickWindup(ctx);
        return;
      case 'active':
        this.tickActive(ctx);
        return;
      case 'recover':
        this.body.vx = 0;
        if (this.stateTicks <= 0) this.beginIdle();
        return;
      default:
        return;
    }
  }

  protected override onMoveResolved(move: MoveResult, ctx: EnemyContext): void {
    const pattern = this.pattern;
    if (!move.hitX || this.stateValue !== 'active' || !pattern) return;
    const feet = this.feet;
    const player = ctx.player.feet;
    const playerAtWall =
      Math.hypot(feet.x - player.x, feet.y - player.y) <= BOSS_FAIRNESS.wardBreakRadius;
    if (pattern.breakWardOnWall && this.wardedValue && playerAtWall) {
      this.breakWard();
      return;
    }
    if (pattern.wallStunTicks) {
      this.eventBuffer.push({ type: 'wallHit', x: feet.x, y: feet.y });
      this.hiddenValue = false;
      this.beginState('stagger', pattern.wallStunTicks, 'hurt');
    }
  }

  private tickWindup(ctx: EnemyContext): void {
    this.body.vx = 0;
    const pattern = this.pattern;
    if (!pattern) {
      this.beginIdle();
      return;
    }
    if (pattern.hideTicks && this.stateTicks <= pattern.hideTicks) this.hiddenValue = true;
    if (this.stateTicks > 0) return;

    this.hiddenValue = false;
    this.beginState('active', this.scaled(pattern.activeTicks), 'active');
    this.patterns.beginActive(pattern);
    if (pattern.kind === 'teleport') {
      this.body.x = teleportBehindX(ctx.arena, this.feet.x, ctx.player.feet.x, this.body.w);
      this.facePlayer(ctx);
    }
    if (pattern.kind === 'dive') {
      this.body.x = diveLandingX(ctx.arena, ctx.player.feet.x, this.facing, this.body.w);
      this.facePlayer(ctx);
    }
    if (pattern.speed) {
      this.body.vx = this.facing * pattern.speed * this.phase.speedScale;
    }
    if (pattern.activeSfx) {
      this.eventBuffer.push({
        type: 'attack',
        patternId: pattern.id,
        sfx: pattern.activeSfx,
      });
    }
    launchPatternStart(pattern, ctx, this.feet, this.facing, this.rng);
  }

  private tickActive(ctx: EnemyContext): void {
    const pattern = this.pattern;
    if (!pattern) {
      this.beginIdle();
      return;
    }
    this.patterns.advanceActive();
    if (this.patterns.canFire(pattern)) {
      launchRainVolley(pattern, ctx, this.rng);
      this.patterns.recordShot();
    }
    if (pattern.speed) {
      this.body.vx = this.facing * pattern.speed * this.phase.speedScale;
    }
    if (this.stateTicks <= 0) this.beginRecover();
  }

  private choosePattern(ctx: EnemyContext): BossPatternDef {
    const distance = Math.abs(ctx.player.feet.x - this.feet.x);
    return this.patterns.choose(this.phase, this.rng, distance);
  }

  private beginPattern(pattern: BossPatternDef): void {
    this.patterns.begin(pattern);
    this.hiddenValue = false;
    this.body.vx = 0;
    this.beginState('windup', this.scaled(pattern.telegraphTicks), 'windup');
    this.eventBuffer.push({ type: 'tell', patternId: pattern.id, sfx: pattern.tellSfx });
  }

  private beginIdle(): void {
    this.patterns.clear();
    this.hiddenValue = false;
    this.body.vx = 0;
    this.beginState(
      'idle',
      this.scaled(this.rng.int(this.phase.idleTicks[0], this.phase.idleTicks[1])),
      'idle',
    );
  }

  private beginRecover(): void {
    this.body.vx = 0;
    this.beginState('recover', this.scaled(this.pattern?.recoverTicks ?? 20), 'idle');
  }

  private checkPhase(): void {
    const ratio = this.hp / this.maxHp;
    while (this.phaseIndexValue < this.definition.phases.length - 1) {
      const next = this.definition.phases[this.phaseIndexValue + 1];
      if (!next || ratio > next.threshold) return;
      this.phaseIndexValue += 1;
      this.patterns.clear();
      this.hiddenValue = false;
      this.body.vx = 0;
      this.beginState('phase', this.scaled(next.transitionTicks), 'hurt');
      this.eventBuffer.push({ type: 'phase', phase: this.phaseIndexValue, name: next.name });
      return;
    }
  }

  private breakWard(): void {
    this.wardedValue = false;
    this.phaseIndexValue = Math.min(1, this.definition.phases.length - 1);
    this.patterns.clear();
    this.hiddenValue = false;
    this.body.vx = 0;
    const feet = this.feet;
    this.eventBuffer.push({ type: 'wardBreak', x: feet.x, y: feet.y - 30 });
    this.eventBuffer.push({ type: 'phase', phase: this.phaseIndexValue, name: this.phase.name });
    this.beginState('stagger', this.definition.wardBreakStunTicks ?? 45, 'hurt');
  }

  private defeat(): void {
    this.hp = 0;
    this.wardedValue = false;
    this.hiddenValue = false;
    this.stateValue = 'dead';
    this.stateTicks = 0;
    this.body.vx = 0;
    this.body.vy = 0;
    this.eventBuffer.push({ type: 'defeated', kind: this.kind as BossKind });
  }

  private findPattern(id: string): BossPatternDef | null {
    return BOSS_PATTERNS[id] ?? null;
  }

  private scaled(ticks: number): number {
    return Math.max(1, Math.round(ticks * this.tempoScale));
  }
}
