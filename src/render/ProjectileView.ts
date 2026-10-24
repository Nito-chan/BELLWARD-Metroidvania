import { Container, Graphics, Sprite, Texture } from 'pixi.js';
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
  private readonly bells: Graphics[] = [];
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
      const bell = new Graphics();
      bell.visible = false;
      this.bells.push(bell);
      this.view.addChild(sprite, bell);
    }
  }

  /** Positions every live slot and advances the shared loop from the simulation clock. */
  sync(pool: ProjectilePool, tickCount: number): void {
    const frameIndex = Math.floor(tickCount / this.frameTicks) % Math.max(1, this.frames.length);
    const texture = this.frames[frameIndex] ?? this.frames[0];
    for (const slot of pool.all) {
      const sprite = this.sprites[slot.index];
      const bell = this.bells[slot.index];
      if (!sprite || !bell) continue;
      sprite.visible = false;
      bell.clear();
      bell.visible = false;
      if (!slot.active) continue;

      if (slot.style === 'bell') {
        // Toll waves are a brass note and an expanding ring, not a recoloured fireball.
        const age = Math.max(0, slot.maxLifeTicks - slot.ticksLeft);
        const t = Math.min(1, age / Math.max(1, slot.maxLifeTicks));
        const direction = slot.vx < 0 ? -1 : 1;
        bell.circle(slot.x, slot.y, 5 + t * 5).stroke({
          width: 2,
          color: PALETTE.brass,
          alpha: 0.9 - t * 0.25,
        });
        bell.circle(slot.x, slot.y, 2 + t * 2).stroke({
          width: 1,
          color: PALETTE.bone,
          alpha: 0.85,
        });
        for (let i = 0; i < 3; i += 1) {
          bell
            .circle(slot.x - direction * (10 + i * 6), slot.y + Math.sin(age * 0.2 + i) * 2, 1.4)
            .fill({
              color: PALETTE.echo,
              alpha: 0.5 - i * 0.12,
            });
        }
        bell
          .poly([slot.x, slot.y - 4, slot.x + 3, slot.y, slot.x, slot.y + 4, slot.x - 3, slot.y])
          .fill({ color: PALETTE.bone, alpha: 0.9 });
        bell.visible = true;
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
