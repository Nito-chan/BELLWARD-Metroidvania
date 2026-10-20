import { Container, Graphics } from 'pixi.js';
import { PALETTE } from '../config/palette';
import { VIEW } from '../config/world';

/**
 * The combat HUD: a row of health pips, a row of boss sigils, a red damage vignette and
 * the death fade. Entirely screen-space and drawn with three Graphics objects, redrawn
 * only when a tracked value changes.
 */
export class Hud {
  readonly view = new Container();
  private readonly damage = new Graphics().rect(0, 0, VIEW.width, VIEW.height).fill(PALETTE.blood);
  private readonly pips = new Graphics();
  private readonly sigils = new Graphics();
  private readonly death = new Graphics().rect(0, 0, VIEW.width, VIEW.height).fill(PALETTE.void);
  private lastHp = -1;
  private lastMax = -1;
  private lastSigils = -1;
  private lastSigilTotal = -1;
  private lastDamage = -1;
  private lastDeath = -1;

  constructor() {
    this.damage.alpha = 0;
    this.damage.visible = false;
    this.death.alpha = 0;
    this.death.visible = false;
    this.view.addChild(this.damage, this.pips, this.sigils, this.death);
  }

  /** Redraws the pip row when the value actually changed. */
  setHealth(hp: number, max: number): void {
    if (hp === this.lastHp && max === this.lastMax) return;
    this.lastHp = hp;
    this.lastMax = max;

    const g = this.pips;
    g.clear();
    const width = max * 12 + 8;
    g.roundRect(8, 8, width, 16, 4).fill({ color: PALETTE.void, alpha: 0.55 });
    g.roundRect(8, 8, width, 16, 4).stroke({
      width: 1,
      color: PALETTE.brassDark,
      alpha: 0.7,
    });
    for (let i = 0; i < max; i += 1) {
      const cx = 17 + i * 12;
      const filled = i < hp;
      g.poly([cx, 11, cx + 5, 16, cx, 21, cx - 5, 16]).fill({
        color: filled ? PALETTE.ember : PALETTE.stone,
        alpha: filled ? 1 : 0.55,
      });
    }
  }

  /** Sigil pips sit at the top-right, mirroring the boss rewards recovered this run. */
  setSigils(count: number, total: number): void {
    if (count === this.lastSigils && total === this.lastSigilTotal) return;
    this.lastSigils = count;
    this.lastSigilTotal = total;
    const g = this.sigils;
    g.clear();
    if (total <= 0) {
      g.visible = false;
      return;
    }
    const width = total * 12 + 8;
    const x = VIEW.width - width - 8;
    g.roundRect(x, 8, width, 16, 4).fill({ color: PALETTE.void, alpha: 0.55 });
    g.roundRect(x, 8, width, 16, 4).stroke({
      width: 1,
      color: PALETTE.brassDark,
      alpha: 0.7,
    });
    for (let i = 0; i < total; i += 1) {
      const cx = x + 9 + i * 12;
      const filled = i < count;
      g.poly([cx, 11, cx + 5, 16, cx, 21, cx - 5, 16]).fill({
        color: filled ? PALETTE.echo : PALETTE.stone,
        alpha: filled ? 1 : 0.55,
      });
    }
    g.visible = true;
  }

  /** `level` 0..1 maps to the red damage flash. */
  setDamage(level: number): void {
    const clamped = Math.max(0, Math.min(1, level));
    if (clamped === this.lastDamage) return;
    this.lastDamage = clamped;
    const alpha = clamped * 0.22;
    // A full-screen alpha-0 quad still costs fill rate on software renderers; hide it
    // outright whenever the flash is off.
    this.damage.visible = alpha > 0;
    this.damage.alpha = alpha;
  }

  /** `level` 0..1 maps to the black death fade. */
  setDeath(level: number): void {
    const clamped = Math.max(0, Math.min(1, level));
    if (clamped === this.lastDeath) return;
    this.lastDeath = clamped;
    const alpha = clamped * 0.85;
    this.death.visible = alpha > 0;
    this.death.alpha = alpha;
  }
}
