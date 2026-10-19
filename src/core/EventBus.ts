import { BellwardError } from './Errors';

/** Constraint for event maps: every event payload is an object. */
export type EventPayloadMap = Record<string, object>;

type Listener<T> = (payload: T) => void;

type ErrorHandler = (event: string, error: unknown) => void;

/**
 * Minimal typed synchronous event bus.
 *
 * Rules of engagement:
 * - Listeners run in subscription order.
 * - A throwing listener never breaks the emitting system; the error is routed to `onError`
 *   (default: rethrown wrapped, because this project fails loudly).
 * - `emit` iterates over a snapshot, so listeners may (un)subscribe during dispatch.
 */
export class EventBus<Events extends EventPayloadMap> {
  private readonly listeners = new Map<keyof Events, Set<Listener<never>>>();
  private readonly onError: ErrorHandler;

  constructor(onError?: ErrorHandler) {
    this.onError =
      onError ??
      ((event, error) => {
        throw new BellwardError(`listener for "${event}" threw: ${String(error)}`);
      });
  }

  /** Subscribes to `event`. Returns an unsubscribe function. */
  on<K extends keyof Events>(event: K, listener: Listener<Events[K]>): () => void {
    let set = this.listeners.get(event);
    if (!set) {
      set = new Set();
      this.listeners.set(event, set);
    }
    // Listener<Events[K]> is assignable to Listener<never> (never is assignable to any param).
    set.add(listener);
    return () => {
      set.delete(listener);
    };
  }

  /** Removes a previously subscribed listener. Unknown listeners are ignored. */
  off<K extends keyof Events>(event: K, listener: Listener<Events[K]>): void {
    const set = this.listeners.get(event);
    if (!set) return;
    set.delete(listener);
    if (set.size === 0) {
      this.listeners.delete(event);
    }
  }

  /** Synchronously dispatches `payload` to all listeners of `event`. */
  emit<K extends keyof Events>(event: K, payload: Events[K]): void {
    const set = this.listeners.get(event);
    if (!set || set.size === 0) return;
    const snapshot = [...set];
    for (const listener of snapshot) {
      try {
        (listener as Listener<Events[K]>)(payload);
      } catch (error) {
        this.onError(String(event), error);
      }
    }
  }

  /** Detaches every listener (shutdown / scene teardown). */
  clear(): void {
    this.listeners.clear();
  }
}
