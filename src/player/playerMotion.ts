import { PLAYER } from '../config/player';
import { SIM } from '../config/world';
import { approach } from '../core/Math2D';
import type { Body } from '../physics/Body';

/** Gravity, apex float and variable jump height for one fixed tick. */
export function applyGravity(body: Body, jumpHeld: boolean): void {
  const jump = PLAYER.jump;
  const rising = body.vy < 0;
  let gravity = rising ? jump.gravity : jump.fallGravity;
  if (!body.grounded && Math.abs(body.vy) < jump.apexSpeed) {
    gravity *= jump.apexGravityScale;
  }
  body.vy = Math.min(body.vy + gravity * SIM.dt, jump.maxFall);

  if (rising && !jumpHeld && body.vy < -jump.cutSpeed) {
    body.vy = -jump.cutSpeed;
  }
}

/** Ground/air run acceleration, skid deceleration and the post-dash speed bleed. */
export function stepRun(body: Body, dir: -1 | 0 | 1, grounded: boolean, speedScale = 1): void {
  const max = (grounded ? PLAYER.ground.maxRun : PLAYER.air.maxRun) * speedScale;
  if (dir !== 0) {
    const opposing = body.vx * dir < 0;
    const rate = grounded
      ? opposing
        ? PLAYER.ground.skidDecel
        : PLAYER.ground.accel
      : PLAYER.air.accel;
    body.vx = approach(body.vx, dir * max, rate * SIM.dt);
  } else {
    const rate = grounded ? PLAYER.ground.friction : PLAYER.air.drag;
    body.vx = approach(body.vx, 0, rate * SIM.dt);
  }

  // Dash exits can leave the body above the run cap: bleed the excess off smoothly.
  if (Math.abs(body.vx) > max) {
    body.vx = approach(body.vx, Math.sign(body.vx) * max, PLAYER.ground.friction * SIM.dt);
  }
}

/** Hurt/death slide: no control, just friction. */
export function decayHorizontal(body: Body, rate: number): void {
  body.vx = approach(body.vx, 0, rate * SIM.dt);
}
