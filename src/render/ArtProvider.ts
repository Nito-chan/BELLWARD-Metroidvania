import { Assets, Rectangle, Texture } from 'pixi.js';
import { PALETTE } from '../config/palette';
import { BellwardError, formatError } from '../core/Errors';
import {
  ART_URLS,
  BACKGROUND_ART,
  HERO_ART,
  KNIGHT_REQUIRED,
  PROP_ART,
  TILE_ART,
  type ArtKey,
  type SourceRect,
} from '../data/art';
import type { BackgroundKey, PropKey } from '../world/Room';
import type { TileRole } from '../world/tiles';
import type { CharacterArt } from './Animation';
import { ProceduralArt } from './ProceduralArt';

export type ArtMode = 'packed' | 'procedural';

export type BackgroundArt = {
  readonly texture: Texture;
  readonly factor: number;
  readonly scale: number;
  readonly tint: number;
  /** Which horizontal edge sits at `anchorY`. */
  readonly anchor: 'top' | 'bottom';
  /** World y of the pinned edge. */
  readonly anchorY: number;
};

/**
 * Resolves logical art keys to textures. Loads the packed packs once at boot and
 * silently upgrades every missing texture to its procedural equivalent — the room
 * renders identically from the caller's point of view, and failures stay visible in
 * the debug overlay instead of turning into invisible holes.
 */
export class ArtProvider {
  private readonly derived = new Map<string, Texture>();
  readonly failures: readonly string[];
  readonly mode: ArtMode;
  readonly hero: CharacterArt;

  private constructor(
    private readonly procedural: ProceduralArt,
    private readonly packed: ReadonlyMap<ArtKey, Texture>,
    failures: readonly string[],
  ) {
    this.failures = failures;
    this.mode = packed.has('church.tiles') ? 'packed' : 'procedural';
    // The hero falls back as a whole: a knight missing clips would break at runtime.
    const knightReady = KNIGHT_REQUIRED.every((key) => packed.has(key));
    this.hero = knightReady ? HERO_ART : procedural.hero;
  }

  static async load(): Promise<ArtProvider> {
    const procedural = new ProceduralArt();
    const packed = new Map<ArtKey, Texture>();
    const failures: string[] = [];
    const base = import.meta.env.BASE_URL;
    const keys = Object.keys(ART_URLS) as ArtKey[];

    await Promise.all(
      keys.map(async (key) => {
        try {
          const texture = await Assets.load<Texture>({
            alias: key,
            src: `${base}${ART_URLS[key]}`,
          });
          texture.source.scaleMode = 'nearest';
          packed.set(key, texture);
        } catch (error) {
          failures.push(`${key}: ${formatError(error)}`);
        }
      }),
    );

    if (failures.length > 0) {
      console.warn(`[BELLWARD] art fallbacks in use: ${failures.join('; ')}`);
    }
    return new ArtProvider(procedural, packed, failures);
  }

  /** Keys whose packed textures loaded successfully (for debug state). */
  loadedKeys(): string[] {
    return [...this.packed.keys()];
  }

  /** Resolves a packed or procedural texture by logical key. */
  texture(key: string): Texture {
    const packed = this.packed.get(key as ArtKey);
    if (packed) return packed;
    const generated = this.procedural.texture(key);
    if (generated) return generated;
    throw new BellwardError(`art texture "${key}" is unavailable`);
  }

  /**
   * Tile texture for one cell. Variant choice is a pure function of the cell
   * coordinate, so the same room always looks identical between runs.
   */
  tile(role: TileRole, tx: number, ty: number): Texture {
    const variants = TILE_ART[role];
    const atlas = this.packed.get('church.tiles');
    if (atlas && variants && variants.length > 0) {
      const index = variantIndex(tx, ty, variants.length);
      const rect = variants[index];
      if (rect) {
        return this.subTexture(atlas, `tile:${role}:${index}`, rect);
      }
    }
    return this.procedural.tile(role);
  }

  /** Prop texture; every prop falls back independently, so one bad pack cannot hide a scene. */
  prop(key: PropKey): Texture {
    const art = PROP_ART[key];
    if (art) {
      const base = this.packed.get(art.texture);
      if (base) {
        if (!art.rect) return base;
        return this.subTexture(base, `prop:${key}`, art.rect);
      }
    }
    return this.procedural.prop(key);
  }

  background(key: BackgroundKey): BackgroundArt | null {
    const art = BACKGROUND_ART[key];
    if (!art) return null;
    const base = this.packed.get(art.texture);
    const texture = base
      ? art.rect
        ? this.subTexture(base, `bg:${key}`, art.rect)
        : base
      : this.procedural.background(key);
    return {
      texture,
      factor: art.factor,
      // Procedural stand-ins are already authored at viewport scale.
      scale: base ? art.scale : 1,
      tint: PALETTE[art.tint],
      anchor: art.anchor,
      anchorY: art.anchorY,
    };
  }

  private subTexture(base: Texture, cacheKey: string, rect: SourceRect): Texture {
    const cached = this.derived.get(cacheKey);
    if (cached) return cached;
    const texture = new Texture({
      source: base.source,
      frame: new Rectangle(rect.x, rect.y, rect.w, rect.h),
    });
    this.derived.set(cacheKey, texture);
    return texture;
  }
}

/**
 * Stable per-cell variant picker. A small integer hash avoids visible diagonal bands
 * that a plain `(tx + ty) % n` pattern would produce.
 */
function variantIndex(tx: number, ty: number, count: number): number {
  let hash = Math.imul(tx + 0x9e37, 0x85ebca6b) ^ Math.imul(ty + 0x1f1f, 0xc2b2ae35);
  hash ^= hash >>> 13;
  return (hash >>> 0) % count;
}
