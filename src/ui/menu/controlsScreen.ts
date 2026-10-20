/** Renders the controls screen: one row per action, three editable slots, reset row. */
import {
  describeKeyCode,
  describePadButton,
  formatKeyCode,
  formatPadButton,
} from '../../input/bindings';
import type { MenuModel } from './MenuModel';
import { ACTION_LABELS, ACTION_ORDER, bindingFocusId, slotLabel } from './menuContent';
import { el, makeButton, markNav } from './menuDom';

export type ControlsContent = {
  /** Banner plus scrollable action list, without the pinned reset/Back row. */
  content: HTMLElement;
  /** Reset button, pinned beside Back so it stays discoverable at 640x360. */
  reset: HTMLButtonElement;
  /** Row index shared by the reset and Back buttons. */
  actionsRow: number;
};

export function buildControls(model: MenuModel): ControlsContent {
  const content = el('div', 'controls-screen');
  let row = 0;

  if (model.capture) {
    const target = model.capture;
    const banner = el('div', 'capture-banner');
    banner.append(
      el(
        'p',
        'capture-text',
        `Listening for ${target.kind === 'key' ? 'a key' : 'a pad button'} · ${ACTION_LABELS[target.action]} · ${slotLabel(target.kind, target.slot)}`,
      ),
    );
    const cancel = makeButton('Cancel', 'cancel-capture', 'menu-small-button');
    markNav(cancel, 'controls:cancel', 0, 0);
    banner.append(cancel);
    content.append(banner);
    row = 1;
  }

  const scroll = el('div', 'bindings-scroll');
  const table = el('div', 'binding-table');
  const header = el('div', 'binding-row binding-header');
  header.setAttribute('aria-hidden', 'true');
  header.append(
    el('span', 'binding-name', 'Action'),
    el('span', 'binding-slot', 'Key 1'),
    el('span', 'binding-slot', 'Key 2'),
    el('span', 'binding-slot', 'Pad'),
  );
  table.append(header);

  ACTION_ORDER.forEach((action, index) => {
    const line = el('div', 'binding-row');
    line.append(el('span', 'binding-name', ACTION_LABELS[action]));

    const keys = model.bindings.keyboard[action];
    for (let slot = 0; slot < 2; slot += 1) {
      const code = keys[slot];
      const label = code ? formatKeyCode(code) : '—';
      const button = makeButton(label, `bind:${action}:key:${slot}`, 'binding-button');
      button.setAttribute(
        'aria-label',
        `Rebind ${ACTION_LABELS[action]}, ${slotLabel('key', slot)}, currently ${code ? describeKeyCode(code) : 'unbound'}`,
      );
      if (isCaptured(model, action, 'key', slot)) button.classList.add('is-capturing');
      markNav(button, bindingFocusId(action, 'key', slot), row + index, slot + 1);
      line.append(button);
    }

    const padButtons = model.bindings.gamepad.buttons[action];
    const padButton = padButtons?.[0];
    const pad = makeButton(
      padButton === undefined ? '—' : formatPadButton(padButton),
      `bind:${action}:pad:0`,
      'binding-button',
    );
    pad.setAttribute(
      'aria-label',
      `Rebind ${ACTION_LABELS[action]}, Pad, currently ${padButton === undefined ? 'unbound' : describePadButton(padButton)}`,
    );
    if (isCaptured(model, action, 'pad', 0)) pad.classList.add('is-capturing');
    markNav(pad, bindingFocusId(action, 'pad', 0), row + index, 3);
    line.append(pad);

    table.append(line);
  });

  const actionsRow = row + ACTION_ORDER.length;
  const reset = makeButton(
    model.resetArmed ? 'Confirm reset' : 'Reset defaults',
    'reset',
    'binding-reset',
  );
  if (model.resetArmed) reset.classList.add('is-armed');
  markNav(reset, 'controls:reset', actionsRow, 0);

  scroll.append(table);
  content.append(scroll);

  return { content, reset, actionsRow };
}

function isCaptured(
  model: MenuModel,
  action: (typeof ACTION_ORDER)[number],
  kind: 'key' | 'pad',
  slot: number,
): boolean {
  const capture = model.capture;
  return (
    capture !== null && capture.action === action && capture.kind === kind && capture.slot === slot
  );
}
