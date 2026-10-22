import { COMBAT } from '../config/combat';
import { PLAYER } from '../config/player';
import { NAIL, type CharmId } from '../config/progression';
import { SIM } from '../config/world';
import type { Rect, Vec2 } from '../core/Types';
import type { InputSnapshot } from '../input/InputState';
import { createBody, type Body } from '../physics/Body';
import { moveAndCollide, type MoveResult } from '../physics/TileCollision';
import type { Tilemap } from '../world/Tilemap';
import { PlayerCombat, type CombatHost } from './PlayerCombat';
import { PlayerDash, type DashHost } from './PlayerDash';
import { PlayerFocus } from './PlayerFocus';
import { PlayerGuard, type GuardHost, type IncomingOutcome } from './PlayerGuard';
import { PlayerHealing, type HealHost } from './PlayerHealing';
import { PlayerJump, type JumpHost } from './PlayerJump';
import { hasCharm, STARTER_LOADOUT, type PlayerLoadout } from './PlayerLoadout';
import { applyGravity, stepRun } from './playerMotion';
import { PlayerPose } from './PlayerPose';
import { PlayerReaction, type ReactionHost } from './PlayerReaction';
import { inputDirection } from './playerSensors';
import type { PlayerEvent, PlayerStateName } from './PlayerTypes';
import { PlayerVitals } from './PlayerVitals';
import { PlayerWall, type WallHost } from './PlayerWall';

export type { PlayerEvent, PlayerStateName } from './PlayerTypes';

