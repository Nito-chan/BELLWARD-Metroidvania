/**
 * The first screen. Boots into a game-first command plate over the live terrace while
 * the simulation stays paused behind it. Starting is a real user gesture, which is also
 * what unlocks browser audio. All navigation is DOM-native: buttons, focus, labels.
 */
import './start.css';
import { AUDIO } from '../../config/audio';
import type { Bindings } from '../../input/bindings';
import { formatKeyCode } from '../../input/bindingLabels';
import type { SfxKey } from '../../data/audio';
import { MenuPad } from '../menu/MenuPad';

export type TitleSummary = {
  readonly sigils: number;
  readonly sigilTarget: number;
  readonly rooms: number;
  readonly roomTarget: number;
  readonly complete: boolean;
};

export type TitleScreenOptions = {
  readonly hasSave: boolean;
  readonly summary: TitleSummary | null;
  readonly bindings: Bindings;
  /** Touch devices get on-screen control hints instead of keyboard keycaps. */
  readonly touch?: boolean;
  readonly onBegin: () => void;
  readonly onNewRun: () => void;
  readonly onSfx?: (key: SfxKey) => void;
  /** Audio mute remains available before the run starts. */
  readonly onMute?: () => void;
};

export type TitleDebugState = {
  open: boolean;
  hasSave: boolean;
  newRunArmed: boolean;
  primaryLabel: string;
  focus: string | null;
};

export class TitleScreen {
  readonly root: HTMLElement;
  private readonly dialog: HTMLElement;
  private readonly primary: HTMLButtonElement;
  private readonly newRun: HTMLButtonElement;
  private readonly status: HTMLElement;
  private readonly pad: MenuPad;
  private openValue = false;
  private armed = false;

  constructor(private readonly options: TitleScreenOptions) {
    this.root = el('div', 'title-root');
    this.root.dataset.testid = 'title-root';
    this.root.hidden = true;

    const atmosphere = el('div', 'title-atmosphere');
    atmosphere.setAttribute('aria-hidden', 'true');
    atmosphere.append(el('div', 'title-caustics'), el('div', 'title-mist'));
    atmosphere.append(makeBellMark());
    atmosphere.append(el('div', 'title-tide-line'));

    this.dialog = el('main', 'title-panel');
    this.dialog.setAttribute('role', 'dialog');
    this.dialog.setAttribute('aria-modal', 'true');
    this.dialog.setAttribute('aria-labelledby', 'title-heading');
    this.dialog.setAttribute('aria-describedby', 'title-tagline title-save');

    const main = el('div', 'title-main');
    const header = el('header', 'title-header');
    const eyebrow = el('p', 'title-eyebrow');
    eyebrow.append(el('span', 'title-eyebrow-mark'), el('span', undefined, "A Pilgrim's Arrival"));
    const heading = el('h1', 'title-word', 'BELLWARD');
    heading.id = 'title-heading';
    const tagline = el('p', 'title-tagline', 'The water is listening');
    tagline.id = 'title-tagline';
    const rule = el('span', 'title-rule');
    header.append(eyebrow, heading, rule, tagline);

    this.primary = makeAction(
      options.hasSave ? 'Continue the climb' : 'Enter the belfry',
      'primary',
      options.hasSave ? 'Return to the last bell' : 'A new climb through the drowned city',
    );
    this.primary.classList.add('title-action-primary');

    this.newRun = makeAction('Begin anew', 'new', 'Erase the old record');
    this.newRun.classList.add('title-action-secondary');
    this.newRun.hidden = !options.hasSave;

    const actions = el('nav', 'title-actions');
    actions.setAttribute('aria-label', 'Start the game');
    actions.append(this.primary, this.newRun);

    const save = el('div', 'title-save');
    save.id = 'title-save';
    if (options.hasSave && options.summary) {
      const summary = options.summary;
      save.append(
        el(
          'p',
          'title-save-kicker',
          summary.complete ? 'The bell remembers' : 'A climb in progress',
        ),
        el(
          'p',
          'title-save-meta',
          summary.complete
            ? 'The ledger is sealed. The city is at rest.'
            : 'The ledger waits at the last bell.',
        ),
      );
      const progress = el('p', 'title-save-progress');
      progress.append(
        el('span', undefined, `Bells ${summary.sigils} / ${summary.sigilTarget}`),
        el('span', undefined, `Charted ${summary.rooms} / ${summary.roomTarget}`),
      );
      save.append(progress);
    } else {
      save.append(
        el('p', 'title-save-kicker', 'A silent bell'),
        el('p', 'title-save-meta', 'A rising sea · A road with no witnesses'),
      );
    }
    if (options.summary && options.summary.complete) save.classList.add('is-complete');

    this.status = el('p', 'title-status');
    this.status.setAttribute('role', 'status');
    this.status.setAttribute('aria-live', 'polite');
    this.status.setAttribute('aria-atomic', 'true');

    main.append(header, actions, save, this.status);
    this.dialog.append(main, this.buildRecord());
    this.root.append(this.buildTopbar(), atmosphere, this.dialog, this.buildFooter());

    this.primary.addEventListener('click', () => this.begin());
    this.newRun.addEventListener('click', () => this.requestNewRun());

    this.pad = new MenuPad({
      captureKind: () => null,
      onCaptureCancel: () => undefined,
      onCaptureButton: () => undefined,
      onPause: () => this.activateFocused(),
      onBack: () => this.moveFocus(-1),
      onConfirm: () => this.activateFocused(),
      onDirection: (direction) =>
        this.moveFocus(direction === 'up' || direction === 'left' ? -1 : 1),
    });
  }

