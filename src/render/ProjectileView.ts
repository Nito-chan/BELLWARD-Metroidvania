import { Container, Sprite, Texture } from 'pixi.js';
import { PALETTE } from '../config/palette';
import { VIEW } from '../config/world';
import type { ProjectilePool, ProjectileStyle } from '../combat/ProjectilePool';
import type { ArtProvider } from './ArtProvider';
import { sliceFrame } from './frames';

/** Pattern tints keep the shared fireball silhouette but give each boss a vocabulary. */
const STYLE_TINT: Readonly<Record<ProjectileStyle, number>> = {
  fire: 0xffffff,
  spore: PALETTE.moss,
  wave: PALETTE.echo,
  coin: PALETTE.brass,
  bell: PALETTE.bone,
};

/**
 * One sprite per projectile pool slot. The fireball loop is shared by every shot, so a
 * single frame clock drives all of them; the view never creates objects at runtime.
 */
export class ProjectileView {
  readonly view = new Container();
  private readonly sprites: Sprite[] = [];
  private readonly frames: Texture[] = [];
  private readonly frameTicks: number;

  constructor(provider: ArtProvider, pool: ProjectilePool) {
    const art = provider.effects.fireball;
    const sheet = provider.texture(art.textureKey);
    for (const frame of art.clip.frames) {
      this.frames.push(sliceFrame(sheet, art.sheet, frame.frame));
    }
    this.frameTicks = art.clip.frames[0]?.ticks ?? 4;
    for (let i = 0; i < pool.all.length; i += 1) {
      const sprite = new Sprite(this.frames[0]);
      sprite.anchor.set(art.anchor.x, art.anchor.y);
      sprite.scale.set(art.scale);
      sprite.visible = false;
      this.sprites.push(sprite);
      this.view.addChild(sprite);
    }
  }

  /** Positions every live slot and advances the shared loop from the simulation clock. */
  sync(pool: ProjectilePool, tickCount: number): void {
    const frameIndex = Math.floor(tickCount / this.frameTicks) % Math.max(1, this.frames.length);
    const texture = this.frames[frameIndex] ?? this.frames[0];
    for (const slot of pool.all) {
      const sprite = this.sprites[slot.index];
      if (!sprite) continue;
      if (!slot.active) {
        sprite.visible = false;
        continue;
      }
      sprite.visible = true;
      sprite.position.set(slot.x, slot.y);
      sprite.tint = STYLE_TINT[slot.style];
      if (texture) sprite.texture = texture;
    }
    // Projectiles always draw above actors but below the HUD; the scene owns this layer.
    this.view.zIndex = VIEW.height;
  }
}
