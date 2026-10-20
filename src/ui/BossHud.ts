import { Container, Graphics, Text } from 'pixi.js';
import { PALETTE } from '../config/palette';

/** Everything the boss bar needs from the simulation, with no entity references. */
export type BossHudInfo = {
  readonly name: string;
  readonly hp: number;
  readonly maxHp: number;
  readonly phaseIndex: number;
  readonly phaseCount: number;
  readonly phaseName: string;
  readonly warded: boolean;
  readonly alive: boolean;
};

const BAR_X = 180;
const BAR_Y = 25;
const BAR_W = 280;
const BAR_H = 5;
const TEXT_X = 320;

const TITLE_STYLE = {
  fontFamily: 'Georgia, "Times New Roman", serif',
  fontSize: 11,
  fill: PALETTE.bone,
  letterSpacing: 2,
  stroke: { color: PALETTE.void, width: 3 },
} as const;

const SUB_STYLE = {
  fontFamily: 'Georgia, "Times New Roman", serif',
  fontSize: 8,
  fill: PALETTE.brass,
  letterSpacing: 1.5,
  stroke: { color: PALETTE.void, width: 2 },
} as const;

/**
 * Screen-space boss bar. It appears only while a boss encounter exists, shows the phase
 * as pips, and spells out the ward state so the Bellbearer's immune phase is never a
 * mystery. Redraws happen only when a visible value changes.
 */
export class BossHud {
  readonly view = new Container();
  private readonly back = new Graphics();
  private readonly fill = new Graphics();
  private readonly pips = new Graphics();
  private readonly title = new Text({ text: '', style: TITLE_STYLE });
  private readonly subtitle = new Text({ text: '', style: SUB_STYLE });
  private last: BossHudInfo | null = null;

  constructor() {
    this.title.anchor.set(0.5, 0);
    this.title.position.set(TEXT_X, 3);
    this.title.resolution = 2;
    this.subtitle.anchor.set(0.5, 0);
    this.subtitle.position.set(TEXT_X, 33);
    this.subtitle.resolution = 2;
    this.view.addChild(this.back, this.fill, this.pips, this.title, this.subtitle);
    this.view.visible = false;
  }

  setBoss(info: BossHudInfo | null): void {
    if (!info) {
      this.view.visible = false;
      this.last = null;
      return;
    }
    this.view.visible = true;
    if (this.sameAsLast(info)) return;
    this.last = info;
    this.redraw(info);
  }

  private sameAsLast(info: BossHudInfo): boolean {
    const last = this.last;
    if (!last) return false;
    return (
      last.name === info.name &&
      last.hp === info.hp &&
      last.maxHp === info.maxHp &&
      last.phaseIndex === info.phaseIndex &&
      last.phaseCount === info.phaseCount &&
      last.phaseName === info.phaseName &&
      last.warded === info.warded &&
      last.alive === info.alive
    );
  }

  private redraw(info: BossHudInfo): void {
    const ratio = info.maxHp > 0 ? Math.max(0, Math.min(1, info.hp / info.maxHp)) : 0;
    this.title.text = info.alive ? info.name : `${info.name} — FELLED`;
    this.subtitle.text = info.alive
      ? `${info.phaseName}${info.warded ? '  ·  WARDED' : ''}`
      : 'A bell-sigil remains';

    this.back.clear();
    this.back.roundRect(BAR_X, BAR_Y, BAR_W, BAR_H, 2).fill({ color: PALETTE.void, alpha: 0.82 });
    this.back
      .roundRect(BAR_X, BAR_Y, BAR_W, BAR_H, 2)
      .stroke({ width: 1, color: PALETTE.brassDark, alpha: 0.85 });

    this.fill.clear();
    if (ratio > 0) {
      const color = info.warded
        ? PALETTE.stoneLit
        : info.phaseIndex > 0
          ? PALETTE.echo
          : PALETTE.ember;
      this.fill
        .roundRect(BAR_X + 1, BAR_Y + 1, (BAR_W - 2) * ratio, BAR_H - 2, 1)
        .fill({ color, alpha: 0.95 });
    }

    this.pips.clear();
    const spacing = 10;
    const startX = TEXT_X - ((info.phaseCount - 1) * spacing) / 2;
    for (let i = 0; i < info.phaseCount; i += 1) {
      const x = startX + i * spacing;
      const current = i === info.phaseIndex;
      const cleared = i < info.phaseIndex;
      this.pips.poly([x, 44, x + 4, 48, x, 52, x - 4, 48]).fill({
        color: current ? PALETTE.ember : cleared ? PALETTE.brassDark : PALETTE.stone,
        alpha: current ? 1 : 0.7,
      });
    }
  }
}
