/** Builders for the three pause-flow screens. Kept apart from the modal shell/navigation. */
import type { AudioBus } from '../../audio/AudioManager';
import { MENU } from '../../config/menu';
import type { MenuModel } from './MenuModel';
import { buildControls } from './controlsScreen';
import { BACK_FOCUS_ID, VOLUME_LABELS } from './menuContent';
import { el, makeButton, markNav } from './menuDom';

const BUSES: readonly AudioBus[] = ['master', 'music', 'sfx'];

export function buildPauseScreen(hasTideglass = false): HTMLElement {
  const nav = el('nav', 'menu-options');
  nav.setAttribute('aria-label', 'Pause menu');
  const items = [
    { label: 'Resume', detail: 'Return to the climb', command: 'resume', focusId: 'pause:resume' },
    {
      label: 'Settings',
      detail: 'Sound and access',
      command: 'settings',
      focusId: 'pause:settings',
    },
    {
      label: 'Controls',
      detail: 'Keys and pad',
      command: 'controls',
      focusId: 'pause:controls',
    },
    ...(hasTideglass
      ? [
          {
            label: 'Map',
            detail: 'The Keeper’s Tideglass',
            command: 'map',
            focusId: 'pause:map',
          },
        ]
      : []),
  ];
  items.forEach((item, index) => {
    const button = makeButton('', item.command, 'menu-option');
    const copy = el('span', 'menu-option-copy');
    copy.append(
      el('span', 'menu-option-label', item.label),
      el('span', 'menu-option-detail', item.detail),
    );
    button.append(
      el('span', 'menu-option-index', ['I', 'II', 'III', 'IV'][index] ?? String(index + 1)),
      copy,
      el('span', 'menu-option-mark', '◆'),
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
  list.append(sectionLabel('Sound mix'));

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
    input.style.setProperty('--fill', `${Math.round(value * 100)}%`);
    markNav(input, `settings:${bus}`, index + 1, 0);
    const output = el('output', 'setting-value', `${Math.round(value * 100)}%`);
    output.htmlFor = id;
    output.dataset.output = bus;
    row.append(label, input, output);
    list.append(row);
  });

  list.append(sectionLabel('Access'));
  const mute = makeButton('', 'mute', 'setting-row setting-toggle');
  mute.setAttribute('role', 'switch');
  const muted = model.audioIsMuted();
  mute.setAttribute('aria-checked', String(muted));
  mute.setAttribute('aria-label', 'Silence all audio');
  mute.append(
    el('span', 'setting-label', 'Silence all'),
    el('span', 'setting-toggle-state', muted ? 'Muted' : 'Off'),
    el('span', 'setting-toggle-track'),
  );
  let nextRow = BUSES.length + 2;
  markNav(mute, 'settings:mute', nextRow, 0);
  nextRow += 1;
  list.append(mute);

  if (model.supportsScreenShake()) {
    const shake = makeButton('', 'screen-shake', 'setting-row setting-toggle');
    shake.setAttribute('role', 'switch');
    const enabled = model.screenShakeEnabled();
    shake.setAttribute('aria-checked', String(enabled));
    shake.setAttribute('aria-label', 'Camera shake');
    shake.append(
      el('span', 'setting-label', 'Camera shake'),
      el('span', 'setting-toggle-state', enabled ? 'On' : 'Off'),
      el('span', 'setting-toggle-track'),
    );
    markNav(shake, 'settings:screen-shake', nextRow, 0);
    nextRow += 1;
    list.append(shake);
  }

  wrap.append(list);
  wrap.append(buildBackRow(nextRow));
  return wrap;
}

function sectionLabel(text: string): HTMLElement {
  const label = el('p', 'settings-section-label', text);
  label.setAttribute('aria-hidden', 'true');
  return label;
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

export function buildBackRow(row: number): HTMLElement {
  const wrap = el('div', 'screen-back-row');
  const back = makeButton('Back', 'back', 'menu-back-button');
  markNav(back, BACK_FOCUS_ID, row, 0);
  wrap.append(back);
  return wrap;
}
