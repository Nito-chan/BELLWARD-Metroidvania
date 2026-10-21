/** A read-only snapshot of the run's combat modifiers. The controller subscribes to it. */
import type { CharmId } from '../config/progression';

export type PlayerLoadout = {
  readonly charms: readonly CharmId[];
  readonly nailLevel: number;
  readonly wallClaw: boolean;
};

export const STARTER_LOADOUT: PlayerLoadout = {
  charms: [],
  nailLevel: 0,
  wallClaw: false,
};

export function hasCharm(loadout: PlayerLoadout, id: CharmId): boolean {
  return loadout.charms.includes(id);
}
