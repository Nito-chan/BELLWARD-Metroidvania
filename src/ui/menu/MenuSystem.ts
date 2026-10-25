/**
 * Owns the pause overlay: opening/closing, focus handoff, keyboard capture, gamepad
 * polling and the bridge between the pure MenuModel and the DOM view.
 *
 * The simulation is frozen by Game while this is open; the menu's own rAF keeps gamepad
 * navigation alive independently of the fixed-tick loop.
 */
import './menu.css';
import type { MenuDebugState } from '../../debug/DebugState';
import type { ActionName } from '../../config/input';
import type { SfxKey } from '../../data/audio';
import type { Bindings } from '../../input/bindings';
import type { MapPinResult } from '../map/mapScreen';
import type { MapSnapshot } from '../map/mapTypes';
import { MenuModel } from './MenuModel';
import { MenuPad, type MenuDirection } from './MenuPad';
import { MenuView } from './MenuView';
import { ACTION_ORDER, bindingFocusId } from './menuContent';
import type { MenuAccessibility, MenuAudio, MenuScreen } from './menuTypes';

export type MenuSystemOptions = {
  bindings: Bindings;
  audio: MenuAudio;
  accessibility?: MenuAccessibility;
  applyBindings: (next: Bindings) => void;
  /** Called after the menu hides itself; Game resumes the loop here. */
  onClose: () => void;
  /** Applies the live screen-shake preference to the mounted room. */
  onScreenShakeChanged?: (enabled: boolean) => void;
  /** Current chart data, built when the map screen renders. */
  getMap: () => MapSnapshot;
  /** Persists one wax mark through the run, not the menu. */
  onMapPin: (roomId: string) => MapPinResult;
  /** Live keyboard codes for the map action, so M toggles the map closed too. */
  mapKeyCodes: () => readonly string[];
};

const NATIVE_RANGE_KEYS = new Set(['ArrowLeft', 'ArrowRight', 'Home', 'End', 'PageUp', 'PageDown']);

export class MenuSystem {
  private readonly model: MenuModel;
  private readonly view: MenuView;
  private readonly pad: MenuPad;
  private openValue = false;

  constructor(private readonly options: MenuSystemOptions) {
    this.model = new MenuModel({
      bindings: options.bindings,
      audio: options.audio,
      accessibility: options.accessibility,
      applyBindings: options.applyBindings,
    });
    this.view = new MenuView({
      onCommand: (command) => this.onCommand(command),
      onVolume: (bus, value) => this.model.setVolume(bus, value),
      getMap: () => this.options.getMap(),
      onMapPin: (roomId) => this.options.onMapPin(roomId),
    });
    this.pad = new MenuPad({
      captureKind: () => this.model.capture?.kind ?? null,
      onCaptureCancel: () => {
        const capture = this.model.capture;
        this.model.cancelCapture();
        this.playUi('uiBack');
        this.syncView(
          capture ? bindingFocusId(capture.action, capture.kind, capture.slot) : undefined,
        );
      },
      onCaptureButton: (index) => {
        const capture = this.model.capture;
        this.model.usePadButton(index);
        this.playUi('uiMove');
        this.syncView(
          capture ? bindingFocusId(capture.action, capture.kind, capture.slot) : undefined,
        );
      },
      onPause: () => this.requestClose(true),
      onBack: () => this.handleBack(),
      onConfirm: () => this.view.activateFocused(),
      onDirection: (direction) => this.applyDirection(direction),
    });
  }

  get isOpen(): boolean {
    return this.openValue;
  }

  mount(): void {
    this.view.mount();
    document.addEventListener('keydown', this.onKeyDown, { capture: true });
  }

  open(screen: MenuScreen = 'pause', options: { mapBoot?: boolean } = {}): void {
    if (this.openValue) return;
    this.openValue = true;
    this.view.setMapBoot(options.mapBoot ?? false);
    this.model.open(screen);
    this.view.show();
    this.setGameInert(true);
    this.view.render(this.model, null, true);
    this.pad.start();
  }

  /** A fresh climb earns the Tideglass reveal again. */
  resetMapMoment(): void {
    this.view.resetMapMoment();
  }

  close(): void {
    if (!this.openValue) return;
    this.openValue = false;
    this.pad.stop();
    this.model.close();
    this.view.hide();
    this.setGameInert(false);
  }

  debugState(): MenuDebugState {
    return {
      open: this.openValue,
      screen: this.model.screen,
      capture: this.model.capture,
      status: this.model.status,
      focus: this.openValue ? this.view.focusId() : null,
      bindings: this.model.bindings,
    };
  }

  private requestClose(fromPad = false): void {
    if (fromPad) this.playUi('uiBack');
    this.close();
    this.options.onClose();
  }

