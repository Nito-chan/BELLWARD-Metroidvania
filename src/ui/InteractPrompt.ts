import { Container, Graphics, Text } from 'pixi.js';
import { PALETTE } from '../config/palette';
import { VIEW } from '../config/world';

const TITLE_STYLE = {
  fontFamily: 'Georgia, "Times New Roman", serif',
  fontSize: 9,
  fill: PALETTE.bone,
  letterSpacing: 2,
  align: 'center',
  stroke: { color: PALETTE.void, width: 3 },
} as const;

const HINT_STYLE = {
  fontFamily: 'ui-monospace, Consolas, monospace',
  fontSize: 7,
  fill: PALETTE.brass,
  letterSpacing: 1.4,
  align: 'center',
  stroke: { color: PALETTE.void, width: 2 },
} as const;

/**
 * Screen-space rest prompt. Kept below the HUD so the death fade can cover it; the bench
 * marker itself carries the in-world affordance. Visibility is driven by the scene, not
 * by DOM focus.
 */
export class InteractPrompt {
  readonly view = new Container();
  private readonly title = new Text({ text: '', style: TITLE_STYLE });
  private readonly hint = new Text({
    text: 'INTERACT TO REST · PROGRESS SAVES',
    style: HINT_STYLE,
  });

  constructor() {
    const back = new Graphics()
      .roundRect(182, 314, 276, 34, 4)
      .fill({ color: PALETTE.void, alpha: 0.78 })
      .stroke({ width: 1, color: PALETTE.brassDark, alpha: 0.8 });
    this.title.anchor.set(0.5, 0);
    this.title.position.set(VIEW.width / 2, 318);
    this.title.resolution = 2;
    this.hint.anchor.set(0.5, 0);
    this.hint.position.set(VIEW.width / 2, 333);
    this.hint.resolution = 2;
    this.view.addChild(back, this.title, this.hint);
    this.view.visible = false;
  }

  show(benchName: string): void {
    const next = `REST AT ${benchName.toUpperCase()}`;
    if (this.title.text !== next) this.title.text = next;
    this.view.visible = true;
  }

  hide(): void {
    this.view.visible = false;
  }
}
