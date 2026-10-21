import { PLAYER } from '../config/player';
import { RENDER } from '../config/render';
import type { Body } from '../physics/Body';
import type { Tilemap } from '../world/Tilemap';
import type { PlayerPose } from './PlayerPose';

export type WallHost = {
  body: Body;
  pose: PlayerPose;
  setFacing(direction: -1 | 1): void;
};

const EPSILON = 0.001;

/**
 * Wall Claw contact, slide and kick. The sensor is geometric, not trigger-based, so the
 * shaft works at any height and a wall jump can be authored without bespoke colliders.
 */
export class PlayerWall {
  private contactValue: -1 | 0 | 1 = 0;
  private enabled = false;
  private lockTicks = 0;
  private recontactTicks = 0;
  private slidingValue = false;

  get contact(): -1 | 0 | 1 {
    return this.contactValue;
  }

  get sliding(): boolean {
    return this.slidingValue;
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) {
      this.contactValue = 0;
      this.slidingValue = false;
      this.lockTicks = 0;
      this.recontactTicks = 0;
    }
  }

  tick(): void {
    if (this.lockTicks > 0) this.lockTicks -= 1;
    if (this.recontactTicks > 0) this.recontactTicks -= 1;
  }

  /** Rebuilds the contact sensor from the body's current position. */
  scan(body: Body, tilemap: Tilemap): void {
    this.contactValue = 0;
    this.slidingValue = false;
    if (!this.enabled || body.grounded) return;

    const tile = RENDER.tileSize;
    const top = Math.floor((body.y + 2) / tile);
    const bottom = Math.floor((body.y + body.h - 2) / tile);
    const left = Math.floor(body.x / tile);
    const right = Math.floor((body.x + body.w - EPSILON) / tile);

    if (this.recontactTicks <= 0 && this.probesColumn(tilemap, left - 1, top, bottom)) {
      this.contactValue = -1;
    } else if (this.recontactTicks <= 0 && this.probesColumn(tilemap, right + 1, top, bottom)) {
      this.contactValue = 1;
    }
  }

  /**
   * Tries a wall kick before the normal jump. Takes the buffered jump edge so the same
   * press cannot also fire a ground jump.
   */
  tryJump(host: WallHost, buffered: boolean): boolean {
    if (!buffered || this.lockTicks > 0 || this.contactValue === 0 || host.body.grounded) {
      return false;
    }
    const away = this.contactValue === -1 ? 1 : -1;
    host.body.vx = away * PLAYER.wall.jumpX;
    host.body.vy = -PLAYER.wall.jumpY;
    host.setFacing(away);
    host.pose.setState('jump', 'jump');
    host.pose.emit('wallJump');
    this.lockTicks = PLAYER.wall.lockTicks;
    this.recontactTicks = PLAYER.wall.recontactTicks;
    this.contactValue = 0;
    this.slidingValue = false;
    return true;
  }

  /**
   * Caps downward speed against a wall. Called after gravity, before collision, so the
   * slide reads on the same tick the hero touches the stone.
   */
  applySlide(body: Body): void {
    if (!this.enabled || this.lockTicks > 0 || this.contactValue === 0 || body.grounded) {
      return;
    }
    if (body.vy >= 0) {
      if (!this.slidingValue) body.vy = Math.max(body.vy, PLAYER.wall.slideStartSpeed);
      this.slidingValue = true;
      body.vy = Math.min(body.vy, PLAYER.wall.slideSpeed);
    }
  }

  get locked(): boolean {
    return this.lockTicks > 0;
  }

  private probesColumn(tilemap: Tilemap, tx: number, top: number, bottom: number): boolean {
    for (let ty = top; ty <= bottom; ty += 1) {
      if (tilemap.isWall(tx, ty)) return true;
    }
    return false;
  }
}
