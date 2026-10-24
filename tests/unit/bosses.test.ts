import { describe, expect, it } from 'vitest';
import { BOSSES, BOSS_PATTERNS, BOSS_PATTERN_IDS } from '../../src/config/bosses';
import { BOSS_FAIRNESS, type BossPatternDef, type BossPhaseDef } from '../../src/config/bossTypes';
import { BOSS_KINDS, ENEMIES, type BossKind } from '../../src/config/enemies';
import type { ProjectileSpawnOptions } from '../../src/combat/ProjectilePool';
import { Boss } from '../../src/enemies/Boss';
import type { EnemyContext } from '../../src/enemies/Enemy';
import { chooseBossPattern } from '../../src/enemies/patternChoice';
import { Rng } from '../../src/core/Rng';
import { Tilemap } from '../../src/world/Tilemap';

const WIDTH = 60;
const OPEN = ' '.repeat(WIDTH);
const FLOOR = 'F'.repeat(WIDTH);
const FILL = 'f'.repeat(WIDTH);
const LEGEND = { F: 'floor', f: 'floorFill', '#': 'wall' } as const;
const GROUND = Tilemap.fromRows([...Array.from({ length: 8 }, () => OPEN), FLOOR, FILL], LEGEND);
const WALLED = Tilemap.fromRows(
  [...Array.from({ length: 8 }, () => `#${' '.repeat(WIDTH - 1)}`), FLOOR, FILL],
  LEGEND,
);
const ARENA = { x: 0, y: 0, w: 960, h: 160 };
const FEET_Y = 128;

type Shot = {
  x: number;
  y: number;
  dirX: number;
  dirY: number;
  speed: number;
  damage: number;
  lifeTicks: number;
  options?: ProjectileSpawnOptions;
};

function context(tilemap: Tilemap, playerX = 700, shots: Shot[] = []): EnemyContext {
  return {
    tilemap,
    player: { feet: { x: playerX, y: FEET_Y }, dead: false },
    arena: ARENA,
    castProjectile: (x, y, dirX, dirY, speed, damage, lifeTicks, options) => {
      shots.push({ x, y, dirX, dirY, speed, damage, lifeTicks, options });
    },
  };
}

function step(boss: Boss, ctx: EnemyContext, ticks: number): void {
  for (let i = 0; i < ticks; i += 1) boss.update(ctx);
}

function makeBoss(
  kind: BossKind,
  options: { x?: number; facing?: -1 | 1; seed?: number } = {},
): Boss {
  return new Boss(
    kind,
    {
      kind,
      x: options.x ?? 800,
      y: FEET_Y,
      facing: options.facing ?? -1,
      ...(kind === 'lastKeeper'
        ? {
            chainTargets: [
              { x: 240, y: 172 },
              { x: 480, y: 172 },
              { x: 720, y: 172 },
            ],
            greatBell: { x: 480, y: 148 },
          }
        : {}),
    },
    new Rng(options.seed ?? 7),
  );
}

function phaseFor(patterns: string[]): BossPhaseDef {
  return {
    id: 'test',
    name: 'Test',
    threshold: 1,
    patterns,
    idleTicks: [BOSS_FAIRNESS.minIdleTicks, BOSS_FAIRNESS.maxIdleTicks],
    transitionTicks: 20,
    speedScale: 1,
  };
}

function pattern(id: string, overrides: Partial<BossPatternDef> = {}): BossPatternDef {
  return {
    id,
    kind: 'sweep',
    weight: 1,
    telegraphTicks: BOSS_FAIRNESS.minTelegraphTicks,
    activeTicks: 8,
    recoverTicks: 8,
    cooldownTicks: 0,
    damage: 1,
    tellSfx: 'bossCast',
    ...overrides,
  };
}

function patternOwner(id: string): BossKind {
  if (id.startsWith('bearer.')) return 'bellbearer';
  if (id.startsWith('warden.')) return 'wardenMoss';
  return 'bellThief';
}

