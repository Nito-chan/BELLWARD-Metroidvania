/**
 * Pure menu state machine: screens, rebinding capture, audio settings and the two-step
 * reset. It never touches the DOM, so the unit suite exercises every transition directly.
 */
import type { AudioBus } from '../../audio/AudioManager';
import type { ActionName } from '../../config/input';
import { MENU } from '../../config/menu';
import {
  defaultBindings,
  describeKeyCode,
  formatPadButton,
  setKeyboardBinding,
  setPadBinding,
  type Bindings,
} from '../../input/bindings';
import { ACTION_LABELS, slotLabel } from './menuContent';
import type {
  BindingKind,
  CaptureTarget,
  MenuAccessibility,
  MenuAudio,
  MenuScreen,
  StatusTone,
} from './menuTypes';

export type MenuModelOptions = {
  bindings: Bindings;
  audio: MenuAudio;
  accessibility?: MenuAccessibility;
  /** Applies and persists a new binding document. */
  applyBindings: (next: Bindings) => void;
};

export type BackResult = 'closed' | 'changed' | 'cancelled';
export type ResetResult = 'armed' | 'applied';

const BUSES: readonly AudioBus[] = ['master', 'music', 'sfx'];

export class MenuModel {
  private bindingsValue: Bindings;
  private screenValue: MenuScreen | null = null;
  private captureValue: CaptureTarget | null = null;
  private statusValue = '';
  private toneValue: StatusTone = 'info';
  private resetArmedValue = false;

  constructor(private readonly options: MenuModelOptions) {
    this.bindingsValue = options.bindings;
  }

  get screen(): MenuScreen | null {
    return this.screenValue;
  }

  get capture(): CaptureTarget | null {
    return this.captureValue;
  }

  get status(): string {
    return this.statusValue;
  }

  get statusTone(): StatusTone {
    return this.toneValue;
  }

  get resetArmed(): boolean {
    return this.resetArmedValue;
  }

  get bindings(): Bindings {
    return this.bindingsValue;
  }

  open(screen: MenuScreen = 'pause'): void {
    this.screenValue = screen;
    this.captureValue = null;
    this.statusValue = '';
    this.toneValue = 'info';
    this.resetArmedValue = false;
  }

  navigate(screen: MenuScreen): void {
    this.screenValue = screen;
    this.captureValue = null;
    this.statusValue = '';
    this.toneValue = 'info';
    this.resetArmedValue = false;
  }

  close(): void {
    this.screenValue = null;
    this.captureValue = null;
    this.statusValue = '';
    this.toneValue = 'info';
    this.resetArmedValue = false;
  }

  /** Escape / Back: cancels capture, backs one screen, or closes from pause/map. */
  back(): BackResult {
    if (this.captureValue) {
      this.cancelCapture();
      return 'cancelled';
    }
    if (this.screenValue === null || this.screenValue === 'pause' || this.screenValue === 'map') {
      this.close();
      return 'closed';
    }
    this.navigate('pause');
    return 'changed';
  }

  beginCapture(action: ActionName, kind: BindingKind, slot: number): void {
    this.captureValue = { action, kind, slot };
    this.resetArmedValue = false;
    this.toneValue = 'capture';
    if (kind === 'key') {
      this.statusValue = `Press a key for ${ACTION_LABELS[action]} · ${slotLabel(kind, slot)}. Escape cancels.`;
    } else {
      this.statusValue = `Press a pad button for ${ACTION_LABELS[action]} · Pad. Escape or Select cancels.`;
    }
  }

  /** Captures a keyboard code for the current target. */
  useKey(code: string): void {
    const capture = this.captureValue;
    if (!capture || capture.kind !== 'key') return;

    if ((MENU.reservedKeys as readonly string[]).includes(code)) {
      this.toneValue = 'error';
      this.statusValue = 'That key belongs to the menu. Press another key, or Escape to cancel.';
      return;
    }

    const edit = setKeyboardBinding(this.bindingsValue, capture.action, capture.slot, code);
    if (edit.conflict) {
      this.toneValue = 'error';
      this.statusValue = `${this.conflictMessage(edit.conflict.action, 'key', edit.conflict.slot)} Press another key, or Escape to cancel.`;
      return;
    }

    this.commit(edit.bindings);
    this.toneValue = 'info';
    this.statusValue = `Bound ${ACTION_LABELS[capture.action]} · ${slotLabel('key', capture.slot)} to ${describeKeyCode(code)}.`;
    this.captureValue = null;
  }

