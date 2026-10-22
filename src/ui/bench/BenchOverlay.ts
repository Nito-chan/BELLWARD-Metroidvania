/**
 * The bench equipment screen. It is a DOM overlay like the pause flow, but deliberately
 * separate: resting is a diegetic interaction, and its flow (charm belt + nail forge)
 * should not inherit pause-menu navigation. The simulation is frozen while it is open.
 */
import './bench.css';
import '../menu/menu.css';
import type { CharmId } from '../../config/progression';
import { MenuPad, type MenuDirection } from '../menu/MenuPad';
import { el, makeBellMark, makeButton, makeHint } from '../menu/menuDom';

export type BenchCharmRow = {
  readonly id: CharmId;
  readonly name: string;
  readonly description: string;
  readonly cost: number;
  readonly owned: boolean;
  readonly equipped: boolean;
};

export type BenchState = {
  readonly benchName: string;
  readonly shards: number;
  readonly nailLevel: number;
  readonly nailMax: number;
  readonly nextCost: number | null;
  readonly slotsUsed: number;
  readonly slotsTotal: number;
  readonly charms: readonly BenchCharmRow[];
};

export type BenchChange = {
  readonly ok: boolean;
  readonly message: string;
};

export type BenchOverlayOptions = {
  getState(): BenchState;
  onToggleCharm(id: CharmId): BenchChange;
  onBuyNail(): BenchChange;
  onClose(): void;
  announce(text: string): void;
};

export class BenchOverlay {
  readonly root: HTMLElement;
  private readonly panel: HTMLElement;
  private readonly status: HTMLElement;
  private readonly body: HTMLElement;
  private readonly slots: HTMLElement;
  private readonly forgeBody: HTMLElement;
  private readonly charmList: HTMLElement;
  private readonly pad = new MenuPad({
    captureKind: () => null,
    onCaptureCancel: () => undefined,
    onCaptureButton: () => undefined,
    onPause: () => this.close(),
    onBack: () => this.close(),
    onConfirm: () => this.confirmFocused(),
    onDirection: (direction) => this.focusDirection(direction),
  });
  private openValue = false;

  constructor(private readonly options: BenchOverlayOptions) {
    this.root = el('div', 'menu-root bench-root');
    this.root.hidden = true;
    this.root.setAttribute('role', 'dialog');
    this.root.setAttribute('aria-modal', 'true');
    this.root.setAttribute('aria-labelledby', 'bench-title');
    this.root.setAttribute('aria-describedby', 'bench-subtitle');

    const scrim = el('div', 'menu-scrim');
    scrim.addEventListener('pointerdown', () => this.close());
    this.panel = el('div', 'menu-panel');
    this.panel.dataset.screen = 'bench';

    const header = el('header', 'menu-header');
    const eyebrow = el('p', 'menu-eyebrow', 'BENCH · EQUIPMENT');
    const title = el('h2', 'menu-title', 'The Bench');
    title.id = 'bench-title';
    const subtitle = el(
      'p',
      'menu-subtitle',
      'The stone keeps what you carry. Choose what answers the dark.',
    );
    subtitle.id = 'bench-subtitle';
    this.status = el('p', 'menu-status');
    this.status.setAttribute('role', 'status');
    this.status.setAttribute('aria-live', 'polite');
    this.status.hidden = true;
    header.append(eyebrow, title, subtitle, this.status);

    this.body = el('div', 'menu-body');
    this.slots = el('p', 'bench-slots');
    const forge = el('section', 'bench-forge');
    forge.setAttribute('aria-labelledby', 'bench-forge-title');
    const forgeTitle = el('h3', 'bench-section-title', 'Nail Forge');
    forgeTitle.id = 'bench-forge-title';
    this.forgeBody = el('div', 'bench-forge-row');
    const inscription = el(
      'p',
      'bench-inscription',
      'A nail remembers every blow. The stone keeps the rest.',
    );
    forge.append(forgeTitle, this.forgeBody, inscription);

    const charms = el('section', 'bench-charms');
    charms.setAttribute('aria-labelledby', 'bench-charms-title');
    const charmsTitle = el('h3', 'bench-section-title', 'Charm Rack');
    charmsTitle.id = 'bench-charms-title';
    this.charmList = el('div', 'bench-charm-list');
    charms.append(charmsTitle, this.charmList);

    const workbench = el('div', 'bench-workbench');
    workbench.append(forge, charms);
    this.body.append(this.slots, workbench);

    const footer = el('footer', 'menu-footer');
    footer.append(makeHint('Esc', 'Leave'), makeHint('Enter', 'Select'));
    const leave = makeButton('Leave the bench', 'leave', 'menu-back-button bench-leave');
    leave.dataset.focusId = 'bench:leave';
    leave.addEventListener('click', () => this.close());

    const bell = makeBellMark();
    footer.append(leave);
    this.panel.append(bell, header, this.body, footer);
    this.root.append(scrim, this.panel);
    document.body.append(this.root);
    window.addEventListener('keydown', this.onKeyDown, true);
  }

  get isOpen(): boolean {
    return this.openValue;
  }

  open(): void {
    if (this.openValue) return;
    this.openValue = true;
    this.root.hidden = false;
    this.status.hidden = true;
    this.render();
    this.pad.start();
    const first = this.panel.querySelector<HTMLElement>('[data-focus-id]');
    first?.focus();
    this.options.announce('Bench. Equipment open.');
  }

  close(): void {
    if (!this.openValue) return;
    this.openValue = false;
    this.pad.stop();
    this.root.hidden = true;
    this.options.onClose();
  }