  get isOpen(): boolean {
    return this.openValue;
  }

  mount(): void {
    document.body.append(this.root);
    document.addEventListener('keydown', this.onKeyDown, { capture: true });
  }

  open(): void {
    if (this.openValue) return;
    this.openValue = true;
    this.root.hidden = false;
    this.setGameInert(true);
    this.focusPrimary();
    this.pad.start();
  }

  close(): void {
    if (!this.openValue) return;
    this.openValue = false;
    this.pad.stop();
    this.root.hidden = true;
    this.setGameInert(false);
  }

  debugState(): TitleDebugState {
    return {
      open: this.openValue,
      hasSave: this.options.hasSave,
      newRunArmed: this.armed,
      primaryLabel: actionLabel(this.primary),
      focus: this.focusId(),
    };
  }

  private begin(): void {
    if (!this.openValue) return;
    this.play('uiConfirm');
    this.close();
    this.options.onBegin();
  }

  private requestNewRun(): void {
    if (!this.openValue || !this.options.hasSave) return;
    if (!this.armed) {
      this.armed = true;
      setActionLabel(this.newRun, 'Confirm new run', 'Erase the saved climb');
      this.newRun.setAttribute('aria-label', 'Confirm new run and erase the saved climb');
      this.newRun.classList.add('is-armed');
      this.status.textContent =
        'This erases the saved climb. Choose Confirm new run again to begin fresh.';
      this.play('uiMove');
      this.newRun.focus({ preventScroll: true });
      return;
    }
    this.play('uiConfirm');
    this.status.textContent = 'A new climb begins.';
    this.close();
    this.options.onNewRun();
  }

  /** Escape backs out of the destructive confirmation without touching the save. */
  private disarmNewRun(): void {
    this.armed = false;
    setActionLabel(this.newRun, 'Begin anew', 'Erase the old record');
    this.newRun.classList.remove('is-armed');
    this.status.textContent = 'New run cancelled. The saved climb is untouched.';
    this.play('uiBack');
    this.focusPrimary();
  }

  private buildTopbar(): HTMLElement {
    const bar = el('header', 'title-topbar');
    bar.setAttribute('aria-hidden', 'true');
    const brand = el('div', 'title-topbar-brand');
    brand.append(
      el('span', 'title-topbar-mark', '◆'),
      el('span', 'title-topbar-copy', 'The Drowned Belfry'),
    );
    const build = el('div', 'title-topbar-build');
    build.append(
      el('span', 'title-topbar-label', 'Slot I'),
      el('span', 'title-topbar-rule'),
      el('span', 'title-topbar-label', 'Build I'),
    );
    bar.append(brand, build);
    return bar;
  }

  private buildRecord(): HTMLElement {
    const record = el('aside', 'title-record');
    record.setAttribute('aria-label', 'Pilgrim record');
    const top = el('div', 'title-record-top');
    top.append(
      el('p', 'title-record-kicker', 'Pilgrim record'),
      el('span', 'title-record-slot', 'SLOT I'),
    );

    const seal = el('div', 'title-record-seal');
    seal.setAttribute('aria-hidden', 'true');
    seal.append(makeBellMark(), el('span', 'title-record-seal-word', 'Bell'));

    const state = el(
      'p',
      'title-record-state',
      this.options.hasSave
        ? this.options.summary?.complete
          ? 'REMEMBERED'
          : 'THE CLIMB IS UNFINISHED'
        : 'NO PILGRIMAGE RECORDED',
    );

    record.append(top, seal, state);
    if (this.options.hasSave && this.options.summary) {
      const summary = this.options.summary;
      const stats = el('dl', 'title-record-stats');
      stats.append(
        recordStat('Bells', `${summary.sigils} / ${summary.sigilTarget}`),
        recordStat('Charted', `${summary.rooms} / ${summary.roomTarget}`),
      );
      record.append(stats);
    } else {
      const empty = el('p', 'title-record-empty', 'The ledger is clean.');
      record.append(empty);
    }
    return record;
  }

  private buildFooter(): HTMLElement {
    const footer = el('footer', 'title-footer');
    const hints = el('div', 'title-hints');
    if (this.options.touch) {
      hints.append(hint('', 'Tap to choose'), hint('', 'Landscape'), hint('', 'Headphones'));
      footer.append(hints, el('p', 'title-footnote', 'Touch · Wide screen · Audio'));
      return footer;
    }

    hints.append(
      hint('↑ ↓', 'Choose'),
      hint('Enter / A', 'Confirm'),
      hint(formatKeyCode(AUDIO.muteKey), 'Mute'),
    );
    footer.append(hints, el('p', 'title-footnote', 'Keyboard · Gamepad · Headphones'));
    return footer;
  }

