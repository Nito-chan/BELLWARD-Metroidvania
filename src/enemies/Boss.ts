import { BOSSES, BOSS_PATTERNS } from '../config/bosses';
import {
  BOSS_FAIRNESS,
  type BossDef,
  type BossPatternDef,
  type BossPhaseDef,
} from '../config/bossTypes';
import type { BossKind } from '../config/enemies';
import { ORDEAL } from '../config/progression';
import { RESONANCE } from '../config/weapons';
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
import { Enemy, type EnemyContext, type EnemyHazard, type PostureResult } from './Enemy';

/** A Toll wave passing through a world position, used for Last Keeper chains and answers. */
export type TollWaveAt = { readonly x: number; readonly y: number };

/** The final phase's public ritual cadence. */
export type RitualStage = 'kneel' | 'ring' | 'window' | 'recover';

/** A miss sends a ground shockwave; it telegraphs before it can hit. */
export type ShockwaveStage = 'none' | 'telegraph' | 'active';

/** Last Keeper mechanic tuning. */
const LAST_KEEPER = {
  /** Radius (px) within which a Toll wave opens a chain. */
  chainRadius: 40,
  /** Ticks the Censer has to break a chain after Toll opens it. */
  chainWindowTicks: 60,
  /** Radius (px) within which a Toll wave answers the great bell. */
  bellRadius: 40,
  /** Quiet beat before the Keeper rings the next note. */
  kneelTicks: 60,
  /** Ticks for the ring to travel from the bell to the answer circle. */
  ringTicks: 30,
  /** Ticks the player has to answer a boss ring. */
  answerWindowTicks: 24,
  /** Closed beat after a note resolves, before the next kneel. */
  recoverTicks: 36,
  /** A missed note charges this long before the shockwave becomes dangerous. */
  shockwaveTelegraphTicks: 30,
  /** Active hitbox lifetime; long enough to catch a late jump, short enough to dash clear. */
  shockwaveActiveTicks: 12,
  shockwaveDamage: 1,
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
  /** The current beat of the final ritual. */
  private ritualStageValue: RitualStage = 'kneel';
  /** Ticks left in the current ritual beat. */
  private ritualTicksValue = 0;
  /** One Toll wave may answer at most one note. */
  private readonly answeredWaveIds = new Set<number>();
  /** All three answers given; the ritual is solved. */
  private ritualSolvedValue = false;
  /** Ground shockwave spawned by a missed note. */
  private shockwaveStageValue: ShockwaveStage = 'none';
  private shockwaveTicksValue = 0;
  private shockwaveIdValue = 0;
  private arenaValue: Rect | null = null;
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

  /**
   * The Last Keeper's final phase is a ritual, not a damage race. Health and posture are
   * sealed until the three Toll answers are given, and no normal pattern may start.
   */
  get ritualActive(): boolean {
    return this.lastKeeperModeValue && this.phaseIndexValue === 2;
  }

  /** Chains broken in phase 2 (0..3). */
  get chainCount(): number {
    return this.chainCountValue;
  }

  /** A chain is open and waiting for a Censer hit. */
  get chainOpen(): boolean {
    return this.chainOpenValue;
  }

  /** Ticks remaining in the current Censer chain window. */
  get chainWindowTicks(): number {
    return this.chainWindowTicksValue;
  }

  /** Authored Censer response window, for HUD and ring countdowns. */
  get chainWindowTotal(): number {
    return LAST_KEEPER.chainWindowTicks;
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

  /** The current beat of the final ritual. */
  get ritualStage(): RitualStage {
    return this.ritualStageValue;
  }

  /** Ticks left in the current ritual beat (the window timer during `window`). */
  get ritualStageTicks(): number {
    return this.ritualTicksValue;
  }

  /** A boss ring is open and waiting for a Toll answer. */
  get answerWindow(): boolean {
    return this.ritualStageValue === 'window';
  }

  /** Ticks remaining in the current answer window (0 outside it). */
  get answerWindowTicks(): number {
    return this.answerWindow ? this.ritualTicksValue : 0;
  }

  /** Authored answer window, for HUD and ring countdowns. */
  get answerWindowTotal(): number {
    return LAST_KEEPER.answerWindowTicks;
  }

  /** Authored travel time for a boss ring before the answer window opens. */
  get ritualRingTotal(): number {
    return LAST_KEEPER.ringTicks;
  }

  /** All three answers given; the ritual is solved. */
  get ritualSolved(): boolean {
    return this.ritualSolvedValue;
  }

  /** Current shockwave beat, used by the view and HUD. */
  get shockwaveStage(): ShockwaveStage {
    return this.shockwaveStageValue;
  }

  /** Ticks left in the current shockwave beat. */
  get shockwaveTicks(): number {
    return this.shockwaveTicksValue;
  }

  /** The floor box the shockwave will sweep; present for both telegraph and active. */
  get shockwaveBox(): Rect | null {
    if (this.shockwaveStageValue === 'none' || !this.arenaValue) return null;
    return {
      x: this.arenaValue.x,
      y: this.feet.y - 20,
      w: this.arenaValue.w,
      h: 20,
    };
  }

  /** 0..1 during the telegraph, then held at 1 while active. */
  get shockwaveProgress(): number {
    if (this.shockwaveStageValue === 'none') return 0;
    if (this.shockwaveStageValue === 'active') return 1;
    return clamp(1 - this.shockwaveTicksValue / LAST_KEEPER.shockwaveTelegraphTicks, 0, 1);
  }

  /** Test/UI contract for the authored durations. */
  get shockwaveTiming(): {
    readonly telegraphTicks: number;
    readonly activeTicks: number;
  } {
    return {
      telegraphTicks: LAST_KEEPER.shockwaveTelegraphTicks,
      activeTicks: LAST_KEEPER.shockwaveActiveTicks,
    };
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
      this.ritualActive ||
      // The Drowning Toll is a chain puzzle: its health is sealed at 1 on entry.
      (this.lastKeeperModeValue && this.phaseIndexValue === 1) ||
      this.stateValue === 'intro' ||
      this.stateValue === 'phase' ||
      this.stateValue === 'ritual'
    );
  }

  override activeHazard(): EnemyHazard | null {
    if (!this.alive || !this.ritualActive || this.shockwaveStageValue !== 'active') return null;
    const box = this.shockwaveBox;
    if (!box) return null;
    return {
      id: this.shockwaveIdValue,
      box,
      damage: LAST_KEEPER.shockwaveDamage,
      unblockable: true,
      sourceX: this.greatBellValue?.x ?? this.feet.x,
    };
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

  /**
   * A Toll wave is the designed way to stagger the Drowning Toll. Its body is sealed,
   * so the wave deals no health damage, but its resonance and posture still land.
   */
  override onBlockedWave(posture: number): void {
    if (!this.lastKeeperModeValue || this.phaseIndexValue !== 1 || !this.alive) return;
    this.markResonance(RESONANCE.ticks);
    this.applyPosture(posture);
  }

  override takeDamage(amount: number, _sourceX: number): boolean {
    if (!this.alive) return false;
    if (this.damageBlocked) {
      if (this.wardedValue) this.wardFlashTicks = 8;
      return false;
    }
    const applied = Math.max(0, Math.floor(amount));
    if (applied === 0) return false;

    // Defensive guard for direct calls: phase 2 is solved by chains, never by damage.
    if (this.lastKeeperModeValue && this.phaseIndexValue === 1) return false;

    this.hp = Math.max(0, this.hp - applied);
    this.flashTicks = 4;
    if (this.hp <= 0) {
      this.defeat();
      return true;
    }
    this.checkPhase();
    return true;
  }

  override takePostureDamage(amount: number, sourceX: number): PostureResult {
    if (this.ritualActive) return 'none';
    return super.takePostureDamage(amount, sourceX);
  }

  override applyPosture(amount: number): PostureResult {
    if (this.ritualActive) return 'none';
    return super.applyPosture(amount);
  }

  /** Break the bell shield immediately. Used by a wall charge and by E2E cheats. */
  forceBreakWard(): boolean {
    if (!this.wardedValue) return false;
    this.breakWard();
    return true;
  }

  /** Test/debug hook: start a specific pattern with its authored telegraph. */
  debugForcePattern(id: string): void {
    if (this.ritualActive) return;
    const pattern = this.findPattern(id);
    if (!pattern) return;
    this.beginPattern(pattern);
  }

  /** Test/debug hook: skip the fight without passing through phase gates. */
  debugDefeat(): void {
    if (this.alive) this.defeat();
  }

  /** Test hook: force an answer window open once the final ritual has begun. */
  debugForceAnswerWindow(): void {
    if (!this.ritualActive || this.stateValue !== 'ritual') return;
    this.ritualStageValue = 'window';
    this.ritualTicksValue = LAST_KEEPER.answerWindowTicks;
  }

  /** DEV-only: set the flood step for visual and input probes. */
  debugSetWaterLevel(level: number): boolean {
    if (!this.lastKeeperModeValue || !this.alive || this.phaseIndexValue < 1) return false;
    this.waterLevelValue = Math.max(0, Math.min(3, Math.floor(level)));
    return true;
  }

  /** DEV-only: skip to a settled phase 3 ritual for browser final-act coverage. */
  debugEnterRitual(): boolean {
    if (!this.lastKeeperModeValue) return false;
    this.phaseIndexValue = 2;
    // Mirror a real phase-2 clear so the debug ritual shows the authored final flood.
    this.hp = 1;
    this.waterLevelValue = 3;
    this.patterns.clear();
    this.hiddenValue = false;
    this.wardedValue = false;
    this.body.vx = 0;
    this.beginState('ritual', 0, 'idle');
    this.startRitualStage('kneel');
    this.eventBuffer.push({ type: 'phase', phase: 2, name: this.phase.name });
    return true;
  }

  /** DEV-only: mark the ritual solved and run the real defeat path for the final bell. */
  debugSolveRitual(): boolean {
    if (!this.lastKeeperModeValue) return false;
    if (!this.ritualActive) this.debugEnterRitual();
    this.answerCountValue = 3;
    this.ritualSolvedValue = true;
    this.ritualStageValue = 'recover';
    this.ritualTicksValue = 0;
    this.defeat();
    return true;
  }

  /**
   * Called by the room scene when a Toll wave passes through this position.
   * `waveId` is the projectile's spawn identity: one wave can answer at most one note.
   */
  tollAt(x: number, y: number, waveId: number): void {
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
      return;
    }

    if (
      this.phaseIndexValue !== 2 ||
      this.stateValue !== 'ritual' ||
      !this.answerWindow ||
      this.answeredWaveIds.has(waveId)
    ) {
      return;
    }

    const bell = this.greatBellValue;
    if (!bell || Math.hypot(x - bell.x, y - bell.y) >= LAST_KEEPER.bellRadius) return;

    // Correct answer: one wave spends its note, closes the window, and lights a pip.
    this.answeredWaveIds.add(waveId);
    this.answerCountValue += 1;
    this.eventBuffer.push({
      type: 'answer',
      count: this.answerCountValue,
      total: 3,
      x: bell.x,
      y: bell.y,
    });
    if (this.answerCountValue >= 3) {
      this.ritualSolvedValue = true;
      this.ritualStageValue = 'recover';
      this.ritualTicksValue = 0;
      this.defeat();
      return;
    }
    this.startRitualStage('recover');
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
    this.hp = 1;
    this.waterLevelValue = 3;
    this.patterns.clear();
    this.body.vx = 0;
    this.beginState('phase', this.scaled(this.phase.transitionTicks), 'hurt');
    this.eventBuffer.push({ type: 'phase', phase: 2, name: 'The Answer' });
  }

  /** Process a Toll wave at a world position each tick. Called by the room scene. */
  processTollWave(x: number, y: number, waveId: number): void {
    this.tollAt(x, y, waveId);
  }

  consumeEvents(): BossEvent[] {
    return this.eventBuffer.splice(0, this.eventBuffer.length);
  }

  override update(ctx: EnemyContext): void {
    if (!this.alive) {
      this.deathElapsedValue += 1;
      return;
    }
    this.arenaValue = ctx.arena ?? this.arenaValue;
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
      // Advance an existing shockwave before the cadence so a miss' new telegraph gets
      // its full wind-up instead of losing a tick on the frame it spawns.
      if (this.shockwaveStageValue !== 'none') this.tickShockwave();
      // Phase 3 runs its own kneel -> ring -> window -> recover cadence. It never
      // chooses a pattern, and the cadence only starts after the transition settles.
      if (this.ritualActive && this.stateValue === 'ritual') {
        this.tickRitual();
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
        if (this.stateTicks <= 0) {
          // The Last Keeper's phase transition ends in a terminal ritual, never idle.
          if (this.ritualActive) this.beginRitual();
          else this.beginIdle();
        }
        return;
      case 'ritual':
        this.body.vx = 0;
        this.facePlayer(ctx);
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
    if (this.ritualActive) {
      this.beginRitual();
      return;
    }
    this.patterns.clear();
    this.hiddenValue = false;
    this.body.vx = 0;
    this.beginState(
      'idle',
      this.scaled(this.rng.int(this.phase.idleTicks[0], this.phase.idleTicks[1])),
      'idle',
    );
  }

  /** Terminal phase 3 state: the Keeper holds the bell and waits for Toll answers. */
  private beginRitual(): void {
    this.patterns.clear();
    this.hiddenValue = false;
    this.body.vx = 0;
    this.beginState('ritual', 0, 'idle');
    this.startRitualStage('kneel');
    this.eventBuffer.push({
      type: 'tell',
      patternId: 'ritual.begin',
      sfx: 'bossPhase',
      x: this.greatBellValue?.x ?? this.feet.x,
      y: this.greatBellValue?.y ?? this.feet.y,
    });
  }

  /** One tick of the final cadence. Windows only exist after the transition. */
  private tickRitual(): void {
    if (this.ritualSolvedValue) return;
    this.ritualTicksValue -= 1;
    if (this.ritualTicksValue > 0) return;

    switch (this.ritualStageValue) {
      case 'kneel': {
        this.startRitualStage('ring');
        const bell = this.greatBellValue;
        this.eventBuffer.push({
          type: 'tell',
          patternId: 'ritual.ring',
          sfx: 'bossBell',
          x: bell?.x ?? this.feet.x,
          y: bell?.y ?? this.feet.y,
        });
        return;
      }
      case 'ring': {
        this.startRitualStage('window');
        const bell = this.greatBellValue;
        this.eventBuffer.push({
          type: 'tell',
          patternId: 'answer.open',
          sfx: 'bossBell',
          x: bell?.x ?? this.feet.x,
          y: bell?.y ?? this.feet.y,
        });
        return;
      }
      case 'window':
        // The window closed unanswered: retry the note and send a real hazard.
        this.missNote();
        return;
      case 'recover':
        this.startRitualStage('kneel');
        return;
    }
  }

  private startRitualStage(stage: RitualStage): void {
    this.ritualStageValue = stage;
    switch (stage) {
      case 'kneel':
        this.ritualTicksValue = LAST_KEEPER.kneelTicks;
        return;
      case 'ring':
        this.ritualTicksValue = LAST_KEEPER.ringTicks;
        return;
      case 'window':
        this.ritualTicksValue = LAST_KEEPER.answerWindowTicks;
        return;
      case 'recover':
        this.ritualTicksValue = LAST_KEEPER.recoverTicks;
        return;
    }
  }

  private missNote(): void {
    this.startRitualStage('recover');
    this.beginShockwave();
    this.eventBuffer.push({
      type: 'miss',
      x: this.greatBellValue?.x ?? this.feet.x,
      y: this.greatBellValue?.y ?? this.feet.y,
    });
  }

  private beginShockwave(): void {
    this.shockwaveStageValue = 'telegraph';
    this.shockwaveTicksValue = LAST_KEEPER.shockwaveTelegraphTicks;
    const box = this.shockwaveBox;
    if (!box) return;
    this.eventBuffer.push({
      type: 'shockwave',
      x: box.x,
      y: box.y,
      w: box.w,
      h: box.h,
      windupTicks: LAST_KEEPER.shockwaveTelegraphTicks,
      activeTicks: LAST_KEEPER.shockwaveActiveTicks,
    });
  }

  private tickShockwave(): void {
    this.shockwaveTicksValue -= 1;
    if (this.shockwaveTicksValue > 0) return;
    if (this.shockwaveStageValue === 'telegraph') {
      this.shockwaveStageValue = 'active';
      this.shockwaveTicksValue = LAST_KEEPER.shockwaveActiveTicks;
      this.shockwaveIdValue += 1;
      return;
    }
    this.shockwaveStageValue = 'none';
    this.shockwaveTicksValue = 0;
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
      if (this.lastKeeperModeValue && this.phaseIndexValue === 1) {
        // The Drowning Toll's health is sealed at 1; the three chains end the phase.
        this.hp = 1;
        this.waterLevelValue = 0;
      }
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
