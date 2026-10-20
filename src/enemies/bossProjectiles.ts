import type { BossPatternDef } from '../config/bossTypes';
import { clamp } from '../core/Math2D';
import type { Rng } from '../core/Rng';
import type { Vec2 } from '../core/Types';
import type { EnemyContext } from './Enemy';

/** Vertical offset from the feet to the boss's cast hand / chest. */
const CAST_HEIGHT = 36;
/** Ground-wave spawn height and the safe margin for arena-wide rain. */
const WAVE_HEIGHT = 8;
const ARENA_MARGIN = 24;
const DEFAULT_ARENA = { x: 0, y: 0, w: 960, h: 384 };

function cast(
  ctx: EnemyContext,
  x: number,
  y: number,
  dirX: number,
  dirY: number,
  speed: number,
  damage: number,
  life: number,
  pattern: BossPatternDef,
): void {
  ctx.castProjectile(x, y, dirX, dirY, speed, damage, life, {
    style: pattern.shotStyle ?? 'spore',
    gravity: pattern.shotGravity ?? 0,
  });
}

/** Shots whose direction depends on where the player is standing. */
export function launchAimedVolley(
  pattern: BossPatternDef,
  ctx: EnemyContext,
  feet: Vec2,
  facing: -1 | 1,
): void {
  const count = pattern.shots ?? 1;
  const speed = pattern.shotSpeed ?? 160;
  const life = pattern.shotLifeTicks ?? 120;
  const originX = feet.x + facing * 8;
  const originY = feet.y - CAST_HEIGHT;
  const aimX = ctx.player.feet.x - originX;
  const aimY = ctx.player.feet.y - 22 - originY;
  const base = Math.atan2(aimY, aimX);
  const spread = pattern.spreadRadians ?? 0;

  for (let i = 0; i < count; i += 1) {
    const offset = count === 1 ? 0 : (i / (count - 1) - 0.5) * spread;
    const angle = base + offset;
    cast(
      ctx,
      originX,
      originY,
      Math.cos(angle),
      Math.sin(angle),
      speed,
      pattern.damage,
      life,
      pattern,
    );
  }
}

/** A full circle of shots, with a tiny seeded rotation so repeats do not line up. */
export function launchRing(pattern: BossPatternDef, ctx: EnemyContext, feet: Vec2, rng: Rng): void {
  const count = pattern.shots ?? 8;
  const speed = pattern.shotSpeed ?? 130;
  const life = pattern.shotLifeTicks ?? 120;
  const originY = feet.y - CAST_HEIGHT;
  const offset = rng.float(-0.18, 0.18);
  for (let i = 0; i < count; i += 1) {
    const angle = offset + (i / count) * Math.PI * 2;
    cast(
      ctx,
      feet.x,
      originY,
      Math.cos(angle),
      Math.sin(angle),
      speed,
      pattern.damage,
      life,
      pattern,
    );
  }
}

/** Two ground waves leaving the boss in both directions. */
export function launchShockwaves(pattern: BossPatternDef, ctx: EnemyContext, feet: Vec2): void {
  const speed = pattern.shotSpeed ?? 180;
  const life = pattern.shotLifeTicks ?? 90;
  const y = feet.y - WAVE_HEIGHT;
  cast(ctx, feet.x - 4, y, -1, 0, speed, pattern.damage, life, pattern);
  cast(ctx, feet.x + 4, y, 1, 0, speed, pattern.damage, life, pattern);
}

/** One falling shot, placed around the player but clamped inside the arena. */
export function launchRainVolley(pattern: BossPatternDef, ctx: EnemyContext, rng: Rng): void {
  const arena = ctx.arena ?? DEFAULT_ARENA;
  const speed = pattern.shotSpeed ?? 160;
  const life = pattern.shotLifeTicks ?? 130;
  const x = clamp(
    ctx.player.feet.x + rng.float(-120, 120),
    arena.x + ARENA_MARGIN,
    arena.x + arena.w - ARENA_MARGIN,
  );
  cast(ctx, x, arena.y + 16, 0, 1, speed, pattern.damage, life, pattern);
}

/** Fires everything a pattern releases on its active frame. Rain schedules the rest. */
export function launchPatternStart(
  pattern: BossPatternDef,
  ctx: EnemyContext,
  feet: Vec2,
  facing: -1 | 1,
  rng: Rng,
): void {
  if (pattern.kind === 'fan' || pattern.kind === 'teleport') {
    if (pattern.kind === 'fan') launchAimedVolley(pattern, ctx, feet, facing);
    return;
  }
  if (pattern.kind === 'ring') {
    launchRing(pattern, ctx, feet, rng);
    return;
  }
  if (pattern.shockwave) launchShockwaves(pattern, ctx, feet);
  if (pattern.kind === 'rain') launchRainVolley(pattern, ctx, rng);
}
