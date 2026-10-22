import { COMBAT } from '../config/combat';
import type { Enemy } from '../enemies/Enemy';
import type { PlayerController } from '../player/PlayerController';
import type { Tilemap } from '../world/Tilemap';
import { bodyRect, overlaps } from './geometry';
import type { ProjectilePool } from './ProjectilePool';

/** Something combat did this tick, in the order it happened. Scenes turn these into FX. */
export type CombatEvent =
  | {
      type: 'enemyHit';
      enemy: Enemy;
      /** World position of the impact (the enemy's torso). */
      x: number;
      y: number;
      facing: -1 | 1;
      damage: number;
      killed: boolean;
      /** True when the hit landed on a posture-broken enemy: the KNELL. */
      knell: boolean;
      /** True when this hit filled the enemy's posture and broke it. */
      broke: boolean;
    }
  | {
      type: 'enemyBlocked';
      enemy: Enemy;
      /** World position of the clang (the guard's torso). */
      x: number;
      y: number;
      facing: -1 | 1;
    }
  | {
      type: 'playerHit';
      x: number;
      y: number;
      damage: number;
      source: 'contact' | 'melee' | 'projectile';
    }
  | {
      /** A perfect parry: the attacker's posture took the blow. */
      type: 'playerParry';
      x: number;
      y: number;
    }
  | {
      /** A held block: the hero's posture paid for the stop. */
      type: 'playerBlock';
      x: number;
      y: number;
    }
  | {
      /** The guard shattered; the reaction path already applied the mask cost. */
      type: 'playerGuardBreak';
      x: number;
      y: number;
    }
  | { type: 'projectileHit'; x: number; y: number; surface: 'tile' | 'player' };

export type CombatResult = {
  events: CombatEvent[];
  /** Ticks of hitstop to apply (0 = none). */
  hitstop: number;
};

/**
 * Resolves all damage for one fixed tick:
 *   1. the player's open swing, once per enemy per swing id;
 *   2. enemy melee hitboxes and body contact;
 *   3. projectile movement and impacts.
 *
 * Keeping this in one deterministic, view-free pass means the order of damage is
 * explicit: a killing blow lands before the same enemy's attack can hurt the player.
 */
export class CombatSystem {
  /** Swing id that last hit each enemy, so a multi-tick window lands once. */
  private readonly lastSwingByEnemy = new WeakMap<Enemy, number>();
  /** Attack id that last reached the guard, so one swing blocks/parries once. */
  private readonly lastMeleeByEnemy = new WeakMap<Enemy, number>();

