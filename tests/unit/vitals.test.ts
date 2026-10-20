import { describe, expect, it } from 'vitest';
import { COMBAT } from '../../src/config/combat';
import { PlayerController } from '../../src/player/PlayerController';
import { PlayerVitals } from '../../src/player/PlayerVitals';

describe('PlayerVitals', () => {
  it('starts at the configured ceiling and accepts carried health', () => {
    const full = new PlayerVitals();
    expect(full.hp).toBe(COMBAT.player.maxHp);
    expect(full.maxHp).toBe(COMBAT.player.maxHp);

    const carried = new PlayerVitals(7, 3);
    expect(carried.hp).toBe(3);
    expect(carried.maxHp).toBe(7);

    expect(new PlayerVitals(7, 99).hp).toBe(7);
    expect(new PlayerVitals(7, -2).hp).toBe(1);
  });

  it('adds a sigil mask by raising the ceiling and filling the new mask', () => {
    const vitals = new PlayerVitals(5, 3);
    vitals.grantMaxHp(1);
    expect(vitals.maxHp).toBe(6);
    expect(vitals.hp).toBe(4);
    vitals.grantMaxHp(0);
    expect(vitals.maxHp).toBe(6);
    expect(vitals.hp).toBe(4);
  });

  it('rejects a non-positive ceiling instead of silently repairing developer data', () => {
    expect(() => new PlayerVitals(0)).toThrow(/positive integer/);
    expect(() => new PlayerVitals(-1)).toThrow(/positive integer/);
    expect(() => new PlayerVitals(4.5)).toThrow(/positive integer/);
  });

  it('carries the reward through the controller', () => {
    const player = new PlayerController({ x: 80, y: 128 }, { maxHp: 5, hp: 2 });
    expect(player.maxHp).toBe(5);
    expect(player.hp).toBe(2);
    player.grantMaxHp(1);
    expect(player.maxHp).toBe(6);
    expect(player.hp).toBe(3);
  });
});
