import { COMBAT } from '../config/combat';
import type { Enemy } from '../enemies/Enemy';
import type { PlayerController } from '../player/PlayerController';
import type { Tilemap } from '../world/Tilemap';
import { bodyRect, overlaps } from './geometry';
import type { ProjectilePool } from './ProjectilePool';
import { RESONANCE } from '../config/weapons';

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
      source: 'contact' | 'melee' | 'projectile' | 'shockwave';
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

type CenserCloud = {
  x: number;
  y: number;
  /** Ticks remaining before the cloud fades. */
  ticksLeft: number;
  /** Ticks until the next posture pulse. */
  nextTick: number;
};

/** Read-only cloud data for the renderer; the simulation keeps ownership. */
export type CenserCloudSnapshot = {
  readonly x: number;
  readonly y: number;
  readonly ticksLeft: number;
  readonly maxTicks: number;
  readonly radius: number;
};

/** Brine cloud radius and posture pulse, in pixels/ticks. */
const CENSER_CLOUD = {
  ticks: 90,
  radius: 24,
  pulseEvery: 15,
  posture: 2,
} as const;

/**
 * Resolves all damage for one fixed tick:
 *   1. the player's open swing, once per enemy per swing id;
 *   2. enemy melee hitboxes and body contact;
 *   3. Toll waves (pierce enemies, hit each once, apply resonance);
 *   4. Censer brine clouds (tick posture to enemies inside);
 *   5. enemy projectile movement and impacts vs the player.
 *
 * Keeping this in one deterministic, view-free pass means the order of damage is
 * explicit: a killing blow lands before the same enemy's attack can hurt the player.
 */
export class CombatSystem {
  /** Swing id that last hit each enemy, so a multi-tick window lands once. */
  private readonly lastSwingByEnemy = new WeakMap<Enemy, number>();
  /** Attack id that last reached the guard, so one swing blocks/parries once. */
  private readonly lastMeleeByEnemy = new WeakMap<Enemy, number>();
  /** Hazard id that last reached the player, so one shockwave lands once. */
  private readonly lastHazardByEnemy = new WeakMap<Enemy, number>();
  /** Lingering Censer clouds; one slot per cloud, reused when inactive. */
  private readonly clouds: CenserCloud[] = [];

  /** Copies only the live clouds so render code cannot mutate simulation state. */
  get activeCenserClouds(): readonly CenserCloudSnapshot[] {
    return this.clouds
      .filter((cloud) => cloud.ticksLeft > 0)
      .map((cloud) => ({
        x: cloud.x,
        y: cloud.y,
        ticksLeft: cloud.ticksLeft,
        maxTicks: CENSER_CLOUD.ticks,
        radius: CENSER_CLOUD.radius,
      }));
  }