  resolve(
    player: PlayerController,
    enemies: readonly Enemy[],
    projectiles: ProjectilePool,
    tilemap: Tilemap,
  ): CombatResult {
    const events: CombatEvent[] = [];
    let hitstop = 0;
    const playerBox = bodyRect(player.body);

    const swingBox = player.attackHitbox();
    if (swingBox) {
      const swing = player.attackId;
      for (const enemy of enemies) {
        if (!enemy.targetable || this.lastSwingByEnemy.get(enemy) === swing) continue;
        if (!overlaps(swingBox, enemy.bounds())) continue;
        this.lastSwingByEnemy.set(enemy, swing);
        const feet = enemy.feet;
        if (enemy.damageBlocked) {
          enemy.onDeflect(player.feet.x);
          events.push({
            type: 'enemyBlocked',
            enemy,
            x: feet.x,
            y: feet.y - enemy.stats.body.h * 0.55,
            facing: player.facing,
          });
          hitstop = Math.max(hitstop, COMBAT.enemy.blockedHitstopTicks);
          continue;
        }

        const knell = enemy.postureBroken;
        const base = player.attackDamage + player.attackCounterBonus;
        const damage = knell ? Math.ceil(base * COMBAT.knell.damageMultiplier) : base;
        const landed = enemy.takeDamage(damage, player.feet.x);
        let broke = false;
        if (landed && enemy.alive && !knell) {
          broke = enemy.takePostureDamage(player.attackPostureDamage, player.feet.x) === 'broken';
        }
        if (landed) player.gainFocusOnHit();
        events.push({
          type: 'enemyHit',
          enemy,
          x: feet.x,
          y: feet.y - enemy.stats.body.h * 0.55,
          facing: player.facing,
          damage,
          killed: !enemy.alive,
          knell,
          broke,
        });
        hitstop = Math.max(hitstop, knell ? COMBAT.knell.hitstopTicks : COMBAT.enemy.hitstopTicks);
      }
    }

    if (!player.dead) {
      for (const enemy of enemies) {
        if (!enemy.targetable) continue;
        const melee = enemy.attackHitbox();
        const hitPoint = { x: player.feet.x, y: player.feet.y - 20 };
        const meleeDamage = enemy.attackDamage;
        if (melee && meleeDamage > 0 && overlaps(melee, playerBox)) {
          if (this.lastMeleeByEnemy.get(enemy) === enemy.attackId) continue;
          this.lastMeleeByEnemy.set(enemy, enemy.attackId);
          const outcome = player.resolveIncoming(
            meleeDamage,
            enemy.feet.x,
            enemy.attackUnblockable,
          );
          if (outcome === 'parry') {
            enemy.onParried(player.feet.x);
            events.push({ type: 'playerParry', ...hitPoint });
            hitstop = Math.max(hitstop, COMBAT.enemy.hitstopTicks);
          } else if (outcome === 'block') {
            events.push({ type: 'playerBlock', ...hitPoint });
            hitstop = Math.max(hitstop, COMBAT.enemy.blockedHitstopTicks);
          } else if (outcome === 'broken') {
            events.push({ type: 'playerGuardBreak', ...hitPoint });
            hitstop = Math.max(hitstop, COMBAT.player.hitstopTicks);
          } else if (player.takeDamage(meleeDamage, enemy.feet.x)) {
            events.push({
              type: 'playerHit',
              ...hitPoint,
              damage: meleeDamage,
              source: 'melee',
            });
            hitstop = Math.max(hitstop, COMBAT.player.hitstopTicks);
          }
          continue;
        }
        if (enemy.contactHazard && overlaps(enemy.bounds(), playerBox)) {
          const damage = enemy.stats.contactDamage;
          if (player.takeDamage(damage, enemy.feet.x)) {
            events.push({ type: 'playerHit', ...hitPoint, damage, source: 'contact' });
            hitstop = Math.max(hitstop, COMBAT.player.hitstopTicks);
          }
        }
      }
    }

    for (const hit of projectiles.update(tilemap, playerBox)) {
      if (hit.kind === 'player' && !player.dead) {
        const outcome = player.resolveIncoming(hit.damage, hit.x, false);
        if (outcome === 'parry') {
          events.push({ type: 'playerParry', x: hit.x, y: hit.y });
          hitstop = Math.max(hitstop, COMBAT.enemy.hitstopTicks);
        } else if (outcome === 'block') {
          events.push({ type: 'playerBlock', x: hit.x, y: hit.y });
          hitstop = Math.max(hitstop, COMBAT.enemy.blockedHitstopTicks);
        } else if (outcome === 'broken') {
          events.push({ type: 'playerGuardBreak', x: hit.x, y: hit.y });
          hitstop = Math.max(hitstop, COMBAT.player.hitstopTicks);
        } else if (player.takeDamage(hit.damage, hit.x)) {
          events.push({
            type: 'playerHit',
            x: hit.x,
            y: hit.y,
            damage: hit.damage,
            source: 'projectile',
          });
          hitstop = Math.max(hitstop, COMBAT.player.hitstopTicks);
        }
      }
      events.push({ type: 'projectileHit', x: hit.x, y: hit.y, surface: hit.kind });
    }

    return { events, hitstop };
  }
}
