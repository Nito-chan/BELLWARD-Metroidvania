import { COMBAT } from '../config/combat';
import { SIM } from '../config/world';
import { isHeld, type InputSnapshot } from '../input/InputState';
import { moveAndCollide } from '../physics/TileCollision';
import type { Body } from '../physics/Body';
import type { Tilemap } from '../world/Tilemap';
import { applyGravity, stepRun } from './playerMotion';
import { inputDirection } from './playerSensors';
import type { PlayerPose } from './PlayerPose';

export type GuardHost = {
  body: Body;
  pose: PlayerPose;
  facing: -1 | 1;
  grounded: boolean;
  /** True while a swing, dash, heal channel, hit or death owns the hero. */
  busy: boolean;
  setFacing(direction: -1 | 1): void;
};

/** What a would-be hit becomes when it reaches a guarding hero. */
export type IncomingOutcome = 'hit' | 'block' | 'parry' | 'broken' | 'unblockable';

/**
 * The Keeper's Guard: a held brace whose opening ticks deflect. A perfect parry opens a
 * counter window and fills the attacker's posture; a plain block spends the hero's own
 * posture; a shatter costs a mask and control. Unblockable (red) attacks pass straight
 * through, so the guard is a read, not a wall.
 */
export class PlayerGuard {
  private activeValue = false;
  private guardTicksValue = 0;
  private postureValue: number = COMBAT.guard.maxPosture;
  private regenDelayValue = 0;
  private brokenTicksValue = 0;
  private releaseLockValue = 0;
  private antiSpamTicksValue = 0;
  private spamCountValue = 0;
  private counterTicksValue = 0;

  get active(): boolean {
    return this.activeValue;
  }

  get posture(): number {
    return this.postureValue;
  }

  get maxPosture(): number {
    return COMBAT.guard.maxPosture;
  }

  /** 0..1 for the HUD; 1 is a full brace, 0 is a shatter. */
  get postureRatio(): number {
    return this.postureValue / COMBAT.guard.maxPosture;
  }

  get broken(): boolean {
    return this.brokenTicksValue > 0;
  }

  /** True while a perfect parry has opened the hero for a Hook Counter. */
  get counterReady(): boolean {
    return this.counterTicksValue > 0;
  }

  /** Ticks of deflect left on the current guard, for feedback and tests. */
  get deflectTicksRemaining(): number {
    if (!this.activeValue || this.brokenTicksValue > 0) return 0;
    return Math.max(0, this.currentDeflectTicks - this.guardTicksValue);
  }

  /** True on the opening beats where an incoming hit is a perfect parry. */
  get perfectWindow(): boolean {
    return (
      this.activeValue &&
      this.brokenTicksValue <= 0 &&
      this.guardTicksValue < COMBAT.guard.perfectTicks
    );
  }

  /** Starts, holds and ends the brace. Called once per tick before combat resolution. */
  tick(input: InputSnapshot, host: GuardHost): void {
    if (this.releaseLockValue > 0) this.releaseLockValue -= 1;
    if (this.antiSpamTicksValue > 0) {
      this.antiSpamTicksValue -= 1;
      if (this.antiSpamTicksValue === 0) this.spamCountValue = 0;
    }
    if (this.counterTicksValue > 0) this.counterTicksValue -= 1;

    if (this.brokenTicksValue > 0) {
      this.brokenTicksValue -= 1;
      this.activeValue = false;
      this.regenDelayValue = COMBAT.guard.postureRegenDelayTicks;
      return;
    }

    this.regeneratePosture();

    const wantsGuard = isHeld(input, 'guard');
    if (this.activeValue) {
      if (!wantsGuard || !host.grounded || host.busy) {
        this.endGuard();
        return;
      }
      this.guardTicksValue += 1;
      return;
    }

    if (wantsGuard && host.grounded && !host.busy && this.releaseLockValue <= 0) {
      this.beginGuard(host);
    }
  }

  /** Advances the brace's movement and physics. The controller skips normal movement. */
  step(host: GuardHost, input: InputSnapshot, tilemap: Tilemap): void {
    const dir = inputDirection(input);
    if (dir !== 0) host.setFacing(dir);
    stepRun(host.body, dir, host.body.grounded, COMBAT.guard.speedScale);
    applyGravity(host.body, isHeld(input, 'jump'));
    moveAndCollide(tilemap, host.body, SIM.dt);

    if (host.pose.animation === 'parry' && host.pose.clipTick >= COMBAT.guard.parryClipTicks) {
      host.pose.beginClip('guard');
    }
  }

  /**
   * Classifies an incoming hit before damage is applied. The caller owns the outcome:
   * it applies health for `hit`/`unblockable`, adds posture to the attacker for `parry`,
   * and plays the shatter feedback for `broken`.
   */
  resolveIncoming(host: GuardHost, sourceX: number, unblockable: boolean): IncomingOutcome {
    if (!this.activeValue || this.brokenTicksValue > 0 || !host.grounded) return 'hit';
    if (unblockable) return 'unblockable';

    const feetX = host.body.x + host.body.w / 2;
    const inFront = host.facing === 1 ? sourceX >= feetX - 2 : sourceX <= feetX + 2;
    if (!inFront) return 'hit';

    if (this.guardTicksValue < COMBAT.guard.perfectTicks) {
      this.counterTicksValue = COMBAT.guard.counterTicks;
      host.pose.beginClip('parry');
      return 'parry';
    }

    this.postureValue = Math.max(0, this.postureValue - COMBAT.guard.blockPostureCost);
    this.regenDelayValue = COMBAT.guard.postureRegenDelayTicks;
    if (this.postureValue <= 0) {
      this.brokenTicksValue = COMBAT.guard.brokenTicks;
      this.activeValue = false;
      return 'broken';
    }
    return 'block';
  }

  /** Spends a perfect-parry counter window. Returns false when none is open. */
  consumeCounter(): boolean {
    if (this.counterTicksValue <= 0) return false;
    this.counterTicksValue = 0;
    return true;
  }

  /** Drops the brace without a release lock (heal start, hit reaction, room reset). */
  cancel(): void {
    this.activeValue = false;
  }

  private beginGuard(host: GuardHost): void {
    this.activeValue = true;
    this.guardTicksValue = 0;
    if (this.antiSpamTicksValue > 0) {
      this.spamCountValue = Math.min(this.spamCountValue + 1, COMBAT.guard.deflectTicks.length - 1);
    }
    this.antiSpamTicksValue = COMBAT.guard.antiSpamWindowTicks;
    host.pose.setState('guard', 'guard');
  }

  private endGuard(): void {
    this.activeValue = false;
    this.releaseLockValue = COMBAT.guard.releaseLockTicks;
  }

  private regeneratePosture(): void {
    if (this.postureValue >= COMBAT.guard.maxPosture) return;
    if (this.regenDelayValue > 0) {
      this.regenDelayValue -= 1;
      return;
    }
    this.postureValue = Math.min(
      COMBAT.guard.maxPosture,
      this.postureValue + COMBAT.guard.postureRegenPerTick,
    );
  }

  private get currentDeflectTicks(): number {
    const ladder = COMBAT.guard.deflectTicks;
    const index = Math.min(this.spamCountValue, ladder.length - 1);
    return ladder[index] ?? ladder[ladder.length - 1] ?? 0;
  }
}