  private render(): void {
    const active = document.activeElement;
    const focusId = active instanceof HTMLElement ? active.dataset.focusId : undefined;
    const state = this.options.getState();
    this.renderSlots(state);
    this.renderForge(state);
    this.renderCharms(state);
    if (focusId) this.focusById(focusId);
  }

  private renderSlots(state: BenchState): void {
    this.slots.replaceChildren();
    const place = el('span', 'bench-slots-place', state.benchName);
    const belt = el('span', 'bench-belt');
    const notches = el('span', 'bench-notches');
    notches.setAttribute('aria-hidden', 'true');
    for (let index = 0; index < state.slotsTotal; index += 1) {
      notches.append(el('span', index < state.slotsUsed ? 'bench-notch is-filled' : 'bench-notch'));
    }
    belt.append(
      el('span', 'bench-belt-label', 'Charm belt'),
      notches,
      el('span', 'bench-belt-count', `${state.slotsUsed}/${state.slotsTotal}`),
    );
    const shards = el('span', 'bench-shards');
    shards.append(
      el('span', 'bench-shards-mark', '◈'),
      el('span', 'bench-shards-value', String(state.shards)),
    );
    this.slots.append(place, belt, shards);
  }

  private renderForge(state: BenchState): void {
    this.forgeBody.replaceChildren();
    const mark = el('div', 'bench-forge-mark');
    mark.setAttribute('aria-hidden', 'true');
    mark.append(
      el('span', 'bench-forge-level', `+${state.nailLevel}`),
      el('span', 'bench-forge-cap', `OF +${state.nailMax}`),
    );

    const copy = el('div', 'bench-forge-text');
    const pips = el('span', 'bench-forge-pips');
    pips.setAttribute('aria-hidden', 'true');
    for (let index = 0; index < state.nailMax; index += 1) {
      pips.append(el('span', index < state.nailLevel ? 'bench-pip is-filled' : 'bench-pip'));
    }
    const detail = el(
      'p',
      'bench-forge-detail',
      state.nextCost === null
        ? 'The nail has taken all the bell can give.'
        : `Next temper: ◈ ${state.nextCost}`,
    );
    copy.append(
      el('p', 'bench-forge-copy', 'Nail temper'),
      el('span', 'sr-only', `Nail +${state.nailLevel} of +${state.nailMax}.`),
      pips,
      detail,
    );

    const button = makeButton(
      state.nextCost === null ? 'Fully tempered' : 'Temper the nail',
      'forge',
      'menu-option bench-forge-button',
    );
    button.dataset.focusId = 'bench:forge';
    button.disabled = state.nextCost === null;
    button.setAttribute(
      'aria-label',
      state.nextCost === null
        ? 'Nail fully tempered'
        : `Temper the nail for ${state.nextCost} shards; ${state.shards} held`,
    );
    button.addEventListener('click', () => this.apply(this.options.onBuyNail(), 'forge'));
    this.forgeBody.append(mark, copy, button);
  }

  private renderCharms(state: BenchState): void {
    this.charmList.replaceChildren();
    for (const charm of state.charms) {
      const button = makeButton('', `charm:${charm.id}`, 'menu-option bench-charm');
      button.dataset.focusId = `bench:charm:${charm.id}`;
      button.disabled = !charm.owned;
      button.setAttribute('aria-pressed', String(charm.equipped));
      button.setAttribute(
        'aria-label',
        `${charm.name}, ${charm.cost} slot${charm.cost === 1 ? '' : 's'}. ${
          charm.owned ? (charm.equipped ? 'Equipped.' : 'Owned, not equipped.') : 'Not found.'
        } ${charm.description}`,
      );
      const mark = el('span', 'menu-option-mark', charm.equipped ? '◆' : '◇');
      const copy = el('span', 'bench-charm-copy');
      copy.append(
        el('span', 'bench-charm-name', charm.name),
        el('span', 'bench-charm-description', charm.description),
      );
      const meta = el('span', 'bench-charm-meta');
      meta.append(
        el(
          'span',
          'bench-charm-cost',
          charm.owned ? `${charm.cost} SLOT${charm.cost === 1 ? '' : 'S'}` : '—',
        ),
        el(
          'span',
          'bench-charm-state',
          charm.owned ? (charm.equipped ? 'EQUIPPED' : 'CARRIED') : 'MISSING',
        ),
      );
      button.append(mark, copy, meta);
      button.addEventListener('click', () =>
        this.apply(this.options.onToggleCharm(charm.id), `charm:${charm.id}`),
      );
      this.charmList.append(button);
    }
  }

  private apply(change: BenchChange, focusId: string): void {
    this.status.hidden = false;
    this.status.textContent = change.message;
    this.status.dataset.tone = change.ok ? 'info' : 'error';
    this.options.announce(change.message);
    this.render();
    this.focusById(focusId);
  }

  private focusById(id: string): void {
    this.panel.querySelector<HTMLElement>(`[data-focus-id="${id}"]`)?.focus();
  }

  private confirmFocused(): void {
    const active = document.activeElement;
    if (active instanceof HTMLButtonElement && !active.disabled) active.click();
  }

  private focusDirection(direction: MenuDirection): void {
    const items = [...this.panel.querySelectorAll<HTMLElement>('[data-focus-id]:not(:disabled)')];
    if (items.length === 0) return;
    const current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const index = current ? items.indexOf(current) : -1;
    const delta = direction === 'up' || direction === 'left' ? -1 : 1;
    const next = items[(index + delta + items.length) % items.length];
    next?.focus();
  }

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    if (!this.openValue) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      this.close();
      return;
    }
    if (event.key !== 'Tab') return;
    const items = [...this.panel.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')];
    if (items.length === 0) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (!first || !last) return;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };
}
