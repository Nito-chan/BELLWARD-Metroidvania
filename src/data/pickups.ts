/**
 * Every collectible in the slice, keyed by a stable save id. Rooms only place ids and
 * coordinates; this registry owns what a pickup is, so a save can be validated without
 * trusting room data and the level checker can prove every reward is reachable content.
 */
import type { BossKind } from '../config/enemies';
import { BOSS_KINDS } from '../config/enemies';
import { CHARMS, type CharmId } from '../config/progression';
import { BellwardError } from '../core/Errors';

export type PickupKind = 'shard' | 'healthShard' | 'charm' | 'ability' | 'key';

export type PickupDef = {
  readonly id: string;
  readonly kind: PickupKind;
  readonly name: string;
  readonly description: string;
  /** Shards granted by a `shard` pickup. */
  readonly amount?: number;
  /** Charm granted by a `charm` pickup. */
  readonly charm?: CharmId;
  /** A key may only be collected after this boss sigil is claimed. */
  readonly requiresSigil?: BossKind;
};

export const PICKUPS: Readonly<Record<string, PickupDef>> = {
  'gallery-shard-low': {
    id: 'gallery-shard-low',
    kind: 'shard',
    name: 'Bell Shard',
    description: 'A sliver of bronze, still warm.',
    amount: 10,
  },
  'gallery-shard-high': {
    id: 'gallery-shard-high',
    kind: 'shard',
    name: 'Bell Shard',
    description: 'A sliver of bronze, still warm.',
    amount: 15,
  },
  'gallery-quick-mend': {
    id: 'gallery-quick-mend',
    kind: 'charm',
    name: 'Quick Mend',
    description: 'A needle of pale bone. Healing answers sooner.',
    charm: 'quickMend',
  },
  'gallery-health-shard': {
    id: 'gallery-health-shard',
    kind: 'healthShard',
    name: 'Mask Shard',
    description: 'A fragment of a porcelain mask. Four make a whole.',
  },
  'ossuary-shard': {
    id: 'ossuary-shard',
    kind: 'shard',
    name: 'Bell Shard',
    description: 'A sliver of bronze, still warm.',
    amount: 20,
  },
  'ossuary-light-step': {
    id: 'ossuary-light-step',
    kind: 'charm',
    name: 'Light Step',
    description: 'A damp feather. The dash remembers how to return.',
    charm: 'lightStep',
  },
  'ossuary-health-shard': {
    id: 'ossuary-health-shard',
    kind: 'healthShard',
    name: 'Mask Shard',
    description: 'A fragment of a porcelain mask. Four make a whole.',
  },
  'aqueduct-wall-claw': {
    id: 'aqueduct-wall-claw',
    kind: 'ability',
    name: 'Wall Claw',
    description: 'A hooked relic. Cling to wet stone, then kick away.',
  },
  'aqueduct-hookline': {
    id: 'aqueduct-hookline',
    kind: 'ability',
    name: 'Hookline',
    description: 'A coil of bell wire. Throw it to a brass ring and let the belfry pull.',
  },
  'shaft-longline': {
    id: 'shaft-longline',
    kind: 'ability',
    name: 'Longline',
    description: 'A longer coil, wound by the Keeper. The line reaches what the eye can.',
  },
  'aqueduct-shard-low': {
    id: 'aqueduct-shard-low',
    kind: 'shard',
    name: 'Bell Shard',
    description: 'A sliver of bronze, still warm.',
    amount: 10,
  },
  'aqueduct-shard-high': {
    id: 'aqueduct-shard-high',
    kind: 'shard',
    name: 'Bell Shard',
    description: 'A sliver of bronze, still warm.',
    amount: 20,
  },
  'aqueduct-ember-greed': {
    id: 'aqueduct-ember-greed',
    kind: 'charm',
    name: 'Ember Greed',
    description: 'A coal that will not drown. Each hit feeds the Focus more.',
    charm: 'emberGreed',
  },
  'aqueduct-health-shard': {
    id: 'aqueduct-health-shard',
    kind: 'healthShard',
    name: 'Mask Shard',
    description: 'A fragment of a porcelain mask. Four make a whole.',
  },
  'bellows-shard-low': {
    id: 'bellows-shard-low',
    kind: 'shard',
    name: 'Bell Shard',
    description: 'A sliver of bronze, still warm.',
    amount: 15,
  },
  'bellows-shard-high': {
    id: 'bellows-shard-high',
    kind: 'shard',
    name: 'Bell Shard',
    description: 'A sliver of bronze, still warm.',
    amount: 20,
  },
  'shaft-shard': {
    id: 'shaft-shard',
    kind: 'shard',
    name: 'Bell Shard',
    description: 'A sliver of bronze, still warm.',
    amount: 25,
  },
  'upper-shard-low': {
    id: 'upper-shard-low',
    kind: 'shard',
    name: 'Bell Shard',
    description: 'A sliver of bronze, still warm.',
    amount: 15,
  },
  'upper-shard-high': {
    id: 'upper-shard-high',
    kind: 'shard',
    name: 'Bell Shard',
    description: 'A sliver of bronze, still warm.',
    amount: 25,
  },
  'reliquary-long-reach': {
    id: 'reliquary-long-reach',
    kind: 'charm',
    name: 'Long Reach',
    description: 'A stretched chain link. The nail answers farther.',
    charm: 'longReach',
  },
  'reliquary-shard': {
    id: 'reliquary-shard',
    kind: 'shard',
    name: 'Bell Shard',
    description: 'A sliver of bronze, still warm.',
    amount: 20,
  },
  'reliquary-health-shard': {
    id: 'reliquary-health-shard',
    kind: 'healthShard',
    name: 'Mask Shard',
    description: 'A fragment of a porcelain mask. Four make a whole.',
  },
  'reliquary-censer': {
    id: 'reliquary-censer',
    kind: 'ability',
    name: 'Censer',
    description: 'A brass vessel on a chain. A heavy, committed swing.',
  },
  'upper-toll': {
    id: 'upper-toll',
    kind: 'ability',
    name: 'Toll',
    description: 'A hand-bell that answers the belfry. Its ring carries far.',
  },
  'terrace-tideglass': {
    id: 'terrace-tideglass',
    kind: 'ability',
    name: 'Tideglass',
    description: 'A black wax tablet. The belfry’s rooms wait to be remembered.',
  },
  'bellthief-sturdy-shell': {
    id: 'bellthief-sturdy-shell',
    kind: 'charm',
    name: 'Sturdy Shell',
    description: 'The Thief’s shell. One blow is forgiven while you mend.',
    charm: 'sturdyShell',
    requiresSigil: 'bellThief',
  },
  'bellthief-tide-bell': {
    id: 'bellthief-tide-bell',
    kind: 'key',
    name: 'Tide-Bell',
    description: 'A bell that answers water. The sealed door above will know it.',
    requiresSigil: 'bellThief',
  },
};

