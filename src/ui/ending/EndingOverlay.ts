/**
 * The Tide-door ending card. Accessible DOM like the pause flow; the world stays mounted
 * behind it, so the player can close the card and keep exploring after the slice ends.
 */
import type { EndingCopy } from '../../config/finalAct';
import '../menu/menu.css';
import './ending.css';
import { el, makeBellMark, makeButton, makeHint } from '../menu/menuDom';

export type EndingStats = {
  readonly sigils: number;
  readonly bossCount: number;
  readonly shards: number;
  readonly charms: number;
  /** Arsenal weapons owned, e.g. "4 / 4". Only shown for the earned ending. */
  readonly arsenal?: string;
  /** Whether the Tideglass was found, shown only for the earned ending. */
  readonly tideglass?: string;
};

export type EndingOverlayOptions = {
  onClose(): void;
  announce(text: string): void;
};

export class EndingOverlay {
  readonly root: HTMLElement;
  private readonly eyebrow: HTMLElement;
  private readonly title: HTMLElement;
  private readonly subtitle: HTMLElement;
  private readonly stats: HTMLElement;
  private readonly sealPips: HTMLElement;
  private readonly closeButton: HTMLButtonElement;
  private readonly panel: HTMLElement;
  private openValue = false;

  constructor(private readonly options: EndingOverlayOptions) {
    this.root = el('div', 'menu-root ending-root');
    this.root.hidden = true;
    this.root.setAttribute('role', 'dialog');
    this.root.setAttribute('aria-modal', 'true');
    this.root.setAttribute('aria-labelledby', 'ending-title');
    this.root.setAttribute('aria-describedby', 'ending-subtitle');
    const scrim = el('div', 'menu-scrim');
    this.panel = el('div', 'menu-panel ending-panel');
    this.panel.dataset.screen = 'ending';

    const header = el('header', 'menu-header');
    this.eyebrow = el('p', 'menu-eyebrow', '');
    this.title = el('h2', 'menu-title', '');
    this.title.id = 'ending-title';
    this.subtitle = el('p', 'menu-subtitle', '');
    this.subtitle.id = 'ending-subtitle';
    header.append(this.eyebrow, this.title, this.subtitle);

    const seal = el('div', 'ending-seal');
    seal.setAttribute('aria-hidden', 'true');
    this.sealPips = el('span', 'ending-seal-pips');
    seal.append(makeBellMark(), el('span', 'ending-seal-word', 'Tide-bell'), this.sealPips);

    this.stats = el('div', 'ending-stats');
    const body = el('div', 'menu-body ending-body');
    body.append(seal, el('p', 'ending-ledger-label', 'Final account'), this.stats);

    const footer = el('footer', 'menu-footer');
    footer.append(makeHint('Esc', 'Return'), makeHint('Enter', 'Continue'));
    this.closeButton = makeButton(
      'Return to the belfry',
      'continue',
      'menu-back-button ending-continue',
    );
    this.closeButton.dataset.focusId = 'ending:continue';
    this.closeButton.addEventListener('click', () => this.close());
    footer.append(this.closeButton);

    this.panel.append(makeBellMark(), header, body, footer);
    this.root.append(scrim, this.panel);
    document.body.append(this.root);
    window.addEventListener('keydown', this.onKeyDown, true);
  }

  get isOpen(): boolean {
    return this.openValue;
  }

  open(ending: EndingCopy, stats: EndingStats): void {
    if (this.openValue) return;
    this.openValue = true;
    this.eyebrow.textContent = ending.eyebrow;
    this.title.textContent = ending.title;
    this.subtitle.textContent = ending.subtitle;
    this.closeButton.textContent = ending.closeLabel;
    const rows: HTMLElement[] = [
      this.stat('SIGILS', `${stats.sigils} / ${stats.bossCount}`),
      this.stat('SHARDS', String(stats.shards)),
      this.stat('CHARMS', String(stats.charms)),
    ];
    if (stats.arsenal !== undefined) rows.push(this.stat('ARSENAL', stats.arsenal));
    if (stats.tideglass !== undefined) rows.push(this.stat('TIDEGLASS', stats.tideglass));
    this.stats.replaceChildren(...rows);
    this.sealPips.replaceChildren();
    for (let index = 0; index < stats.bossCount; index += 1) {
      this.sealPips.append(
        el('span', index < stats.sigils ? 'ending-pip is-filled' : 'ending-pip'),
      );
    }
    this.root.hidden = false;
    this.panel.querySelector<HTMLElement>('[data-focus-id]')?.focus();
    this.options.announce(`${ending.title}. ${ending.subtitle}`);
  }

  close(): void {
    if (!this.openValue) return;
    this.openValue = false;
    this.root.hidden = true;
    this.options.onClose();
  }

  private stat(label: string, value: string): HTMLElement {
    const row = el('div', 'ending-stat');
    row.append(el('span', 'ending-stat-label', label), el('span', 'ending-stat-value', value));
    return row;
  }

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    if (!this.openValue) return;
    if (event.key === 'Escape' || event.key === 'Enter') {
      event.preventDefault();
      this.close();
      return;
    }
    if (event.key === 'Tab') {
      // One action, one focus target: keep the card's focus ring inside the dialog.
      event.preventDefault();
      this.panel.querySelector<HTMLElement>('[data-focus-id]')?.focus();
    }
  };
}