export type PlayerOptions = {
  maxHp?: number;
  hp?: number;
  maxFocus?: number;
  focus?: number;
  loadout?: PlayerLoadout;
};

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
  readonly focus: PlayerFocus;
  private readonly combat = new PlayerCombat();
  private readonly jump = new PlayerJump();
  private readonly dash = new PlayerDash();
  private readonly guard = new PlayerGuard();
  private readonly reaction = new PlayerReaction();
  private readonly healing = new PlayerHealing();
  private readonly wall = new PlayerWall();
  private loadoutValue: PlayerLoadout = STARTER_LOADOUT;
  private facingValue: -1 | 1 = 1;
  private jumpPeakYValue: number | null = null;
  private lastJumpPeakYValue: number | null = null;
  private footstepCounter = 0;

  constructor(spawn: Vec2, options: PlayerOptions = {}) {
    this.body = createBody(
      spawn.x - PLAYER.size.w / 2,
      spawn.y - PLAYER.size.h,
      PLAYER.size.w,
      PLAYER.size.h,
    );
    this.vitals = new PlayerVitals(options.maxHp, options.hp);
    this.focus = new PlayerFocus(options.maxFocus ?? PLAYER.focus.max);
    this.focus.gain(options.focus ?? 0);
    this.applyLoadout(options.loadout ?? STARTER_LOADOUT);
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

  /** Focus bar value and ceiling for the HUD. */
  get focusValue(): number {
    return this.focus.current;
  }

  get maxFocus(): number {
    return this.focus.max;
  }

  /** 0..1 heal channel fill, or 0 when idle. */
  get healProgress(): number {
    return this.healing.progress;
  }

  /** True while the Keeper's Guard is braced. */
  get guarding(): boolean {
    return this.guard.active;
  }

  /** Player posture for the HUD. */
  get posture(): number {
    return this.guard.posture;
  }

  get maxPosture(): number {
    return this.guard.maxPosture;
  }

  /** True while the guard has shattered and control is lost. */
  get guardBroken(): boolean {
    return this.guard.broken;
  }

  /** True while a perfect parry has opened a Hook Counter. */
  get counterReady(): boolean {
    return this.guard.counterReady;
  }

  /** True during the opening beats where a hit becomes a perfect parry. */
  get perfectParryWindow(): boolean {
    return this.guard.perfectWindow;
  }

  get wallContact(): -1 | 0 | 1 {
    return this.wall.contact;
  }

  get wallSliding(): boolean {
    return this.wall.sliding;
  }

  get loadout(): PlayerLoadout {
    return this.loadoutValue;
  }

  get nailLevel(): number {
    return this.loadoutValue.nailLevel;
  }

  /** Applies a new charm/nail/ability snapshot mid-run (bench, pickup, debug). */
  applyLoadout(loadout: PlayerLoadout): void {
    this.loadoutValue = {
      charms: [...loadout.charms],
      nailLevel: Math.max(0, Math.min(NAIL.maxLevel, Math.floor(loadout.nailLevel))),
      wallClaw: loadout.wallClaw,
    };
    const nailBonus = this.loadoutValue.nailLevel * NAIL.damagePerLevel;
    const nailReach = this.loadoutValue.nailLevel * NAIL.reachPerLevel;
    const charmReach = hasCharm(this.loadoutValue, 'longReach')
      ? COMBAT.player.attackBox.width / 3
      : 0;
    const reachScale =
      (COMBAT.player.attackBox.width + nailReach + charmReach) / COMBAT.player.attackBox.width;
    this.combat.setModifiers(nailBonus, reachScale);
    this.dash.setCooldownScale(hasCharm(this.loadoutValue, 'lightStep') ? 0.5 : 1);
    const healTicks = hasCharm(this.loadoutValue, 'quickMend')
      ? PLAYER.heal.ticks * PLAYER.heal.quickMendScale
      : PLAYER.heal.ticks;
    this.healing.setDuration(Math.round(healTicks));
    this.healing.setSturdyShell(hasCharm(this.loadoutValue, 'sturdyShell'));
    this.wall.setEnabled(this.loadoutValue.wallClaw);
  }

  /** Boss or mask-shard reward: permanently (for this run) raises the mask ceiling. */
  grantMaxHp(amount: number): void {
    this.vitals.grantMaxHp(amount);
  }

  /** Restores health from a pickup or bench. Returns masks actually restored. */
  heal(amount: number): number {
    return this.vitals.heal(amount);
  }

  /** Focus gathered by a landed nail hit, with Ember Greed applied. */
  gainFocusOnHit(): void {
    const scale = hasCharm(this.loadoutValue, 'emberGreed') ? 1.5 : 1;
    this.focus.gain(Math.round(PLAYER.focus.gainPerHit * scale));
  }

  hasCharm(id: CharmId): boolean {
    return hasCharm(this.loadoutValue, id);
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

  /** Extra damage this swing carries from a perfect parry. */
  get attackCounterBonus(): number {
    return this.combat.attackCounterBonus;
  }

  /** Posture damage this swing applies, including any counter bonus. */
  get attackPostureDamage(): number {
    return this.combat.attackPostureDamage;
  }

  /**
   * Applies a hit from the world. Returns false when it was ignored (dead or in
   * invulnerability frames). The reaction is a short loss of control, knockback away
   * from the source, and a face-the-attacker turn so the hit reads.
   */
  takeDamage(amount: number, sourceX: number): boolean {
    if (!this.vitals.canBeHit) return false;
    if (this.healing.healing && this.healing.absorbHit(this.healHost)) {
      this.vitals.grantInvulnerability(PLAYER.heal.shieldInvulnerableTicks);
      return false;
    }
    return this.reaction.takeDamage(this.reactionHost, amount, sourceX);
  }

  /**
   * Runs an enemy strike through the guard before health is touched. A shattered guard
   * costs a mask through the normal reaction path; every other outcome is the caller's
   * to resolve.
   */
  resolveIncoming(_damage: number, sourceX: number, unblockable: boolean): IncomingOutcome {
    const outcome = this.guard.resolveIncoming(this.guardHost, sourceX, unblockable);
    if (outcome === 'broken') {
      this.takeDamage(COMBAT.guard.breakDamage, sourceX);
    }
    return outcome;
  }

  /** DEV-only: extend i-frames for deterministic state-machine probes. */
  debugProtect(ticks: number): void {
    this.vitals.debugProtect(ticks);
  }

  /** Advances one fixed tick. */
  update(input: InputSnapshot, tilemap: Tilemap): void {
    this.pose.beginTick();
    this.vitals.tick();
    this.wall.tick();

    if (this.state === 'dead') {
      this.healing.cancel();
      this.guard.cancel();
      this.reaction.stepDead(this.reactionHost, tilemap, this.jump.heldButton);
      this.trackJumpPeak();
      return;
    }
    if (this.reaction.hurt) {
      this.healing.cancel();
      this.guard.cancel();
      this.reaction.stepHurt(this.reactionHost, tilemap, this.jump.heldButton);
      this.trackJumpPeak();
      return;
    }

    this.tickTimers(input);
    this.wall.scan(this.body, tilemap);

    // The heal channel roots the hero. A completed channel resolves after the physics
    // step so the body never tunnels through a ledge while the animation finishes.
    if (this.state === 'heal') {
      this.guard.cancel();
      this.healing.step(input, this.healHost);
      this.stepChannelPhysics(tilemap);
      return;
    }
    if (this.healing.tryStart(input, this.healHost)) {
      this.guard.cancel();
      this.stepChannelPhysics(tilemap);
      return;
    }

    // The brace owns the tick while it holds: the guard's opening beats only mean
    // anything if the hero cannot also swing through them.
    if (this.guard.active) {
      this.guard.step(this.guardHost, input, tilemap);
      this.finalizeGuardState();
      this.trackJumpPeak();
      return;
    }

    const wasGrounded = this.body.grounded;

    if (this.dash.tryStart(this.dashHost, input)) {
      // The dash owns the tick.
    } else if (!this.combat.tryStart(this.combatHost)) {
      if (this.wall.tryJump(this.wallHost, this.jump.hasBuffer)) {
        this.jump.consumeBuffer();
      } else {
        this.jump.tryStart(input, tilemap, this.jumpHost);
      }
    }

    if (this.state === 'dash') {
      this.dash.hold(this.dashHost);
    } else if (this.state === 'attack') {
      this.combat.step(this.combatHost, input);
      applyGravity(this.body, this.jump.heldButton);
    } else {
      if (!this.wall.locked) this.stepMove(input);
      applyGravity(this.body, this.jump.heldButton);
      this.wall.applySlide(this.body);
    }

    // The speed the fall carries into this tick's collision. Sampled before the
    // collision resolves, because that is where a landing's weight is decided.
    const impactSpeed = this.body.vy;
    const move = moveAndCollide(tilemap, this.body, SIM.dt);
    this.finalizeState(input, move, wasGrounded, impactSpeed);
    this.trackJumpPeak();
  }

  private stepChannelPhysics(tilemap: Tilemap): void {
    applyGravity(this.body, this.jump.heldButton);
    moveAndCollide(tilemap, this.body, SIM.dt);
    this.trackJumpPeak();
  }

  private get combatHost(): CombatHost {
    return {
      body: this.body,
      pose: this.pose,
      facing: this.facingValue,
      grounded: this.body.grounded,
      direction: inputDirection,
      consumeCounter: () => this.guard.consumeCounter(),
    };
  }

  private get guardHost(): GuardHost {
    return {
      body: this.body,
      pose: this.pose,
      facing: this.facingValue,
      grounded: this.body.grounded,
      busy:
        this.reaction.hurt ||
        this.state === 'attack' ||
        this.state === 'dash' ||
        this.state === 'heal' ||
        this.state === 'dead',
      setFacing: (direction) => {
        this.facingValue = direction;
      },
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

  private get wallHost(): WallHost {
    return {
      body: this.body,
      pose: this.pose,
      setFacing: (direction) => {
        this.facingValue = direction;
      },
    };
  }

  private get healHost(): HealHost {
    return {
      body: this.body,
      pose: this.pose,
      vitals: this.vitals,
      focus: this.focus,
    };
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
    this.guard.tick(input, this.guardHost);
    this.pose.tickClip();
  }

  /**
   * Resolves the guard's visible state after its physics step. The clip is not restarted
   * while the brace holds, so a parry pose can finish inside the guard.
   */
  private finalizeGuardState(): void {
    if (!this.body.grounded) {
      this.guard.cancel();
      this.pose.setState('fall', 'fall');
      return;
    }
    if (this.pose.state !== 'guard') this.pose.setState('guard', 'guard');
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
      if (this.wall.sliding) this.pose.setState('wallslide', 'fall');
      else if (this.body.vy < 0) this.pose.setState('jump', 'jump');
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
