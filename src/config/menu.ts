/**
 * Menu tuning. UI timings and reserved system inputs live here so the menu model,
 * the DOM view and the binding editor never hard-code a number or a button index.
 */
export const MENU = {
  /** One arrow-key / stick nudge on a volume slider, as a fraction of full scale. */
  volumeStep: 0.05,
  /** Standard-mapping buttons the menus own; they can never be captured as a binding. */
  reservedPadButtons: [8, 9, 12, 13, 14, 15] as const,
  /** Keyboard codes the menus own (focus, cancel, diagnostics, bare modifiers). */
  reservedKeys: [
    'Escape',
    'Tab',
    'F1',
    'ShiftLeft',
    'ShiftRight',
    'ControlLeft',
    'ControlRight',
    'AltLeft',
    'AltRight',
    'MetaLeft',
    'MetaRight',
    'CapsLock',
    'NumLock',
    'ScrollLock',
  ] as const,
  /** Standard-mapping indices used by menu navigation. */
  pad: {
    confirm: 0,
    back: 1,
    cancelCapture: 8,
    pause: 9,
    up: 12,
    down: 13,
    left: 14,
    right: 15,
  } as const,
  /** Left-stick magnitude that counts as a menu direction. */
  stickDeadzone: 0.55,
  /** Wall-clock delay before a held direction starts repeating. */
  repeatDelayMs: 320,
  /** Wall-clock interval between repeats once repeating has started. */
  repeatEveryMs: 110,
} as const;
