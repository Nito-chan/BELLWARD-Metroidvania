import { Container, Graphics } from 'pixi.js';
import { PALETTE } from '../config/palette';
import type { PickupDef } from '../data/pickups';
import { getPickup } from '../data/pickups';
import type { RoomPickupPlacement } from '../world/Room';

type PickupRecord = {
  readonly id: string;
  readonly def: PickupDef;
  readonly x: number;
  readonly y: number;
  readonly phase: number;
  readonly view: Graphics;
};

/**
 * World-space collectibles. The simulation decides when one is taken; this layer only
 * draws the remaining set and bobs it deterministically from the fixed tick.
 */
export class PickupLayer {
  readonly view = new Container();
  private readonly records: PickupRecord[] = [];

  constructor(placements: readonly RoomPickupPlacement[], collected: ReadonlySet<string>) {
    for (const [index, placement] of placements.entries()) {
      if (collected.has(placement.id)) continue;
      const def = getPickup(placement.id);
      const view = this.draw(def);
      view.position.set(placement.x, placement.y - 12);
      this.view.addChild(view);
      this.records.push({
        id: placement.id,
        def,
        x: placement.x,
        y: placement.y - 12,
        phase: index * 17,
        view,
      });
    }
  }

  /** Removes one pickup's view. Returns the remaining count. */
  collect(id: string): number {
    const index = this.records.findIndex((record) => record.id === id);
    if (index >= 0) {
      const record = this.records[index];
      record?.view.removeFromParent();
      record?.view.destroy();
      this.records.splice(index, 1);
    }
    return this.records.length;
  }

  /** Ids still present; the scene checks this before granting a pickup. */
  has(id: string): boolean {
    return this.records.some((record) => record.id === id);
  }

  get remaining(): number {
    return this.records.length;
  }

  update(tickCount: number): void {
    const t = tickCount / 20;
    for (const record of this.records) {
      record.view.y = record.y + Math.sin(t + record.phase) * 2.5;
      record.view.alpha = 0.82 + Math.sin(t * 1.4 + record.phase) * 0.18;
    }
  }

  private draw(def: PickupDef): Graphics {
    const g = new Graphics();
    const colour =
      def.kind === 'charm'
        ? PALETTE.ember
        : def.kind === 'healthShard'
          ? PALETTE.bone
          : def.kind === 'ability' || def.kind === 'key'
            ? PALETTE.echo
            : PALETTE.brass;
    g.circle(0, 0, def.kind === 'charm' || def.kind === 'ability' ? 7 : 4).fill({
      color: PALETTE.void,
      alpha: 0.65,
    });
    g.circle(0, 0, def.kind === 'charm' || def.kind === 'ability' ? 6 : 3).fill(colour);
    g.circle(-1.5, -1.5, def.kind === 'charm' ? 1.5 : 1).fill({
      color: PALETTE.bone,
      alpha: 0.9,
    });
    if (def.kind === 'charm' || def.kind === 'ability' || def.kind === 'key') {
      g.poly([0, -13, 3, -9, 0, -5, -3, -9]).fill({ color: colour, alpha: 0.55 });
    }
    return g;
  }
}
