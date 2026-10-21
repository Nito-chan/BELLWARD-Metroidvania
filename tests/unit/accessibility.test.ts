import { describe, expect, it } from 'vitest';
import { ACCESSIBILITY } from '../../src/config/accessibility';
import { AccessibilitySettings } from '../../src/settings/AccessibilitySettings';

function fakeStorage(initial?: string): Storage {
  const values = new Map<string, string>();
  if (initial !== undefined) values.set(ACCESSIBILITY.storageKey, initial);
  return {
    get length() {
      return values.size;
    },
    clear: () => values.clear(),
    getItem: (key: string) => values.get(key) ?? null,
    key: (index: number) => [...values.keys()][index] ?? null,
    removeItem: (key: string) => {
      values.delete(key);
    },
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
  };
}

describe('AccessibilitySettings', () => {
  it('defaults screen shake to the inverse of the OS motion preference', () => {
    expect(new AccessibilitySettings(fakeStorage(), false).screenShake).toBe(true);
    expect(new AccessibilitySettings(fakeStorage(), true).screenShake).toBe(false);
  });

  it('persists a toggle and restores it over the OS default', () => {
    const storage = fakeStorage();
    const settings = new AccessibilitySettings(storage, false);
    expect(settings.toggleScreenShake()).toBe(false);

    const restored = new AccessibilitySettings(storage, false);
    expect(restored.screenShake).toBe(false);
    expect(JSON.parse(storage.getItem(ACCESSIBILITY.storageKey) ?? '{}')).toEqual({
      version: ACCESSIBILITY.version,
      screenShake: false,
    });
  });

  it('ignores corrupt or future-versioned documents without throwing', () => {
    expect(new AccessibilitySettings(fakeStorage('{'), true).screenShake).toBe(false);
    expect(
      new AccessibilitySettings(
        fakeStorage(JSON.stringify({ version: 99, screenShake: true })),
        true,
      ).screenShake,
    ).toBe(false);
    expect(
      new AccessibilitySettings(
        fakeStorage(JSON.stringify({ version: ACCESSIBILITY.version, screenShake: 'yes' })),
        false,
      ).screenShake,
    ).toBe(true);
  });

  it('works without storage', () => {
    const settings = new AccessibilitySettings(null, false);
    expect(settings.screenShake).toBe(true);
    expect(settings.setScreenShake(false)).toBe(false);
    expect(settings.screenShake).toBe(false);
  });
});
