import { Container, Graphics, Sprite } from 'pixi.js';
import { BENCH } from '../config/bench';
import { PALETTE } from '../config/palette';
import type { RoomBench } from '../world/Room';
import type { ArtProvider } from './ArtProvider';

type BenchRecord = {
  readonly bench: RoomBench;
  readonly marker: Graphics;
  focused: boolean;
};

/**
 * Renders every rest point in a room and owns only the interaction lookup. Healing,
 * checkpointing and room rebuilding belong to RunSession; this layer is deliberately
 * replaceable scenery plus one readable focus marker.
 */
export class BenchLayer {
  readonly view = new Container();
  private readonly records: BenchRecord[] = [];

  constructor(benches: readonly RoomBench[], art: ArtProvider) {
    for (const bench of benches) {
      const sprite = new Sprite(art.prop('bench'));
      sprite.anchor.set(0.5, 1);
      sprite.position.set(bench.x, bench.y);

      const marker = new Graphics();
      marker
        .poly([0, -4, 4, 0, 0, 4, -4, 0])
        .fill(PALETTE.ember)
        .stroke({ width: 1, color: PALETTE.brass, alpha: 0.6 });
      marker.position.set(bench.x, bench.y - BENCH.markerOffsetY);
      marker.alpha = 0.18;

      this.view.addChild(marker, sprite);
      this.records.push({ bench, marker, focused: false });
    }
  }

  /** Nearest bench inside the generous feet-center interaction zone, or null. */
  findInRange(feet: { readonly x: number; readonly y: number }): RoomBench | null {
    let nearest: RoomBench | null = null;
    let nearestDx = Number.POSITIVE_INFINITY;
    for (const record of this.records) {
      const dx = Math.abs(feet.x - record.bench.x);
      const dy = Math.abs(feet.y - record.bench.y);
      if (dx > BENCH.interactRadiusX || dy > BENCH.interactRadiusY) continue;
      if (dx < nearestDx) {
        nearest = record.bench;
        nearestDx = dx;
      }
    }
    return nearest;
  }

  /** Brightens only the focused marker; the stone itself stays part of the room. */
  setFocused(benchId: string | null): void {
    for (const record of this.records) record.focused = record.bench.id === benchId;
  }

  /** Deterministic pulse on the simulation clock, not wall time. */
  tick(tickCount: number): void {
    for (const record of this.records) {
      const pulse = record.focused ? Math.sin(tickCount * 0.18) * 0.2 : 0;
      record.marker.alpha = (record.focused ? 0.62 : 0.18) + pulse;
    }
  }
}
