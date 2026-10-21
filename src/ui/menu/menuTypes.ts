/** Shared menu vocabulary, kept out of the DOM and model modules. */
import type { AudioBus, AudioMix } from '../../audio/AudioManager';
import type { ActionName } from '../../config/input';
import type { SfxKey } from '../../data/audio';

export type MenuScreen = 'pause' | 'settings' | 'controls' | 'map';
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
  /** Optional so the pure unit model can run against a silent fake. */
  playSfx?(key: SfxKey): void;
};

/** The narrow accessibility surface the settings screen will render. */
export type MenuAccessibility = {
  screenShake(): boolean;
  setScreenShake(enabled: boolean): boolean;
};

export type StatusTone = 'info' | 'error' | 'capture';
