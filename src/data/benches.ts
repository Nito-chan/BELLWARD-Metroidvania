import { BellwardError } from '../core/Errors';
import type { RoomBench } from '../world/Room';
import { ALL_ROOMS } from './rooms';

/** A bench with its owning room attached, so saves can resolve a checkpoint in one lookup. */
export type BenchRef = RoomBench & {
  readonly roomId: string;
};

const index = new Map<string, BenchRef>();
for (const room of ALL_ROOMS) {
  for (const bench of room.benches ?? []) {
    if (index.has(bench.id)) {
      throw new BellwardError(`duplicate bench id "${bench.id}" in room "${room.id}"`);
    }
    index.set(bench.id, { ...bench, roomId: room.id });
  }
}

/** Every rest point in the slice, keyed by its stable save id. */
export const BENCHES: ReadonlyMap<string, BenchRef> = index;

/** Resolves a bench by id. Save loading treats a miss as a corrupt document. */
export function getBench(id: string): BenchRef {
  const bench = index.get(id);
  if (!bench) throw new BellwardError(`unknown bench "${id}"`);
  return bench;
}
