import { Container, Graphics } from 'pixi.js';
import { PALETTE } from '../config/palette';
import type { Vec2 } from '../core/Types';
import type { Boss } from '../enemies/Boss';
import type { ArtProvider } from './ArtProvider';
import { CharacterView } from './CharacterView';

/**
 * Boss view: the procedural character sheet, a body-sized guard aura while warded, and
 * an archetype-aware telegraph. The telegraphs are intentionally larger and louder than
 * regular enemy tells: a boss pattern is a commitment, so the player must be able to read
 * the lane (charge), the ground (slam), the ring (volley) or the falling lane (rain).
 */
export class BossView {
  readonly view = new Container();
  private readonly character: CharacterView;
  private readonly guard = new Graphics();
  private readonly telegraph = new Graphics();

  constructor(provider: ArtProvider, boss: Boss) {
    const art = provider.bosses[boss.kind as keyof typeof provider.bosses];
    this.character = new CharacterView(provider, art, {
      shadow: { rx: 20, ry: 4 },
      shadowAlpha: { grounded: 0.45, airborne: 0.2 },
    });
    this.view.addChild(this.guard, this.character.view, this.telegraph);
  }

  sync(boss: Boss, target: Vec2 | null = null): void {
    const feet = boss.feet;
    const fade = boss.alive
      ? 1
      : Math.max(0, 1 - boss.deathElapsed / Math.max(1, boss.definition.deathFadeTicks));
    this.view.visible = (boss.alive || fade > 0) && !boss.hidden;
    this.view.alpha = fade;
    this.view.zIndex = feet.y;

    this.character.setPose({
      x: feet.x,
      y: feet.y,
      facing: boss.facing,
      animation: boss.animation,
      restart: boss.restarted,
      grounded: boss.grounded,
      flash: boss.flash,
    });
    this.character.tick();
    this.drawGuard(boss);
    this.drawTelegraph(boss, target);
  }

  destroy(): void {
    this.view.removeFromParent();
    this.view.destroy({ children: true });
  }

  private drawGuard(boss: Boss): void {
    const g = this.guard;
    g.clear();
    if (!boss.alive || !boss.warded || boss.hidden) {
      g.visible = false;
      return;
    }
    const feet = boss.feet;
    const pulse = boss.wardFlash ? 0.9 : 0.42;
    g.circle(feet.x, feet.y - 30, 32).stroke({
      width: boss.wardFlash ? 3 : 2,
      color: PALETTE.brass,
      alpha: pulse,
    });
    g.circle(feet.x, feet.y - 30, 26).stroke({
      width: 1,
      color: PALETTE.bone,
      alpha: pulse * 0.5,
    });
    // Three rivets read as the bell's rim rather than a generic magic bubble.
    for (const angle of [-0.9, 0, 0.9]) {
      const x = feet.x + Math.sin(angle) * 30;
      const y = feet.y - 30 + Math.cos(angle) * 30;
      g.circle(x, y, 2).fill({ color: PALETTE.ember, alpha: pulse });
    }
    g.visible = true;
  }

