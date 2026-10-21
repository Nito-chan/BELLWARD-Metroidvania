import { PLAYER } from '../config/player';
import { isHeld, isPressed, type InputSnapshot } from '../input/InputState';
import type { Body } from '../physics/Body';
import type { Tilemap } from '../world/Tilemap';
import type { PlayerPose } from './PlayerPose';
import { standingOnOneWay } from './playerSensors';

export type JumpHost = {
  body: Body;
  pose: PlayerPose;
};

/**
 * Jump buffering, coyote time, variable height input and one-way drop-through. The
 * controller samples `heldButton` for gravity; this class owns the forgiveness budget.
 */
export class PlayerJump {
  private bufferTicks = 0;
  private coyoteTicks = 0;
  private held = false;

  get heldButton(): boolean {
    return this.held;
  }

  get hasBuffer(): boolean {
    return this.bufferTicks > 0;
  }

  consumeBuffer(): void {
    this.bufferTicks = 0;
  }

  tick(input: InputSnapshot, grounded: boolean): void {
    if (this.bufferTicks > 0) this.bufferTicks -= 1;
    if (isPressed(input, 'jump')) this.bufferTicks = PLAYER.jump.bufferTicks;
    this.held = isHeld(input, 'jump');

    if (grounded) this.coyoteTicks = PLAYER.jump.coyoteTicks;
    else if (this.coyoteTicks > 0) this.coyoteTicks -= 1;
  }

  tryStart(input: InputSnapshot, tilemap: Tilemap, host: JumpHost): boolean {
    if (this.bufferTicks <= 0) return false;

    // Down + jump on a one-way platform drops through it instead of jumping.
    if (host.body.grounded && isHeld(input, 'down') && standingOnOneWay(host.body, tilemap)) {
      host.body.dropThroughTicks = PLAYER.dropThroughTicks;
      host.body.vy = PLAYER.dropThroughSpeed;
      this.bufferTicks = 0;
      host.pose.setState('fall', 'fall');
      return true;
    }

    if (!host.body.grounded && this.coyoteTicks <= 0) return false;
    host.body.vy = -PLAYER.jump.speed;
    this.coyoteTicks = 0;
    this.bufferTicks = 0;
    host.pose.setState('jump', 'jump');
    host.pose.emit('jump');
    return true;
  }
}
