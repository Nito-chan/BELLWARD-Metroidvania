/** Shared menu vocabulary, kept out of the DOM and model modules. */
import type { AudioBus, AudioMix } from '../../audio/AudioManager';
import type { ActionName } from '../../config/input';

export type MenuScreen = 'pause' | 'settings' | 'controls';
export type BindingKind = 'key' | 'pad';

export type CaptureTarget = {
  readonly action: ActionName;
  readonly kind: BindingKind;
  readonly slot: number;
};

/** The narrow audio surface the menu model needs; AudioManager implements it. */
export type MenuAudio = {
  getMix(): AudioMix;
  setVolume(bus: AudioBus, value: number): void;
  isMuted(): boolean;
  setMuted(muted: boolean): boolean;
};

export type StatusTone = 'info' | 'error' | 'capture';
