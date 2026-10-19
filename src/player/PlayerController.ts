import { PLAYER } from '../config/player';
import { RENDER } from '../config/render';
import { SIM } from '../config/world';
import { approach } from '../core/Math2D';
import type { Vec2 } from '../core/Types';
import { isHeld, isPressed, type InputSnapshot } from '../input/InputState';
import { createBody, type Body } from '../physics/Body';
import { moveAndCollide, type MoveResult } from '../physics/TileCollision';
import type { Tilemap } from '../world/Tilemap';

export type PlayerStateName = 'idle' | 'run' | 'skid' | 'jump' | 'fall' | 'attack' | 'dash';

const EPSILON = 0.001;

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
  private facingValue: -1 | 1 = 1;
  private stateValue: PlayerStateName = 'idle';
  private animationValue = 'idle';
  private clipTickValue = 0;
  private restartedValue = true;
  private attackStage: 1 | 2 = 1;
  private attackBufferTicks = 0;
  private jumpBufferTicks = 0;
  private dashTicksLeft = 0;
  private dashCooldownTicks = 0;
  private coyoteTicks = 0;
  private jumpHeld = false;

  constructor(spawn: Vec2) {
    this.body = createBody(
      spawn.x - PLAYER.size.w / 2,
      spawn.y - PLAYER.size.h,
      PLAYER.size.w,
      PLAYER.size.h,
    );
  }

  get facing(): -1 | 1 {
    return this.facingValue;
  }

  get state(): PlayerStateName {
    return this.stateValue;
  }

  /** Active animation clip name (a key in the hero's animation set). */
  get animation(): string {
    return this.animationValue;
  }

  /** Ticks since the current clip started. */
  get clipTick(): number {
    return this.clipTickValue;
  }

  /** True on the tick a new clip started, so the view can restart one-shots. */
  get restarted(): boolean {
    return this.restartedValue;
  }

  get grounded(): boolean {
    return this.body.grounded;
  }

  get dashCooldown(): number {
    return this.dashCooldownTicks;
  }

  /** Feet-center in world pixels: the view anchor and camera focus. */
  get feet(): Vec2 {
    return { x: this.body.x + this.body.w / 2, y: this.body.y + this.body.h };
  }

  /** True while a swing's damage window is open (combat lands in a later milestone). */
  get attackActive(): boolean {
    if (this.stateValue !== 'attack') return false;
    const window =
      this.attackStage === 1 ? PLAYER.attack.windows.stage1 : PLAYER.attack.windows.stage2;
    return this.clipTickValue >= window.start && this.clipTickValue <= window.end;
  }

  /** Advances one fixed tick. */
  update(input: InputSnapshot, tilemap: Tilemap): void {
    this.restartedValue = false;
    this.tickTimers(input);
    this.updateCoyote();

    if (this.tryStartDash(input)) {
      // The dash owns the tick.
    } else if (!this.tryStartAttack()) {
      this.tryStartJump(input, tilemap);
    }

    if (this.stateValue === 'dash') {
      // A dash is a fixed-speed burst with gravity suspended.
      this.body.vx = this.facingValue * PLAYER.dash.speed;
      this.body.vy = 0;
    } else if (this.stateValue === 'attack') {
      this.stepAttack(input);
      this.applyGravity();
    } else {
      this.stepMove(input);
      this.applyGravity();
    }

    const move = moveAndCollide(tilemap, this.body, SIM.dt);
    this.finalizeState(input, move);
  }

  /** Ticks down every timer and latches pressed edges into buffers. */
  private tickTimers(input: InputSnapshot): void {
    if (this.dashCooldownTicks > 0) this.dashCooldownTicks -= 1;
    if (this.jumpBufferTicks > 0) this.jumpBufferTicks -= 1;
    if (this.attackBufferTicks > 0) this.attackBufferTicks -= 1;
    if (isPressed(input, 'jump')) this.jumpBufferTicks = PLAYER.jump.bufferTicks;
    if (isPressed(input, 'attack')) this.attackBufferTicks = PLAYER.attack.bufferTicks;
    this.jumpHeld = isHeld(input, 'jump');
    this.clipTickValue += 1;
  }

  private updateCoyote(): void {
    if (this.body.grounded) this.coyoteTicks = PLAYER.jump.coyoteTicks;
    else if (this.coyoteTicks > 0) this.coyoteTicks -= 1;
  }

  private tryStartDash(input: InputSnapshot): boolean {
    if (!isPressed(input, 'dash')) return false;
    if (this.dashCooldownTicks > 0) return false;
    if (this.stateValue === 'dash' || this.stateValue === 'attack') return false;

    const dir = this.direction(input);
    if (dir !== 0) this.facingValue = dir;
    this.stateValue = 'dash';
    this.beginClip('dash');
    this.dashTicksLeft = PLAYER.dash.ticks;
    this.dashCooldownTicks = PLAYER.dash.cooldownTicks;
    this.body.vx = this.facingValue * PLAYER.dash.speed;
    this.body.vy = 0;
    return true;
  }

  private tryStartAttack(): boolean {
    if (this.attackBufferTicks <= 0) return false;
    if (this.stateValue === 'attack' || this.stateValue === 'dash') return false;
    this.attackBufferTicks = 0;
    this.startAttack(1);
    return true;
  }

  private tryStartJump(input: InputSnapshot, tilemap: Tilemap): boolean {
    if (this.jumpBufferTicks <= 0) return false;

    // Down + jump on a one-way platform drops through it instead of jumping.
    if (this.body.grounded && isHeld(input, 'down') && this.standingOnOneWay(tilemap)) {
      this.body.dropThroughTicks = PLAYER.dropThroughTicks;
      this.body.vy = PLAYER.dropThroughSpeed;
      this.jumpBufferTicks = 0;
      this.stateValue = 'fall';
      this.beginClip('fall');
      return true;
    }

    if (!this.body.grounded && this.coyoteTicks <= 0) return false;
    this.body.vy = -PLAYER.jump.speed;
    this.coyoteTicks = 0;
    this.jumpBufferTicks = 0;
    this.stateValue = 'jump';
    this.beginClip('jump');
    return true;
  }

  private startAttack(stage: 1 | 2): void {
    this.attackStage = stage;
    this.stateValue = 'attack';
    this.beginClip(stage === 1 ? 'attack1' : 'attack2');
    // Facing is locked for the swing; the art is directional.
    this.body.vx *= PLAYER.attack.speedScale;
  }

  private stepAttack(input: InputSnapshot): void {
    const window =
      this.attackStage === 1 ? PLAYER.attack.windows.stage1 : PLAYER.attack.windows.stage2;
    if (
      this.attackStage === 1 &&
      this.clipTickValue >= window.start &&
      this.clipTickValue <= window.end &&
      isPressed(input, 'attack')
    ) {
      this.startAttack(2);
      return;
    }

    const total =
      this.attackStage === 1 ? PLAYER.attack.clipTicks.stage1 : PLAYER.attack.clipTicks.stage2;
    if (this.clipTickValue >= total) {
      // The swing has ended; hand control back to locomotion and let the clip select
      // itself from the current motion.
      this.stateValue = this.body.grounded ? 'idle' : 'fall';
      this.beginClip(this.body.grounded ? 'idle' : 'fall');
      return;
    }

    // Swings drag: a fraction of ground control remains available.
    const dir = this.direction(input);
    const max = PLAYER.ground.maxRun * PLAYER.attack.speedScale;
    const accel =
      (this.body.grounded ? PLAYER.ground.accel : PLAYER.air.accel) * PLAYER.attack.speedScale;
    const decel = this.body.grounded ? PLAYER.ground.friction : PLAYER.air.drag;
    if (dir !== 0) {
      this.body.vx = approach(this.body.vx, dir * max, accel * SIM.dt);
    } else {
      this.body.vx = approach(this.body.vx, 0, decel * SIM.dt);
    }
  }

  private stepMove(input: InputSnapshot): void {
    const dir = this.direction(input);
    const grounded = this.body.grounded;
    const max = grounded ? PLAYER.ground.maxRun : PLAYER.air.maxRun;

    if (dir !== 0) {
      this.facingValue = dir;
      const opposing = this.body.vx * dir < 0;
      const rate = grounded
        ? opposing
          ? PLAYER.ground.skidDecel
          : PLAYER.ground.accel
        : PLAYER.air.accel;
      this.body.vx = approach(this.body.vx, dir * max, rate * SIM.dt);
    } else {
      const rate = grounded ? PLAYER.ground.friction : PLAYER.air.drag;
      this.body.vx = approach(this.body.vx, 0, rate * SIM.dt);
    }

    // Dash exits can leave the body above the run cap: bleed the excess off smoothly.
    if (Math.abs(this.body.vx) > max) {
      this.body.vx = approach(
        this.body.vx,
        Math.sign(this.body.vx) * max,
        PLAYER.ground.friction * SIM.dt,
      );
    }
  }

  private applyGravity(): void {
    const jump = PLAYER.jump;
    const rising = this.body.vy < 0;
    let gravity = rising ? jump.gravity : jump.fallGravity;
    if (!this.body.grounded && Math.abs(this.body.vy) < jump.apexSpeed) {
      gravity *= jump.apexGravityScale;
    }
    this.body.vy = Math.min(this.body.vy + gravity * SIM.dt, jump.maxFall);

    // Variable jump height: releasing the button during the rise clips the arc.
    if (rising && !this.jumpHeld && this.body.vy < -jump.cutSpeed) {
      this.body.vy = -jump.cutSpeed;
    }
  }

  /** Resolves state and clip after the physics step, from the ground truth of collision. */
  private finalizeState(input: InputSnapshot, move: MoveResult): void {
    if (this.stateValue === 'dash') {
      this.dashTicksLeft -= 1;
      if (this.dashTicksLeft > 0 && !move.hitX) return;
      this.body.vx =
        this.facingValue *
        Math.min(Math.abs(this.body.vx), PLAYER.ground.maxRun) *
        PLAYER.dash.exitSpeedScale;
      this.stateValue = this.body.grounded ? 'idle' : 'fall';
    }

    if (this.stateValue === 'attack') return;

    if (!this.body.grounded) {
      if (this.body.vy < 0) this.setState('jump', 'jump');
      else this.setState('fall', 'fall');
      return;
    }

    const dir = this.direction(input);
    const speed = Math.abs(this.body.vx);
    if (dir !== 0 && speed > PLAYER.skidMinSpeed && this.body.vx * dir < 0) {
      this.setState('skid', 'turn');
      return;
    }
    if (speed > PLAYER.idleSpeed) this.setState('run', 'run');
    else this.setState('idle', 'idle');
  }

  private setState(state: PlayerStateName, animation: string): void {
    this.stateValue = state;
    this.beginClip(animation);
  }

  private beginClip(name: string): void {
    if (this.animationValue === name) return;
    this.animationValue = name;
    this.clipTickValue = 0;
    this.restartedValue = true;
  }

  /** -1, 0 or 1: the horizontal direction the player is asking for. */
  private direction(input: InputSnapshot): -1 | 0 | 1 {
    const left = isHeld(input, 'left');
    const right = isHeld(input, 'right');
    if (left === right) return 0;
    return right ? 1 : -1;
  }

  /** True when a one-way platform sits directly under the body's feet. */
  private standingOnOneWay(tilemap: Tilemap): boolean {
    const tile = RENDER.tileSize;
    const row = Math.floor((this.body.y + this.body.h + 0.5) / tile);
    const left = Math.floor(this.body.x / tile);
    const right = Math.floor((this.body.x + this.body.w - EPSILON) / tile);
    for (let tx = left; tx <= right; tx += 1) {
      if (tilemap.isOneWay(tx, row)) return true;
    }
    return false;
  }
}