  resolve(
    player: PlayerController,
    enemies: readonly Enemy[],
    projectiles: ProjectilePool,
    tilemap: Tilemap,
  ): CombatResult {
    const events: CombatEvent[] = [];
    let hitstop = 0;
    const playerBox = bodyRect(player.body);
    const weapon = player.currentWeapon;

    // 1. The player's open melee swing (Nail / Censer). Toll has no melee hitbox.
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
        let base = player.attackDamage + player.attackCounterBonus;
        // Resonance: the next Nail or Censer hit on a marked enemy deals bonus damage
        // and posture, then the mark is consumed. Toll never consumes its own mark.
        if (weapon !== 'toll' && enemy.resonance > 0) {
          base += RESONANCE.damageBonus;
          enemy.consumeResonance();
        }
        const damage = knell ? Math.ceil(base * COMBAT.knell.damageMultiplier) : base;
        const landed = enemy.takeDamage(damage, player.feet.x);
        let broke = false;
        if (landed && enemy.alive && !knell) {
          broke = enemy.takePostureDamage(player.attackPostureDamage, player.feet.x) === 'broken';
        }
        if (landed) player.gainFocusOnHit();
        // A Censer hit leaves a brine cloud that ticks posture while it lasts.
        if (weapon === 'censer' && landed) this.spawnCenserCloud(feet.x, feet.y);
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
        const hazard = enemy.activeHazard();
        if (
          hazard &&
          this.lastHazardByEnemy.get(enemy) !== hazard.id &&
          overlaps(hazard.box, playerBox)
        ) {
          this.lastHazardByEnemy.set(enemy, hazard.id);
          const outcome = player.resolveIncoming(hazard.damage, hazard.sourceX, hazard.unblockable);
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
          } else if (player.takeDamage(hazard.damage, hazard.sourceX)) {
            events.push({
              type: 'playerHit',
              ...hitPoint,
              damage: hazard.damage,
              source: 'shockwave',
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

    // 3. Projectiles move and hit tiles or the player box. Only enemy-owned shots hurt
    // the player; player-owned Toll waves pass the player harmlessly.
    for (const hit of projectiles.update(tilemap, playerBox)) {
      if (hit.kind === 'player' && hit.owner === 'enemy' && !player.dead) {
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
      if (hit.kind === 'tile' || (hit.kind === 'player' && hit.owner === 'enemy')) {
        events.push({ type: 'projectileHit', x: hit.x, y: hit.y, surface: hit.kind });
      }
    }

    // 4. Player-owned Toll waves pierce enemies, hitting each once per wave and applying
    // the resonance mark. They stop at solid tiles (handled by the pool update above).
    this.resolvePlayerWaves(player, enemies, projectiles, events);

    // 5. Censer brine clouds pulse posture to enemies standing in them.
    this.pulseCenserClouds(enemies);

    return { events, hitstop };
  }

  /** Spawn a lingering brine cloud at a Censer hit point. Called by the room scene. */
  spawnCenserCloud(x: number, y: number): void {
    let slot = this.clouds.find((cloud) => cloud.ticksLeft <= 0);
    if (!slot) {
      slot = { x: 0, y: 0, ticksLeft: 0, nextTick: 0 };
      this.clouds.push(slot);
    }
    slot.x = x;
    slot.y = y;
    slot.ticksLeft = CENSER_CLOUD.ticks;
    slot.nextTick = CENSER_CLOUD.pulseEvery;
  }

  private resolvePlayerWaves(
    player: PlayerController,
    enemies: readonly Enemy[],
    projectiles: ProjectilePool,
    events: CombatEvent[],
  ): void {
    for (const slot of projectiles.all) {
      if (!slot.active || slot.owner !== 'player') continue;
      const waveBox = {
        x: slot.x - 11,
        y: slot.y - 15,
        w: 22,
        h: 30,
      };
      for (const enemy of enemies) {
        if (!enemy.targetable || slot.hitEnemies.has(enemy)) continue;
        if (!overlaps(waveBox, enemy.bounds())) continue;
        slot.hitEnemies.add(enemy);
        // A warded or ritual-sealed boss absorbs the wave without taking damage or
        // producing ordinary hit feedback. Its state is the signal, not a false hit.
        if (enemy.damageBlocked) continue;

        const knell = enemy.postureBroken;
        const damage = knell ? Math.ceil(slot.damage * COMBAT.knell.damageMultiplier) : slot.damage;
        const landed = enemy.takeDamage(damage, slot.x);
        let broke = false;
        if (landed && enemy.alive && !knell) {
          broke = enemy.takePostureDamage(slot.posture, slot.x) === 'broken';
        }
        if (landed) enemy.markResonance(RESONANCE.ticks);
        events.push({
          type: 'enemyHit',
          enemy,
          x: slot.x,
          y: slot.y,
          facing: player.facing,
          damage,
          killed: !enemy.alive,
          knell,
          broke,
        });
      }
    }
  }

  private pulseCenserClouds(enemies: readonly Enemy[]): void {
    for (const cloud of this.clouds) {
      if (cloud.ticksLeft <= 0) continue;
      cloud.ticksLeft -= 1;
      if (cloud.ticksLeft <= 0) continue;
      cloud.nextTick -= 1;
      if (cloud.nextTick > 0) continue;
      cloud.nextTick = CENSER_CLOUD.pulseEvery;
      const radius = CENSER_CLOUD.radius;
      for (const enemy of enemies) {
        if (!enemy.targetable || !enemy.alive) continue;
        const dx = enemy.feet.x - cloud.x;
        const dy = enemy.feet.y - cloud.y;
        if (dx * dx + dy * dy > radius * radius) continue;
        enemy.applyPosture(CENSER_CLOUD.posture);
      }
    }
  }

  reset(): void {
    for (const cloud of this.clouds) cloud.ticksLeft = 0;
  }
}
