import { PLAYER } from '../config/player';
import { SIM } from '../config/world';
import type { Rect, Vec2 } from '../core/Types';
import type { InputSnapshot } from '../input/InputState';
import { createBody, type Body } from '../physics/Body';
import { moveAndCollide, type MoveResult } from '../physics/TileCollision';
import type { Tilemap } from '../world/Tilemap';
import { PlayerCombat, type CombatHost } from './PlayerCombat';
import { PlayerDash, type DashHost } from './PlayerDash';
import { PlayerJump, type JumpHost } from './PlayerJump';
import { applyGravity, stepRun } from './playerMotion';
import { PlayerPose } from './PlayerPose';
import { PlayerReaction, type ReactionHost } from './PlayerReaction';
import { inputDirection } from './playerSensors';
import type { PlayerEvent, PlayerStateName } from './PlayerTypes';
import { PlayerVitals } from './PlayerVitals';

export type { PlayerEvent, PlayerStateName } from './PlayerTypes';

/**
 * The player's locomotion state machine. Pure simulation: no Pixi, no DOM, no wall clock.
 * Every rule reads `PLAYER` constants, so the controller is fully testable by stepping it
 * with synthetic input snapshots and asserting positions, velocities and clip names.
 *
 * The forgiveness budget (all configurable) is what makes the movement feel fair:
 * jump buffering, coyote time, ceiling corner correction, apex float, an attack buffer,
 * and a deliberate drop-through for one-way platforms.
 */
export class PlayerController {
  readonly body: Body;
  /** Health, invulnerability and death live in their own small component. */
  readonly vitals: PlayerVitals;
  private readonly pose = new PlayerPose();
  private readonly combat = new PlayerCombat();
  private readonly jump = new PlayerJump();
  private readonly dash = new PlayerDash();
  private readonly reaction = new PlayerReaction();
  private facingValue: -1 | 1 = 1;
  private jumpPeakYValue: number | null = null;
  private lastJumpPeakYValue: number | null = null;
  private footstepCounter = 0;

  constructor(spawn: Vec2, options: { maxHp?: number; hp?: number } = {}) {
    this.body = createBody(
      spawn.x - PLAYER.size.w / 2,
      spawn.y - PLAYER.size.h,
      PLAYER.size.w,
      PLAYER.size.h,
    );
    this.vitals = new PlayerVitals(options.maxHp, options.hp);
  }

  get facing(): -1 | 1 {
    return this.facingValue;
  }

  get state(): PlayerStateName {
    return this.pose.state;
  }

  /** Active animation clip name (a key in the hero's animation set). */
  get animation(): string {
    return this.pose.animation;
  }

  /** Ticks since the current clip started. */
  get clipTick(): number {
    return this.pose.clipTick;
  }

  /** True on the tick a new clip started, so the view can restart one-shots. */
  get restarted(): boolean {
    return this.pose.restarted;
  }

  /**
   * What the simulation did on the most recent tick, in order. The buffer is cleared
   * at the start of every update() and stays valid until the next one.
   */
  get events(): readonly PlayerEvent[] {
    return this.pose.events;
  }

  get grounded(): boolean {
    return this.body.grounded;
  }

  /**
   * Feet Y at the highest point of the airtime in progress, or null while grounded.
   * A trace only starts on upward motion, so settling into the floor at spawn is not
   * mistaken for a jump.
   */
  get jumpPeakY(): number | null {
    return this.jumpPeakYValue;
  }

  /** Feet Y at the apex of the last completed jump; null until the first one lands. */
  get lastJumpPeakY(): number | null {
    return this.lastJumpPeakYValue;
  }

  get dashCooldown(): number {
    return this.dash.cooldownTicks;
  }

  /** Current health (0 when dead). */
  get hp(): number {
    return this.vitals.hp;
  }

  get maxHp(): number {
    return this.vitals.maxHp;
  }

  /** Boss reward: permanently (for this run) raises the mask ceiling. */
  grantMaxHp(amount: number): void {
    this.vitals.grantMaxHp(amount);
  }

  /** Remaining invulnerability ticks. */
  get invulnerableTicks(): number {
    return this.vitals.invulnerableTicks;
  }

  get dead(): boolean {
    return this.vitals.dead;
  }

  /** Ticks since death; the scene fades and resets on this clock. */
  get deathElapsed(): number {
    return this.reaction.deathElapsed;
  }

  /**
   * Identifies the current swing. Combat uses it so one swing can damage an enemy only
   * once, even while the active window spans several ticks.
   */
  get attackId(): number {
    return this.combat.attackId;
  }

  /** Feet-center in world pixels: the view anchor and camera focus. */
  get feet(): Vec2 {
    return { x: this.body.x + this.body.w / 2, y: this.body.y + this.body.h };
  }

  /** True while a swing's damage window is open. */
  get attackActive(): boolean {
    return this.combat.isActive(this.pose.state, this.pose.clipTick);
  }

  /** The swing's world-space damage box, or null when the window is closed. */
  attackHitbox(): Rect | null {
    return this.combat.attackHitbox(
      this.feet,
      this.facingValue,
      this.pose.state,
      this.pose.clipTick,
    );
  }

  /** Damage of the swing currently landing (0 when no window is open). */
  get attackDamage(): number {
    return this.combat.attackDamage(this.pose.state, this.pose.clipTick);
  }

  /**
   * Applies a hit from the world. Returns false when it was ignored (dead or in
   * invulnerability frames). The reaction is a short loss of control, knockback away
   * from the source, and a face-the-attacker turn so the hit reads.
   */
  takeDamage(amount: number, sourceX: number): boolean {
    return this.reaction.takeDamage(this.reactionHost, amount, sourceX);
  }

