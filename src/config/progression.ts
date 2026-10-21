/**
 * Progression tuning: charms, nail upgrades and the Ordeal. These are the only numbers
 * the equipment, combat and boss-variant systems read; content IDs live with the pickup
 * registry so save validation and room data share one vocabulary.
 */
export type CharmId = 'quickMend' | 'longReach' | 'lightStep' | 'emberGreed' | 'sturdyShell';

export type CharmDef = {
  readonly id: CharmId;
  readonly name: string;
  readonly description: string;
  /** Notches occupied in the three-slot charm belt. */
  readonly cost: number;
};

export const CHARM_SLOTS = 3;

export const CHARMS: Readonly<Record<CharmId, CharmDef>> = {
  quickMend: {
    id: 'quickMend',
    name: 'Quick Mend',
    description: 'A held heal completes in two-thirds of the usual time.',
    cost: 1,
  },
  longReach: {
    id: 'longReach',
    name: 'Long Reach',
    description: 'The nail reaches a third farther.',
    cost: 1,
  },
  lightStep: {
    id: 'lightStep',
    name: 'Light Step',
    description: 'The dash recovers in half the usual time.',
    cost: 1,
  },
  emberGreed: {
    id: 'emberGreed',
    name: 'Ember Greed',
    description: 'Each nail hit gathers half again as much Focus.',
    cost: 1,
  },
  sturdyShell: {
    id: 'sturdyShell',
    name: 'Sturdy Shell',
    description: 'While healing, the next hit is absorbed instead of interrupting you.',
    cost: 1,
  },
};

export const CHARM_ORDER: readonly CharmId[] = [
  'quickMend',
  'longReach',
  'lightStep',
  'emberGreed',
  'sturdyShell',
];

/** Nail upgrades bought at a bench. Level 0 is the starting nail. */
export const NAIL = {
  maxLevel: 2,
  /** Cost in shards to reach level 1 and level 2, in order. */
  costs: [30, 60] as const,
  /** Extra damage per upgrade level. */
  damagePerLevel: 1,
  /** Extra horizontal reach per upgrade level, pixels. */
  reachPerLevel: 4,
} as const;

/** The Ordeal: a claimed arena can be relit for a harder, optional rematch. */
export const ORDEAL = {
  /** Extra maximum health multiplier on top of the base boss pool. */
  hpScale: 1.35,
  /** Wind-up and recovery are shortened by this fraction, so telegraphs stay readable. */
  tempoScale: 0.85,
  /** Reward for a first Ordeal clear. */
  shardReward: 40,
} as const;
