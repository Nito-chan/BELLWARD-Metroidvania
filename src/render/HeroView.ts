import { Container, Graphics, Rectangle, Sprite, Texture } from 'pixi.js';
import { PALETTE } from '../config/palette';
import { BellwardError } from '../core/Errors';
import type { ArtProvider } from './ArtProvider';
import type { CharacterArt } from './Animation';
import { SpriteAnimator } from './SpriteAnimator';

export type Facing = -1 | 1;

/** One tick's worth of what the hero view needs to draw. */
export type HeroPose = {
  /** Feet-center, in world pixels. */
  x: number;
  y: number;
  facing: Facing;
  /** Clip name from the character's animation set. */
  animation: string;
  /** Restarts the clip even if it is already active (attack re-triggers). */
  restart?: boolean;
  /** When false, the contact shadow shrinks and fades to read as airborne. */
  grounded?: boolean;
};

/**
 * World-space hero view: a single sprite whose texture is swapped from pre-sliced
 * frame textures. The animator is advanced by the scene's fixed-step update, never by
 * render time, and the pivot is the feet-center so flipping around it is stable.
 */
export class HeroView {
  readonly view = new Container();
  private readonly art: CharacterArt;
  private readonly textures = new Map<string, Texture>();
  private readonly animator: SpriteAnimator;
  private readonly sprite: Sprite;
  private readonly shadow: Graphics;
  private facing: Facing = 1;

  constructor(provider: ArtProvider) {
    this.art = provider.hero;
    this.animator = new SpriteAnimator(this.art.animations, 'idle');

    for (const clip of Object.values(this.art.animations)) {
      const sheetKey = clip.textureKey ?? this.art.textureKey;
      const sheet = provider.texture(sheetKey);
      for (const frame of clip.frames) {
        const key = `${sheetKey}:${frame.frame}`;
        if (!this.textures.has(key)) {
          this.textures.set(key, sliceFrame(sheet, this.art, frame.frame));
        }
      }
    }

    this.sprite = new Sprite(this.currentTexture());
    this.sprite.anchor.set(
      this.art.origin.x / this.art.sheet.frameWidth,
      this.art.origin.y / this.art.sheet.frameHeight,
    );
    // A soft contact shadow keeps the hero grounded against busy stonework, and doubles
    // as the airborne cue (it shrinks as the hero leaves the floor).
    this.shadow = new Graphics().ellipse(0, 0, 9, 3).fill(PALETTE.void);
    this.shadow.alpha = 0.35;
    this.view.addChild(this.shadow, this.sprite);
  }

  get animation(): string {
    return this.animator.animation;
  }

  /** Places the feet-center and switches clips; called once per fixed tick. */
  setPose(pose: HeroPose): void {
    this.sprite.position.set(pose.x, pose.y);
    this.shadow.position.set(pose.x, pose.y);
    if (pose.facing !== this.facing) {
      this.facing = pose.facing;
      this.sprite.scale.x = pose.facing;
    }
    this.animator.play(pose.animation, pose.restart === true);

    const grounded = pose.grounded !== false;
    this.shadow.alpha = grounded ? 0.35 : 0.18;
    this.shadow.scale.set(grounded ? 1 : 0.7);
  }

  /** Advances the frame clock by one fixed tick. */
  tick(): void {
    this.animator.tick();
    this.sprite.texture = this.currentTexture();
  }

  private currentTexture(): Texture {
    const clip = this.art.animations[this.animator.animation];
    const sheetKey = clip?.textureKey ?? this.art.textureKey;
    const texture = this.textures.get(`${sheetKey}:${this.animator.frame}`);
    if (!texture) {
      throw new BellwardError(
        `hero frame ${this.animator.frame} of clip "${this.animator.animation}" is missing`,
      );
    }
    return texture;
  }
}

function sliceFrame(sheet: Texture, art: CharacterArt, index: number): Texture {
  const { frameWidth, frameHeight, columns } = art.sheet;
  const column = index % columns;
  const row = Math.floor(index / columns);
  return new Texture({
    source: sheet.source,
    frame: new Rectangle(column * frameWidth, row * frameHeight, frameWidth, frameHeight),
  });
}
