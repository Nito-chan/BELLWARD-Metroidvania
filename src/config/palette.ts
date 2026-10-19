/**
 * Master palette (dark-brass-and-water mood). Rendering code references these names,
 * never raw hex values, so the art direction stays consistent across milestones.
 */
export const PALETTE = {
  /** Deepest background, used as the renderer clear color. */
  void: 0x05070a,
  deepWater: 0x0b1b26,
  cavern: 0x14212e,
  stone: 0x2a3a4a,
  stoneLit: 0x3d5266,
  brass: 0xc9a86a,
  brassDark: 0x8a6f3c,
  echo: 0x7fe0c3,
  ember: 0xe8a35c,
  blood: 0x9e3b3b,
  bone: 0xd9d2c0,
  moss: 0x5f7f4f,
  /** Multiplicative tint that pushes the warm parallax art toward the belfry's cool night. */
  duskFar: 0xcdd6e6,
  duskMid: 0xb9c6dc,
} as const;

export type PaletteName = keyof typeof PALETTE;
