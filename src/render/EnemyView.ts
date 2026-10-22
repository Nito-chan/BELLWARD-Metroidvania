import { Container, Graphics } from 'pixi.js';
import { ENEMIES, type EnemyKind } from '../config/enemies';
import { PALETTE } from '../config/palette';
import type { Enemy } from '../enemies/Enemy';
import type { ArtProvider } from './ArtProvider';
import { CharacterView } from './CharacterView';

/**
 * World-space enemy view: the shared character sprite plus a wind-up telegraph drawn in
 * front of the body. The telegraph is the enemy's attack tell; it fills toward the full
 * reach as the wind-up completes, so the player can read when to dodge without a HUD.
 */
export class EnemyView {
  readonly view = new Container();
  private readonly character: CharacterView;
  private readonly telegraph = new Graphics();
  private readonly postureBar = new Graphics();

  constructor(provider: ArtProvider, kind: EnemyKind) {
    const art = provider.enemies[kind];
    const body = ENEMIES[kind].body;
    this.character = new CharacterView(provider, art, {
      shadow: { rx: Math.max(7, body.w * 0.65), ry: 3 },
    });
    this.view.addChild(this.character.view, this.telegraph, this.postureBar);
  }

  /** Syncs the view to one enemy after its simulation tick. */
  sync(enemy: Enemy): void {
    const feet = enemy.feet;
    this.character.setPose({
      x: feet.x,
      y: feet.y,
      facing: enemy.facing,
      animation: enemy.animation,
      restart: enemy.restarted,
      grounded: enemy.grounded,
      flash: enemy.flash,
    });
    this.character.tick();

    this.view.visible = enemy.alive;
    this.view.zIndex = feet.y;
    this.drawTelegraph(enemy);
    this.drawPosture(enemy);
  }

  destroy(): void {
    this.view.removeFromParent();
    this.view.destroy({ children: true });
  }

  private drawTelegraph(enemy: Enemy): void {
    const melee = enemy.stats.melee;
    const t = enemy.telegraph;
    if (!enemy.alive || !melee || t <= 0) {
      this.telegraph.visible = false;
      return;
    }
    const feet = enemy.feet;
    const dir = enemy.facing;
    const box = melee.box;
    const startX = feet.x + dir * box.forward;
    const fullX = feet.x + dir * (box.forward + box.width);
    const top = feet.y - box.top;
    const bottom = top + box.height;
    const tell = melee.unblockable ? PALETTE.blood : PALETTE.ember;

    this.telegraph.clear();
    // Faint full-reach guide plus a bright leading edge that grows with the wind-up.
    // Red means the guard cannot stop it; move, do not parry.
    this.telegraph
      .moveTo(startX, top + 4)
      .lineTo(fullX, bottom - 4)
      .stroke({ width: 1, color: tell, alpha: 0.25 });
    const reachX = startX + (fullX - startX) * t;
    this.telegraph
      .moveTo(startX, top + 6)
      .lineTo(reachX, bottom - 6)
      .stroke({ width: 2, color: tell, alpha: 0.55 });
    this.telegraph.visible = true;
  }

  /**
   * A small posture line above the head, shown only after the first posture hit. When it
   * fills, the bar turns blood-red for the whole KNELL window.
   */
  private drawPosture(enemy: Enemy): void {
    const bar = this.postureBar;
    bar.clear();
    if (!enemy.alive || (enemy.postureRatio >= 1 && !enemy.postureBroken)) {
      bar.visible = false;
      return;
    }
    const feet = enemy.feet;
    const width = 28;
    const x = Math.round(feet.x - width / 2);
    const y = Math.round(feet.y - enemy.stats.body.h - 7);
    bar.rect(x, y, width, 2).fill({ color: PALETTE.void, alpha: 0.75 });
    const ratio = enemy.postureBroken ? 1 : Math.max(0, Math.min(1, enemy.postureRatio));
    bar
      .rect(x, y, width * ratio, 2)
      .fill({ color: enemy.postureBroken ? PALETTE.blood : PALETTE.brass, alpha: 0.95 });
    bar.visible = true;
  }
}
