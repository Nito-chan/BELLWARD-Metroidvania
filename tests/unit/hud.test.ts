import { describe, expect, it } from 'vitest';
import { arsenalReadout, bossHudSubtitle, type BossHudInfo } from '../../src/ui/hudModel';

const base: BossHudInfo = {
  name: 'The Last Keeper',
  hp: 40,
  maxHp: 40,
  phaseIndex: 1,
  phaseCount: 3,
  phaseName: 'The Drowning Toll',
  warded: false,
  posture: 160,
  maxPosture: 160,
  postureBroken: false,
  alive: true,
  lastKeeper: {
    chainCount: 1,
    chainOpen: true,
    answerCount: 0,
    answerWindow: false,
    ritualActive: false,
  },
};

describe('arsenal plaque model', () => {
  it('keeps the four slots in Nail, Hookline, Censer, Toll order', () => {
    const slots = arsenalReadout('nail', true, true, true);
    expect(slots.map((slot) => slot.label)).toEqual(['Nail', 'Hookline', 'Censer', 'Toll']);
    expect(slots.map((slot) => slot.owned)).toEqual([true, true, true, true]);
    expect(slots.map((slot) => slot.active)).toEqual([true, false, false, false]);
  });

  it('marks only the owned attack weapons and keeps the Hookline inactive', () => {
    const slots = arsenalReadout('toll', false, true, false);
    expect(slots.find((slot) => slot.id === 'toll')).toMatchObject({
      owned: true,
      active: true,
    });
    expect(slots.find((slot) => slot.id === 'censer')?.owned).toBe(false);
    expect(slots.find((slot) => slot.id === 'hookline')?.owned).toBe(false);
    expect(slots.filter((slot) => slot.active)).toHaveLength(1);
  });
});

describe('boss HUD readout', () => {
  it('names the chain count and open Censer window in phase two', () => {
    expect(bossHudSubtitle(base)).toBe('The Drowning Toll  ·  CHAINS 1 / 3  ·  CHAIN OPEN');
  });

  it('seals phase three behind ANSWERS and INVULNERABLE', () => {
    expect(
      bossHudSubtitle({
        ...base,
        phaseIndex: 2,
        phaseName: 'The Answer',
        lastKeeper: {
          chainCount: 3,
          chainOpen: false,
          answerCount: 1,
          answerWindow: true,
          ritualActive: true,
        },
      }),
    ).toBe('The Answer  ·  ANSWERS 1 / 3  ·  INVULNERABLE  ·  RING NOW');
  });

  it('keeps the ordinary warded phase and felled copy', () => {
    expect(
      bossHudSubtitle({
        ...base,
        phaseIndex: 0,
        phaseName: 'The Vigil',
        warded: true,
        lastKeeper: undefined,
      }),
    ).toBe('The Vigil  ·  WARDED');
    expect(bossHudSubtitle({ ...base, alive: false })).toBe('A bell-sigil remains');
  });
});
