import { Container, Sprite, Texture } from 'pixi.js';
import { PALETTE } from '../config/palette';
import { VIEW } from '../config/world';
import type { Rng } from '../core/Rng';

const MOTE_COUNT = 28;

type Mote = {
  readonly view: Sprite;
  readonly baseX: number;
  readonly phase: number;
  readonly speed: number;
};

/**
 * The drifting dust that gives still rooms depth. One shared white texture means all
 * motes batch into a single draw call, and the field is simulation-clock driven so a
 * dropped frame cannot change where the motes appear.
 */
export class MoteField {
  readonly view = new Container();
  private readonly motes: Mote[] = [];

  constructor(rng: Rng) {
    for (let i = 0; i < MOTE_COUNT; i += 1) {
      const mote = new Sprite(Texture.WHITE);
      mote.anchor.set(0.5);
      mote.width = 3;
      mote.height = 3;
      mote.tint = PALETTE.echo;
      this.view.addChild(mote);
      this.motes.push({
        view: mote,
        baseX: rng.float(0, VIEW.width),
        phase: rng.float(0, Math.PI * 2),
        speed: rng.float(0.3, 0.9),
      });
    }
  }

  update(tickCount: number): void {
    const t = tickCount / 60;
    const span = VIEW.height + 80;
    for (const mote of this.motes) {
      const travel = (mote.phase * 101 + t * mote.speed * 22) % span;
      const x = mote.baseX + Math.sin(t * 0.6 + mote.phase) * 16;
      mote.view.position.set(x, VIEW.height + 40 - travel);
      mote.view.alpha = 0.2 + 0.5 * (0.5 + 0.5 * Math.sin(t * 1.7 + mote.phase));
    }
  }
}
