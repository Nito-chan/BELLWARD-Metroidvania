/** Menu copy and focus ids. All player-facing strings for the pause flow live here. */
import type { ActionName } from '../../config/input';
import type { BindingKind, MenuScreen } from './menuTypes';

export type MenuHint = { readonly keys: string; readonly label: string };

export const SCREEN_COPY: Readonly<
  Record<
    MenuScreen,
    {
      readonly eyebrow: string;
      readonly title: string;
      readonly subtitle: string;
      readonly hints: readonly MenuHint[];
    }
  >
> = {
  pause: {
    eyebrow: 'The Drowned Belfry',
    title: 'Paused',
    subtitle: 'The water keeps its counsel.',
    hints: [
      { keys: '↑↓', label: 'Move' },
      { keys: 'Enter', label: 'Select' },
      { keys: 'Esc', label: 'Resume' },
    ],
  },
  settings: {
    eyebrow: 'Paused · Sound',
    title: 'Sound',
    subtitle: 'Set the bells at a distance you can bear.',
    hints: [
      { keys: '←→', label: 'Adjust' },
      { keys: '↑↓', label: 'Move' },
      { keys: 'Esc', label: 'Back' },
    ],
  },
  controls: {
    eyebrow: 'Paused · Controls',
    title: 'Bindings',
    subtitle: 'Every hand holds the rope differently.',
    hints: [
      { keys: '↑↓', label: 'Row' },
      { keys: '←→', label: 'Slot' },
      { keys: 'Enter', label: 'Rebind' },
      { keys: 'Esc', label: 'Back' },
    ],
  },
};

export const ACTION_ORDER: readonly ActionName[] = [
  'left',
  'right',
  'up',
  'down',
  'jump',
  'attack',
  'dash',
  'heal',
  'cast',
  'interact',
  'map',
  'pause',
];

export const ACTION_LABELS: Readonly<Record<ActionName, string>> = {
  left: 'Move left',
  right: 'Move right',
  up: 'Up',
  down: 'Down',
  jump: 'Jump',
  attack: 'Attack',
  dash: 'Dash',
  heal: 'Heal',
  cast: 'Cast',
  interact: 'Interact',
  map: 'Map',
  pause: 'Pause',
};

export const VOLUME_LABELS = {
  master: 'Master',
  music: 'Music',
  sfx: 'Effects',
} as const;

export const BACK_FOCUS_ID = 'screen:back';

export function bindingFocusId(action: ActionName, kind: BindingKind, slot: number): string {
  return `binding:${action}:${kind}:${slot}`;
}

export function defaultFocusId(screen: MenuScreen): string {
  if (screen === 'pause') return 'pause:resume';
  if (screen === 'settings') return 'settings:master';
  return bindingFocusId('jump', 'key', 0);
}

export function slotLabel(kind: BindingKind, slot: number): string {
  return kind === 'key' ? `Key ${slot + 1}` : 'Pad';
}