  private onCommand(command: string): void {
    if (!this.openValue) return;

    if (command === 'resume') {
      this.playUi('uiConfirm');
      this.requestClose();
      return;
    }
    if (command === 'settings' || command === 'controls' || command === 'map') {
      this.playUi('uiConfirm');
      this.model.navigate(command);
      this.view.render(this.model, null, true);
      return;
    }
    if (command === 'back') {
      this.handleBack();
      return;
    }
    if (command === 'mute') {
      this.playUi('uiConfirm');
      this.model.toggleMute();
      this.syncView('settings:mute');
      return;
    }
    if (command === 'screen-shake') {
      this.playUi('uiConfirm');
      const enabled = this.model.toggleScreenShake();
      this.options.onScreenShakeChanged?.(enabled);
      this.syncView('settings:screen-shake');
      return;
    }
    if (command === 'reset') {
      this.playUi('uiConfirm');
      this.model.requestReset();
      this.syncView('controls:reset');
      return;
    }
    if (command === 'cancel-capture') {
      const capture = this.model.capture;
      this.playUi('uiBack');
      this.model.cancelCapture();
      this.syncView(
        capture ? bindingFocusId(capture.action, capture.kind, capture.slot) : undefined,
      );
      return;
    }
    if (command.startsWith('bind:')) {
      const [prefix, action, kind, slotText] = command.split(':');
      if (
        prefix !== 'bind' ||
        !isAction(action) ||
        (kind !== 'key' && kind !== 'pad') ||
        slotText === undefined
      ) {
        return;
      }
      const slot = Number(slotText);
      if (!Number.isInteger(slot) || slot < 0) return;
      this.playUi('uiMove');
      this.model.beginCapture(action, kind, slot);
      this.view.render(this.model, bindingFocusId(action, kind, slot), false);
    }
  }

  private handleBack(): void {
    const capture = this.model.capture;
    const result = this.model.back();
    this.playUi('uiBack');
    if (result === 'closed') {
      this.requestClose();
      return;
    }
    if (result === 'changed') {
      this.view.render(this.model, null, true);
      return;
    }
    this.syncView(capture ? bindingFocusId(capture.action, capture.kind, capture.slot) : undefined);
  }

  private syncView(focusId?: string): void {
    this.view.render(this.model, focusId ?? this.view.focusId(), false);
  }

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    if (!this.openValue) return;
    const code = event.code;

    if (this.model.capture) {
      const capture = this.model.capture;
      if (event.repeat) {
        event.preventDefault();
        event.stopPropagation();
        return;
      }
      if (code === 'Escape') {
        this.playUi('uiBack');
        this.model.cancelCapture();
        this.syncView(bindingFocusId(capture.action, capture.kind, capture.slot));
      } else if (capture.kind === 'key') {
        this.model.useKey(code);
        this.syncView(bindingFocusId(capture.action, capture.kind, capture.slot));
      }
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    const target = event.target;
    if (
      target instanceof HTMLInputElement &&
      target.type === 'range' &&
      NATIVE_RANGE_KEYS.has(code)
    ) {
      return;
    }

    // The map's own action closes it, matching the shortcut that opened it. Rebinding
    // the action updates the code list live, so this is never a hard-coded M.
    if (this.model.screen === 'map' && this.options.mapKeyCodes().includes(code)) {
      this.handleBack();
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    // The chart owns fit, locate and zoom while it is open; these never reach gameplay.
    if (this.model.screen === 'map' && this.view.handleMapKey(code)) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    switch (code) {
      case 'Escape':
        this.handleBack();
        break;
      case 'ArrowUp':
      case 'KeyW':
        this.moveFocus('up');
        break;
      case 'ArrowDown':
      case 'KeyS':
        this.moveFocus('down');
        break;
      case 'ArrowLeft':
      case 'KeyA':
        this.moveFocus('left');
        break;
      case 'ArrowRight':
      case 'KeyD':
        this.moveFocus('right');
        break;
      case 'Enter':
      case 'Space':
        if (!event.repeat) this.view.activateFocused();
        break;
      case 'Tab':
        this.view.trapTab(event.shiftKey);
        this.playUi('uiMove');
        break;
      default:
        break;
    }

    // Modal: no gameplay key, browser scroll or F-key reaches the page underneath.
    event.preventDefault();
    event.stopPropagation();
  };

  private applyDirection(direction: MenuDirection): void {
    if (direction === 'left' || direction === 'right') {
      const steps = direction === 'left' ? -1 : 1;
      if (this.view.stepFocusedRange(steps)) {
        this.playUi('uiMove');
        return;
      }
    }
    this.moveFocus(direction);
  }

  /** Moves focus only when it actually changes, so holding a direction cannot machine-gun. */
  private moveFocus(direction: MenuDirection): void {
    const before = this.view.focusId();
    this.view.moveFocus(direction);
    if (this.view.focusId() !== before) this.playUi('uiMove');
  }

  private playUi(key: SfxKey): void {
    this.options.audio.playSfx?.(key);
  }

  private setGameInert(inert: boolean): void {
    const app = document.getElementById('app');
    if (!app) return;
    if (inert) app.setAttribute('inert', '');
    else app.removeAttribute('inert');
  }
}

function isAction(value: string | undefined): value is ActionName {
  return value !== undefined && (ACTION_ORDER as readonly string[]).includes(value);
}
