import type { PlayerEvent, PlayerStateName } from './PlayerTypes';

/**
 * The player's visible state: FSM name, animation clip, clip clock and tick events.
 * Simulation owns it; views only sample it after the tick.
 */
export class PlayerPose {
  private stateValue: PlayerStateName = 'idle';
  private animationValue = 'idle';
  private clipTickValue = 0;
  private restartedValue = true;
  private readonly eventBuffer: PlayerEvent[] = [];

  get state(): PlayerStateName {
    return this.stateValue;
  }

  get animation(): string {
    return this.animationValue;
  }

  get clipTick(): number {
    return this.clipTickValue;
  }

  /** True on the tick a new clip started, so the view can restart one-shots. */
  get restarted(): boolean {
    return this.restartedValue;
  }

  /** Events from the most recent tick, in order. */
  get events(): readonly PlayerEvent[] {
    return this.eventBuffer;
  }

  beginTick(): void {
    this.restartedValue = false;
    this.eventBuffer.length = 0;
  }

  tickClip(): void {
    this.clipTickValue += 1;
  }

  setState(state: PlayerStateName, animation: string): void {
    this.stateValue = state;
    this.beginClip(animation);
  }

  /** Used by reactions whose animation is chosen by the existing clip. */
  forceState(state: PlayerStateName): void {
    this.stateValue = state;
  }

  beginClip(name: string): void {
    if (this.animationValue === name) return;
    this.animationValue = name;
    this.clipTickValue = 0;
    this.restartedValue = true;
  }

  emit(event: PlayerEvent): void {
    this.eventBuffer.push(event);
  }
}
