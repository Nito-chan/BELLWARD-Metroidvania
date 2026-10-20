/**
 * Human-readable labels for keyboard codes and standard-mapping gamepad buttons.
 * The binding document stores raw `KeyboardEvent.code` values and button indices; this
 * module is the only place that turns them into text for the controls screen and the
 * screen-reader labels. Kept apart from `bindings.ts` so that persistence/validation and
 * presentation stay independently readable.
 */

const KEY_LABELS: Readonly<Record<string, string>> = {
  Escape: 'Esc',
  Space: 'Space',
  Enter: 'Enter',
  Tab: 'Tab',
  Backspace: 'Backspace',
  Delete: 'Del',
  ArrowLeft: '←',
  ArrowRight: '→',
  ArrowUp: '↑',
  ArrowDown: '↓',
  ShiftLeft: 'Shift L',
  ShiftRight: 'Shift R',
  ControlLeft: 'Ctrl L',
  ControlRight: 'Ctrl R',
  AltLeft: 'Alt L',
  AltRight: 'Alt R',
  MetaLeft: 'Meta L',
  MetaRight: 'Meta R',
  BracketLeft: '[',
  BracketRight: ']',
  Semicolon: ';',
  Quote: "'",
  Comma: ',',
  Period: '.',
  Slash: '/',
  Backslash: '\\',
  Minus: '-',
  Equal: '=',
  Backquote: '`',
};

const KEY_DESCRIPTIONS: Readonly<Record<string, string>> = {
  Escape: 'Escape',
  Space: 'Space',
  Enter: 'Enter',
  Tab: 'Tab',
  Backspace: 'Backspace',
  Delete: 'Delete',
  ArrowLeft: 'Left arrow',
  ArrowRight: 'Right arrow',
  ArrowUp: 'Up arrow',
  ArrowDown: 'Down arrow',
  ShiftLeft: 'Left Shift',
  ShiftRight: 'Right Shift',
  ControlLeft: 'Left Control',
  ControlRight: 'Right Control',
  AltLeft: 'Left Alt',
  AltRight: 'Right Alt',
  MetaLeft: 'Left Meta',
  MetaRight: 'Right Meta',
};

const PAD_LABELS: Readonly<Record<number, string>> = {
  0: 'A',
  1: 'B',
  2: 'X',
  3: 'Y',
  4: 'LB',
  5: 'RB',
  6: 'LT',
  7: 'RT',
  8: 'Select',
  9: 'Start',
  10: 'LS',
  11: 'RS',
  12: 'D↑',
  13: 'D↓',
  14: 'D←',
  15: 'D→',
  16: 'Guide',
};

const PAD_DESCRIPTIONS: Readonly<Record<number, string>> = {
  0: 'A / Cross',
  1: 'B / Circle',
  2: 'X / Square',
  3: 'Y / Triangle',
  4: 'Left bumper',
  5: 'Right bumper',
  6: 'Left trigger',
  7: 'Right trigger',
  8: 'Back / Select',
  9: 'Start / Options',
  10: 'Left stick click',
  11: 'Right stick click',
  12: 'D-pad up',
  13: 'D-pad down',
  14: 'D-pad left',
  15: 'D-pad right',
  16: 'Guide',
};

export function formatKeyCode(code: string): string {
  const special = KEY_LABELS[code];
  if (special) return special;
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  if (code.startsWith('Numpad')) return `Num ${code.slice(6)}`;
  return code;
}

/** Long form for screen-reader labels ("Left arrow" rather than "←"). */
export function describeKeyCode(code: string): string {
  return KEY_DESCRIPTIONS[code] ?? formatKeyCode(code);
}

export function formatPadButton(index: number): string {
  return PAD_LABELS[index] ?? `Btn ${index}`;
}

export function describePadButton(index: number): string {
  return PAD_DESCRIPTIONS[index] ?? `Button ${index}`;
}