describe('boss content', () => {
  it('defines exactly the declared boss kinds', () => {
    expect(Object.keys(BOSSES).sort()).toEqual([...BOSS_KINDS].sort());
    for (const kind of BOSS_KINDS) {
      const def = BOSSES[kind];
      expect(def.kind).toBe(kind);
      expect(def.phases.length).toBeGreaterThanOrEqual(2);
      expect(def.rewardName.length).toBeGreaterThan(0);
      expect(ENEMIES[kind].displayName.length).toBeGreaterThan(0);
    }
  });

  it('keeps phase thresholds descending and every phase transition safe', () => {
    for (const kind of BOSS_KINDS) {
      const phases = BOSSES[kind].phases;
      expect(phases[0]?.threshold).toBe(1);
      for (let i = 1; i < phases.length; i += 1) {
        const previous = phases[i - 1];
        const phase = phases[i];
        if (!previous || !phase) throw new Error('phase table has a hole');
        expect(phase.threshold).toBeLessThan(previous.threshold);
        expect(phase.threshold).toBeGreaterThanOrEqual(0);
        // The last phase of a mechanic-driven boss (mode: 'lastKeeper') is entered
        // by chains/ritual, not by health, so its transition can be instant.
        const isLastPhase = i === phases.length - 1;
        if (isLastPhase) {
          expect(phase.transitionTicks).toBeGreaterThanOrEqual(0);
        } else {
          expect(phase.transitionTicks).toBeGreaterThan(0);
        }
      }
      for (const [index, phase] of phases.entries()) {
        // The last phase of a mechanic-driven boss (mode: 'lastKeeper') has no
        // authored patterns; its chains/answers are handled by room-side logic.
        const isLastKeeperFinal = BOSSES[kind].mode === 'lastKeeper' && index === phases.length - 1;
        if (!isLastKeeperFinal) expect(phase.patterns.length).toBeGreaterThan(0);
        expect(phase.speedScale).toBeGreaterThan(0);
        // The Last Keeper's final answer phase has no idle/pause cadence; it
        // waits on player action instead.
        if (!isLastKeeperFinal) {
          expect(phase.idleTicks[0]).toBeGreaterThanOrEqual(BOSS_FAIRNESS.minIdleTicks);
          expect(phase.idleTicks[1]).toBeLessThanOrEqual(BOSS_FAIRNESS.maxIdleTicks);
          expect(phase.idleTicks[0]).toBeLessThanOrEqual(phase.idleTicks[1]);
        }
        if (index === 0) expect(phase.transitionTicks).toBe(0);
      }
    }
  });

  it('references only known patterns with fair telegraphs and positive weights', () => {
    for (const kind of BOSS_KINDS) {
      for (const phase of BOSSES[kind].phases) {
        const seen = new Set<string>();
        for (const id of phase.patterns) {
          expect(BOSS_PATTERNS[id], `${kind}/${phase.id}: ${id}`).toBeDefined();
          expect(seen.has(id)).toBe(false);
          seen.add(id);
          const pattern = BOSS_PATTERNS[id];
          if (!pattern) continue;
          expect(pattern.id).toBe(id);
          expect(pattern.weight).toBeGreaterThan(0);
          expect(pattern.telegraphTicks).toBeGreaterThanOrEqual(BOSS_FAIRNESS.minTelegraphTicks);
          expect(pattern.activeTicks).toBeGreaterThan(0);
          expect(pattern.recoverTicks).toBeGreaterThanOrEqual(0);
          expect(pattern.cooldownTicks).toBeGreaterThanOrEqual(0);
          expect(pattern.damage).toBeGreaterThan(0);
          if (pattern.kind === 'charge' || pattern.kind === 'dash' || pattern.kind === 'sweep') {
            expect(pattern.box, `${id} must have a hitbox`).toBeDefined();
          }
        }
      }
    }
    expect(BOSS_PATTERN_IDS.length).toBe(new Set(BOSS_PATTERN_IDS).size);
  });

  it('gives every arena boss a known body, music and reward path', () => {
    for (const kind of BOSS_KINDS) {
      expect(ENEMIES[kind].body.w).toBeGreaterThan(0);
      expect(ENEMIES[kind].body.h).toBeGreaterThan(0);
      expect(BOSSES[kind].introTicks).toBeGreaterThan(0);
      expect(BOSSES[kind].deathFadeTicks).toBeGreaterThan(0);
      expect(BOSSES[kind].rewardName).toMatch(/Sigil/);
    }
    expect(BOSSES.bellbearer.gate).toBe('bellShield');
    expect(BOSS_FAIRNESS.wardBreakRadius).toBeGreaterThan(0);
    expect(BOSS_FAIRNESS.wardBreakRadius).toBeLessThan(200);
  });
});

