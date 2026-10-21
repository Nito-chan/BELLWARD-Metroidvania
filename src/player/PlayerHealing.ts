import { PLAYER } from '../config/player';
import { isHeld, isPressed, type InputSnapshot } from '../input/InputState';
import type { Body } from '../physics/Body';
import type { PlayerFocus } from './PlayerFocus';
import type { PlayerPose } from './PlayerPose';
import type { PlayerVitals } from './PlayerVitals';

export type HealHost = {
  body: Body;
  pose: PlayerPose;
  vitals: PlayerVitals;
  focus: PlayerFocus;
};

/**
 * The hold-to-heal channel. It owns no health math: the controller only asks it to
 * start or advance, and completion calls the real vitals/focus paths. A hit either
 * cancels the channel or, with Sturdy Shell, is absorbed by it.
 */
export class PlayerHealing {
  private active = false;
  private elapsed = 0;
  private duration: number = PLAYER.heal.ticks;
  private sturdy = false;

  get healing(): boolean {
    return this.active;
  }

  /** 0..1 fill for the HUD ring. */
  get progress(): number {
    return this.active ? Math.min(1, this.elapsed / this.duration) : 0;
  }

  get hasSturdyShell(): boolean {
    return this.sturdy;
  }

  setDuration(ticks: number): void {
    this.duration = Math.max(1, Math.floor(ticks));
  }

  setSturdyShell(enabled: boolean): void {
    this.sturdy = enabled;
  }

  /** Begins a heal only on a fresh press while grounded and hurt. */
  tryStart(input: InputSnapshot, host: HealHost): boolean {
    if (this.active) return false;
    if (!isPressed(input, 'heal') || !host.body.grounded) return false;
    if (!host.focus.canHeal || host.vitals.dead || host.vitals.hp >= host.vitals.maxHp) {
      return false;
    }
    this.active = true;
    this.elapsed = 0;
    host.pose.setState('heal', 'idle');
    return true;
  }

  /** Advances the channel. Returns false once it has finished or been cancelled. */
  step(input: InputSnapshot, host: HealHost): boolean {
    if (!this.active) return false;
    if (!isHeld(input, 'heal') || !host.body.grounded || host.vitals.dead) {
      this.cancel(host);
      return false;
    }

    this.elapsed += 1;
    if (this.elapsed < this.duration) return true;

    if (!host.focus.spendHeal()) {
      this.cancel(host);
      return false;
    }
    host.vitals.heal(1);
    host.pose.emit('heal');
    this.active = false;
    host.pose.setState('idle', 'idle');
    return false;
  }

  /**
   * A hit arrives while channeling. Sturdy Shell consumes the hit and the charge;
   * without it the channel simply breaks. Returns true when the hit was absorbed.
   */
  absorbHit(host: HealHost): boolean {
    if (!this.active) return false;
    if (!this.sturdy) {
      this.cancel(host);
      return false;
    }
    this.active = false;
    host.pose.emit('shield');
    host.pose.setState('idle', 'idle');
    return true;
  }

  cancel(host?: HealHost): void {
    if (!this.active) return;
    this.active = false;
    this.elapsed = 0;
    if (host && host.pose.state === 'heal') host.pose.setState('idle', 'idle');
  }
}
