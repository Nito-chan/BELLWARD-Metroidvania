import { Container, Graphics, Text } from 'pixi.js';
import { PALETTE } from '../config/palette';

const TITLE_STYLE = {
  fontFamily: 'Georgia, "Times New Roman", serif',
  fontSize: 16,
  fill: PALETTE.bone,
  letterSpacing: 3,
  align: 'center',
  stroke: { color: PALETTE.void, width: 4 },
} as const;

const SUB_STYLE = {
  fontFamily: 'Georgia, "Times New Roman", serif',
  fontSize: 8,
  fill: PALETTE.brass,
  letterSpacing: 2,
  align: 'center',
  stroke: { color: PALETTE.void, width: 2 },
} as const;

/**
 * Short-lived screen-space banner for boss phase and reward beats. Ticks on the fixed
 * simulation clock (not wall time), and fades out without blocking input.
 */
export class Banner {
  readonly view = new Container();
  private readonly back = new Graphics();
  private readonly title = new Text({ text: '', style: TITLE_STYLE });
  private readonly subtitle = new Text({ text: '', style: SUB_STYLE });
  private ticksLeft = 0;
  private totalTicks = 0;
  /** Paused while a DOM card owns the screen; the timer resumes with the simulation. */
  private enabled = true;

  constructor() {
    this.back
      .roundRect(118, 78, 404, 50, 4)
      .fill({ color: PALETTE.void, alpha: 0.72 })
      .stroke({ width: 1, color: PALETTE.brassDark, alpha: 0.7 });
    this.title.anchor.set(0.5, 0);
    this.title.position.set(320, 86);
    this.title.resolution = 2;
    this.subtitle.anchor.set(0.5, 0);
    this.subtitle.position.set(320, 110);
    this.subtitle.resolution = 2;
    this.view.addChild(this.back, this.title, this.subtitle);
    this.view.visible = false;
  }

  show(title: string, subtitle: string, ticks = 150): void {
    this.title.text = title;
    this.subtitle.text = subtitle;
    this.ticksLeft = ticks;
    this.totalTicks = ticks;
    this.view.visible = this.enabled;
    this.view.alpha = 1;
  }

  /**
   * Hides the current banner without consuming its timer. The title card uses this so a
   * boss intro or room arrival can resume when gameplay actually starts.
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    this.view.visible = enabled && this.ticksLeft > 0;
  }

  /** Clears the banner immediately when a DOM overlay takes over its message. */
  hide(): void {
    this.ticksLeft = 0;
    this.view.visible = false;
  }

  tick(): void {
    if (this.ticksLeft <= 0) return;
    this.ticksLeft -= 1;
    if (this.ticksLeft <= 0) {
      this.view.visible = false;
      return;
    }
    // Fade the final quarter-second so the banner never pops away.
    const fadeTicks = Math.min(24, Math.floor(this.totalTicks * 0.25));
    this.view.alpha = this.ticksLeft < fadeTicks ? this.ticksLeft / fadeTicks : 1;
    this.view.visible = this.enabled;
  }
}