describe('chooseBossPattern', () => {
  const patterns = {
    a: pattern('a'),
    b: pattern('b', { weight: 2 }),
  };

  it('filters cooldowns and then avoids the previous pattern', () => {
    const rng = new Rng(42);
    const selected = chooseBossPattern(
      phaseFor(['a', 'b']),
      patterns,
      rng,
      100,
      new Map([['a', 100]]),
      0,
      null,
    );
    expect(selected.id).toBe('b');

    const varied = chooseBossPattern(
      phaseFor(['a', 'b']),
      patterns,
      new Rng(42),
      100,
      new Map(),
      0,
      'a',
    );
    expect(varied.id).toBe('b');
  });

  it('applies distance filters and falls back to ready patterns', () => {
    const ranged = {
      close: pattern('close', { maxRange: 100 }),
      far: pattern('far', { minRange: 101 }),
    };
    expect(
      chooseBossPattern(phaseFor(['close', 'far']), ranged, new Rng(1), 50, new Map(), 0, null).id,
    ).toBe('close');
    expect(
      chooseBossPattern(phaseFor(['close', 'far']), ranged, new Rng(1), 150, new Map(), 0, null).id,
    ).toBe('far');

    const allCooling = chooseBossPattern(
      phaseFor(['a', 'b']),
      patterns,
      new Rng(1),
      100,
      new Map([
        ['a', 100],
        ['b', 100],
      ]),
      0,
      null,
    );
    expect(['a', 'b']).toContain(allCooling.id);
  });

  it('is deterministic for the same seed and throws on bad content', () => {
    const run = (): string[] => {
      const rng = new Rng(1234);
      let last: string | null = null;
      const ids: string[] = [];
      for (let tick = 0; tick < 12; tick += 1) {
        const selected = chooseBossPattern(
          phaseFor(['a', 'b']),
          patterns,
          rng,
          100,
          new Map(),
          tick,
          last,
        );
        ids.push(selected.id);
        last = selected.id;
      }
      return ids;
    };
    expect(run()).toEqual(run());
    expect(() =>
      chooseBossPattern(phaseFor(['missing']), patterns, new Rng(1), 0, new Map(), 0, null),
    ).toThrow(/unknown pattern/);
  });
});

