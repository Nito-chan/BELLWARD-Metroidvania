/** Builders for the three pause-flow screens. Kept apart from the modal shell/navigation. */
import type { AudioBus } from '../../audio/AudioManager';
import { MENU } from '../../config/menu';
import type { MenuModel } from './MenuModel';
import { buildControls } from './controlsScreen';
import { BACK_FOCUS_ID, VOLUME_LABELS } from './menuContent';
import { el, makeButton, markNav } from './menuDom';

const BUSES: readonly AudioBus[] = ['master', 'music', 'sfx'];

export function buildPauseScreen(): HTMLElement {
  const nav = el('nav', 'menu-options');
  nav.setAttribute('aria-label', 'Pause menu');
  const items = [
    { label: 'Resume', command: 'resume', focusId: 'pause:resume' },
    { label: 'Settings', command: 'settings', focusId: 'pause:settings' },
    { label: 'Controls', command: 'controls', focusId: 'pause:controls' },
  ];
  items.forEach((item, index) => {
    const button = makeButton('', item.command, 'menu-option');
    button.append(
      el('span', 'menu-option-index', String(index + 1).padStart(2, '0')),
      el('span', 'menu-option-label', item.label),
      el('span', 'menu-option-mark', '›'),
    );
    button.setAttribute('aria-label', item.label);
    markNav(button, item.focusId, index, 0);
    nav.append(button);
  });
  return nav;
}

export function buildSettingsScreen(model: MenuModel): HTMLElement {
  const wrap = el('div', 'settings-screen');
  const list = el('div', 'settings-list');

  BUSES.forEach((bus, index) => {
    const row = el('div', 'setting-row');
    const id = `menu-volume-${bus}`;
    const label = el('label', 'setting-label', VOLUME_LABELS[bus]);
    label.htmlFor = id;
    const value = model.getVolume(bus);
    const input = el('input', 'setting-range');
    input.type = 'range';
    input.id = id;
    input.name = `volume-${bus}`;
    input.min = '0';
    input.max = '100';
    input.step = String(Math.round(MENU.volumeStep * 100));
    input.value = String(Math.round(value * 100));
    input.dataset.bus = bus;
    input.setAttribute('aria-valuetext', `${Math.round(value * 100)}%`);
    markNav(input, `settings:${bus}`, index, 0);
    const output = el('output', 'setting-value', `${Math.round(value * 100)}%`);
    output.htmlFor = id;
    output.dataset.output = bus;
    row.append(label, input, output);
    list.append(row);
  });

  const mute = makeButton('', 'mute', 'setting-row setting-toggle');
  mute.setAttribute('role', 'switch');
  const muted = model.audioIsMuted();
  mute.setAttribute('aria-checked', String(muted));
  mute.setAttribute('aria-label', 'Silence all audio');
  mute.append(
    el('span', 'setting-label', 'Silence all'),
    el('span', 'setting-toggle-state', muted ? 'Muted' : 'On'),
    el('span', 'setting-toggle-track'),
  );
  markNav(mute, 'settings:mute', BUSES.length, 0);
  list.append(mute);

  wrap.append(list);
  wrap.append(buildBackRow(4));
  return wrap;
}

export function buildControlsScreen(model: MenuModel): HTMLElement {
  const wrap = el('div', 'controls-wrap');
  const controls = buildControls(model);
  wrap.append(controls.content);

  const actions = el('div', 'screen-back-row controls-actions');
  actions.append(controls.reset);
  const back = makeButton('Back', 'back', 'menu-back-button');
  markNav(back, BACK_FOCUS_ID, controls.actionsRow, 1);
  actions.append(back);
  wrap.append(actions);
  return wrap;
}

function buildBackRow(row: number): HTMLElement {
  const wrap = el('div', 'screen-back-row');
  const back = makeButton('Back', 'back', 'menu-back-button');
  markNav(back, BACK_FOCUS_ID, row, 0);
  wrap.append(back);
  return wrap;
}
