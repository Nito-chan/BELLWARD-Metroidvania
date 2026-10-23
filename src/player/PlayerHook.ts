import { HOOK } from '../config/hookline';
import { PLAYER } from '../config/player';
import { SIM } from '../config/world';
import type { Vec2 } from '../core/Types';
import { isHeld, isPressed, type InputSnapshot } from '../input/InputState';
import type { Body } from '../physics/Body';
import { moveAndCollide } from '../physics/TileCollision';
import { canHangAt, handPoint, hangFeet, hasHookLineOfSight } from '../world/hookGeometry';
import type { RoomAnchor } from '../world/Room';
import type { Tilemap } from '../world/Tilemap';
import type { PlayerPose } from './PlayerPose';
import { inputDirection } from './playerSensors';

export type HookHost = {
  body: Body;
  pose: PlayerPose;
  facing: -1 | 1;
  /** True while a swing, dash, heal channel, hit or death owns the hero. */
  busy: boolean;
  setFacing(direction: -1 | 1): void;
};

export type HookPhase = 'idle' | 'zip' | 'hang';

/** What the hook did this tick, so the controller can consume a jump buffer. */
export type HookTickResult = 'none' | 'started' | 'retargeted' | 'active' | 'jumped' | 'dropped';

/**
 * The Hookline: a cast that picks the best brass ring in reach, pulls the Keeper along
 * a taut line, and holds for a short hang. The hang can be chained to another ring,
 * released into a jump, or dropped through a platform. A wall in the flight path ends
 * the pull early rather than teleporting the body.
 */
export class PlayerHook {
  private phaseValue: HookPhase = 'idle';
  private anchorValue: RoomAnchor | null = null;
  private targetValue: Vec2 | null = null;
  private cooldownValue = 0;
  private hangTicksValue = 0;
  private candidateValue: RoomAnchor | null = null;
  private enabledValue = false;
  private rangeValue: number = HOOK.range.base;

  get active(): boolean {
    return this.phaseValue !== 'idle';
  }

  get phase(): HookPhase {
    return this.phaseValue;
  }

  /** The ring currently holding the line, if any. */
  get anchor(): RoomAnchor | null {
    return this.anchorValue;
  }

  get anchorId(): string | null {
    return this.anchorValue?.id ?? null;
  }

  /** The ring the reticle is highlighting, or null when nothing is in reach. */
  get candidate(): RoomAnchor | null {
    return this.candidateValue;
  }

  get candidateId(): string | null {
    return this.candidateValue?.id ?? null;
  }

  get cooldownTicks(): number {
    return this.cooldownValue;
  }

  get range(): number {
    return this.rangeValue;
  }

  get hangTicksLeft(): number {
    return this.hangTicksValue;
  }

  setEnabled(enabled: boolean): void {
    this.enabledValue = enabled;
    if (!enabled) this.cancel();
  }

  setRange(range: number): void {
    this.rangeValue = Math.max(0, range);
  }

  /**
   * Drops the line without starting the recovery clock. Used by hurt/death and by room
   * teardown, where a cooldown is meaningless.
   */
  cancel(): void {
    this.phaseValue = 'idle';
    this.anchorValue = null;
    this.targetValue = null;
    this.hangTicksValue = 0;
    this.candidateValue = null;
  }

  /**
   * Samples input and either starts/retargets a pull, or handles a hang release.
   * Movement itself is resolved in `step` after this decision, so the controller can
   * give the hook the whole tick when it is active.
   */
  tick(
    host: HookHost,
    input: InputSnapshot,
    anchors: readonly RoomAnchor[],
    tilemap: Tilemap,
  ): HookTickResult {
    if (this.cooldownValue > 0) this.cooldownValue -= 1;
    if (!this.enabledValue) {
      if (this.active) this.cancel();
      return 'none';
    }

    if (!this.active) {
      this.candidateValue =
        !host.busy && this.cooldownValue === 0 ? this.findCandidate(host, anchors, tilemap) : null;
      if (this.candidateValue && isPressed(input, 'cast') && !host.busy) {
        this.begin(host, this.candidateValue);
        return 'started';
      }
      return 'none';
    }

    this.candidateValue = null;

    if (this.phaseValue === 'hang') {
      if (isPressed(input, 'jump')) {
        this.release(host);
        this.launch(host, input);
        return 'jumped';
      }
      if (isHeld(input, 'down')) {
        this.release(host);
        this.dropThrough(host);
        return 'dropped';
      }
    }

    if (isPressed(input, 'cast')) {
      const next = this.findCandidate(host, anchors, tilemap, this.anchorValue?.id);
      if (next) {
        this.begin(host, next);
        return 'retargeted';
      }
    }

    return 'active';
  }

  /** Moves the body for one tick while the hook owns control. */
  step(host: HookHost, tilemap: Tilemap): void {
    if (this.phaseValue === 'zip') this.stepZip(host, tilemap);
    else if (this.phaseValue === 'hang') this.stepHang(host);
  }

