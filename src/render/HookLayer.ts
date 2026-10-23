import { Container, Graphics } from 'pixi.js';
import { HOOK } from '../config/hookline';
import { PALETTE } from '../config/palette';
import type { PlayerController } from '../player/PlayerController';
import type { RoomAnchor } from '../world/Room';

/**
 * Draws the room's brass rings and the live Hookline. Rings are static fixtures, so they
 * are drawn once; only the reticle, rope and grip flare are rebuilt per tick. The rope is
 * absent during the hang by design: the hand is already on the ring.
 */
export class HookLayer {
  readonly view = new Container();
  private readonly rings = new Graphics();
  private readonly dynamic = new Graphics();
  private readonly anchors: readonly RoomAnchor[];

  constructor(anchors: readonly RoomAnchor[]) {
    this.anchors = anchors;
    this.view.addChild(this.rings, this.dynamic);
    this.drawRings();
  }

  update(player: PlayerController, tickCount: number): void {
    const line = this.dynamic;
    line.clear();
    if (!player.hookEnabled) return;

    if (player.hookPhase === 'idle' && player.hookCandidateId) {
      const candidate = this.find(player.hookCandidateId);
      if (candidate) this.drawReticle(candidate);
    }

    if (!player.hooking) return;
    const anchor = this.find(player.hookAnchorId);
    if (!anchor) return;

    if (player.hookPhase === 'zip') {
      this.drawRope(player, anchor, tickCount);
    } else {
      this.drawGrip(anchor, tickCount);
    }
  }

  private drawRings(): void {
    for (const anchor of this.anchors) {
      const { x, y } = anchor;
      this.rings
        .circle(x, y + 0.8, 5.2)
        .fill({ color: PALETTE.void, alpha: 0.5 })
        .circle(x, y, 6.4)
        .fill({ color: PALETTE.brassDark, alpha: 0.08 });
      // A short chain running up out of the frame: the ring is suspended, not floating.
      this.rings
        .moveTo(x, y - 17)
        .lineTo(x, y - 6)
        .stroke({ width: 1, color: PALETTE.brassDark, alpha: 0.62 });
      this.rings
        .ellipse(x, y - 18.4, 2.1, 2.9)
        .stroke({ width: 1, color: PALETTE.brassDark, alpha: 0.56 });
      this.rings
        .circle(x, y, 5)
        .stroke({ width: 1.6, color: PALETTE.brassDark, alpha: 0.95 })
        .circle(x, y, 3.2)
        .stroke({ width: 0.9, color: PALETTE.brass, alpha: 0.6 })
        .circle(x, y - 0.6, 1.15)
        .fill({ color: PALETTE.bone, alpha: 0.72 });
    }
  }

  private drawReticle(anchor: RoomAnchor): void {
    const r = HOOK.reticleRadius;
    const { x, y } = anchor;
    this.dynamic
      .moveTo(x, y - r)
      .lineTo(x + r, y)
      .lineTo(x, y + r)
      .lineTo(x - r, y)
      .closePath()
      .stroke({ width: 1.3, color: PALETTE.ember, alpha: 0.9 })
      .circle(x, y, r + 3.2)
      .stroke({ width: 0.8, color: PALETTE.ember, alpha: 0.3 });
    for (const [dx, dy] of [
      [0, -1],
      [0, 1],
      [-1, 0],
      [1, 0],
    ] as const) {
      this.dynamic
        .moveTo(x + dx * (r + 4), y + dy * (r + 4))
        .lineTo(x + dx * (r + 7.5), y + dy * (r + 7.5))
        .stroke({ width: 1, color: PALETTE.bone, alpha: 0.55 });
    }
  }

  private drawRope(player: PlayerController, anchor: RoomAnchor, tickCount: number): void {
    const feet = player.feet;
    const handX = feet.x + player.facing * 4;
    const handY = feet.y - HOOK.handOffsetY;
    // A taut line still carries a little weight; the slow wobble keeps it alive. The bow
    // is perpendicular to the line, otherwise a vertical rope only slides along itself.
    const sag = HOOK.ropeSag + Math.sin(tickCount * 0.55) * 0.7;
    const dx = anchor.x - handX;
    const dy = anchor.y - handY;
    const length = Math.hypot(dx, dy) || 1;
    const normalX = -dy / length;
    const normalY = dx / length;
    const points: Array<readonly [number, number]> = [];

    for (let index = 0; index <= HOOK.ropeSegments; index += 1) {
      const t = index / HOOK.ropeSegments;
      const bow = Math.sin(Math.PI * t) * sag;
      const x = handX + dx * t + normalX * bow;
      const y = handY + dy * t + normalY * bow;
      points.push([x, y]);
    }

    const strokePath = (width: number, color: number, alpha: number): void => {
      const [first, ...rest] = points;
      if (!first) return;
      this.dynamic.moveTo(first[0], first[1]);
      for (const [x, y] of rest) this.dynamic.lineTo(x, y);
      this.dynamic.stroke({ width, color, alpha });
    };
    strokePath(3.2, PALETTE.void, 0.65);
    strokePath(1.6, PALETTE.brass, 0.95);
    strokePath(0.7, PALETTE.bone, 0.5);
  }

  private drawGrip(anchor: RoomAnchor, tickCount: number): void {
    const glint = 0.72 + Math.sin(tickCount * 0.4) * 0.16;
    this.dynamic
      .circle(anchor.x, anchor.y, 7.5)
      .fill({ color: PALETTE.ember, alpha: 0.16 })
      .circle(anchor.x, anchor.y, 4.2)
      .stroke({ width: 1.4, color: PALETTE.ember, alpha: glint })
      .circle(anchor.x, anchor.y, 1.6)
      .fill({ color: PALETTE.bone, alpha: 0.9 });
  }

  private find(id: string | null): RoomAnchor | null {
    if (id === null) return null;
    return this.anchors.find((anchor) => anchor.id === id) ?? null;
  }
}
