/**
 * The editable binding document. `config/input.ts` holds the defaults; this module owns
 * the versioned serialized shape, validation, conflict checks and the pure edit helpers
 * the settings UI and the unit suite use. Nothing here touches the DOM.
 */
import {
  ACTIONS,
  INPUT,
  KEY_BINDINGS,
  PAD_AXES,
  PAD_BUTTONS,
  type ActionName,
} from '../config/input';

export type PadAxisBinding = { readonly axis: number; readonly dir: -1 | 1 };

export type Bindings = {
  readonly version: number;
  readonly keyboard: Readonly<Record<ActionName, readonly string[]>>;
  readonly gamepad: {
    readonly buttons: Readonly<Partial<Record<ActionName, readonly number[]>>>;
    readonly axes: Readonly<Partial<Record<ActionName, PadAxisBinding>>>;
  };
};

export type BindingsStorage = Pick<Storage, 'getItem' | 'setItem'>;

export type BindingConflict = { readonly action: ActionName; readonly slot: number };

export type BindingEdit = {
  readonly bindings: Bindings;
  readonly conflict: BindingConflict | null;
};

export const KEY_SLOTS = 2;
export const PAD_SLOTS = 2;

/** A fresh, mutable-inside copy of the shipped defaults. */
export function defaultBindings(): Bindings {
  const keyboard = {} as Record<ActionName, readonly string[]>;
  for (const action of ACTIONS) keyboard[action] = [...KEY_BINDINGS[action]];

  const buttons: Partial<Record<ActionName, readonly number[]>> = {};
  for (const action of ACTIONS) {
    const value = PAD_BUTTONS[action];
    if (value) buttons[action] = [...value];
  }

  const axes: Partial<Record<ActionName, PadAxisBinding>> = {};
  for (const action of ACTIONS) {
    const value = PAD_AXES[action];
    if (value) axes[action] = { ...value };
  }

  return {
    version: INPUT.bindingFormatVersion,
    keyboard,
    gamepad: { buttons, axes },
  };
}

/** localStorage when it exists and is reachable, else null (private mode, embedded). */
export function defaultBindingsStorage(): BindingsStorage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

/**
 * Reads the saved document. Any corrupt, partial or future-versioned document falls
 * back to the shipped defaults with a warning; the game never boots into half a control
 * scheme. A v1 document is migrated in place: the guard action arrives with its default
 * binds and every other choice survives.
 */
export function loadBindings(storage = defaultBindingsStorage()): Bindings {
  if (!storage) return defaultBindings();
  try {
    const raw = storage.getItem(INPUT.storageKey);
    if (raw === null) return defaultBindings();
    const parsed = migrateBindings(JSON.parse(raw));
    if (isBindings(parsed)) return parsed;
    console.warn('[BELLWARD] ignoring invalid saved bindings; using defaults');
  } catch (error) {
    console.warn('[BELLWARD] ignoring unreadable saved bindings', error);
  }
  return defaultBindings();
}

/**
 * The guard action arrived in binding format v2. A v1 document keeps every custom key
 * and gains the shipped guard defaults, so the hand the player trained does not reset.
 */
export function migrateBindings(value: unknown): unknown {
  if (!isRecord(value) || value.version !== 1) return value;
  if (!isRecord(value.keyboard)) return value;

  const keyboard: Record<string, unknown> = { ...value.keyboard };
  if (keyboard.guard === undefined) keyboard.guard = [...KEY_BINDINGS.guard];

  const gamepad: Record<string, unknown> = isRecord(value.gamepad) ? { ...value.gamepad } : {};
  const buttons: Record<string, unknown> = isRecord(gamepad.buttons) ? { ...gamepad.buttons } : {};
  if (buttons.guard === undefined) buttons.guard = [...(PAD_BUTTONS.guard ?? [])];
  gamepad.buttons = buttons;

  return { ...value, version: INPUT.bindingFormatVersion, keyboard, gamepad };
}

/** Persists the document. A blocked storage must never break the game. */
export function saveBindings(bindings: Bindings, storage = defaultBindingsStorage()): void {
  if (!storage) return;
  try {
    storage.setItem(INPUT.storageKey, JSON.stringify(bindings));
  } catch (error) {
    console.warn('[BELLWARD] could not persist bindings', error);
  }
}

