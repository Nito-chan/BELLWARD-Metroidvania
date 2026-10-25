/**
 * Landscape-first touch controls. Each button is a real DOM button with a pointer
 * lifetime, but presses flow through `InputManager.setVirtual` so the simulation sees
 * exactly the same per-tick snapshots as keyboard and gamepad play. The overlay is
 * passive while hidden and holds no composition-root state.
 */
import './touch.css';
import type { ActionName } from '../../config/input';
import { WEAPON_LABELS, type WeaponId } from '../../config/weapons';

export type TouchAction = Extract<
  ActionName,
  | 'left'
  | 'right'
  | 'down'
  | 'jump'
  | 'attack'
  | 'guard'
  | 'dash'
  | 'heal'
  | 'interact'
  | 'cast'
  | 'weapon'
>;

export type TouchControlsOptions = {
  /** False on mouse/keyboard-only devices; no DOM is mounted at all. */
  readonly enabled: boolean;
  readonly onAction: (action: TouchAction, down: boolean) => void;
  readonly onPause: () => void;
  readonly onMap: () => void;
};

export type TouchDebugState = {
  enabled: boolean;
  visible: boolean;
  held: string[];
  weapon: WeaponId;
};

type ActiveTouch = {
  readonly action: TouchAction;
  readonly button: HTMLButtonElement;
};

type ButtonSpec = {
  readonly action: TouchAction;
  readonly label: string;
  readonly text?: string;
  readonly glyph?: string;
};

const MOVE_BUTTONS: readonly ButtonSpec[] = [
  { action: 'left', label: 'Move left', glyph: '◀' },
  { action: 'down', label: 'Drop down', glyph: '▼' },
  { action: 'right', label: 'Move right', glyph: '▶' },
];

const ACTION_BUTTONS: readonly ButtonSpec[] = [
  { action: 'heal', label: 'Focus', text: 'Focus' },
  { action: 'interact', label: 'Rest', text: 'Rest' },
  { action: 'dash', label: 'Dash', text: 'Dash' },
  { action: 'guard', label: 'Guard', text: 'Guard' },
  { action: 'attack', label: 'Strike', text: 'Strike' },
  { action: 'jump', label: 'Jump', text: 'Jump' },
];

export class TouchControls {
  readonly root: HTMLElement;
  private readonly active = new Map<number, ActiveTouch>();
  private readonly buttons = new Map<TouchAction, HTMLButtonElement>();
  private readonly swapButton: HTMLButtonElement;
  private readonly swapName: HTMLElement;
  private readonly mapButton: HTMLButtonElement;
  private weaponValue: WeaponId = 'nail';
  private mounted = false;
  private visibleValue = false;

  constructor(private readonly options: TouchControlsOptions) {
    this.root = document.createElement('div');
    this.root.className = 'touch-root';
    this.root.dataset.testid = 'touch-controls';
    this.root.setAttribute('role', 'group');
    this.root.setAttribute('aria-label', 'Touch controls');
    this.root.hidden = true;

    this.swapName = document.createElement('span');
    this.swapName.className = 'touch-swap-name';
    this.swapName.textContent = WEAPON_LABELS.nail;
    this.swapButton = this.buildSwapButton(this.swapName);
    this.mapButton = this.buildMapButton();

    // Swap, Hook and Map live in a utility row above the action pad. Keeping the pad
    // three columns wide is what lets both thumbs fit comfortably at 375 px.
    const utility = document.createElement('div');
    utility.className = 'touch-utility';
    utility.setAttribute('role', 'group');
    utility.setAttribute('aria-label', 'Weapons and chart');
    utility.append(
      this.swapButton,
      this.buildButton({ action: 'cast', label: 'Hookline', text: 'Hook' }),
      this.mapButton,
    );
    this.root.append(
      utility,
      this.buildCluster('touch-move', 'Movement', MOVE_BUTTONS),
      this.buildCluster('touch-actions', 'Actions', ACTION_BUTTONS),
      this.buildPause(),
    );
    this.setWeapon('nail');
    this.setActionVisible('cast', false);
    this.setActionVisible('weapon', false);
    this.root.addEventListener('contextmenu', (event) => {
      if (this.visibleValue) event.preventDefault();
    });
  }

  get visible(): boolean {
    return this.visibleValue;
  }

  mount(): void {
    if (!this.options.enabled || this.mounted) return;
    this.mounted = true;
    document.body.append(this.root);
    window.addEventListener('pointerup', this.onWindowPointerUp);
    window.addEventListener('pointercancel', this.onWindowPointerUp);
    window.addEventListener('blur', this.releaseAll);
    document.addEventListener('visibilitychange', this.onVisibilityChange);
  }

  show(): void {
    if (!this.options.enabled) return;
    this.visibleValue = true;
    this.root.hidden = false;
  }

  hide(): void {
    this.releaseAll();
    this.visibleValue = false;
    this.root.hidden = true;
  }

  /** Release every held button without changing visibility (blur/reset paths). */
  releaseAll = (): void => {
    for (const active of this.active.values()) {
      active.button.classList.remove('is-pressed');
    }
    const pressed = [...this.active.values()];
    this.active.clear();
    for (const active of pressed) this.options.onAction(active.action, false);
  };

  /** The chart is earned; hide its key until the Tideglass is in hand. */
  setMapVisible(visible: boolean): void {
    this.mapButton.hidden = !visible;
  }

  /** Shows or hides an owned ability without changing the action-pad geometry. */
  setActionVisible(action: TouchAction, visible: boolean): void {
    const button = this.buttons.get(action);
    if (!button || button.hidden === !visible) return;
    if (!visible) {
      for (const [pointerId, active] of [...this.active]) {
        if (active.action === action) this.release(pointerId);
      }
    }
    button.hidden = !visible;
  }

