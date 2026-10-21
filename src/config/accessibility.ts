/**
 * Player-facing accessibility tuning. The document is deliberately tiny: screen shake is
 * the one motion effect that can be disabled independently of the CSS motion preference.
 * Browser motion preferences still disable decorative UI animation in CSS.
 */
export const ACCESSIBILITY = {
  /** localStorage key for the persisted accessibility document. Reads/writes are guarded. */
  storageKey: 'bellward.accessibility.v1',
  /** Serialized schema version. Unknown versions fall back to the OS preference. */
  version: 1,
} as const;

export type AccessibilityDocument = {
  readonly version: number;
  readonly screenShake: boolean;
};
