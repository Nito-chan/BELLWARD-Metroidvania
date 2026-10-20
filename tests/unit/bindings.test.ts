import { afterEach, describe, expect, it, vi } from 'vitest';
import { ACTIONS, INPUT } from '../../src/config/input';
import {
  defaultBindings,
  findKeyboardConflict,
  findPadConflict,
  formatKeyCode,
  formatPadButton,
  loadBindings,
  saveBindings,
  setKeyboardBinding,
  setPadBinding,
  type Bindings,
  type BindingsStorage,
} from '../../src/input/bindings';

class MapStorage implements BindingsStorage {
  readonly map = new Map<string, string>();

  getItem(key: string): string | null {
    return this.map.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.map.set(key, value);
  }
}

function withoutWarnings<T>(run: () => T): T {
  const spy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  try {
    return run();
  } finally {
    spy.mockRestore();
  }
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('binding document', () => {
  it('starts from a complete versioned default document', () => {
    const bindings = defaultBindings();
    expect(bindings.version).toBe(INPUT.bindingFormatVersion);
    for (const action of ACTIONS) {
      expect(bindings.keyboard[action].length).toBeGreaterThan(0);
    }
    expect(bindings.gamepad.buttons.jump).toEqual([0]);
    expect(bindings.gamepad.axes.left).toEqual({ axis: 0, dir: -1 });
  });

  it('round-trips through storage', () => {
    const storage = new MapStorage();
    const edited = setKeyboardBinding(defaultBindings(), 'jump', 0, 'KeyQ').bindings;
    saveBindings(edited, storage);
    expect(loadBindings(storage)).toEqual(edited);
  });

  it('falls back to defaults for malformed, partial and future documents', () => {
    const storage = new MapStorage();
    withoutWarnings(() => {
      for (const raw of ['{ not json', '{"version":1}', '{"version":99}']) {
        storage.setItem(INPUT.storageKey, raw);
        expect(loadBindings(storage)).toEqual(defaultBindings());
      }
    });
  });

  it('rejects a document with no pad tables instead of booting into a crash', () => {
    const storage = new MapStorage();
    const document = JSON.parse(JSON.stringify(defaultBindings())) as {
      gamepad: Record<string, unknown>;
    };
    delete document.gamepad.buttons;
    delete document.gamepad.axes;
    storage.setItem(INPUT.storageKey, JSON.stringify(document));
    withoutWarnings(() => expect(loadBindings(storage)).toEqual(defaultBindings()));
  });

  it('rejects a document missing an action or containing a duplicate key in one slot', () => {
    const storage = new MapStorage();
    const partial = JSON.parse(JSON.stringify(defaultBindings())) as {
      keyboard: Record<string, string[]>;
    };
    delete partial.keyboard.map;
    storage.setItem(INPUT.storageKey, JSON.stringify({ ...partial, version: 1 }));
    withoutWarnings(() => expect(loadBindings(storage)).toEqual(defaultBindings()));

    const duplicate = defaultBindings() as unknown as {
      keyboard: Record<string, string[]>;
    };
    duplicate.keyboard.jump = ['KeyZ', 'KeyZ'];
    storage.setItem(INPUT.storageKey, JSON.stringify(duplicate));
    withoutWarnings(() => expect(loadBindings(storage)).toEqual(defaultBindings()));
  });

  it('survives storage that throws', () => {
    const storage: BindingsStorage = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    };
    withoutWarnings(() => {
      expect(loadBindings(storage)).toEqual(defaultBindings());
      expect(() => saveBindings(defaultBindings(), storage)).not.toThrow();
    });
  });
});

describe('binding edits', () => {
  it('replaces one keyboard slot and leaves the rest untouched', () => {
    const before = defaultBindings();
    const result = setKeyboardBinding(before, 'jump', 0, 'KeyQ');
    expect(result.conflict).toBeNull();
    expect(result.bindings.keyboard.jump).toEqual(['KeyQ', 'Space']);
    expect(result.bindings.keyboard.attack).toEqual(before.keyboard.attack);
    expect(before.keyboard.jump[0]).toBe('KeyZ');
  });

  it('fills a spare keyboard slot', () => {
    const before = defaultBindings();
    const result = setKeyboardBinding(before, 'heal', 1, 'KeyH');
    expect(result.bindings.keyboard.heal).toEqual(['KeyL', 'KeyH']);
  });

  it('rejects a code already used by another action, including the same action', () => {
    const bindings = defaultBindings();
    const cross = setKeyboardBinding(bindings, 'jump', 0, 'ArrowRight');
    expect(cross.conflict).toEqual({ action: 'right', slot: 0 });
    expect(cross.bindings).toBe(bindings);

    const sameAction = setKeyboardBinding(bindings, 'jump', 0, 'Space');
    expect(sameAction.conflict).toEqual({ action: 'jump', slot: 1 });
  });

  it('ignores the slot being edited when checking conflicts', () => {
    const bindings = defaultBindings();
    expect(findKeyboardConflict(bindings, 'KeyZ', 'jump', 0)).toBeNull();
    expect(findKeyboardConflict(bindings, 'KeyZ', 'jump', 1)).toEqual({ action: 'jump', slot: 0 });
  });

  it('sets gamepad buttons and detects pad conflicts', () => {
    const before = defaultBindings();
    const result = setPadBinding(before, 'jump', 0, 10);
    expect(result.conflict).toBeNull();
    expect(result.bindings.gamepad.buttons.jump).toEqual([10]);

    const conflict = setPadBinding(before, 'jump', 0, 2);
    expect(conflict.conflict).toEqual({ action: 'attack', slot: 0 });
    expect(conflict.bindings).toBe(before);
    expect(findPadConflict(before, 9, 'pause', 0)).toBeNull();
  });
});

describe('binding labels', () => {
  it('formats keyboard codes for display and descriptions', () => {
    expect(formatKeyCode('KeyQ')).toBe('Q');
    expect(formatKeyCode('Digit4')).toBe('4');
    expect(formatKeyCode('ArrowLeft')).toBe('←');
    expect(formatKeyCode('Escape')).toBe('Esc');
    expect(formatKeyCode('Numpad7')).toBe('Num 7');
  });

  it('formats standard gamepad buttons', () => {
    expect(formatPadButton(0)).toBe('A');
    expect(formatPadButton(5)).toBe('RB');
    expect(formatPadButton(14)).toBe('D←');
    expect(formatPadButton(31)).toBe('Btn 31');
  });

  it('produces a document JSON.parse can consume', () => {
    const data = JSON.parse(JSON.stringify(defaultBindings())) as Bindings;
    expect(data.version).toBe(1);
    expect(data.keyboard.pause).toEqual(['Escape']);
  });
});
