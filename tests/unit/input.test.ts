import { describe, expect, it } from 'vitest';
import { ACTIONS, INPUT } from '../../src/config/input';
import { setKeyboardBinding, defaultBindings } from '../../src/input/bindings';
import { InputManager, type PadReading } from '../../src/input/InputManager';

function managerWithPad(): { input: InputManager; setPad: (pad: PadReading) => void } {
  let pad: PadReading = null;
  const input = new InputManager({ getPad: () => pad });
  return {
    input,
    setPad: (value) => {
      pad = value;
    },
  };
}

describe('InputManager', () => {
  it('delivers a press edge exactly once and keeps the key held', () => {
    const input = new InputManager();
    expect(input.handleKey('KeyD', true)).toBe(true);

    const first = input.snapshot();
    expect(first.held.has('right')).toBe(true);
    expect(first.pressed.has('right')).toBe(true);

    const second = input.snapshot();
    expect(second.held.has('right')).toBe(true);
    expect(second.pressed.has('right')).toBe(false);
  });

  it('delivers a release edge exactly once', () => {
    const input = new InputManager();
    input.handleKey('KeyD', true);
    input.snapshot();
    input.handleKey('KeyD', false);

    const first = input.snapshot();
    expect(first.held.has('right')).toBe(false);
    expect(first.released.has('right')).toBe(true);
    expect(input.snapshot().released.has('right')).toBe(false);
  });

  it('ignores unbound keys so they keep their browser default', () => {
    const input = new InputManager();
    expect(input.handleKey('KeyQ', true)).toBe(false);
    expect(input.snapshot().held.size).toBe(0);
  });

  it('ignores OS auto-repeat on a held key', () => {
    const input = new InputManager();
    input.handleKey('KeyD', true);
    input.snapshot();
    input.handleKey('KeyD', true);
    expect(input.snapshot().pressed.has('right')).toBe(false);
  });

  it('keeps an action held while any of its keys is down', () => {
    const input = new InputManager();
    input.handleKey('ArrowRight', true);
    input.handleKey('KeyD', true);
    input.handleKey('ArrowRight', false);

    const held = input.snapshot();
    expect(held.held.has('right')).toBe(true);
    expect(held.released.has('right')).toBe(false);

    input.handleKey('KeyD', false);
    expect(input.snapshot().released.has('right')).toBe(true);
  });

  it('maps one key to every action bound to it (ArrowUp is up and interact)', () => {
    const input = new InputManager();
    input.handleKey('ArrowUp', true);
    const snapshot = input.snapshot();
    expect(snapshot.held.has('up')).toBe(true);
    expect(snapshot.held.has('interact')).toBe(true);
  });

  it('clears held actions on blur so no key can stick', () => {
    const input = new InputManager();
    input.handleKey('ArrowLeft', true);
    input.setVirtual('right', true);
    input.snapshot();
    input.blur();

    const after = input.snapshot();
    expect(after.held.size).toBe(0);
    expect(after.released.has('left')).toBe(true);
    expect(after.released.has('right')).toBe(true);
  });

  it('reads the standard gamepad mapping', () => {
    const { input, setPad } = managerWithPad();
    setPad({ buttons: [true], axes: [0.9, 0] });

    const snapshot = input.snapshot();
    expect(snapshot.held.has('jump')).toBe(true); // A
    expect(snapshot.held.has('right')).toBe(true); // stick right
    expect(snapshot.held.has('left')).toBe(false);
    expect(snapshot.pressed.has('jump')).toBe(true);

    setPad(null);
    const after = input.snapshot();
    expect(after.held.size).toBe(0);
    expect(after.released.has('jump')).toBe(true);
    expect(after.released.has('right')).toBe(true);
  });

  it('respects the stick deadzone', () => {
    const { input, setPad } = managerWithPad();
    setPad({ buttons: [], axes: [0.2, -0.1] });
    expect(input.snapshot().held.size).toBe(0);
  });

  it('does not release an action the keyboard still holds when the pad drops it', () => {
    const { input, setPad } = managerWithPad();
    input.handleKey('Space', true);
    setPad({ buttons: [true], axes: [0, 0] });
    input.snapshot();

    setPad(null);
    const after = input.snapshot();
    expect(after.held.has('jump')).toBe(true);
    expect(after.released.has('jump')).toBe(false);
  });

  it('queues a quick on-screen tap as both edges between ticks', () => {
    const input = new InputManager();
    input.setVirtual('jump', true);
    input.setVirtual('jump', false);

    const tap = input.snapshot();
    expect(tap.pressed.has('jump')).toBe(true);
    expect(tap.released.has('jump')).toBe(true);
    expect(tap.held.has('jump')).toBe(false);
  });

  it('keeps an action held while touch and keyboard overlap', () => {
    const input = new InputManager();
    input.handleKey('ArrowRight', true);
    const keyboard = input.snapshot();
    expect(keyboard.pressed.has('right')).toBe(true);

    input.setVirtual('right', true);
    const touch = input.snapshot();
    expect(touch.held.has('right')).toBe(true);
    expect(touch.pressed.has('right')).toBe(false);

    input.handleKey('ArrowRight', false);
    const keyUp = input.snapshot();
    expect(keyUp.held.has('right')).toBe(true);
    expect(keyUp.released.has('right')).toBe(false);

    input.setVirtual('right', false);
    const after = input.snapshot();
    expect(after.held.has('right')).toBe(false);
    expect(after.released.has('right')).toBe(true);
  });

  it('does not release a touch-held action when the pad drops it', () => {
    const { input, setPad } = managerWithPad();
    setPad({ buttons: [true], axes: [0, 0] });
    input.setVirtual('jump', true);
    input.snapshot();

    setPad(null);
    const after = input.snapshot();
    expect(after.held.has('jump')).toBe(true);
    expect(after.released.has('jump')).toBe(false);
  });

  it('serializes the bindings for the settings UI', () => {
    const data: unknown = JSON.parse(new InputManager().serialize());
    expect(data).toMatchObject({ version: INPUT.bindingFormatVersion });
    const keyboard = (data as { keyboard: Record<string, unknown> }).keyboard;
    for (const action of ACTIONS) {
      expect(Array.isArray(keyboard[action])).toBe(true);
      expect((keyboard[action] as string[]).length).toBeGreaterThan(0);
    }
  });

  it('uses supplied bindings and swaps them live', () => {
    const rebound = setKeyboardBinding(defaultBindings(), 'jump', 0, 'KeyQ').bindings;
    const input = new InputManager({ bindings: rebound });

    expect(input.handleKey('KeyU', true)).toBe(false);
    expect(input.handleKey('KeyQ', true)).toBe(true);
    expect(input.snapshot().pressed.has('jump')).toBe(true);
    expect(JSON.parse(input.serialize()).keyboard.jump).toEqual(['KeyQ', 'Space']);

    input.handleKey('KeyQ', false);
    input.setBindings(defaultBindings());
    expect(input.snapshot().held.has('jump')).toBe(false);
    expect(input.handleKey('Space', true)).toBe(true);
  });

  it('resets every input set without emitting release edges', () => {
    const { input, setPad } = managerWithPad();
    input.handleKey('ArrowLeft', true);
    input.setVirtual('heal', true);
    setPad({ buttons: [true], axes: [0, 0] });
    input.snapshot();

    input.reset();
    setPad(null);
    const after = input.snapshot();
    expect(after.held.size).toBe(0);
    expect(after.pressed.size).toBe(0);
    expect(after.released.size).toBe(0);
  });
});