  /** Captures a gamepad button for the current target. */
  usePadButton(button: number): void {
    const capture = this.captureValue;
    if (!capture || capture.kind !== 'pad') return;

    if ((MENU.reservedPadButtons as readonly number[]).includes(button)) {
      this.toneValue = 'error';
      this.statusValue =
        'That button belongs to the menu. Press another button, or Select to cancel.';
      return;
    }

    const edit = setPadBinding(this.bindingsValue, capture.action, capture.slot, button);
    if (edit.conflict) {
      this.toneValue = 'error';
      this.statusValue = `${this.conflictMessage(edit.conflict.action, 'pad', edit.conflict.slot)} Press another button, or Select to cancel.`;
      return;
    }

    this.commit(edit.bindings);
    this.toneValue = 'info';
    this.statusValue = `Bound ${ACTION_LABELS[capture.action]} · Pad to ${formatPadButton(button)}.`;
    this.captureValue = null;
  }

  cancelCapture(): void {
    if (!this.captureValue) return;
    this.captureValue = null;
    this.toneValue = 'info';
    this.statusValue = 'Rebinding cancelled.';
  }

  /** First call arms; the second restores every shipped binding. */
  requestReset(): ResetResult {
    if (!this.resetArmedValue) {
      this.resetArmedValue = true;
      this.captureValue = null;
      this.toneValue = 'info';
      this.statusValue = 'Press Reset defaults again to restore every binding.';
      return 'armed';
    }

    this.resetArmedValue = false;
    this.captureValue = null;
    this.commit(defaultBindings());
    this.toneValue = 'info';
    this.statusValue = 'Default bindings restored.';
    return 'applied';
  }

  getVolume(bus: AudioBus): number {
    return this.options.audio.getMix()[bus];
  }

  audioIsMuted(): boolean {
    return this.options.audio.isMuted();
  }

  /** Applies a clamped absolute level. Used by the native range inputs. */
  setVolume(bus: AudioBus, value: number): void {
    if (!BUSES.includes(bus)) return;
    this.options.audio.setVolume(bus, Math.max(0, Math.min(1, value)));
  }

  /** Steps a fader by a whole number of configured increments. */
  adjustVolume(bus: AudioBus, steps: number): number {
    const next = Math.max(
      0,
      Math.min(1, Math.round((this.getVolume(bus) + steps * MENU.volumeStep) * 100) / 100),
    );
    this.setVolume(bus, next);
    return next;
  }

  toggleMute(): boolean {
    const muted = this.options.audio.setMuted(!this.options.audio.isMuted());
    this.toneValue = 'info';
    this.statusValue = muted ? 'Audio muted.' : 'Audio unmuted.';
    return muted;
  }

  /** True when the settings screen can offer the motion toggle. */
  supportsScreenShake(): boolean {
    return this.options.accessibility !== undefined;
  }

  screenShakeEnabled(): boolean {
    return this.options.accessibility?.screenShake() ?? true;
  }

  toggleScreenShake(): boolean {
    const accessibility = this.options.accessibility;
    if (!accessibility) return true;
    const enabled = accessibility.setScreenShake(!accessibility.screenShake());
    this.toneValue = 'info';
    this.statusValue = enabled
      ? 'Camera shake enabled.'
      : 'Camera shake disabled. Impact is still shown by flash and hit-stop.';
    return enabled;
  }

  private commit(next: Bindings): void {
    this.bindingsValue = next;
    this.options.applyBindings(next);
  }

  private conflictMessage(action: ActionName, kind: BindingKind, slot: number): string {
    return `That input is already bound to ${ACTION_LABELS[action]} · ${slotLabel(kind, slot)}.`;
  }
}