export const PICKUP_IDS: readonly string[] = Object.keys(PICKUPS);

export function getPickup(id: string): PickupDef {
  const pickup = PICKUPS[id];
  if (!pickup) throw new BellwardError(`unknown pickup "${id}"`);
  return pickup;
}

export function isPickupId(id: string): boolean {
  return Object.hasOwn(PICKUPS, id);
}

/** Number of mask shards among the collected pickup ids. */
export function healthShardCount(ids: Iterable<string>): number {
  let count = 0;
  for (const id of ids) if (PICKUPS[id]?.kind === 'healthShard') count += 1;
  return count;
}

/** Every charm id must exist in the charm table and appear in exactly one pickup. */
for (const pickup of Object.values(PICKUPS)) {
  if (pickup.kind === 'shard' && !(Number.isInteger(pickup.amount) && (pickup.amount ?? 0) > 0)) {
    throw new BellwardError(`shard pickup "${pickup.id}" must grant a positive integer amount`);
  }
  if (pickup.kind === 'charm' && (!pickup.charm || !CHARMS[pickup.charm])) {
    throw new BellwardError(`charm pickup "${pickup.id}" has no valid charm`);
  }
  if (
    pickup.requiresSigil !== undefined &&
    !(BOSS_KINDS as readonly string[]).includes(pickup.requiresSigil)
  ) {
    throw new BellwardError(`pickup "${pickup.id}" requires an unknown sigil`);
  }
  if (pickup.kind !== 'shard' && pickup.amount !== undefined) {
    throw new BellwardError(`pickup "${pickup.id}" is not a shard but grants an amount`);
  }
}

for (const charmId of Object.keys(CHARMS)) {
  const grants = Object.values(PICKUPS).filter((pickup) => pickup.charm === charmId);
  if (grants.length !== 1) {
    throw new BellwardError(`charm "${charmId}" must be granted by exactly one pickup`);
  }
}
