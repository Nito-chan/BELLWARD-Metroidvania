/** A read-only snapshot of the run's combat modifiers. The controller subscribes to it. */
import type { CharmId } from '../config/progression';

export type PlayerLoadout = {
  readonly charms: readonly CharmId[];
  readonly nailLevel: number;
  readonly wallClaw: boolean;
  readonly hookline: boolean;
  readonly longline: boolean;
  readonly censer: boolean;
  readonly toll: boolean;
};

export const STARTER_LOADOUT: PlayerLoadout = {
  charms: [],
  nailLevel: 0,
  wallClaw: false,
  hookline: false,
  longline: false,
  censer: false,
  toll: false,
};

export function hasCharm(loadout: PlayerLoadout, id: CharmId): boolean {
  return loadout.charms.includes(id);
}
