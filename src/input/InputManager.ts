import {
  ACTIONS,
  INPUT,
  KEY_BINDINGS,
  PAD_AXES,
  PAD_BUTTONS,
  type ActionName,
} from '../config/input';
import type { InputSnapshot } from './InputState';

/** The slice of the Gamepad API the manager reads, so tests can inject fake pads. */
export type PadReading = {
  buttons: readonly boolean[];
  axes: readonly number[];
} | null;

export type InputManagerOptions = {
  /** Pad source; defaults to `navigator.getGamepads()`. */
  getPad?: () => PadReading;
};

/**
 * Turns keyboard and gamepad events into per-tick snapshots.
 *
 * The simulation never touches DOM events: it calls `snapshot()` exactly once per fixed
 * tick. Key edges that arrive between ticks are queued, so a 10 ms tap is never lost
 * across two 16.7 ms ticks, and OS auto-repeat can never produce duplicate presses.
 */
export class InputManager {
  private readonly held = new Set<ActionName>();
  private readonly pressed = new Set<ActionName>();
  private readonly released = new Set<ActionName>();
  private readonly pendingPressed = new Set<ActionName>();
  private readonly pendingReleased = new Set<ActionName>();
  private readonly keysDown = new Set<string>();
  private readonly padHeld = new Set<ActionName>();
  private readonly boundCodes = new Set<string>();

  constructor(private readonly options: InputManagerOptions = {}) {
    for (const codes of Object.values(KEY_BINDINGS)) {
      for (const code of codes) this.boundCodes.add(code);
    }
  }

  /** True when `code` is bound to an action; the DOM layer suppresses its default. */
  isBoundCode(code: string): boolean {
    return this.boundCodes.has(code);
  }

  /**
   * Feeds one key event. Returns true when the code is bound. Auto-repeat (the OS
   * re-firing keydown while a key is held) is ignored so press edges stay single.
   */
  handleKey(code: string, down: boolean): boolean {
    if (!this.boundCodes.has(code)) return false;

    if (down) {
      if (this.keysDown.has(code)) return true;
      this.keysDown.add(code);
      for (const action of actionsBoundTo(code)) {
        if (!this.held.has(action)) {
          this.held.add(action);
          this.pendingPressed.add(action);
        }
      }
      return true;
    }

    if (!this.keysDown.delete(code)) return true;
    for (const action of actionsBoundTo(code)) {
      if (!this.isKeyHeld(action) && !this.padHeld.has(action) && this.held.delete(action)) {
        this.pendingReleased.add(action);
      }
    }
    return true;
  }

  /** Clears every held key (window blur): nothing is worse than a stuck run key. */
  blur(): void {
    this.keysDown.clear();
    for (const action of [...this.held]) {
      if (!this.padHeld.has(action) && this.held.delete(action)) {
        this.pendingReleased.add(action);
      }
    }
  }

  /** Takes this tick's snapshot; pressed/released edges are consumed by the call. */
  snapshot(): InputSnapshot {
    this.applyPad();
    this.pressed.clear();
    this.released.clear();
    for (const action of this.pendingPressed) this.pressed.add(action);
    for (const action of this.pendingReleased) this.released.add(action);
    this.pendingPressed.clear();
    this.pendingReleased.clear();
    return { held: this.held, pressed: this.pressed, released: this.released };
  }

  /** Serialized bindings for the binding editor / settings UI (M5). */
  serialize(): string {
    return JSON.stringify({
      version: INPUT.bindingFormatVersion,
      keyboard: KEY_BINDINGS,
      gamepad: { buttons: PAD_BUTTONS, axes: PAD_AXES },
    });
  }

  private isKeyHeld(action: ActionName): boolean {
    for (const code of KEY_BINDINGS[action]) {
      if (this.keysDown.has(code)) return true;
    }
    return false;
  }

  /** Merges the pad's current state into held plus press/release edges. */
  private applyPad(): void {
    const pad = this.readPad();
    const now = new Set<ActionName>();
    if (pad) {
      for (const action of ACTIONS) {
        if (padActionActive(pad, action)) now.add(action);
      }
    }

    for (const action of now) {
      if (!this.padHeld.has(action) && !this.held.has(action)) {
        this.held.add(action);
        this.pendingPressed.add(action);
      }
    }
    for (const action of this.padHeld) {
      if (!now.has(action) && !this.isKeyHeld(action) && this.held.delete(action)) {
        this.pendingReleased.add(action);
      }
    }

    this.padHeld.clear();
    for (const action of now) this.padHeld.add(action);
  }

  private readPad(): PadReading {
    if (this.options.getPad) return this.options.getPad();
    if (typeof navigator === 'undefined' || typeof navigator.getGamepads !== 'function') {
      return null;
    }
    const pad = navigator.getGamepads()[INPUT.gamepadIndex] ?? null;
    if (!pad || !pad.connected) return null;
    return {
      buttons: pad.buttons.map((button) => button.pressed),
      axes: Array.from(pad.axes),
    };
  }
}

/** Every action a keyboard code is bound to (bindings may double up, e.g. ArrowUp/W). */
function actionsBoundTo(code: string): ActionName[] {
  return ACTIONS.filter((action) => KEY_BINDINGS[action].includes(code));
}

function padActionActive(pad: NonNullable<PadReading>, action: ActionName): boolean {
  const buttons = PAD_BUTTONS[action];
  if (buttons) {
    for (const index of buttons) {
      if (pad.buttons[index] === true) return true;
    }
  }
  const axis = PAD_AXES[action];
  if (axis) {
    const value = pad.axes[axis.axis] ?? 0;
    return axis.dir < 0 ? value <= -INPUT.stickDeadzone : value >= INPUT.stickDeadzone;
  }
  return false;
}