  /**
   * Picks the best reachable ring. Ahead-of-facing rings get a small preference, but a
   * slightly closer ring overhead always wins. Rings behind the hero beyond the allowance
   * are skipped: turn around if you want to go back.
   */
  private findCandidate(
    host: HookHost,
    anchors: readonly RoomAnchor[],
    tilemap: Tilemap,
    excludeId?: string,
  ): RoomAnchor | null {
    const origin = handPoint(this.feet(host.body));
    let best: RoomAnchor | null = null;
    let bestScore = Number.POSITIVE_INFINITY;

    for (const anchor of anchors) {
      if (anchor.id === excludeId) continue;
      const dx = anchor.x - origin.x;
      const dy = anchor.y - origin.y;
      const distance = Math.hypot(dx, dy);
      if (distance < HOOK.minRange || distance > this.rangeValue) continue;
      if (dy > HOOK.maxDrop) continue;
      if (dx * host.facing < -HOOK.backwardAllowance) continue;
      if (!canHangAt(tilemap, anchor)) continue;
      if (!hasHookLineOfSight(tilemap, origin, anchor)) continue;

      let score = distance;
      if (dx * host.facing >= 0) score -= HOOK.facingBias;
      if (dy > 0) score += HOOK.dropBias;
      if (score < bestScore) {
        best = anchor;
        bestScore = score;
      }
    }
    return best;
  }

  private begin(host: HookHost, anchor: RoomAnchor): void {
    const feet = this.feet(host.body);
    if (Math.abs(anchor.x - feet.x) > 2) {
      host.setFacing(anchor.x < feet.x ? -1 : 1);
    }
    this.phaseValue = 'zip';
    this.anchorValue = anchor;
    this.targetValue = hangFeet(anchor);
    this.hangTicksValue = 0;
    host.body.vx = 0;
    host.body.vy = 0;
    host.body.grounded = false;
    host.pose.setState('hook', 'hook');
    host.pose.emit('hook');
  }

  private stepZip(host: HookHost, tilemap: Tilemap): void {
    const anchor = this.anchorValue;
    const target = this.targetValue;
    if (!anchor || !target) {
      this.release(host);
      return;
    }

    const feet = this.feet(host.body);
    const dx = target.x - feet.x;
    const dy = target.y - feet.y;
    const distance = Math.hypot(dx, dy);
    const stepDistance = HOOK.zipSpeed * SIM.dt;

    if (Math.abs(dx) > 2) host.setFacing(dx < 0 ? -1 : 1);

    if (distance <= Math.max(HOOK.snapDistance, stepDistance)) {
      this.snapIntoHang(host, target, anchor, tilemap);
      return;
    }

    host.body.vx = (dx / distance) * HOOK.zipSpeed;
    host.body.vy = (dy / distance) * HOOK.zipSpeed;
    const move = moveAndCollide(tilemap, host.body, SIM.dt);

    if (move.hitX || move.hitCeiling || move.hitGround) {
      // A clipped pull stops honestly: if the collision left the body on the ring's
      // snap doorstep it may still hang, otherwise the line goes slack.
      const after = this.feet(host.body);
      const remaining = Math.hypot(target.x - after.x, target.y - after.y);
      if (remaining <= HOOK.snapDistance) {
        this.snapIntoHang(host, target, anchor, tilemap);
      } else {
        this.release(host);
      }
    }
  }

  private snapIntoHang(host: HookHost, target: Vec2, anchor: RoomAnchor, tilemap: Tilemap): void {
    if (!canHangAt(tilemap, anchor)) {
      this.release(host);
      return;
    }
    host.body.x = target.x - host.body.w / 2;
    host.body.y = target.y - host.body.h;
    host.body.vx = 0;
    host.body.vy = 0;
    host.body.grounded = false;
    this.phaseValue = 'hang';
    this.hangTicksValue = HOOK.hangTicks;
    host.pose.setState('hook', 'hook');
  }

  private stepHang(host: HookHost): void {
    host.body.vx = 0;
    host.body.vy = 0;
    host.body.grounded = false;
    this.hangTicksValue -= 1;
    if (this.hangTicksValue <= 0) this.release(host);
  }

  private launch(host: HookHost, input: InputSnapshot): void {
    const steer = inputDirection(input);
    const direction = steer !== 0 ? steer : host.facing;
    host.setFacing(direction);
    host.body.vx = direction * HOOK.jumpX;
    host.body.vy = -HOOK.jumpY;
    host.body.grounded = false;
    host.pose.setState('jump', 'jump');
    host.pose.emit('jump');
  }

  private dropThrough(host: HookHost): void {
    host.body.dropThroughTicks = PLAYER.dropThroughTicks;
    host.body.vy = PLAYER.dropThroughSpeed;
  }

  private release(host: HookHost): void {
    this.phaseValue = 'idle';
    this.anchorValue = null;
    this.targetValue = null;
    this.hangTicksValue = 0;
    this.candidateValue = null;
    this.cooldownValue = HOOK.cooldownTicks;
    host.body.vx = 0;
    host.body.vy = 0;
  }

  private feet(body: Body): Vec2 {
    return { x: body.x + body.w / 2, y: body.y + body.h };
  }
}
