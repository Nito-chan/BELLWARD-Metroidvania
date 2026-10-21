/**
 * Persisted accessibility preferences. Loading is all-or-nothing: a corrupt or
 * future-versioned document falls back to the operating-system motion preference rather
 * than booting into half a setting. Storage failures never break play.
 */
import { ACCESSIBILITY, type AccessibilityDocument } from '../config/accessibility';

export type AccessibilityStorage = Pick<Storage, 'getItem' | 'setItem'>;

/** True when the player asked the OS to minimise non-essential motion. */
export function prefersReducedMotion(): boolean {
  try {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

export function defaultAccessibilityStorage(): AccessibilityStorage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

export class AccessibilitySettings {
  private screenShakeValue: boolean;

  constructor(
    private readonly storage: AccessibilityStorage | null = defaultAccessibilityStorage(),
    reduceMotion = prefersReducedMotion(),
  ) {
    const saved = readDocument(this.storage);
    this.screenShakeValue = saved?.screenShake ?? !reduceMotion;
  }

  get screenShake(): boolean {
    return this.screenShakeValue;
  }

  setScreenShake(enabled: boolean): boolean {
    this.screenShakeValue = enabled;
    writeDocument(this.storage, {
      version: ACCESSIBILITY.version,
      screenShake: enabled,
    });
    return this.screenShakeValue;
  }

  toggleScreenShake(): boolean {
    return this.setScreenShake(!this.screenShakeValue);
  }
}

function readDocument(storage: AccessibilityStorage | null): AccessibilityDocument | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(ACCESSIBILITY.storageKey);
    if (raw === null) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!isDocument(parsed)) {
      console.warn('[BELLWARD] ignoring invalid saved accessibility preferences');
      return null;
    }
    return parsed;
  } catch (error) {
    console.warn('[BELLWARD] ignoring unreadable accessibility preferences', error);
    return null;
  }
}

function writeDocument(storage: AccessibilityStorage | null, document: AccessibilityDocument): void {
  if (!storage) return;
  try {
    storage.setItem(ACCESSIBILITY.storageKey, JSON.stringify(document));
  } catch (error) {
    console.warn('[BELLWARD] could not persist accessibility preferences', error);
  }
}

function isDocument(value: unknown): value is AccessibilityDocument {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    (value as Record<string, unknown>).version === ACCESSIBILITY.version &&
    typeof (value as Record<string, unknown>).screenShake === 'boolean'
  );
}
