import type { PaletteName } from '../config/palette';
import { PARALLAX, RENDER } from '../config/render';
import type { AnimationClip, CharacterArt } from '../render/Animation';
import type { BackgroundKey, PropKey } from '../world/Room';
import type { TileRole } from '../world/tiles';

/**
 * Art data for the M1 vertical slice. Rooms reference semantic roles and prop keys;
 * this file is the only place that knows which pack file (or atlas rect) backs them.
 *
 * Packed art and the procedural fallback produce the same logical keys, so swapping
 * art sources never touches room data or rendering code.
 */

export type SourceRect = {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
};

/** Packed textures, keyed by logical art key. Paths are relative to `public/`. */
export const ART_URLS = {
  'church.tiles': 'assets/ansimuz-church/ENVIRONMENT/tileset.png',
  'church.column': 'assets/ansimuz-church/ENVIRONMENT/column.png',
  'bg.far': 'assets/ansimuz-town/PNG/environment/layers/background.png',
  'bg.mid': 'assets/ansimuz-town/PNG/environment/layers/middleground.png',
  'hero.idle': 'assets/aamatniekss-knight/Colour1/NoOutline/120x80_PNGSheets/_Idle.png',
  'hero.run': 'assets/aamatniekss-knight/Colour1/NoOutline/120x80_PNGSheets/_Run.png',
  'hero.turn': 'assets/aamatniekss-knight/Colour1/NoOutline/120x80_PNGSheets/_TurnAround.png',
  'hero.jump': 'assets/aamatniekss-knight/Colour1/NoOutline/120x80_PNGSheets/_Jump.png',
  'hero.fall': 'assets/aamatniekss-knight/Colour1/NoOutline/120x80_PNGSheets/_Fall.png',
  'hero.attack1': 'assets/aamatniekss-knight/Colour1/NoOutline/120x80_PNGSheets/_Attack.png',
  'hero.attack2': 'assets/aamatniekss-knight/Colour1/NoOutline/120x80_PNGSheets/_Attack2.png',
  'hero.dash': 'assets/aamatniekss-knight/Colour1/NoOutline/120x80_PNGSheets/_Dash.png',
  'enemy.parishioner.idle': 'assets/ansimuz-town/PNG/spritesheets/bearded-idle.png',
  'enemy.parishioner.walk': 'assets/ansimuz-town/PNG/spritesheets/bearded-walk.png',
  'enemy.ghoul': 'assets/ansimuz-church/SPRITES/burning-ghoul/spritesheet/v2/burning-ghoul.png',
  'enemy.adept': 'assets/ansimuz-church/SPRITES/wizard/spritesheet/wizard.png',
  'fx.enemyDeath':
    'assets/ansimuz-church/SPRITES/fx/enemy-death/enemy-death-spritesheet/enemy-death.png',
  'fx.fireball': 'assets/ansimuz-church/SPRITES/fx/fireball/fireball-spritesheet/fireball.png',
} as const;

export type ArtKey = keyof typeof ART_URLS;

/** One 16px cell of the GothicVania church tileset (21x14 cells, chunk-based). */
function cell(col: number, row: number): SourceRect {
  const size = RENDER.tileSize;
  return { x: col * size, y: row * size, w: size, h: size };
}

/**
 * Church tileset cells that tile acceptably when repeated. The source pack is a chunk
 * kit, so the cells below are deliberately cherry-picked: floor-top cells include the
 * lit rim, fill cells are fully opaque brick interiors.
 */
export const TILE_ART: Partial<Record<TileRole, readonly SourceRect[]>> = {
  floor: [
    cell(0, 10),
    cell(1, 10),
    cell(2, 10),
    cell(4, 10),
    cell(5, 10),
    cell(6, 10),
    cell(8, 10),
    cell(9, 10),
    cell(10, 10),
  ],
  floorFill: [
    cell(0, 11),
    cell(1, 11),
    cell(2, 11),
    cell(4, 11),
    cell(5, 11),
    cell(6, 11),
    cell(8, 11),
    cell(9, 11),
    cell(10, 11),
  ],
  wall: [
    cell(1, 2),
    cell(1, 3),
    cell(3, 2),
    cell(4, 2),
    cell(3, 3),
    cell(4, 3),
    cell(6, 2),
    cell(6, 3),
  ],
  wallTrim: [cell(1, 2), cell(3, 2), cell(4, 2), cell(6, 2)],
  pillar: [cell(6, 2), cell(6, 3)],
  backgroundBrick: [cell(18, 6), cell(19, 6)],
  ledge: [cell(0, 10), cell(4, 10), cell(8, 10)],
};

/** Props that come from packed art. Props without an entry are always procedural. */
export const PROP_ART: Partial<
  Record<PropKey, { readonly texture: ArtKey; readonly rect?: SourceRect }>
