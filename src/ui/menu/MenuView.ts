/** The DOM shell and screen renderers for the pause flow. All text is set via textContent. */
import type { AudioBus } from '../../audio/AudioManager';
import type { MenuModel } from './MenuModel';
import { SCREEN_COPY, defaultFocusId } from './menuContent';
import { el, makeBellMark, makeHint } from './menuDom';
import { buildControlsScreen, buildPauseScreen, buildSettingsScreen } from './screenBuilders';

export type MenuViewHandlers = {
  onCommand(command: string): void;
  onVolume(bus: AudioBus, value: number): void;
};

export class MenuView {
  readonly root: HTMLElement;
  private readonly panel: HTMLElement;
  private readonly eyebrow: HTMLElement;
  private readonly title: HTMLElement;
  private readonly subtitle: HTMLElement;
  private readonly status: HTMLElement;
  private readonly body: HTMLElement;
  private readonly footer: HTMLElement;

  constructor(private readonly handlers: MenuViewHandlers) {
    this.root = el('div', 'menu-root');
    this.root.hidden = true;
    this.root.dataset.testid = 'menu-root';

    const scrim = el('div', 'menu-scrim');
    this.panel = el('section', 'menu-panel');
    this.panel.setAttribute('role', 'dialog');
    this.panel.setAttribute('aria-modal', 'true');
    this.panel.setAttribute('aria-labelledby', 'menu-title');
    this.panel.setAttribute('aria-describedby', 'menu-subtitle');

    const header = el('header', 'menu-header');
    this.eyebrow = el('p', 'menu-eyebrow');
    this.title = el('h2', 'menu-title');
    this.title.id = 'menu-title';
    this.subtitle = el('p', 'menu-subtitle');
    this.subtitle.id = 'menu-subtitle';
    header.append(this.eyebrow, this.title, this.subtitle);

    this.status = el('div', 'menu-status');
    this.status.setAttribute('role', 'status');
    this.status.setAttribute('aria-live', 'polite');
    this.status.setAttribute('aria-atomic', 'true');
    this.status.hidden = true;

    this.body = el('div', 'menu-body');
    this.footer = el('footer', 'menu-footer');
    this.panel.append(makeBellMark(), header, this.status, this.body, this.footer);
    this.root.append(scrim, this.panel);

    this.panel.addEventListener('click', this.onClick);
    this.panel.addEventListener('input', this.onInput);
  }

  mount(): void {
    document.body.append(this.root);
  }

  show(): void {
    this.root.hidden = false;
  }

  hide(): void {
    this.root.hidden = true;
  }

  /** Renders one screen and moves focus to `focusId` (or that screen's default). */
  render(model: MenuModel, focusId: string | null, animate = false): void {
    const screen = model.screen;
    if (!screen) return;
    this.panel.dataset.screen = screen;
    const copy = SCREEN_COPY[screen];
    this.eyebrow.textContent = copy.eyebrow;
    this.title.textContent = copy.title;
    this.subtitle.textContent = copy.subtitle;
    this.setStatus(model.status, model.statusTone);
    this.body.replaceChildren();
    this.body.classList.toggle('is-entering', animate);

    if (screen === 'pause') this.body.append(buildPauseScreen());
    if (screen === 'settings') this.body.append(buildSettingsScreen(model));
    if (screen === 'controls') this.body.append(buildControlsScreen(model));

    this.footer.replaceChildren(...copy.hints.map((hint) => makeHint(hint.keys, hint.label)));
    this.focus(focusId ?? defaultFocusId(screen));
  }

  /** Keeps the visible slider, output and aria value in sync after a fader move. */
  updateVolume(bus: AudioBus, value: number): void {
    const input = this.findRange(bus);
    const percentage = Math.round(Math.max(0, Math.min(1, value)) * 100);
    if (input) {
      input.value = String(percentage);
      input.setAttribute('aria-valuetext', `${percentage}%`);
    }
    const output = this.panel.querySelector<HTMLOutputElement>(`[data-output="${bus}"]`);
    if (output) output.textContent = `${percentage}%`;
  }

  focus(focusId: string): void {
    const target = this.findFocus(focusId) ?? this.panel.querySelector<HTMLElement>('[data-nav]');
    if (!target) return;
    this.focusNode(target);
  }

  focusId(): string | null {
    const active = document.activeElement;
    if (!(active instanceof HTMLElement) || !this.panel.contains(active)) return null;
    return active.closest<HTMLElement>('[data-focus-id]')?.dataset.focusId ?? null;
  }