  private activateFocused(): void {
    const active = document.activeElement;
    if (active === this.newRun && !this.newRun.hidden) {
      this.newRun.click();
      return;
    }
    this.primary.click();
  }

  private moveFocus(step: number): void {
    if (this.newRun.hidden) {
      this.focusPrimary();
      return;
    }
    const buttons = [this.primary, this.newRun];
    const active = document.activeElement as HTMLButtonElement | null;
    if (active !== this.primary && active !== this.newRun) {
      this.focusPrimary();
      return;
    }
    const index = buttons.indexOf(active);
    const next = buttons[(index + step + buttons.length) % buttons.length];
    if (!next) return;
    next.focus({ preventScroll: true });
    this.play('uiMove');
  }

  private focusPrimary(): void {
    this.primary.focus({ preventScroll: true });
  }

  private focusId(): string | null {
    if (document.activeElement === this.primary) return 'title:primary';
    if (document.activeElement === this.newRun) return 'title:new-run';
    return null;
  }

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    if (!this.openValue) return;

    if (event.code === 'Enter' || event.code === 'Space') {
      // Activate the focused native button ourselves so the game never sees the key.
      event.preventDefault();
      event.stopPropagation();
      if (!event.repeat) this.activateFocused();
      return;
    }

    if (event.code === 'Tab') {
      this.moveFocus(event.shiftKey ? -1 : 1);
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    if (
      event.code === 'ArrowDown' ||
      event.code === 'ArrowRight' ||
      event.code === 'KeyS' ||
      event.code === 'KeyD'
    ) {
      this.moveFocus(1);
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    if (
      event.code === 'ArrowUp' ||
      event.code === 'ArrowLeft' ||
      event.code === 'KeyW' ||
      event.code === 'KeyA'
    ) {
      this.moveFocus(-1);
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    if (event.code === 'Escape' && this.armed) {
      this.disarmNewRun();
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    if (event.code === AUDIO.muteKey) {
      event.preventDefault();
      event.stopPropagation();
      if (!event.repeat) this.options.onMute?.();
      return;
    }

    // The title owns every other key while it is open.
    event.preventDefault();
    event.stopPropagation();
  };

  private play(key: SfxKey): void {
    this.options.onSfx?.(key);
  }

  private setGameInert(inert: boolean): void {
    const app = document.getElementById('app');
    if (!app) return;
    if (inert) app.setAttribute('inert', '');
    else app.removeAttribute('inert');
  }
}

function makeAction(label: string, action: string, detail: string): HTMLButtonElement {
  const button = el('button', 'title-action');
  button.type = 'button';
  button.dataset.action = action;
  button.setAttribute('aria-label', label);

  const ordinal = el('span', 'title-action-ordinal', action === 'primary' ? 'I' : 'II');
  ordinal.setAttribute('aria-hidden', 'true');
  const copy = el('span', 'title-action-copy');
  const labelNode = el('span', 'title-action-label', label);
  const detailNode = el('span', 'title-action-detail', detail);
  detailNode.setAttribute('aria-hidden', 'true');
  copy.append(labelNode, detailNode);
  const mark = el('span', 'title-action-mark', '◆');
  mark.setAttribute('aria-hidden', 'true');
  button.append(ordinal, copy, mark);
  return button;
}

function setActionLabel(button: HTMLButtonElement, label: string, detail: string): void {
  const labelNode = button.querySelector<HTMLElement>('.title-action-label');
  const detailNode = button.querySelector<HTMLElement>('.title-action-detail');
  if (labelNode) labelNode.textContent = label;
  if (detailNode) detailNode.textContent = detail;
  button.setAttribute('aria-label', label);
}

function actionLabel(button: HTMLButtonElement): string {
  return button.querySelector<HTMLElement>('.title-action-label')?.textContent ?? '';
}

function recordStat(label: string, value: string): HTMLElement {
  const stat = el('div', 'title-record-stat');
  stat.append(
    el('dt', 'title-record-stat-label', label),
    el('dd', 'title-record-stat-value', value),
  );
  return stat;
}

function hint(keys: string, label: string): HTMLElement {
  const node = el('span', 'title-hint');
  if (keys.trim().length > 0) node.append(el('kbd', 'title-key', keys));
  node.append(el('span', 'title-hint-label', label));
  return node;
}

function makeBellMark(): SVGSVGElement {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 120 160');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  svg.classList.add('title-bell');
  for (const d of [
    'M60 10v14',
    'M28 94c0-42 14-66 32-66s32 24 32 66l9 22H19l9-22Z',
    'M48 124c3 10 8 15 12 15s9-5 12-15',
    'M76 42 66 70l9 8-12 18',
    'M60 142v6',
  ]) {
    const path = document.createElementNS(ns, 'path');
    path.setAttribute('d', d);
    svg.append(path);
  }
  return svg;
}

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}
