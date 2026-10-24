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
  private readonly chains = new Graphics();
  private readonly resonance = new Graphics();
  private readonly guard = new Graphics();
  private readonly telegraph = new Graphics();
  private readonly shockwave = new Graphics();
  private readonly ritual = new Graphics();

  constructor(provider: ArtProvider, boss: Boss) {
    const art = provider.bosses[boss.kind as keyof typeof provider.bosses];
    this.character = new CharacterView(provider, art, {
      shadow: { rx: 20, ry: 4 },
      shadowAlpha: { grounded: 0.45, airborne: 0.2 },
    });
    this.view.addChild(
      this.chains,
      this.resonance,
      this.guard,
      this.character.view,
      this.telegraph,
      this.shockwave,
      this.ritual,
    );
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
    this.drawChains(boss);
    this.drawResonance(boss);
    this.drawTelegraph(boss, target);
    this.drawShockwave(boss);
    this.drawRitual(boss);
  }

  destroy(): void {
    this.view.removeFromParent();
    this.view.destroy({ children: true });
  }

  /**
   * The three chains are world props, not HUD pips. A closed chain still hangs in the
   * arena; a broken chain drops its lower links; an open chain grows a segmented Censer
   * window so the answer is readable without looking away from the fight.
   */
  private drawChains(boss: Boss): void {
    const g = this.chains;
    g.clear();
    if (
      !boss.lastKeeperMode ||
      !boss.alive ||
      boss.hidden ||
      boss.phaseIndex < 1 ||
      boss.chainTargets.length === 0
    ) {
      g.visible = false;
      return;
    }

    for (let i = 0; i < boss.chainTargets.length; i += 1) {
      const target = boss.chainTargets[i]!;
      const broken = i < boss.chainCount;
      const active = i === boss.chainCount && boss.phaseIndex === 1;
      const open = active && boss.chainOpen;
      const colour = broken ? PALETTE.stoneLit : active ? PALETTE.brass : PALETTE.stone;
      const alpha = broken ? 0.28 : active ? 1 : 0.58;
      const top = target.y - 62;

      if (!broken) {
        for (let y = top; y < target.y - 15; y += 8) {
          const sway = i % 2 === 0 ? 1.6 : -1.6;
          g.ellipse(target.x + sway, y, 3.2, 4.4).stroke({
            width: 1,
            color: colour,
            alpha,
          });
        }
      } else {
        // A broken chain keeps one short, dead end above the target.
        for (let y = top; y < target.y - 42; y += 8) {
          g.ellipse(target.x, y, 3.2, 4.4).stroke({
            width: 1,
            color: colour,
            alpha,
          });
        }
        g.moveTo(target.x - 4, target.y - 32)
          .lineTo(target.x + 5, target.y - 24)
          .stroke({ width: 2, color: colour, alpha });
        g.moveTo(target.x + 4, target.y - 32)
          .lineTo(target.x - 5, target.y - 24)
          .stroke({ width: 2, color: colour, alpha });
      }

      g.circle(target.x, target.y, 14).stroke({
        width: active ? 2 : 1,
        color: colour,
        alpha,
      });
      if (active) {
        g.circle(target.x, target.y, 18 + (open ? 2 : 0)).stroke({
          width: open ? 2 : 1,
          color: open ? PALETTE.ember : PALETTE.brassDark,
          alpha: open ? 0.95 : 0.5,
        });
      }

      if (open) {
        const ratio = Math.max(
          0,
          Math.min(1, boss.chainWindowTicks / Math.max(1, boss.chainWindowTotal)),
        );
        const segments = 8;
        for (let s = 0; s < segments; s += 1) {
          const angle = -Math.PI / 2 + (s / segments) * Math.PI * 2;
          const filled = s < Math.ceil(ratio * segments);
          g.circle(
            target.x + Math.cos(angle) * 23,
            target.y + Math.sin(angle) * 23,
            filled ? 2.4 : 1.5,
          ).fill({
            color: filled ? PALETTE.ember : PALETTE.stoneLit,
            alpha: filled ? 0.95 : 0.45,
          });
        }
      }
    }
    g.visible = true;
  }

  /** Toll marks read as three brass notches orbiting the enemy's chest. */
  private drawResonance(boss: Boss): void {
    const g = this.resonance;
    g.clear();
    if (!boss.alive || boss.hidden || boss.resonance <= 0) {
      g.visible = false;
      return;
    }
    const feet = boss.feet;
    const pulse = 0.55 + 0.25 * Math.sin(boss.resonance * 0.25);
    g.circle(feet.x, feet.y - 30, 27).stroke({
      width: 1,
      color: PALETTE.echo,
      alpha: pulse,
    });
    for (let i = 0; i < 3; i += 1) {
      const angle = -Math.PI / 2 + (i / 3) * Math.PI * 2;
      const x = feet.x + Math.cos(angle) * 32;
      const y = feet.y - 30 + Math.sin(angle) * 32;
      g.poly([x, y - 4, x + 3, y, x, y + 4, x - 3, y]).fill({
        color: PALETTE.echo,
        alpha: 0.9,
      });
    }
    g.visible = true;
  }

  /**
   * The final bell's answer travel: kneel, ring, window, recover. The outer circle is
   * always visible while the ritual is live; the travelling ring and pips make the
   * timing legible as a musical call and response rather than an invisible timer.
   */
  private drawRitual(boss: Boss): void {
    const g = this.ritual;
    g.clear();
    const bell = boss.greatBell;
    if (
      !boss.lastKeeperMode ||
      !boss.alive ||
      boss.hidden ||
      !boss.ritualActive ||
      boss.ritualSolved ||
      !bell
    ) {
      g.visible = false;
      return;
    }

    const stage = boss.ritualStage;
    const stageTicks = boss.ritualStageTicks;
    const ringProgress =
      stage === 'ring'
        ? 1 - stageTicks / Math.max(1, boss.ritualRingTotal)
        : stage === 'window'
          ? 1
          : 0;
    const windowRatio =
      stage === 'window'
        ? Math.max(0, Math.min(1, boss.answerWindowTicks / Math.max(1, boss.answerWindowTotal)))
        : 0;

    g.circle(bell.x, bell.y, 40).stroke({
      width: 1,
      color: PALETTE.brassDark,
      alpha: stage === 'recover' ? 0.18 : 0.4,
    });
    g.circle(bell.x, bell.y, 7).fill({
      color: stage === 'window' ? PALETTE.ember : PALETTE.brass,
      alpha: 0.85,
    });

    if (stage === 'kneel') {
      const breath = 0.5 + 0.5 * Math.sin(stageTicks * 0.18);
      g.circle(bell.x, bell.y, 12 + breath * 7).stroke({
        width: 1,
        color: PALETTE.brass,
        alpha: 0.25 + breath * 0.2,
      });
    } else if (stage === 'ring') {
      g.circle(bell.x, bell.y, 12 + ringProgress * 28).stroke({
        width: 3,
        color: PALETTE.ember,
        alpha: 0.35 + ringProgress * 0.55,
      });
      g.circle(bell.x, bell.y, 12 + ringProgress * 20).stroke({
        width: 1,
        color: PALETTE.bone,
        alpha: 0.2 + ringProgress * 0.35,
      });
    } else if (stage === 'window') {
      g.circle(bell.x, bell.y, 40).stroke({
        width: 3,
        color: PALETTE.ember,
        alpha: 0.72,
      });
      const segments = 8;
      for (let s = 0; s < segments; s += 1) {
        const angle = -Math.PI / 2 + (s / segments) * Math.PI * 2;
        const filled = s < Math.ceil(windowRatio * segments);
        g.circle(bell.x + Math.cos(angle) * 48, bell.y + Math.sin(angle) * 48, 2.2).fill({
          color: filled ? PALETTE.ember : PALETTE.stoneLit,
          alpha: filled ? 0.95 : 0.4,
        });
      }
    }

    // Three gold note-pips sit above the bell until answered.
    for (let i = 0; i < 3; i += 1) {
      const x = bell.x - 16 + i * 16;
      const y = bell.y - 28;
      const answered = i < boss.answerCount;
      const current = i === boss.answerCount && stage === 'window';
      g.poly([x, y - 4, x + 3.5, y, x, y + 4, x - 3.5, y]).fill({
        color: answered ? PALETTE.ember : PALETTE.void,
        alpha: answered ? 1 : 0.7,
      });
      g.poly([x, y - 4, x + 3.5, y, x, y + 4, x - 3.5, y]).stroke({
        width: current ? 2 : 1,
        color: current ? PALETTE.ember : PALETTE.brass,
        alpha: current ? 1 : 0.65,
      });
    }
    g.visible = true;
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

    // Red ring: this pattern ignores the guard. Read it as "move", not "parry".
    if (pattern.unblockable) {
      g.circle(feet.x, feet.y - 30, 34 + t * 12).stroke({
        width: 2,
        color: PALETTE.blood,
        alpha,
      });
      g.circle(feet.x, feet.y - 30, 26 + t * 8).stroke({
        width: 1,
        color: PALETTE.blood,
        alpha: alpha * 0.6,
      });
    }

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

  /**
   * The missed-note shockwave is a floor sweep, not a radius: it reads as a red band
   * the player can jump. During the telegraph the band fills; when active it is solid.
   */
  private drawShockwave(boss: Boss): void {
    const g = this.shockwave;
    g.clear();
    const box = boss.shockwaveBox;
    if (!boss.alive || boss.hidden || boss.shockwaveStage === 'none' || !box) {
      g.visible = false;
      return;
    }
    const active = boss.shockwaveStage === 'active';
    const p = boss.shockwaveProgress;
    const fillAlpha = active ? 0.52 : 0.06 + p * 0.16;
    g.rect(box.x, box.y, box.w, box.h).fill({
      color: active ? PALETTE.ember : PALETTE.blood,
      alpha: fillAlpha,
    });
    g.moveTo(box.x, box.y)
      .lineTo(box.x + box.w, box.y)
      .stroke({ width: active ? 4 : 2, color: PALETTE.blood, alpha: 0.55 + p * 0.4 });
    if (!active) {
      // Hatch marks make the telegraph legible without relying on colour alone.
      for (let x = box.x + 24; x < box.x + box.w; x += 48) {
        g.moveTo(x, box.y + 2)
          .lineTo(x, box.y + box.h)
          .stroke({ width: 1, color: PALETTE.blood, alpha: 0.22 + p * 0.35 });
      }
    }
    g.visible = true;
  }
}
