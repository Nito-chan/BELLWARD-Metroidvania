import { BellwardError } from '../core/Errors';
import type { EnemySpawn } from '../world/Room';
import { Adept } from './Adept';
import type { Enemy } from './Enemy';
import { MeleeEnemy } from './MeleeEnemy';

/** Builds the simulation entity for a room's enemy spawn. Throws on unknown kinds. */
export function createEnemy(spawn: EnemySpawn): Enemy {
  switch (spawn.kind) {
    case 'parishioner':
    case 'ghoul':
      return new MeleeEnemy(spawn.kind, spawn);
    case 'adept':
      return new Adept(spawn);
    default: {
      const unknown: never = spawn.kind;
      throw new BellwardError(`unknown enemy kind ${JSON.stringify(unknown)}`);
    }
  }
}
