import { Container, Graphics, Text } from 'pixi.js';
import { PALETTE } from '../config/palette';
import { VIEW } from '../config/world';
import type { Rng } from '../core/Rng';

type Mote = {
  view: Graphics;
  baseX: number;
  phase: number;
  speed: number;
};

const MOTE_COUNT = 24;

/**
 * TEMPORARY (M0 only): visual proof that the fixed-step loop, the Pixi v8 renderer
 * and the headless WebGL2 path all work end to end. M1 replaces this with the real
 * room renderer. Everything here is a pure function of the simulation tick count.
 */
export class DemoScene {
  readonly view = new Container();
  private readonly motes: Mote[] = [];
  private readonly bell = new Graphics();

  constructor(rng: Rng) {
    const background = new Graphics()
      .rect(0, 0, VIEW.width, VIEW.height)
      .fill(PALETTE.deepWater)
      .rect(0, VIEW.height * 0.68, VIEW.width, VIEW.height * 0.32)
      .fill(PALETTE.cavern)
      .rect(0, VIEW.height * 0.68, VIEW.width, 2)
      .fill(PALETTE.stoneLit);
    this.view.addChild(background);

    this.bell
      .circle(0, 0, 26)
      .fill(PALETTE.brass)
      .circle(0, 0, 26)
      .stroke({ width: 3, color: PALETTE.brassDark })
      .rect(-4, 26, 8, 10)
      .fill(PALETTE.brassDark);
    this.bell.position.set(VIEW.width / 2, VIEW.height * 0.38);
    this.view.addChild(this.bell);

    const moteLayer = new Container();
    for (let i = 0; i < MOTE_COUNT; i += 1) {
      const moteView = new Graphics().circle(0, 0, 1.5).fill(PALETTE.echo);
      moteLayer.addChild(moteView);
      this.motes.push({
        view: moteView,
        baseX: rng.float(0, VIEW.width),
        phase: rng.float(0, Math.PI * 2),
        speed: rng.float(0.3, 0.9),
      });
    }
    this.view.addChild(moteLayer);

    const label = new Text({
      text: 'BELLWARD · M0 skeleton',
      style: {
        fontFamily: 'ui-monospace, Consolas, monospace',
        fontSize: 12,
        fill: PALETTE.bone,
      },
    });
    label.anchor.set(0.5);
    label.position.set(VIEW.width / 2, VIEW.height - 33);
    this.view.addChild(label);
  }

  /** Advances visuals to the given absolute simulation tick. Deterministic, alloc-free. */
  update(tickCount: number): void {
    const t = tickCount / 60;
    this.bell.rotation = Math.sin(t * 0.9) * 0.06;

    const span = VIEW.height + 60;
    for (const mote of this.motes) {
      const travel = (mote.phase * 97 + t * mote.speed * 24) % span;
      const y = VIEW.height + 30 - travel;
      const x = mote.baseX + Math.sin(t * 0.7 + mote.phase) * 14;
      mote.view.position.set(x, y);
      mote.view.alpha = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(t * 2 + mote.phase));
    }
  }
}