  /** DEV-only: extend i-frames for deterministic state-machine probes. */
  debugProtect(ticks: number): void {
    this.vitals.debugProtect(ticks);
  }

  /** Advances one fixed tick. */
  update(input: InputSnapshot, tilemap: Tilemap): void {
    this.pose.beginTick();
    this.vitals.tick();

    if (this.state === 'dead') {
      this.reaction.stepDead(this.reactionHost, tilemap, this.jump.heldButton);
      this.trackJumpPeak();
      return;
    }
    if (this.reaction.hurt) {
      this.reaction.stepHurt(this.reactionHost, tilemap, this.jump.heldButton);
      this.trackJumpPeak();
      return;
    }

    this.tickTimers(input);

    const wasGrounded = this.body.grounded;

    if (this.dash.tryStart(this.dashHost, input)) {
      // The dash owns the tick.
    } else if (!this.combat.tryStart(this.combatHost)) {
      this.jump.tryStart(input, tilemap, this.jumpHost);
    }

    if (this.state === 'dash') {
      this.dash.hold(this.dashHost);
    } else if (this.state === 'attack') {
      this.combat.step(this.combatHost, input);
      applyGravity(this.body, this.jump.heldButton);
    } else {
      this.stepMove(input);
      applyGravity(this.body, this.jump.heldButton);
    }

    // The speed the fall carries into this tick's collision. Sampled before the
    // collision resolves, because that is where a landing's weight is decided.
    const impactSpeed = this.body.vy;
    const move = moveAndCollide(tilemap, this.body, SIM.dt);
    this.finalizeState(input, move, wasGrounded, impactSpeed);
    this.trackJumpPeak();
  }

  private get combatHost(): CombatHost {
    return {
      body: this.body,
      pose: this.pose,
      facing: this.facingValue,
      grounded: this.body.grounded,
      direction: inputDirection,
    };
  }

  private get dashHost(): DashHost {
    return {
      body: this.body,
      pose: this.pose,
      facing: this.facingValue,
      setFacing: (direction) => {
        this.facingValue = direction;
      },
    };
  }

  private get jumpHost(): JumpHost {
    return { body: this.body, pose: this.pose };
  }

  private get reactionHost(): ReactionHost {
    return {
      body: this.body,
      pose: this.pose,
      vitals: this.vitals,
      feet: this.feet,
      facing: this.facingValue,
      setFacing: (direction) => {
        this.facingValue = direction;
      },
    };
  }

  /**
   * Records the apex of the current jump for the debug snapshot. This runs after
   * collision so it uses the resolved position, and is simulation-driven: a render
   * stall can skip frames, but it can never skip a tick of the arc.
   */
  private trackJumpPeak(): void {
    if (!this.body.grounded) {
      if (this.body.vy < 0) {
        const feetY = this.feet.y;
        this.jumpPeakYValue =
          this.jumpPeakYValue === null ? feetY : Math.min(this.jumpPeakYValue, feetY);
      }
      return;
    }
    if (this.jumpPeakYValue !== null) {
      this.lastJumpPeakYValue = this.jumpPeakYValue;
      this.jumpPeakYValue = null;
    }
  }

  /** Ticks down every timer and latches pressed edges into buffers. */
  private tickTimers(input: InputSnapshot): void {
    this.dash.tick();
    this.combat.tick(input);
    this.jump.tick(input, this.body.grounded);
    this.pose.tickClip();
  }

  private stepMove(input: InputSnapshot): void {
    const dir = inputDirection(input);
    if (dir !== 0) this.facingValue = dir;
    stepRun(this.body, dir, this.body.grounded);
  }

  /**
   * Resolves state and clip after the physics step, from the ground truth of collision.
   * This is also the one place momentary events are emitted, so their order (landing
   * first, then a skid, then footfalls) is fixed and testable.
   */
  private finalizeState(
    input: InputSnapshot,
    move: MoveResult,
    wasGrounded: boolean,
    impactSpeed: number,
  ): void {
    if (!wasGrounded && this.body.grounded) {
      // Touchdown is graded by the speed the fall carried into it: a step off a ledge
      // is silent, a full jump thuds, a long drop lands heavy.
      if (impactSpeed >= PLAYER.landHeavySoundSpeed) this.pose.emit('landHeavy');
      else if (impactSpeed >= PLAYER.landSoundSpeed) this.pose.emit('land');
      this.footstepCounter = PLAYER.firstFootstepTicks;
    }

    if (this.dash.finalize(this.dashHost, move)) return;

    if (this.state === 'attack') return;

    if (!this.body.grounded) {
      if (this.body.vy < 0) this.pose.setState('jump', 'jump');
      else this.pose.setState('fall', 'fall');
      return;
    }

    const dir = inputDirection(input);
    const speed = Math.abs(this.body.vx);
    if (dir !== 0 && speed > PLAYER.skidMinSpeed && this.body.vx * dir < 0) {
      if (this.state !== 'skid') this.pose.emit('skid');
      this.pose.setState('skid', 'turn');
      return;
    }
    if (speed > PLAYER.idleSpeed) this.pose.setState('run', 'run');
    else this.pose.setState('idle', 'idle');
    this.stepFootsteps();
  }

  /** Emits a footfall every PLAYER.footstepTicks while the hero runs on the ground. */
  private stepFootsteps(): void {
    const running =
      this.body.grounded && this.state === 'run' && Math.abs(this.body.vx) > PLAYER.skidMinSpeed;
    if (!running) {
      this.footstepCounter = PLAYER.firstFootstepTicks;
      return;
    }
    this.footstepCounter -= 1;
    if (this.footstepCounter > 0) return;
    this.footstepCounter = PLAYER.footstepTicks;
    this.pose.emit('footstep');
  }
}
