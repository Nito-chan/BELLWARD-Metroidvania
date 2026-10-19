import { describe, expect, it, vi } from 'vitest';
import { EventBus } from '../../src/core/EventBus';

type TestEvents = {
  ping: { value: number };
  pong: { label: string };
};

describe('EventBus', () => {
  it('delivers payloads to subscribers in subscription order', () => {
    const bus = new EventBus<TestEvents>();
    const order: string[] = [];
    bus.on('ping', (payload) => order.push(`a:${payload.value}`));
    bus.on('ping', (payload) => order.push(`b:${payload.value}`));
    bus.emit('ping', { value: 7 });
    expect(order).toEqual(['a:7', 'b:7']);
  });

  it('returns an unsubscribe function from on()', () => {
    const bus = new EventBus<TestEvents>();
    const listener = vi.fn();
    const unsubscribe = bus.on('ping', listener);

    bus.emit('ping', { value: 1 });
    unsubscribe();
    bus.emit('ping', { value: 2 });

    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('off() removes a specific listener and ignores unknown ones', () => {
    const bus = new EventBus<TestEvents>();
    const listener = vi.fn();
    bus.on('pong', listener);
    bus.off('pong', listener);
    bus.off('pong', listener); // no-op, must not throw
    bus.emit('pong', { label: 'x' });
    expect(listener).not.toHaveBeenCalled();
  });

  it('isolates listener errors and reports them with the event name', () => {
    const onError = vi.fn();
    const bus = new EventBus<TestEvents>(onError);
    const good = vi.fn();
    bus.on('ping', () => {
      throw new Error('bad listener');
    });
    bus.on('ping', good);

    expect(() => bus.emit('ping', { value: 3 })).not.toThrow();
    expect(good).toHaveBeenCalledWith({ value: 3 });
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError.mock.calls[0]?.[0]).toBe('ping');
  });

  it('unsubscribing during emit does not break iteration (snapshot semantics)', () => {
    const bus = new EventBus<TestEvents>();
    const second = vi.fn();
    const unsubscribeFirst = bus.on('ping', () => {
      unsubscribeFirst();
    });
    bus.on('ping', second);

    bus.emit('ping', { value: 1 });

    expect(second).toHaveBeenCalledTimes(1);
  });

  it('clear() detaches all listeners', () => {
    const bus = new EventBus<TestEvents>();
    const listener = vi.fn();
    bus.on('ping', listener);
    bus.clear();
    bus.emit('ping', { value: 1 });
    expect(listener).not.toHaveBeenCalled();
  });

  it('emitting with no listeners is a no-op', () => {
    const bus = new EventBus<TestEvents>();
    expect(() => bus.emit('ping', { value: 1 })).not.toThrow();
  });
});
