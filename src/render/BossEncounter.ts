import { Container } from 'pixi.js';
import type { BossKind } from '../config/enemies';
import type { SfxKey } from '../data/audio';
import type { SceneBossDebugState } from '../debug/DebugState';
import type { Boss, BossEvent } from '../enemies/Boss';
import type { EnemyContext } from '../enemies/Enemy';
import { Banner } from '../ui/Banner';
import { BossHud } from '../ui/BossHud';
import type { ArtProvider } from './ArtProvider';
import { BossView } from './BossView';
import type { Camera } from './Camera';
import type { EffectsLayer } from './EffectsLayer';

export type EncounterAudio = { playSfx(key: SfxKey): void };

export type BossEncounterOptions = {
  art: ArtProvider;
  audio: EncounterAudio;
  effects: EffectsLayer;
  camera: Camera;
  onDefeated: (kind: BossKind, ordeal: boolean) => void;
  announce?: (text: string) => void;
};

/**
 * Owns one boss's presentation and event translation: the world view, the screen-space
 * health bar, phase banners, sound cues, and the one-shot reward hook. The simulation
 * (`Boss`) stays unaware of Pixi, audio, and the player's vitals.
 */
export class BossEncounter {
  readonly boss: Boss;
  readonly actorView: BossView;
  readonly overlay = new Container();
  private readonly hud = new BossHud();
  private readonly banner = new Banner();
  private readonly options: BossEncounterOptions;
  private defeatedHandled = false;

  constructor(boss: Boss, options: BossEncounterOptions) {
    this.boss = boss;
    this.options = options;
    this.actorView = new BossView(options.art, boss);
    this.overlay.addChild(this.hud.view, this.banner.view);
    this.hud.setBoss(this.info());
    // A short title card tells the player which named encounter they just entered;
    // the persistent HUD carries the same name after the card fades.
    this.banner.show(boss.title.toUpperCase(), boss.phase.name, 90);
    options.announce?.(`${boss.title} awakens.`);
  }

  get alive(): boolean {
    return this.boss.alive;
  }

  get kind(): BossKind {
    return this.boss.kind as BossKind;
  }

  update(ctx: EnemyContext): void {
    this.boss.update(ctx);
    for (const event of this.boss.consumeEvents()) this.handleEvent(event);
    this.actorView.sync(this.boss, ctx.player.feet);
    this.hud.setBoss(this.info());
    if (!this.boss.alive && this.boss.deathElapsed > 220) this.hud.setBoss(null);
    this.banner.tick();
  }

  debugDamage(amount: number): boolean {
    return this.boss.takeDamage(amount, this.boss.feet.x);
  }

  debugBreakWard(): boolean {
    return this.boss.forceBreakWard();
  }

  debugDefeat(): void {
    this.boss.debugDefeat();
  }

  debugState(): SceneBossDebugState {
    const pattern = this.boss.pattern;
    return {
      kind: this.boss.kind,
      name: this.boss.title,
      x: this.boss.feet.x,
      y: this.boss.feet.y,
      hp: this.boss.hp,
      maxHp: this.boss.maxHp,
      ordeal: this.boss.variant === 'ordeal',
      phase: this.boss.phaseIndex,
      phaseCount: this.boss.phaseCount,
      phaseName: this.boss.phase.name,
      warded: this.boss.warded,
      posture: this.boss.posture,
      maxPosture: this.boss.postureMax,
      postureBroken: this.boss.postureBroken,
      state: this.boss.state,
      pattern: pattern?.id ?? null,
      telegraph: this.boss.telegraph,
      hidden: this.boss.hidden,
      alive: this.boss.alive,
      deathElapsed: this.boss.deathElapsed,
    };
  }

  private info(): {
    name: string;
    hp: number;
    maxHp: number;
    phaseIndex: number;
    phaseCount: number;
    phaseName: string;
    warded: boolean;
    posture: number;
    maxPosture: number;
    postureBroken: boolean;
    alive: boolean;
  } {
    return {
      name: this.boss.title,
      hp: this.boss.hp,
      maxHp: this.boss.maxHp,
      phaseIndex: this.boss.phaseIndex,
      phaseCount: this.boss.phaseCount,
      phaseName: this.boss.phase.name,
      warded: this.boss.warded,
      posture: this.boss.posture,
      maxPosture: this.boss.postureMax,
      postureBroken: this.boss.postureBroken,
      alive: this.boss.alive,
    };
  }

  private handleEvent(event: BossEvent): void {
    switch (event.type) {
      case 'tell':
      case 'attack':
        if (event.sfx) this.options.audio.playSfx(event.sfx);
        return;
      case 'phase':
        this.options.audio.playSfx('bossPhase');
        this.options.camera.shake(3, 12);
        this.banner.show(this.boss.title.toUpperCase(), event.name, 100);
        this.options.announce?.(`${this.boss.title}: ${event.name}.`);
        return;
      case 'wardBreak':
        this.options.audio.playSfx('bossWard');
        this.options.effects.spark(event.x, event.y, this.boss.facing);
        this.options.camera.shake(4, 14);
        this.banner.show('THE BELL SHIELD BREAKS', 'The Bellbearer is vulnerable', 120);
        this.options.announce?.('The Bellbearer’s shield breaks. It is vulnerable.');
        return;
      case 'wallHit':
        this.options.audio.playSfx('bossSlam');
        this.options.effects.spark(event.x, event.y - 12, 1);
        this.options.camera.shake(3, 8);
        return;
      case 'defeated':
        this.handleDefeat(event.kind);
        return;
    }
  }

  private handleDefeat(kind: BossKind): void {
    if (this.defeatedHandled) return;
    this.defeatedHandled = true;
    this.options.audio.playSfx('bossDefeat');
    this.options.camera.shake(6, 20);
    const ordeal = this.boss.variant === 'ordeal';
    if (ordeal) {
      this.banner.show('ORDEAL BROKEN', 'The arena remembers a harder silence', 220);
      this.options.announce?.(`${this.boss.title} felled. The Ordeal is broken.`);
    } else {
      this.banner.show('SIGIL RECOVERED', this.boss.definition.rewardName, 220);
      this.options.announce?.(
        `${this.boss.title} felled. ${this.boss.definition.rewardName} recovered.`,
      );
    }
    this.options.onDefeated(kind, ordeal);
  }
}