describe('Boss FSM', () => {
  it('stays invulnerable through the intro, then enters idle', () => {
    const boss = makeBoss('bellbearer');
    const ctx = context(GROUND);
    expect(boss.state).toBe('intro');
    expect(boss.damageBlocked).toBe(true);
    expect(boss.takeDamage(1, 0)).toBe(false);
    expect(boss.hp).toBe(ENEMIES.bellbearer.hp);

    step(boss, ctx, BOSSES.bellbearer.introTicks + 1);
    expect(boss.state).toBe('idle');
    // The intro lock is gone, but the bell shield still guards every hit.
    expect(boss.warded).toBe(true);
    expect(boss.damageBlocked).toBe(true);
  });

  it('breaks the bell shield into phase two and becomes damageable', () => {
    const boss = makeBoss('bellbearer');
    expect(boss.warded).toBe(true);
    expect(boss.forceBreakWard()).toBe(true);
    expect(boss.forceBreakWard()).toBe(false);
    expect(boss.warded).toBe(false);
    expect(boss.phaseIndex).toBe(1);
    expect(boss.state).toBe('stagger');
    expect(boss.consumeEvents().map((event) => event.type)).toEqual(
      expect.arrayContaining(['wardBreak', 'phase']),
    );

    expect(boss.takeDamage(2, 0)).toBe(true);
    expect(boss.hp).toBe(ENEMIES.bellbearer.hp - 2);
  });

  it('breaks the shield on a wall charge only when the player baited it there', () => {
    const boss = makeBoss('bellbearer', { x: 80, facing: -1 });
    const ctx = context(WALLED, 80);
    boss.debugForcePattern('bearer.charge');
    step(boss, ctx, 80);
    expect(boss.warded).toBe(false);
    expect(boss.phaseIndex).toBe(1);
    expect(boss.consumeEvents().some((event) => event.type === 'wardBreak')).toBe(true);

    // The same charge into the same wall must not solve the gate if the player is far
    // away on the opposite side of the arena.
    const farBoss = makeBoss('bellbearer', { x: 80, facing: -1, seed: 9 });
    const farCtx = context(WALLED, 700);
    farBoss.debugForcePattern('bearer.charge');
    step(farBoss, farCtx, 80);
    expect(farBoss.warded).toBe(true);
    expect(farBoss.phaseIndex).toBe(0);
  });

  it('stuns Warden Moss on a dash into a wall and emits the impact', () => {
    const boss = makeBoss('wardenMoss', { x: 80, facing: -1 });
    const ctx = context(WALLED, 700);
    boss.debugForcePattern('warden.dash');
    step(boss, ctx, (BOSS_PATTERNS['warden.dash']?.telegraphTicks ?? 0) + 20);
    expect(boss.state).toBe('stagger');
    expect(boss.consumeEvents().some((event) => event.type === 'wallHit')).toBe(true);
  });

  it('opens the authored hitbox only during the active window', () => {
    const boss = makeBoss('bellbearer');
    const ctx = context(GROUND);
    boss.debugForcePattern('bearer.sweep');
    expect(boss.attackHitbox()).toBeNull();
    step(boss, ctx, BOSS_PATTERNS['bearer.sweep']?.telegraphTicks ?? 0);
    expect(boss.state).toBe('active');
    expect(boss.attackHitbox()).not.toBeNull();
    expect(boss.attackDamage).toBe(BOSS_PATTERNS['bearer.sweep']?.damage);
    step(boss, ctx, (BOSS_PATTERNS['bearer.sweep']?.activeTicks ?? 0) + 1);
    expect(boss.attackHitbox()).toBeNull();
    expect(boss.attackDamage).toBe(0);
  });

  it('runs every authored pattern without throwing and always emits a tell', () => {
    for (const id of BOSS_PATTERN_IDS) {
      const def = BOSS_PATTERNS[id];
      if (!def) continue;
      const boss = makeBoss(patternOwner(id));
      const shots: Shot[] = [];
      const ctx = context(GROUND, 640, shots);
      boss.debugForcePattern(id);
      expect(boss.pattern?.id).toBe(id);
      step(boss, ctx, def.telegraphTicks + def.activeTicks + def.recoverTicks + 2);
      expect(
        boss.consumeEvents().some((event) => event.type === 'tell' && event.patternId === id),
        id,
      ).toBe(true);
    }
  });

  it('fires the authored volley sizes, styles and shockwave directions', () => {
    const ringBoss = makeBoss('bellbearer');
    const ringShots: Shot[] = [];
    const ringCtx = context(GROUND, 640, ringShots);
    ringBoss.debugForcePattern('bearer.ring');
    step(ringBoss, ringCtx, BOSS_PATTERNS['bearer.ring']?.telegraphTicks ?? 0);
    expect(ringShots).toHaveLength(8);
    expect(ringShots.every((shot) => shot.options?.style === 'bell')).toBe(true);

    const fanBoss = makeBoss('bellThief');
    const fanShots: Shot[] = [];
    const fanCtx = context(GROUND, 640, fanShots);
    fanBoss.debugForcePattern('thief.fan');
    step(fanBoss, fanCtx, BOSS_PATTERNS['thief.fan']?.telegraphTicks ?? 0);
    expect(fanShots).toHaveLength(3);
    expect(fanShots.every((shot) => shot.options?.style === 'coin')).toBe(true);

    const slamBoss = makeBoss('wardenMoss');
    const slamShots: Shot[] = [];
    const slamCtx = context(GROUND, 640, slamShots);
    slamBoss.debugForcePattern('warden.slam');
    step(slamBoss, slamCtx, BOSS_PATTERNS['warden.slam']?.telegraphTicks ?? 0);
    expect(slamShots).toHaveLength(2);
    expect(slamShots.map((shot) => Math.sign(shot.dirX)).sort()).toEqual([-1, 1]);
    expect(slamShots.every((shot) => shot.options?.style === 'wave')).toBe(true);
  });

  it('schedules rain volleys and applies arena-clamped spawn points', () => {
    const boss = makeBoss('wardenMoss');
    const shots: Shot[] = [];
    const ctx = context(GROUND, 640, shots);
    boss.debugForcePattern('warden.rain');
    step(boss, ctx, 34);
    expect(shots).toHaveLength(1);
    step(boss, ctx, 9);
    expect(shots).toHaveLength(2);
    for (const shot of shots) {
      expect(shot.x).toBeGreaterThanOrEqual(24);
      expect(shot.x).toBeLessThanOrEqual(936);
      expect(shot.y).toBe(16);
      expect(shot.dirY).toBe(1);
      expect(shot.options?.style).toBe('spore');
      expect(shot.options?.gravity).toBe(220);
    }
    step(boss, ctx, 70);
    expect(shots).toHaveLength(BOSS_PATTERNS['warden.rain']?.shots ?? 0);
  });

  it('hides the thief during the teleport wind-up and reappears behind the player', () => {
    const boss = makeBoss('bellThief', { x: 400, facing: 1, seed: 2 });
    const ctx = context(GROUND, 500);
    boss.debugForcePattern('thief.teleport');
    step(boss, ctx, 20);
    expect(boss.hidden).toBe(true);
    expect(boss.targetable).toBe(false);
    expect(boss.contactHazard).toBe(false);
    step(boss, ctx, 10);
    expect(boss.hidden).toBe(false);
    expect(boss.feet.x).toBeGreaterThan(ctx.player.feet.x);
  });

  it('walks Warden Moss through its phase transition and back into idle', () => {
    const boss = makeBoss('wardenMoss');
    const ctx = context(GROUND);
    step(boss, ctx, BOSSES.wardenMoss.introTicks + 1);
    expect(boss.takeDamage(8, 0)).toBe(true);
    expect(boss.phaseIndex).toBe(0);
    expect(boss.takeDamage(5, 0)).toBe(true);
    expect(boss.hp).toBe(13);
    expect(boss.phaseIndex).toBe(1);
    expect(boss.phase.name).toBe('The Overgrowth');
    expect(boss.state).toBe('phase');
    expect(boss.damageBlocked).toBe(true);
    expect(boss.takeDamage(1, 0)).toBe(false);
    step(boss, ctx, (BOSSES.wardenMoss.phases[1]?.transitionTicks ?? 0) + 1);
    expect(boss.state).toBe('idle');
    expect(boss.damageBlocked).toBe(false);
  });

  it('walks the Bell Thief through both phase thresholds', () => {
    const boss = makeBoss('bellThief');
    const ctx = context(GROUND);
    step(boss, ctx, BOSSES.bellThief.introTicks + 1);
    expect(boss.takeDamage(14, 0)).toBe(true);
    expect(boss.phaseIndex).toBe(1);
    step(boss, ctx, (BOSSES.bellThief.phases[1]?.transitionTicks ?? 0) + 1);
    expect(boss.state).toBe('idle');
    expect(boss.takeDamage(10, 0)).toBe(true);
    expect(boss.hp).toBe(8);
    expect(boss.phaseIndex).toBe(1);
    expect(boss.takeDamage(1, 0)).toBe(true);
    expect(boss.hp).toBe(7);
    expect(boss.phaseIndex).toBe(2);
    expect(boss.phase.name).toBe('The Last Silence');
  });

  it('emits exactly one defeat event and then only advances the death clock', () => {
    const boss = makeBoss('wardenMoss');
    const ctx = context(GROUND);
    boss.debugDefeat();
    expect(boss.alive).toBe(false);
    expect(boss.state).toBe('dead');
    expect(boss.consumeEvents().map((event) => event.type)).toEqual(['defeated']);
    expect(boss.takeDamage(1, 0)).toBe(false);
    boss.update(ctx);
    boss.update(ctx);
    expect(boss.deathElapsed).toBe(2);
    expect(boss.consumeEvents()).toHaveLength(0);
  });

  describe('Last Keeper', () => {
    /**
     * Drop the Keeper to phase 2 without spinning in its invulnerable transition.
     * `takeDamage` is intentionally blocked while the FSM owns the hero in `phase`,
     * so the final point of damage must wait for the transition to finish.
     */
    function enterDrowningToll(boss: Boss, ctx: ReturnType<typeof context>): void {
      while (boss.hp > 24) boss.takeDamage(1, 0);
      expect(boss.phaseIndex).toBe(1);
      step(boss, ctx, (BOSSES.lastKeeper.phases[1]?.transitionTicks ?? 0) + 1);
      boss.takeDamage(1, 0);
      expect(boss.hp).toBe(23);
    }

    function breakAllChains(boss: Boss): void {
      for (let chain = 0; chain < 3; chain += 1) {
        const target = boss.chainTargets[chain]!;
        boss.tollAt(target.x, target.y, 100 + chain);
        expect(boss.chainOpen).toBe(true);
        boss.censerAt(target.x, target.y);
        expect(boss.chainOpen).toBe(false);
        expect(boss.chainCount).toBe(chain + 1);
      }
    }

    function enterAnswer(boss: Boss, ctx: ReturnType<typeof context>): void {
      enterDrowningToll(boss, ctx);
      breakAllChains(boss);
      expect(boss.phaseIndex).toBe(2);
      expect(boss.state).toBe('phase');
      step(boss, ctx, BOSSES.lastKeeper.phases[2]?.transitionTicks ?? 0);
      expect(boss.state).toBe('ritual');
      expect(boss.ritualSolved).toBe(false);
    }

    it('gates phase 2 health at 1', () => {
      const boss = makeBoss('lastKeeper');
      const ctx = context(GROUND);
      step(boss, ctx, BOSSES.lastKeeper.introTicks + 1);
      expect(boss.phaseIndex).toBe(0);
      expect(boss.phase.name).toBe('The Vigil');

      // Bring hp below the phase 2 threshold (24). Phase 2 gates health at 1.
      while (boss.phaseIndex === 0 && boss.hp > 0) boss.takeDamage(1, 0);
      expect(boss.phaseIndex).toBe(1);
      expect(boss.hp).toBe(24);

      step(boss, ctx, (BOSSES.lastKeeper.phases[1]?.transitionTicks ?? 0) + 1);
      boss.takeDamage(1, 0);
      expect(boss.hp).toBe(23);
    });

    it('toll opens a chain window and censer breaks it', () => {
      const boss = makeBoss('lastKeeper');
      const ctx = context(GROUND);
      step(boss, ctx, BOSSES.lastKeeper.introTicks + 1);

      enterDrowningToll(boss, ctx);
      expect(boss.phaseIndex).toBe(1);
      expect(boss.phase.name).toBe('The Drowning Toll');
      expect(boss.chainCount).toBe(0);
      expect(boss.chainOpen).toBe(false);

      // Toll at chain 0 opens the window
      const chain0 = boss.chainTargets[0]!;
      boss.tollAt(chain0.x, chain0.y, 1);
      expect(boss.chainOpen).toBe(true);

      // Censer at chain 0 breaks it
      boss.censerAt(chain0.x, chain0.y);
      expect(boss.chainOpen).toBe(false);
      expect(boss.chainCount).toBe(1);
      expect(boss.waterLevel).toBe(1);
    });

    it('censer cannot break a chain that is not open', () => {
      const boss = makeBoss('lastKeeper');
      const ctx = context(GROUND);
      step(boss, ctx, BOSSES.lastKeeper.introTicks + 1);

      enterDrowningToll(boss, ctx);
      expect(boss.phaseIndex).toBe(1);

      const chain0 = boss.chainTargets[0]!;
      boss.censerAt(chain0.x, chain0.y);
      expect(boss.chainCount).toBe(0);
      expect(boss.chainOpen).toBe(false);
    });

    it('three chain breaks enter phase 3', () => {
      const boss = makeBoss('lastKeeper');
      const ctx = context(GROUND);
      step(boss, ctx, BOSSES.lastKeeper.introTicks + 1);

      enterDrowningToll(boss, ctx);
      expect(boss.phaseIndex).toBe(1);

      breakAllChains(boss);

      expect(boss.phaseIndex).toBe(2);
      expect(boss.phase.name).toBe('The Answer');
      expect(boss.state).toBe('phase');
      expect(boss.ritualSolved).toBe(false);
    });

    it('settles into a terminal ritual without patterns and seals health and posture', () => {
      const boss = makeBoss('lastKeeper');
      const ctx = context(GROUND);
      step(boss, ctx, BOSSES.lastKeeper.introTicks + 1);

      enterAnswer(boss, ctx);
      const hp = boss.hp;
      const posture = boss.posture;
      expect(boss.pattern).toBeNull();

      expect(boss.takeDamage(5, 0)).toBe(false);
      expect(boss.hp).toBe(hp);
      expect(boss.takePostureDamage(999, 0)).toBe('none');
      expect(boss.applyPosture(999)).toBe('none');
      expect(boss.posture).toBe(posture);

      // Long enough for several rings: the FSM must stay in the ritual, not choose a
      // pattern from an empty phase and crash.
      step(boss, ctx, 180);
      expect(boss.state).toBe('ritual');
      expect(boss.phaseIndex).toBe(2);
      expect(boss.pattern).toBeNull();
      expect(boss.hp).toBe(hp);
    });

    it('toll answers open windows in phase 3, three answers solve the ritual', () => {
      const boss = makeBoss('lastKeeper');
      const ctx = context(GROUND);
      step(boss, ctx, BOSSES.lastKeeper.introTicks + 1);

      enterAnswer(boss, ctx);
      expect(boss.answerCount).toBe(0);
      expect(boss.answerWindow).toBe(false);

      // Force answer windows open (simulates boss ringing) and answer them with one
      // distinct wave each.
      boss.debugForceAnswerWindow();
      const bell = boss.greatBell!;
      boss.tollAt(bell.x, bell.y, 1);
      expect(boss.answerCount).toBe(1);
      expect(boss.answerWindow).toBe(false);

      // Open two more windows and answer them
      boss.debugForceAnswerWindow();
      boss.tollAt(bell.x, bell.y, 2);
      expect(boss.answerCount).toBe(2);

      boss.debugForceAnswerWindow();
      boss.tollAt(bell.x, bell.y, 3);
      expect(boss.answerCount).toBe(3);
      expect(boss.ritualSolved).toBe(true);
      expect(boss.alive).toBe(false);
    });

    it('never opens answer windows during the phase transition', () => {
      const boss = makeBoss('lastKeeper');
      const ctx = context(GROUND);
      step(boss, ctx, BOSSES.lastKeeper.introTicks + 1);

      enterDrowningToll(boss, ctx);
      breakAllChains(boss);
      expect(boss.phaseIndex).toBe(2);
      expect(boss.state).toBe('phase');

      step(boss, ctx, (BOSSES.lastKeeper.phases[2]?.transitionTicks ?? 0) - 1);
      expect(boss.state).toBe('phase');
      expect(boss.answerWindow).toBe(false);
      boss.tollAt(boss.greatBell!.x, boss.greatBell!.y, 1);
      expect(boss.answerCount).toBe(0);

      step(boss, ctx, 1);
      expect(boss.state).toBe('ritual');
      expect(boss.answerWindow).toBe(false);
    });

    it('one Toll wave answers at most one note', () => {
      const boss = makeBoss('lastKeeper');
      const ctx = context(GROUND);
      step(boss, ctx, BOSSES.lastKeeper.introTicks + 1);
      enterAnswer(boss, ctx);

      const bell = boss.greatBell!;
      boss.debugForceAnswerWindow();
      boss.tollAt(bell.x, bell.y, 7);
      expect(boss.answerCount).toBe(1);
      expect(boss.answerWindow).toBe(false);

      // The same wave is still alive and in the bell radius when the next note opens.
      boss.debugForceAnswerWindow();
      boss.tollAt(bell.x, bell.y, 7);
      expect(boss.answerCount).toBe(1);
      expect(boss.answerWindow).toBe(true);

      // A new wave can answer it.
      boss.tollAt(bell.x, bell.y, 8);
      expect(boss.answerCount).toBe(2);
      expect(boss.answerWindow).toBe(false);
    });

    it('runs kneel, ring, window, then a miss that resets the note and sends a shockwave', () => {
      const boss = makeBoss('lastKeeper');
      const ctx = context(GROUND);
      step(boss, ctx, BOSSES.lastKeeper.introTicks + 1);
      enterAnswer(boss, ctx);

      expect(boss.ritualStage).toBe('kneel');
      step(boss, ctx, boss.ritualStageTicks);
      expect(boss.ritualStage).toBe('ring');
      step(boss, ctx, boss.ritualStageTicks);
      expect(boss.ritualStage).toBe('window');
      const windowTicks = boss.answerWindowTicks;
      expect(windowTicks).toBeGreaterThan(0);

      // Let the window close unanswered.
      step(boss, ctx, windowTicks);
      expect(boss.answerCount).toBe(0);
      expect(boss.answerWindow).toBe(false);
      expect(boss.ritualStage).toBe('recover');
      expect(boss.shockwaveStage).toBe('telegraph');
      expect(boss.shockwaveBox).not.toBeNull();

      // The telegraph becomes a real, active hazard with its own identity.
      step(boss, ctx, boss.shockwaveTiming.telegraphTicks);
      expect(boss.shockwaveStage).toBe('active');
      const hazard = boss.activeHazard();
      expect(hazard).not.toBeNull();
      expect(hazard?.unblockable).toBe(true);
      expect(hazard?.box).toEqual(boss.shockwaveBox);
      expect(hazard?.damage).toBe(1);

      // It closes after its active lifetime.
      step(boss, ctx, boss.shockwaveTiming.activeTicks + 1);
      expect(boss.shockwaveStage).toBe('none');
      expect(boss.activeHazard()).toBeNull();
    });

    it('censer in phase 1 does nothing to chains', () => {
      const boss = makeBoss('lastKeeper');
      const ctx = context(GROUND);
      step(boss, ctx, BOSSES.lastKeeper.introTicks + 1);

      const chain0 = boss.chainTargets[0]!;
      boss.censerAt(chain0.x, chain0.y);
      expect(boss.chainCount).toBe(0);
      expect(boss.chainOpen).toBe(false);
    });
  });
});
