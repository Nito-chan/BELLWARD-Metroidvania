/**
 * A compact, non-modal first-run hint strip. It never steals input or focus and is
 * dismissible by pointer or keyboard; the browser's native button semantics do the work.
 */
import './start.css';
import { ONBOARDING } from '../../config/onboarding';
import type { Bindings } from '../../input/bindings';
import { formatKeyCode } from '../../input/bindingLabels';

export type OnboardingOptions = {
  /** Read on every refresh so live rebinds never leave stale keycaps on screen. */
  readonly getBindings: () => Bindings;
};

export class Onboarding {
  readonly root: HTMLElement;
  private readonly hints: HTMLElement;
  private timer: number | null = null;
  private openValue = false;

  constructor(private readonly options: OnboardingOptions) {
    this.root = document.createElement('aside');
    this.root.className = 'onboarding-root';
    this.root.dataset.testid = 'onboarding-root';
    this.root.hidden = true;
    this.root.setAttribute('role', 'note');
    this.root.setAttribute('aria-label', 'First steps');

    const kicker = document.createElement('p');
    kicker.className = 'onboarding-kicker';
    kicker.textContent = 'First steps';

    this.hints = document.createElement('div');
    this.hints.className = 'onboarding-hints';
    this.renderHints();

    const note = document.createElement('p');
    note.className = 'onboarding-note';
    note.textContent = 'Rest at a bell to save.';

    const dismiss = document.createElement('button');
    dismiss.type = 'button';
    dismiss.className = 'onboarding-dismiss';
    dismiss.setAttribute('aria-label', 'Dismiss first steps');
    dismiss.textContent = '×';
    dismiss.addEventListener('click', () => this.dismiss());

    const copy = document.createElement('div');
    copy.className = 'onboarding-copy';
    copy.append(kicker, note);
    this.root.append(copy, this.hints, dismiss);
    // A keyboard user who has reached the hint strip should not lose focus when the
    // auto-hide timer fires; the clock resumes when focus leaves the strip.
    this.root.addEventListener('focusin', () => this.clearTimer());
    this.root.addEventListener('focusout', (event) => {
      if (!this.openValue || this.root.classList.contains('is-leaving')) return;
      const next = event.relatedTarget;
      if (next instanceof Node && this.root.contains(next)) return;
      this.scheduleHide();
    });
  }

  get isOpen(): boolean {
    return this.openValue;
  }

  mount(): void {
    document.body.append(this.root);
  }

  /** Rebuilds the keycaps after a rebind without reopening or restarting the timer. */
  refresh(): void {
    this.renderHints();
  }

  show(): void {
    if (this.openValue) return;
    this.openValue = true;
    this.renderHints();
    this.root.hidden = false;
    this.root.classList.remove('is-leaving');
    this.scheduleHide();
  }

  dismiss(): void {
    if (!this.openValue) return;
    this.clearTimer();
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true) {
      this.finishDismiss();
      return;
    }
    this.root.classList.add('is-leaving');
    this.timer = window.setTimeout(() => this.finishDismiss(), ONBOARDING.leavingMs);
  }

  debugState(): { open: boolean } {
    return { open: this.openValue };
  }

  private finishDismiss(): void {
    this.clearTimer();
    this.openValue = false;
    this.root.hidden = true;
    this.root.classList.remove('is-leaving');
  }

  private renderHints(): void {
    const keyboard = this.options.getBindings().keyboard;
    this.hints.replaceChildren(
      hint(
        `${formatKeyCode(keyboard.left[0] ?? '')} ${formatKeyCode(keyboard.right[0] ?? '')}`,
        'Move',
      ),
      hint(formatKeyCode(keyboard.jump[0] ?? ''), 'Jump'),
      hint(formatKeyCode(keyboard.attack[0] ?? ''), 'Strike'),
      hint(formatKeyCode(keyboard.interact[0] ?? ''), 'Rest / use'),
      hint(formatKeyCode(keyboard.pause[0] ?? ''), 'Pause'),
    );
  }

  private clearTimer(): void {
    if (this.timer !== null) {
      window.clearTimeout(this.timer);
      this.timer = null;
    }
  }

  private scheduleHide(): void {
    this.clearTimer();
    this.timer = window.setTimeout(() => this.dismiss(), ONBOARDING.visibleMs);
  }
}

function hint(keys: string, label: string): HTMLElement {
  const node = document.createElement('span');
  node.className = 'onboarding-hint';
  if (keys.trim().length > 0) {
    const key = document.createElement('kbd');
    key.className = 'onboarding-key';
    key.textContent = keys;
    node.append(key);
  }
  const text = document.createElement('span');
  text.className = 'onboarding-hint-label';
  text.textContent = label;
  node.append(text);
  return node;
}
