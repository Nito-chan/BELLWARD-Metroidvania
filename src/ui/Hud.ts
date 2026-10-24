import { Container, Graphics, Text } from 'pixi.js';
import { PALETTE } from '../config/palette';
import { VIEW } from '../config/world';
import type { WeaponId } from '../config/weapons';
import { arsenalReadout } from './hudModel';

const ARSENAL_X = 8;
const ARSENAL_Y = 47;
const ARSENAL_SLOT_W = 42;
const ARSENAL_SLOT_H = 17;

const ARSENAL_STYLE = {
  fontFamily: 'monospace',
  fontSize: 7,
  fill: PALETTE.bone,
  letterSpacing: 0.2,
} as const;

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
  private readonly arsenal = new Graphics();
  private readonly arsenalLabels = [
    new Text({ text: '', style: ARSENAL_STYLE }),
    new Text({ text: '', style: ARSENAL_STYLE }),
    new Text({ text: '', style: ARSENAL_STYLE }),
    new Text({ text: '', style: ARSENAL_STYLE }),
  ];
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
  private lastArsenalKey = '';
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
    for (let i = 0; i < this.arsenalLabels.length; i += 1) {
      const label = this.arsenalLabels[i]!;
      label.anchor.set(0.5, 0.5);
      label.position.set(
        ARSENAL_X + i * ARSENAL_SLOT_W + ARSENAL_SLOT_W / 2,
        ARSENAL_Y + ARSENAL_SLOT_H / 2,
      );
      label.resolution = 2;
    }
    this.view.addChild(
      this.damage,
      this.pips,
      this.focusBar,
      this.postureBar,
      this.arsenal,
      ...this.arsenalLabels,
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

  /**
   * The four-slot arsenal plaque. Hookline is shown as an owned tool, never as the
   * active attack; Toll carries a four-segment radial-ish cooldown at its right edge.
   */
  setArsenal(
    weapon: WeaponId,
    hasCenser: boolean,
    hasToll: boolean,
    hasHookline: boolean,
    tollCooldown: number,
    tollCooldownMax: number,
  ): void {
    const slots = arsenalReadout(weapon, hasCenser, hasToll, hasHookline);
    const ratio =
      tollCooldownMax > 0 ? 1 - Math.max(0, Math.min(1, tollCooldown / tollCooldownMax)) : 1;
    const litSegments = hasToll ? Math.ceil(ratio * 4) : 0;
    const key = `${weapon}|${hasCenser}|${hasToll}|${hasHookline}|${litSegments}`;
    if (key === this.lastArsenalKey) return;
    this.lastArsenalKey = key;

    const g = this.arsenal;
    g.clear();
    for (let i = 0; i < slots.length; i += 1) {
      const slot = slots[i]!;
      const x = ARSENAL_X + i * ARSENAL_SLOT_W;
      g.roundRect(x, ARSENAL_Y, ARSENAL_SLOT_W - 2, ARSENAL_SLOT_H, 3).fill({
        color: PALETTE.void,
        alpha: slot.owned ? 0.62 : 0.34,
      });
      g.roundRect(x, ARSENAL_Y, ARSENAL_SLOT_W - 2, ARSENAL_SLOT_H, 3).stroke({
        width: slot.active ? 1.5 : 1,
        color: slot.active ? PALETTE.ember : PALETTE.brassDark,
        alpha: slot.active ? 1 : slot.owned ? 0.65 : 0.28,
      });
      const label = this.arsenalLabels[i]!;
      label.text = slot.label;
      label.tint = slot.active ? PALETTE.ember : slot.owned ? PALETTE.bone : PALETTE.stoneLit;
      label.alpha = slot.owned ? 1 : 0.36;
      if (slot.active) {
        g.rect(x + 4, ARSENAL_Y + ARSENAL_SLOT_H, ARSENAL_SLOT_W - 10, 1.5).fill({
          color: PALETTE.ember,
          alpha: 0.9,
        });
      }
    }

    if (hasToll) {
      const x = ARSENAL_X + 3 * ARSENAL_SLOT_W + ARSENAL_SLOT_W - 8;
      for (let s = 0; s < 4; s += 1) {
        g.rect(x, ARSENAL_Y + 2 + s * 3.4, 2, 2).fill({
          color: s < litSegments ? PALETTE.echo : PALETTE.stone,
          alpha: s < litSegments ? 0.95 : 0.5,
        });
      }
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