/** Finds another slot that already uses a keyboard code. */
export function findKeyboardConflict(
  bindings: Bindings,
  code: string,
  ignoreAction: ActionName,
  ignoreSlot: number,
): BindingConflict | null {
  for (const action of ACTIONS) {
    const keys = bindings.keyboard[action];
    for (let slot = 0; slot < keys.length; slot += 1) {
      if (action === ignoreAction && slot === ignoreSlot) continue;
      if (keys[slot] === code) return { action, slot };
    }
  }
  return null;
}

/** Finds another slot that already uses a gamepad button. */
export function findPadConflict(
  bindings: Bindings,
  button: number,
  ignoreAction: ActionName,
  ignoreSlot: number,
): BindingConflict | null {
  for (const action of ACTIONS) {
    const buttons = bindings.gamepad.buttons[action];
    if (!buttons) continue;
    for (let slot = 0; slot < buttons.length; slot += 1) {
      if (action === ignoreAction && slot === ignoreSlot) continue;
      if (buttons[slot] === button) return { action, slot };
    }
  }
  return null;
}

/** Returns a new document with one keyboard slot replaced, or an unchanged document on conflict. */
export function setKeyboardBinding(
  bindings: Bindings,
  action: ActionName,
  slot: number,
  code: string,
): BindingEdit {
  const conflict = findKeyboardConflict(bindings, code, action, slot);
  if (conflict) return { bindings, conflict };

  const keys = [...bindings.keyboard[action]];
  if (slot < keys.length) keys[slot] = code;
  else if (slot === keys.length && keys.length < KEY_SLOTS) keys.push(code);
  else return { bindings, conflict: null };

  return {
    bindings: {
      ...bindings,
      keyboard: { ...bindings.keyboard, [action]: keys },
    },
    conflict: null,
  };
}

/** Returns a new document with one gamepad slot replaced, or an unchanged document on conflict. */
export function setPadBinding(
  bindings: Bindings,
  action: ActionName,
  slot: number,
  button: number,
): BindingEdit {
  const conflict = findPadConflict(bindings, button, action, slot);
  if (conflict) return { bindings, conflict };

  const buttons = [...(bindings.gamepad.buttons[action] ?? [])];
  if (slot < buttons.length) buttons[slot] = button;
  else if (slot === buttons.length && buttons.length < PAD_SLOTS) buttons.push(button);
  else return { bindings, conflict: null };

  return {
    bindings: {
      ...bindings,
      gamepad: {
        ...bindings.gamepad,
        buttons: { ...bindings.gamepad.buttons, [action]: buttons },
      },
    },
    conflict: null,
  };
}

/** Presentation helpers stay importable from the binding module for existing callers. */
export {
  describeKeyCode,
  describePadButton,
  formatKeyCode,
  formatPadButton,
} from './bindingLabels';

function isBindings(value: unknown): value is Bindings {
  if (!isRecord(value) || value.version !== INPUT.bindingFormatVersion) return false;
  if (!isRecord(value.keyboard) || !isRecord(value.gamepad)) return false;

  for (const action of ACTIONS) {
    if (!isStringArray(value.keyboard[action], KEY_SLOTS)) return false;
  }
  for (const key of Object.keys(value.keyboard)) {
    if (!isAction(key)) return false;
  }

  const buttons = value.gamepad.buttons;
  if (!isRecord(buttons)) return false;
  for (const key of Object.keys(buttons)) {
    if (!isAction(key) || !isButtonArray(buttons[key])) return false;
  }

  const axes = value.gamepad.axes;
  if (!isRecord(axes)) return false;
  for (const key of Object.keys(axes)) {
    if (!isAction(key) || !isAxisBinding(axes[key])) return false;
  }

  return true;
}

function isAction(value: string): value is ActionName {
  return (ACTIONS as readonly string[]).includes(value);
}

function isStringArray(value: unknown, max: number): value is string[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > max) return false;
  const seen = new Set<string>();
  for (const entry of value) {
    if (typeof entry !== 'string' || entry.length < 1 || entry.length > 32) return false;
    if (seen.has(entry)) return false;
    seen.add(entry);
  }
  return true;
}

function isButtonArray(value: unknown): value is number[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > PAD_SLOTS) return false;
  const seen = new Set<number>();
  for (const entry of value) {
    if (!Number.isInteger(entry) || entry < 0 || entry > 31) return false;
    if (seen.has(entry)) return false;
    seen.add(entry);
  }
  return true;
}

function isAxisBinding(value: unknown): value is PadAxisBinding {
  return (
    isRecord(value) &&
    Number.isInteger(value.axis) &&
    (value.axis as number) >= 0 &&
    (value.axis as number) <= 3 &&
    (value.dir === -1 || value.dir === 1)
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
