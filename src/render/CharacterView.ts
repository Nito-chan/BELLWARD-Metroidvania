import { Container, Graphics, Sprite, Texture } from 'pixi.js';
import { PALETTE } from '../config/palette';
import { BellwardError } from '../core/Errors';
import type { ArtProvider } from './ArtProvider';
import type { CharacterArt } from './Animation';
import { sliceFrame } from './frames';
import { SpriteAnimator } from './SpriteAnimator';

export type Facing = -1 | 1;

/** One tick's worth of what a character view needs to draw. */
export type CharacterPose = {
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
  /** Draws an additive white copy over the sprite for a hit flash. */
  flash?: boolean;
};

export type CharacterViewOptions = {
  /** Contact-shadow radii, in pixels. Defaults suit the knight. */
  shadow?: { rx: number; ry: number };
  /** Shadow opacity when grounded / airborne. */
  shadowAlpha?: { grounded: number; airborne: number };
};

/**
 * World-space view for any character: a single sprite whose texture is swapped from
 * pre-sliced frame textures, plus a contact shadow. The animator is advanced by the
 * scene's fixed-step update, never by render time, and the pivot is the feet-center so
 * flipping around it is stable. Used by the hero and every enemy kind.
 */
export class CharacterView {
  readonly view = new Container();
  private readonly art: CharacterArt;
  private readonly textures = new Map<string, Texture>();
  private readonly animator: SpriteAnimator;
  private readonly sprite: Sprite;
  private readonly flashSprite: Sprite;
  private readonly shadow: Graphics;
  private readonly shadowRx: number;
  private readonly shadowRy: number;
  private readonly shadowAlpha: { grounded: number; airborne: number };
  private facing: Facing = 1;

  constructor(provider: ArtProvider, art: CharacterArt, options: CharacterViewOptions = {}) {
    this.art = art;
    this.animator = new SpriteAnimator(this.art.animations, 'idle');
    this.shadowRx = options.shadow?.rx ?? 9;
    this.shadowRy = options.shadow?.ry ?? 3;
    this.shadowAlpha = options.shadowAlpha ?? { grounded: 0.35, airborne: 0.18 };

    for (const clip of Object.values(this.art.animations)) {
      const sheetKey = clip.textureKey ?? this.art.textureKey;
      const sheet = provider.texture(sheetKey);
      for (const frame of clip.frames) {
        const key = `${sheetKey}:${frame.frame}`;
        if (!this.textures.has(key)) {
          this.textures.set(key, sliceFrame(sheet, this.art.sheet, frame.frame));
        }
      }
    }

    this.sprite = new Sprite(this.currentTexture());
    this.sprite.anchor.set(
      this.art.origin.x / this.art.sheet.frameWidth,
      this.art.origin.y / this.art.sheet.frameHeight,
    );

    // Additive duplicate: a true white hit flash without filters or extra render passes.
    this.flashSprite = new Sprite(this.sprite.texture);
    this.flashSprite.anchor.copyFrom(this.sprite.anchor);
    this.flashSprite.blendMode = 'add';
    this.flashSprite.alpha = 0;
    this.flashSprite.visible = false;

    this.shadow = new Graphics().ellipse(0, 0, this.shadowRx, this.shadowRy).fill(PALETTE.void);
    this.shadow.alpha = this.shadowAlpha.grounded;
    this.view.addChild(this.shadow, this.sprite, this.flashSprite);
  }

  get animation(): string {
    return this.animator.animation;
  }

  /** Places the feet-center and switches clips; called once per fixed tick. */
  setPose(pose: CharacterPose): void {
    this.sprite.position.set(pose.x, pose.y);
    this.flashSprite.position.set(pose.x, pose.y);
    this.shadow.position.set(pose.x, pose.y);
    if (pose.facing !== this.facing) {
      this.facing = pose.facing;
      this.sprite.scale.x = pose.facing;
      this.flashSprite.scale.x = pose.facing;
    }
    this.animator.play(pose.animation, pose.restart === true);

    const grounded = pose.grounded !== false;
    this.shadow.alpha = grounded ? this.shadowAlpha.grounded : this.shadowAlpha.airborne;
    this.shadow.scale.set(grounded ? 1 : 0.7);
    const flashing = pose.flash === true;
    this.flashSprite.visible = flashing;
    this.flashSprite.alpha = flashing ? 0.75 : 0;
  }

  /** Advances the frame clock by one fixed tick. */
  tick(): void {
    this.animator.tick();
    const texture = this.currentTexture();
    this.sprite.texture = texture;
    this.flashSprite.texture = texture;
  }

  private currentTexture(): Texture {
    const clip = this.art.animations[this.animator.animation];
    const sheetKey = clip?.textureKey ?? this.art.textureKey;
    const texture = this.textures.get(`${sheetKey}:${this.animator.frame}`);
    if (!texture) {
      throw new BellwardError(
        `frame ${this.animator.frame} of clip "${this.animator.animation}" is missing`,
      );
    }
    return texture;
  }
}
