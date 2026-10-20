import type { BossPhaseDef, BossPatternDef } from '../config/bossTypes';
import { BellwardError } from '../core/Errors';
import type { Rng } from '../core/Rng';

/**
 * Deterministic weighted pattern choice. Cooldowns and distance filters are applied
 * before the roll; the previous pattern is avoided unless it is the only option. Keeping
 * this pure makes phase pacing testable without a running scene.
 */
export function chooseBossPattern(
  phase: BossPhaseDef,
  patterns: Readonly<Record<string, BossPatternDef>>,
  rng: Rng,
  distance: number,
  cooldownUntil: ReadonlyMap<string, number>,
  tick: number,
  lastPatternId: string | null,
): BossPatternDef {
  const all = phase.patterns.map((id) => {
    const pattern = patterns[id];
    if (!pattern) {
      throw new BellwardError(`boss phase "${phase.id}" references unknown pattern "${id}"`);
    }
    return pattern;
  });

  const ready = all.filter((pattern) => (cooldownUntil.get(pattern.id) ?? 0) <= tick);
  const inRange = ready.filter(
    (pattern) =>
      (pattern.minRange === undefined || distance >= pattern.minRange) &&
      (pattern.maxRange === undefined || distance <= pattern.maxRange),
  );
  const pool = inRange.length > 0 ? inRange : ready.length > 0 ? ready : all;
  const varied = pool.filter((pattern) => pattern.id !== lastPatternId);
  const candidates = varied.length > 0 ? varied : pool;

  let total = 0;
  for (const pattern of candidates) total += pattern.weight;
  if (!(total > 0)) {
    throw new BellwardError(`boss phase "${phase.id}" has no positive pattern weight`);
  }

  let roll = rng.float(0, total);
  for (const pattern of candidates) {
    roll -= pattern.weight;
    if (roll <= 0) return pattern;
  }
  return candidates[candidates.length - 1] as BossPatternDef;
}
