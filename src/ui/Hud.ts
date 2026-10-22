import { Container, Graphics, Text } from 'pixi.js';
import { PALETTE } from '../config/palette';
import { VIEW } from '../config/world';

/**
 * The combat HUD: masks, Focus, boss sigils, shards, a damage vignette and the death
 * fade. Screen-space, redrawn only when a tracked value changes. The Focus bar doubles
 * as the heal channel: the glowing segment grows while the player holds the mend.
 */
export class Hud {
  readonly view = new Container();
  private readonly damage = new Graphics().rect(0, 0, VIEW.width, VIEW.height).fill(PALETTE.blood);
  private readonly pips = new Graphics();
  private readonly focusBar = new Graphics();
  private readonly postureBar = new Graphics();
  private readonly sigils = new Graphics();
  private readonly death = new Graphics().rect(0, 0, VIEW.width, VIEW.height).fill(PALETTE.void);
  private readonly shardText = new Text({
    text: '',
    style: {
      fontFamily: 'monospace',
      fontSize: 10,
      fill: PALETTE.brass,
      letterSpacing: 1,
    },
  });
  private lastHp = -1;
  private lastMax = -1;
  private lastFocus = -1;
  private lastFocusMax = -1;
  private lastHeal = -1;
  private lastPosture = -1;
  private lastPostureMax = -1;
  private lastPostureBroken = false;
  private lastShards = -1;
  private lastSigils = -1;
  private lastSigilTotal = -1;
  private lastDamage = -1;
  private lastDeath = -1;

  constructor() {
    this.damage.alpha = 0;
    this.damage.visible = false;
    this.death.alpha = 0;
    this.death.visible = false;
    this.shardText.anchor.set(1, 0);
    this.shardText.position.set(VIEW.width - 8, 30);
    this.view.addChild(
      this.damage,
      this.pips,
      this.focusBar,
      this.postureBar,
      this.sigils,
      this.shardText,
      this.death,
    );
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

  /** Focus bar below the masks. `healProgress` 0..1 overlays the channel in ember. */
  setFocus(value: number, max: number, healProgress = 0): void {
    const clamped = Math.max(0, Math.min(max, Math.floor(value)));
    const channel = Math.max(0, Math.min(1, healProgress));
    if (clamped === this.lastFocus && max === this.lastFocusMax && channel === this.lastHeal) {
      return;
    }
    this.lastFocus = clamped;
    this.lastFocusMax = max;
    this.lastHeal = channel;

    const g = this.focusBar;
    g.clear();
    const width = 72;
    g.roundRect(8, 29, width, 6, 2).fill({ color: PALETTE.void, alpha: 0.6 });
    g.roundRect(8, 29, width, 6, 2).stroke({
      width: 1,
      color: PALETTE.brassDark,
      alpha: 0.65,
    });
    if (max > 0) {
      g.roundRect(9, 30, (width - 2) * (clamped / max), 4, 1).fill({
        color: PALETTE.echo,
        alpha: 0.9,
      });
    }
    if (channel > 0) {
      g.roundRect(9, 30, (width - 2) * channel, 4, 1).fill({
        color: PALETTE.ember,
        alpha: 1,
      });
    }
  }

  /**
   * The Keeper's posture, a thin line under Focus. Brass holds; blood means the guard
   * has shattered. Redrawn at half-point precision so regen does not repaint every tick.
   */
  setPosture(value: number, max: number, broken: boolean): void {
    const clamped = Math.max(0, Math.min(max, value));
    const rounded = Math.round(clamped * 2) / 2;
    if (
      rounded === this.lastPosture &&
      max === this.lastPostureMax &&
      broken === this.lastPostureBroken
    ) {
      return;
    }
    this.lastPosture = rounded;
    this.lastPostureMax = max;
    this.lastPostureBroken = broken;

    const g = this.postureBar;
    g.clear();
    const width = 72;
    g.rect(8, 38, width, 3).fill({ color: PALETTE.void, alpha: 0.6 });
    const ratio = max > 0 ? rounded / max : 0;
    if (broken) {
      g.rect(8, 38, width, 3).fill({ color: PALETTE.blood, alpha: 0.95 });
    } else if (ratio > 0) {
      g.rect(8, 38, width * ratio, 3).fill({ color: PALETTE.brass, alpha: 0.85 });
    }
  }

  /** Shard total under the sigil row. */
  setShards(count: number): void {
    const clamped = Math.max(0, Math.floor(count));
    if (clamped === this.lastShards) return;
    this.lastShards = clamped;
    this.shardText.text = `◈ ${clamped}`;
    this.shardText.visible = clamped > 0;
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
