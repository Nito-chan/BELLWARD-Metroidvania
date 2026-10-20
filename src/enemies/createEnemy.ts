import { isBossKind } from '../config/enemies';
import type { Rng } from '../core/Rng';
import type { EnemySpawn } from '../world/Room';
import { Adept } from './Adept';
import { Boss } from './Boss';
import type { Enemy } from './Enemy';
import { MeleeEnemy } from './MeleeEnemy';

/** Builds the simulation entity for a room's enemy spawn. Throws on unknown kinds. */
export function createEnemy(spawn: EnemySpawn, rng: Rng): Enemy {
  if (isBossKind(spawn.kind)) return new Boss(spawn.kind, spawn, rng);
  switch (spawn.kind) {
    case 'parishioner':
    case 'ghoul':
      return new MeleeEnemy(spawn.kind, spawn);
    case 'adept':
      return new Adept(spawn);
  }
}