> = {
  balustrade: { texture: 'church.tiles', rect: { x: 192, y: 92, w: 128, h: 52 } },
  column: { texture: 'church.column' },
};

/** Layout of one scrolling background layer (see ASSET_NOTES.md "Background layers"). */
export type BackgroundArtData = {
  readonly texture: ArtKey;
  /** Optional source crop, so a taller sheet can contribute just one band. */
  readonly rect?: SourceRect;
  /** Camera scroll multiplier: 0 pins the layer to the screen, 1 scrolls with the world. */
  readonly factor: number;
  readonly scale: number;
  readonly tint: PaletteName;
  /**
   * Which horizontal edge of the layer is pinned to `anchorY` (a world y). Sky bands pin
   * their top to 0; skyline bands pin their bottom to the floor line, so the town's base
   * always disappears behind the terrace instead of floating in mid-air.
   */
  readonly anchor: 'top' | 'bottom';
  readonly anchorY: number;
};

/** The town pack's parallax sheets are 384x288 and designed for horizontal repetition. */
const TOWN_LAYER_WIDTH = 384;

/** Clouds plus mountain tops; the skyline layer below covers everything underneath. */
const SKY_CROP: SourceRect = { x: 0, y: 0, w: TOWN_LAYER_WIDTH, h: 230 };

/**
 * The skyline sheet is transparent above its rooftops, so it needs no crop — only a low
 * anchor. Its base sits well under the terrace walkway (world y 320) so the buildings'
 * ground shadow stays hidden and the rooftops settle below the sky band.
 */
const SKYLINE_BASE_Y = 380;

export const BACKGROUND_ART: Partial<Record<BackgroundKey, BackgroundArtData>> = {
  far: {
    texture: 'bg.far',
    rect: SKY_CROP,
    factor: PARALLAX.far,
    scale: 1,
    tint: 'duskFar',
    anchor: 'top',
    anchorY: 0,
  },
  mid: {
    texture: 'bg.mid',
    factor: PARALLAX.mid,
    scale: 1,
    tint: 'duskMid',
    anchor: 'bottom',
    anchorY: SKYLINE_BASE_Y,
  },
};

const KNIGHT_SHEET = { frameWidth: 120, frameHeight: 80, columns: 10 } as const;

/**
 * Feet-center pivot measured from the Fantasy Knight sheets: the idle silhouette spans
 * x=45..63 and its feet touch y=79, so (54, 80) keeps the knight planted while the
 * frame flips around his center.
 */
const KNIGHT_ORIGIN = { x: 54, y: 80 } as const;

function knightClip(textureKey: ArtKey, frameCount: number, ticksPerFrame: number): AnimationClip {
  return {
    textureKey,
    loop: true,
    frames: Array.from({ length: frameCount }, (_, frame) => ({
      frame,
      ticks: ticksPerFrame,
    })),
  };
}

/** One sheet, one row, explicit per-frame durations (used for one-shots). */
function knightStrip(textureKey: ArtKey, ticks: readonly number[], loop: boolean): AnimationClip {
  return {
    textureKey,
    loop,
    frames: ticks.map((duration, frame) => ({ frame, ticks: duration })),
  };
}

/**
 * Sheets the packed hero needs. If any of these fails to load, the whole hero falls back
 * to the procedural knight — a half-loaded knight would be missing clips at runtime.
 */
export const KNIGHT_REQUIRED: readonly ArtKey[] = [
  'hero.idle',
  'hero.run',
  'hero.turn',
  'hero.jump',
  'hero.fall',
  'hero.attack1',
  'hero.attack2',
  'hero.dash',
];

/**
 * Packed Fantasy Knight art. Frame counts are measured from the sheets (M2):
 * turn 3, jump 3, fall 3, attack 4, attack2 6, dash 2. One-shot clips hold their last
 * frame; the controller decides when to switch. Attack durations must match
 * `PLAYER.attack.clipTicks` — a unit test cross-checks both sides.
 */
export const HERO_ART: CharacterArt = {
  textureKey: 'hero.idle',
  sheet: KNIGHT_SHEET,
  origin: KNIGHT_ORIGIN,
  animations: {
    idle: knightClip('hero.idle', 10, 8),
    run: knightClip('hero.run', 10, 5),
    turn: knightStrip('hero.turn', [3, 3, 3], false),
    jump: knightStrip('hero.jump', [3, 3, 3], false),
    fall: knightStrip('hero.fall', [6, 6, 6], true),
    attack1: knightStrip('hero.attack1', [3, 3, 4, 6], false),
    attack2: knightStrip('hero.attack2', [2, 3, 3, 3, 4, 5], false),
    dash: knightStrip('hero.dash', [3, 5], false),
  },
};
