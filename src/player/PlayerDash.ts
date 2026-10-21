import { PLAYER } from '../config/player';
import { isPressed, type InputSnapshot } from '../input/InputState';
import type { Body } from '../physics/Body';
import type { MoveResult } from '../physics/TileCollision';
import type { PlayerPose } from './PlayerPose';
import { inputDirection } from './playerSensors';

export type DashHost = {
  body: Body;
  pose: PlayerPose;
  facing: -1 | 1;
  setFacing(direction: -1 | 1): void;
};

/** The fixed-speed dash burst, its cooldown and its safe exit back into locomotion. */
export class PlayerDash {
  private ticksLeft = 0;
  private cooldown = 0;
  private cooldownScale = 1;

  get cooldownTicks(): number {
    return this.cooldown;
  }

  /** Light Step shortens the recovery without changing the burst itself. */
  setCooldownScale(scale: number): void {
    this.cooldownScale = Math.max(0.1, Math.min(1, scale));
  }

  tick(): void {
    if (this.cooldown > 0) this.cooldown -= 1;
  }

  tryStart(host: DashHost, input: InputSnapshot): boolean {
    if (!isPressed(input, 'dash') || this.cooldown > 0) return false;
    if (host.pose.state === 'dash' || host.pose.state === 'attack') return false;

    const dir = inputDirection(input);
    if (dir !== 0) host.setFacing(dir);
    host.pose.setState('dash', 'dash');
    this.ticksLeft = PLAYER.dash.ticks;
    this.cooldown = Math.max(1, Math.round(PLAYER.dash.cooldownTicks * this.cooldownScale));
    this.hold(host);
    host.pose.emit('dash');
    return true;
  }

  /** Keeps the dash at fixed speed while gravity is suspended. */
  hold(host: DashHost): void {
    if (host.pose.state !== 'dash') return;
    host.body.vx = host.facing * PLAYER.dash.speed;
    host.body.vy = 0;
  }

  /**
   * Resolves the dash after collision. Returns true while the dash still owns the state;
   * a wall ends it early, and the exit speed is capped before handing back control.
   */
  finalize(host: DashHost, move: MoveResult): boolean {
    if (host.pose.state !== 'dash') return false;
    this.ticksLeft -= 1;
    if (this.ticksLeft > 0 && !move.hitX) return true;
    host.body.vx =
      host.facing *
      Math.min(Math.abs(host.body.vx), PLAYER.ground.maxRun) *
      PLAYER.dash.exitSpeedScale;
    host.pose.forceState(host.body.grounded ? 'idle' : 'fall');
    return false;
  }
}