  /** Reflects the attack-cycle weapon on the Swap key and its accessible label. */
  setWeapon(weapon: WeaponId): void {
    this.weaponValue = weapon;
    const label = WEAPON_LABELS[weapon];
    this.swapName.textContent = label;
    this.swapButton.dataset.weapon = weapon;
    this.swapButton.setAttribute('aria-label', `Swap weapon. Current: ${label}`);
  }

  debugState(): TouchDebugState {
    return {
      enabled: this.options.enabled,
      visible: this.visibleValue,
      held: [...new Set([...this.active.values()].map((active) => active.action))],
      weapon: this.weaponValue,
    };
  }

  private buildCluster(
    className: string,
    label: string,
    specs: readonly ButtonSpec[],
  ): HTMLElement {
    const cluster = document.createElement('div');
    cluster.className = `touch-cluster ${className}`;
    cluster.setAttribute('role', 'group');
    cluster.setAttribute('aria-label', label);
    for (const spec of specs) cluster.append(this.buildButton(spec));
    return cluster;
  }

  private buildButton(spec: ButtonSpec): HTMLButtonElement {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `touch-button touch-${spec.action}`;
    button.dataset.action = spec.action;
    button.setAttribute('aria-label', spec.label);
    // Touch play has no keyboard focus path; keep Tab on the game canvas and native
    // menu controls instead of putting eight invisible stops under the thumb.
    button.tabIndex = -1;

    if (spec.glyph) {
      const glyph = document.createElement('span');
      glyph.className = 'touch-glyph';
      glyph.setAttribute('aria-hidden', 'true');
      glyph.textContent = spec.glyph;
      button.append(glyph);
    } else {
      const text = document.createElement('span');
      text.className = 'touch-label';
      text.textContent = spec.text ?? spec.label;
      button.append(text);
    }

    button.addEventListener('pointerdown', (event) => this.press(event, button, spec.action));
    button.addEventListener('pointerup', (event) => this.release(event.pointerId));
    button.addEventListener('pointercancel', (event) => this.release(event.pointerId));
    button.addEventListener('lostpointercapture', (event) => this.release(event.pointerId));
    this.buttons.set(spec.action, button);
    return button;
  }

  private buildSwapButton(name: HTMLElement): HTMLButtonElement {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'touch-button touch-swap';
    button.dataset.action = 'weapon';
    button.setAttribute('aria-label', 'Swap weapon');
    button.tabIndex = -1;
    const kicker = document.createElement('span');
    kicker.className = 'touch-swap-kicker';
    kicker.setAttribute('aria-hidden', 'true');
    kicker.textContent = 'Swap';
    button.append(kicker, name);
    button.addEventListener('pointerdown', (event) => this.press(event, button, 'weapon'));
    button.addEventListener('pointerup', (event) => this.release(event.pointerId));
    button.addEventListener('pointercancel', (event) => this.release(event.pointerId));
    button.addEventListener('lostpointercapture', (event) => this.release(event.pointerId));
    this.buttons.set('weapon', button);
    return button;
  }

  private buildMapButton(): HTMLButtonElement {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'touch-button touch-map';
    button.setAttribute('aria-label', 'Open the Tideglass');
    button.tabIndex = -1;
    button.hidden = true;
    const kicker = document.createElement('span');
    kicker.className = 'touch-map-kicker';
    kicker.setAttribute('aria-hidden', 'true');
    kicker.textContent = 'Chart';
    const name = document.createElement('span');
    name.className = 'touch-map-name';
    name.setAttribute('aria-hidden', 'true');
    name.textContent = 'Map';
    button.append(kicker, name);
    button.addEventListener('pointerdown', (event) => {
      if (!this.visibleValue || event.button !== 0) return;
      event.preventDefault();
      this.releaseAll();
      this.options.onMap();
    });
    return button;
  }

  private buildPause(): HTMLButtonElement {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'touch-button touch-pause';
    button.setAttribute('aria-label', 'Pause');
    button.tabIndex = -1;
    button.textContent = 'Pause';
    button.addEventListener('pointerdown', (event) => {
      if (!this.visibleValue) return;
      event.preventDefault();
      this.releaseAll();
      this.options.onPause();
    });
    return button;
  }

  private press(event: PointerEvent, button: HTMLButtonElement, action: TouchAction): void {
    if (!this.visibleValue || event.button !== 0) return;
    for (const active of this.active.values()) {
      if (active.button === button) return;
    }
    event.preventDefault();
    try {
      button.setPointerCapture(event.pointerId);
    } catch {
      // Synthetic pointers (tests, unusual embeds) may not support capture; the window
      // pointerup listener still releases the action.
    }
    this.active.set(event.pointerId, { action, button });
    button.classList.add('is-pressed');
    this.options.onAction(action, true);
  }

  private release(pointerId: number): void {
    const active = this.active.get(pointerId);
    if (!active) return;
    this.active.delete(pointerId);
    active.button.classList.remove('is-pressed');
    if (active.button.hasPointerCapture(pointerId)) {
      try {
        active.button.releasePointerCapture(pointerId);
      } catch {
        // Capture already gone; releasing the virtual action below is what matters.
      }
    }
    this.options.onAction(active.action, false);
  }

  private readonly onWindowPointerUp = (event: PointerEvent): void => {
    this.release(event.pointerId);
  };

  private readonly onVisibilityChange = (): void => {
    if (document.visibilityState === 'hidden') this.releaseAll();
  };
}
