/**
 * Gamepad polling for the pause overlay. Runs on its own rAF loop while the menu is open;
 * the fixed-tick simulation is paused, so this is deliberately not tied to the game loop.
 * The class owns only edge detection, capture filtering and direction repeat; all actions
 * are delegated to MenuSystem through handlers.
 */
import { INPUT } from '../../config/input';
import { MENU } from '../../config/menu';

export type MenuDirection = 'up' | 'down' | 'left' | 'right';

export type MenuPadHandlers = {
  /** Current rebinding capture kind, or null when the menu is navigating normally. */
  captureKind(): 'key' | 'pad' | null;
  onCaptureCancel(): void;
  onCaptureButton(index: number): void;
  onPause(): void;
  onBack(): void;
  onConfirm(): void;
  onDirection(direction: MenuDirection): void;
};

export class MenuPad {
  private active = false;
  private frame: number | null = null;
  private previous: boolean[] = [];
  private direction: MenuDirection | null = null;
  private directionStartedAt = 0;
  private directionRepeatedAt = 0;

  constructor(private readonly handlers: MenuPadHandlers) {}

  start(): void {
    this.stop();
    this.active = true;
    this.previous = this.readButtons();
    this.direction = null;
    if (typeof requestAnimationFrame === 'function') {
      this.frame = requestAnimationFrame(this.poll);
    }
  }

  stop(): void {
    this.active = false;
    if (this.frame !== null) {
      cancelAnimationFrame(this.frame);
      this.frame = null;
    }
  }

  private readonly poll = (now: number): void => {
    this.frame = null;
    if (!this.active) return;

    const pad = this.readPad();
    if (!pad) {
      this.previous = [];
      this.direction = null;
      this.frame = requestAnimationFrame(this.poll);
      return;
    }

    const pressed = pad.buttons.map((button) => button.pressed);
    const edge = (index: number): boolean =>
      pressed[index] === true && this.previous[index] !== true;

    const capture = this.handlers.captureKind();
    if (capture) {
      if (edge(MENU.pad.cancelCapture)) {
        this.handlers.onCaptureCancel();
      } else if (capture === 'pad') {
        for (let index = 0; index < pressed.length; index += 1) {
          if (!edge(index)) continue;
          this.handlers.onCaptureButton(index);
          break;
        }
      }
    } else if (edge(MENU.pad.pause)) {
      this.handlers.onPause();
      return;
    } else if (edge(MENU.pad.back) || edge(MENU.pad.cancelCapture)) {
      this.handlers.onBack();
    } else if (edge(MENU.pad.confirm)) {
      this.handlers.onConfirm();
    } else {
      this.handleDirection(pad, now);
    }

    this.previous = pressed;
    if (this.active) this.frame = requestAnimationFrame(this.poll);
  };

  private handleDirection(pad: Gamepad, now: number): void {
    const direction = this.directionFrom(pad);
    if (!direction) {
      this.direction = null;
      return;
    }

    if (direction !== this.direction) {
      this.direction = direction;
      this.directionStartedAt = now;
      this.directionRepeatedAt = now;
      this.handlers.onDirection(direction);
      return;
    }

    if (
      now - this.directionStartedAt >= MENU.repeatDelayMs &&
      now - this.directionRepeatedAt >= MENU.repeatEveryMs
    ) {
      this.directionRepeatedAt = now;
      this.handlers.onDirection(direction);
    }
  }

  private directionFrom(pad: Gamepad): MenuDirection | null {
    const button = (index: number): boolean => pad.buttons[index]?.pressed === true;
    if (button(MENU.pad.up)) return 'up';
    if (button(MENU.pad.down)) return 'down';
    if (button(MENU.pad.left)) return 'left';
    if (button(MENU.pad.right)) return 'right';

    const x = pad.axes[0] ?? 0;
    const y = pad.axes[1] ?? 0;
    if (Math.abs(x) >= MENU.stickDeadzone && Math.abs(x) >= Math.abs(y)) {
      return x < 0 ? 'left' : 'right';
    }
    if (Math.abs(y) >= MENU.stickDeadzone) return y < 0 ? 'up' : 'down';
    return null;
  }

  private readPad(): Gamepad | null {
    if (typeof navigator === 'undefined' || typeof navigator.getGamepads !== 'function') {
      return null;
    }
    const pad = navigator.getGamepads()[INPUT.gamepadIndex] ?? null;
    return pad?.connected ? pad : null;
  }

  private readButtons(): boolean[] {
    const pad = this.readPad();
    return pad ? pad.buttons.map((button) => button.pressed) : [];
  }
}
