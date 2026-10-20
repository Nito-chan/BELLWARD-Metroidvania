import type { Vec2 } from '../core/Types';
import type { Body } from '../physics/Body';
import { bodyRect, overlaps } from '../combat/geometry';
import type { RoomExit } from '../world/Room';

export type ExitRequest = { roomId: string; spawn: Vec2 };

/**
 * Arms doorway triggers only after the player leaves every trigger on the destination
 * spawn, then emits at most one transition. A living boss keeps every door locked.
 */
export class ExitGate {
  private armed = false;
  private requestValue: ExitRequest | null = null;

  get request(): ExitRequest | null {
    return this.requestValue;
  }

  update(body: Body, exits: readonly RoomExit[], locked: boolean): void {
    if (exits.length === 0 || this.requestValue) return;
    const rect = bodyRect(body);
    if (!this.armed) {
      if (!exits.some((exit) => overlaps(rect, exit))) this.armed = true;
      return;
    }
    if (locked) return;
    for (const exit of exits) {
      if (!overlaps(rect, exit)) continue;
      this.requestValue = {
        roomId: exit.targetRoomId,
        spawn: { x: exit.spawn.x, y: exit.spawn.y },
      };
      return;
    }
  }
}