  private drawTelegraph(boss: Boss, target: Vec2 | null): void {
    const g = this.telegraph;
    g.clear();
    const pattern = boss.pattern;
    const t = boss.telegraph;
    if (!boss.alive || boss.hidden || !pattern || t <= 0) {
      g.visible = false;
      return;
    }
    const feet = boss.feet;
    const dir = boss.facing;
    const alpha = 0.15 + t * 0.55;

    if (pattern.kind === 'charge' || pattern.kind === 'dash') {
      // Show the punishing lane, not only the 34 px hitbox at the boss's feet.
      const lane = 260;
      const top = feet.y - 48;
      const height = 44;
      const endX = feet.x + dir * lane;
      g.rect(Math.min(feet.x, endX), top, lane, height).fill({
        color: PALETTE.ember,
        alpha: alpha * 0.12,
      });
      g.moveTo(feet.x, top)
        .lineTo(endX, top)
        .lineTo(endX, top + height)
        .lineTo(feet.x, top + height)
        .lineTo(feet.x, top)
        .stroke({ width: 2, color: PALETTE.ember, alpha });
      for (let distance = 48; distance <= lane; distance += 52) {
        const x = feet.x + dir * distance;
        g.moveTo(x - dir * 7, top + 10)
          .lineTo(x, top + height / 2)
          .lineTo(x - dir * 7, top + height - 10)
          .stroke({ width: 2, color: PALETTE.bone, alpha: alpha * 0.8 });
      }
      g.visible = true;
      return;
    }

    if (pattern.kind === 'slam' || pattern.kind === 'dive') {
      const radius = 30 + t * 50;
      g.circle(feet.x, feet.y - 6, radius).stroke({
        width: 2 + t * 2,
        color: PALETTE.ember,
        alpha,
      });
      g.circle(feet.x, feet.y - 6, 8).fill({ color: PALETTE.ember, alpha });
      if (target) {
        g.circle(target.x, target.y - 8, 10 + (1 - t) * 14).stroke({
          width: 2,
          color: PALETTE.blood,
          alpha: alpha * 0.8,
        });
      }
      g.visible = true;
      return;
    }

    if (pattern.kind === 'fan' || pattern.kind === 'ring') {
      const radius = 26 + t * 18;
      g.circle(feet.x, feet.y - 36, radius).stroke({
        width: 2,
        color: PALETTE.brass,
        alpha,
      });
      const spokes = pattern.kind === 'ring' ? (pattern.shots ?? 8) : 3;
      for (let i = 0; i < spokes; i += 1) {
        const angle = -Math.PI / 2 + (i / spokes) * Math.PI * 2;
        const x = feet.x + Math.cos(angle) * radius;
        const y = feet.y - 36 + Math.sin(angle) * radius;
        g.circle(x, y, 2).fill({ color: PALETTE.ember, alpha });
      }
      g.visible = true;
      return;
    }

    if (pattern.kind === 'rain') {
      // Lane markers follow the player, matching the arena-clamped spawn points.
      const centre = target?.x ?? feet.x;
      const top = 24;
      for (let i = -1; i <= 1; i += 1) {
        const x = centre + i * 42;
        g.moveTo(x, top)
          .lineTo(x, feet.y - 14)
          .stroke({ width: 1 + t, color: PALETTE.ember, alpha: alpha * 0.8 });
        g.poly([x - 4, feet.y - 22, x + 4, feet.y - 22, x, feet.y - 12]).fill({
          color: PALETTE.ember,
          alpha,
        });
      }
      g.visible = true;
      return;
    }

    if (pattern.box) {
      const box = pattern.box;
      const startX = feet.x + dir * box.forward;
      const fullX = feet.x + dir * (box.forward + box.width);
      const top = feet.y - box.top;
      const bottom = top + box.height;
      g.rect(Math.min(startX, fullX), top, Math.abs(fullX - startX), bottom - top).fill({
        color: PALETTE.ember,
        alpha: alpha * 0.18,
      });
      g.moveTo(startX, top)
        .lineTo(fullX, top)
        .lineTo(fullX, bottom)
        .lineTo(startX, bottom)
        .lineTo(startX, top)
        .stroke({ width: 2, color: PALETTE.ember, alpha });
      g.moveTo(startX, (top + bottom) / 2)
        .lineTo(startX + (fullX - startX) * t, (top + bottom) / 2)
        .stroke({ width: 4, color: PALETTE.bone, alpha });
      g.visible = true;
      return;
    }

    // Teleport has a hitbox but the readable warning is its vanishing origin.
    g.circle(feet.x, feet.y - 28, 24 + t * 20).stroke({
      width: 2,
      color: PALETTE.echo,
      alpha,
    });
    g.visible = true;
  }
}
