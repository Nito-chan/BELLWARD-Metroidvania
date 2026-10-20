import { COMBAT } from '../config/combat';
import type { CombatEvent } from '../combat/CombatSystem';
import type { SfxKey } from '../data/audio';
import type { Camera } from './Camera';
import type { EffectsLayer } from './EffectsLayer';

/** The scene only needs one audio call; keeping it narrow keeps feedback testable. */
export type SceneAudio = {
  playSfx(key: SfxKey): void;
};

/**
 * Turns combat events into audiovisual feedback. The scene owns the result; this class
 * owns only transient presentation state (the damage vignette).
 */
export class CombatFeedback {
  private damageFlashTicks = 0;

  constructor(
    private readonly audio: SceneAudio,
    private readonly effects: EffectsLayer,
    private readonly camera: Camera,
  ) {}

  apply(events: readonly CombatEvent[]): void {
    for (const event of events) {
      if (event.type === 'enemyHit') {
        this.effects.spark(event.x, event.y, event.facing);
        this.audio.playSfx(event.killed ? 'enemyDie' : 'enemyHurt');
        this.camera.shake(COMBAT.enemy.hitShake.strength, COMBAT.enemy.hitShake.ticks);
        if (event.killed) this.effects.death(event.enemy.feet.x, event.enemy.feet.y);
        continue;
      }
      if (event.type === 'enemyBlocked') {
        this.effects.spark(event.x, event.y, event.facing);
        this.audio.playSfx('bossWard');
        this.camera.shake(2, 6);
        continue;
      }
      if (event.type === 'playerHit') {
        this.damageFlashTicks = COMBAT.player.flashTicks;
        this.camera.shake(COMBAT.player.hurtShake.strength, COMBAT.player.hurtShake.ticks);
        continue;
      }
      // Projectile impact: a small spark on stone or flesh, plus the sizzle.
      this.effects.spark(event.x, event.y, 1);
      this.audio.playSfx('fireballHit');
    }
  }

  update(): void {
    if (this.damageFlashTicks > 0) this.damageFlashTicks -= 1;
  }

  get damageAlpha(): number {
    return this.damageFlashTicks / COMBAT.player.flashTicks;
  }
}