  /** Spatial navigation: up/down keeps the nearest column, left/right walks the row. */
  moveFocus(direction: 'up' | 'down' | 'left' | 'right'): void {
    const nodes = [...this.panel.querySelectorAll<HTMLElement>('[data-nav]')];
    if (nodes.length === 0) return;
    const active = document.activeElement;
    const current =
      active instanceof HTMLElement
        ? (active.closest<HTMLElement>('[data-nav]') ?? nodes[0])
        : nodes[0];
    if (!current) return;

    const row = Number(current.dataset.row ?? 0);
    const col = Number(current.dataset.col ?? 0);

    if (direction === 'up' || direction === 'down') {
      const rows = [...new Set(nodes.map((node) => Number(node.dataset.row ?? 0)))].sort(
        (a, b) => a - b,
      );
      const index = rows.indexOf(row);
      if (index < 0) return;
      const step = direction === 'down' ? 1 : -1;
      const targetRow = rows[(index + step + rows.length) % rows.length];
      if (targetRow === undefined) return;
      const candidates = nodes
        .filter((node) => Number(node.dataset.row ?? 0) === targetRow)
        .sort((a, b) => {
          const da = Math.abs(Number(a.dataset.col ?? 0) - col);
          const db = Math.abs(Number(b.dataset.col ?? 0) - col);
          return da - db || Number(a.dataset.col ?? 0) - Number(b.dataset.col ?? 0);
        });
      const target = candidates[0];
      if (target) this.focusNode(target);
      return;
    }

    const inRow = nodes
      .filter((node) => Number(node.dataset.row ?? 0) === row)
      .sort((a, b) => Number(a.dataset.col ?? 0) - Number(b.dataset.col ?? 0));
    if (inRow.length < 2) return;
    const index = inRow.indexOf(current);
    const step = direction === 'right' ? 1 : -1;
    const target = inRow[(index + step + inRow.length) % inRow.length];
    if (target) this.focusNode(target);
  }

  /** Clicks the focused button; sliders handle their own value keys. */
  activateFocused(): void {
    const active = document.activeElement;
    if (!(active instanceof HTMLButtonElement) || active.disabled) return;
    active.click();
  }

  /** Steps the focused range by one native step. Returns false when focus is elsewhere. */
  stepFocusedRange(direction: -1 | 1): boolean {
    const active = document.activeElement;
    if (!(active instanceof HTMLInputElement) || active.type !== 'range') return false;
    const min = Number(active.min || 0);
    const max = Number(active.max || 100);
    const step = Number(active.step || 1);
    const next = Math.max(min, Math.min(max, Number(active.value) + direction * step));
    active.value = String(next);
    active.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  }

  /** Keeps Tab inside the dialog while it is modal. */
  trapTab(shift: boolean): void {
    const nodes = [...this.panel.querySelectorAll<HTMLElement>('[data-nav]')];
    if (nodes.length === 0) return;
    const active = document.activeElement;
    const nav = active instanceof HTMLElement ? active.closest<HTMLElement>('[data-nav]') : null;
    const index = nav ? nodes.indexOf(nav) : -1;
    const step = shift ? -1 : 1;
    const next = nodes[(index + step + nodes.length) % nodes.length];
    if (next) this.focusNode(next);
  }

  private focusNode(node: HTMLElement): void {
    node.focus({ preventScroll: true });
    node.scrollIntoView({ block: 'nearest' });
  }

  private readonly onClick = (event: MouseEvent): void => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const command = target.closest<HTMLElement>('[data-command]')?.dataset.command;
    if (command) this.handlers.onCommand(command);
  };

  private readonly onInput = (event: Event): void => {
    const input = event.target;
    if (!(input instanceof HTMLInputElement) || input.type !== 'range') return;
    const bus = input.dataset.bus;
    if (!isAudioBus(bus)) return;
    const value = Number(input.value) / 100;
    this.handlers.onVolume(bus, value);
    this.updateVolume(bus, value);
  };

  private setStatus(text: string, tone: 'info' | 'error' | 'capture'): void {
    this.status.textContent = text;
    this.status.dataset.tone = tone;
    this.status.hidden = text.length === 0;
  }

  private findFocus(focusId: string): HTMLElement | null {
    for (const node of this.panel.querySelectorAll<HTMLElement>('[data-focus-id]')) {
      if (node.dataset.focusId === focusId) return node;
    }
    return null;
  }

  private findRange(bus: AudioBus): HTMLInputElement | null {
    for (const node of this.panel.querySelectorAll<HTMLInputElement>('input[type="range"]')) {
      if (node.dataset.bus === bus) return node;
    }
    return null;
  }
}

function isAudioBus(value: string | undefined): value is AudioBus {
  return value === 'master' || value === 'music' || value === 'sfx';
}
