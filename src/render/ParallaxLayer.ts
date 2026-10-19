import { Container, Sprite } from 'pixi.js';
import { VIEW } from '../config/world';
import type { Vec2 } from '../core/Types';
import type { BackgroundArt } from './ArtProvider';

/**
 * One scrolling background layer, drawn as a row of plain sprites instead of a
 * TilingSprite. Tiling shaders are disproportionately expensive on software WebGL
 * (headless CI, weak laptops); plain sprites are the cheapest full-screen textured
 * quads there are.
 *
 * The strip only needs to cover the viewport plus the layer's maximum travel across
 * the room, so it is a short row of sprites rather than an infinite tiling shader.
 * `maxShiftX` is the farthest the pattern can slide, in screen pixels:
 * (roomWidth - viewWidth) * factor.
 */
export class ParallaxLayer {
  readonly view = new Container();
  private readonly sprites: Sprite[] = [];
  private readonly step: number;
  private readonly height: number;

  constructor(
    private readonly art: BackgroundArt,
    maxShiftX: number,
  ) {
    this.step = art.texture.width * art.scale;
    this.height = art.texture.height * art.scale;
    const count = Math.max(1, Math.ceil((VIEW.width + maxShiftX) / this.step));
    for (let i = 0; i < count; i += 1) {
      const sprite = new Sprite(art.texture);
      sprite.scale.set(art.scale);
      sprite.tint = art.tint;
      sprite.position.set(i * this.step, 0);
      this.sprites.push(sprite);
      this.view.addChild(sprite);
    }
  }

  /** Aligns the strip with the camera. `camera` is the rounded view top-left. */
  follow(camera: Vec2): void {
    const shiftX = Math.round(camera.x * this.art.factor);
    const shiftY = Math.round(camera.y * this.art.factor);
    const pinned = this.art.anchorY - camera.y - shiftY;
    const top = this.art.anchor === 'top' ? pinned : pinned - this.height;
    for (let i = 0; i < this.sprites.length; i += 1) {
      const sprite = this.sprites[i];
      if (!sprite) continue;
      sprite.position.set(i * this.step - shiftX, top);
    }
  }
}
