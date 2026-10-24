import { Container, Graphics, Sprite, Texture } from 'pixi.js';
import { COMBAT } from '../config/combat';
import { PALETTE } from '../config/palette';
import { SIM } from '../config/world';
import type { CenserCloudSnapshot } from '../combat/CombatSystem';
import type { EffectArt } from '../data/effects';
import type { ArtProvider } from './ArtProvider';
import { sliceFrame } from './frames';
import { SpriteAnimator } from './SpriteAnimator';

type Spark = {
  readonly view: Graphics;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  active: boolean;
};

type Burst = {
  readonly view: Sprite;
  animator: SpriteAnimator | null;
  readonly textures: Map<number, Texture>;
};

const SPARK_POOL = 24;
const BURST_POOL = 3;
const CLOUD_POOL = 4;
const SPARKS_PER_HIT = 4;

/**
 * Deterministic combat feedback: pooled impact sparks and pooled one-shot death bursts.
 * Both are pure simulation-driven views (advanced by fixed ticks), so a replay looks the
 * same and hit effects never depend on the render frame rate.
 */
export class EffectsLayer {
  readonly view = new Container();
  private readonly clouds: Graphics[] = [];
  private readonly sparks: Spark[] = [];
  private readonly bursts: Burst[] = [];
  private readonly deathArt: EffectArt;
  private sparkCursor = 0;

  constructor(provider: ArtProvider) {
    for (let i = 0; i < CLOUD_POOL; i += 1) {
      const cloud = new Graphics();
      cloud.visible = false;
      this.view.addChild(cloud);
      this.clouds.push(cloud);
    }

    for (let i = 0; i < SPARK_POOL; i += 1) {
      const graphic = new Graphics().circle(0, 0, COMBAT.sparkRadius).fill(PALETTE.bone);
      graphic.visible = false;
      this.view.addChild(graphic);
      this.sparks.push({ view: graphic, vx: 0, vy: 0, life: 0, maxLife: 1, active: false });
    }

    this.deathArt = provider.effects.enemyDeath;
    const sheet = provider.texture(this.deathArt.textureKey);
    const textures = new Map<number, Texture>();
    for (const frame of this.deathArt.clip.frames) {
      textures.set(frame.frame, sliceFrame(sheet, this.deathArt.sheet, frame.frame));
    }
    const firstFrame = this.deathArt.clip.frames[0]?.frame ?? 0;
    const firstTexture = textures.get(firstFrame);
    for (let i = 0; i < BURST_POOL; i += 1) {
      const sprite = new Sprite(firstTexture);
      sprite.anchor.set(this.deathArt.anchor.x, this.deathArt.anchor.y);
      sprite.scale.set(this.deathArt.scale);
      sprite.visible = false;
      this.view.addChild(sprite);
      this.bursts.push({ view: sprite, animator: null, textures });
    }
  }

  /** Emits a handful of sparks from a hit point, biased along the attacker's facing. */
  spark(x: number, y: number, facing: -1 | 1): void {
    const patterns = [
      { vx: 55, vy: -95 },
      { vx: 95, vy: -45 },
      { vx: 35, vy: 5 },
      { vx: 110, vy: -130 },
    ];
    for (let i = 0; i < SPARKS_PER_HIT; i += 1) {
      const spark = this.sparks[this.sparkCursor];
      this.sparkCursor = (this.sparkCursor + 1) % SPARK_POOL;
      if (!spark) continue;
      const pattern = patterns[i] ?? patterns[0];
      spark.active = true;
      spark.life = 14;
      spark.maxLife = 14;
      spark.vx = facing * (pattern?.vx ?? 60);
      spark.vy = pattern?.vy ?? -60;
      spark.view.visible = true;
      spark.view.position.set(x, y);
      spark.view.alpha = 1;
      spark.view.scale.set(1);
      spark.view.tint = i % 2 === 0 ? PALETTE.ember : PALETTE.bone;
    }
  }

  /**
   * Mirrors the simulation's live brine clouds. The cloud tick is authoritative, so this
   * view never fades a cloud independently of the posture pulses it represents.
   */
  syncClouds(clouds: readonly CenserCloudSnapshot[]): void {
    for (const graphic of this.clouds) {
      graphic.clear();
      graphic.visible = false;
    }
    for (let i = 0; i < Math.min(clouds.length, this.clouds.length); i += 1) {
      const cloud = clouds[i];
      const graphic = this.clouds[i];
      if (!cloud || !graphic) continue;
      const age = cloud.maxTicks - cloud.ticksLeft;
      const fadeIn = Math.min(1, age / 6);
      const fadeOut = Math.min(1, cloud.ticksLeft / 18);
      const alpha = Math.max(0, fadeIn * fadeOut);
      const centreY = cloud.y - 10;
      const puffs = [
        { dx: -8, dy: 2, r: 13 },
        { dx: 7, dy: 0, r: 15 },
        { dx: 0, dy: -8, r: 12 },
        { dx: -3, dy: 6, r: 10 },
        { dx: 10, dy: -8, r: 8 },
      ];
      for (const puff of puffs) {
        graphic.circle(cloud.x + puff.dx, centreY + puff.dy, puff.r).fill({
          color: puff.dx < 0 ? PALETTE.moss : PALETTE.echo,
          alpha: alpha * 0.16,
        });
      }
      graphic.circle(cloud.x, centreY, cloud.radius).stroke({
        width: 1,
        color: PALETTE.echo,
        alpha: alpha * 0.32,
      });
      graphic.visible = true;
    }
  }

  /** Starts the one-shot death burst at an enemy's feet. */
  death(x: number, y: number): void {
    const burst = this.bursts.find((candidate) => candidate.animator === null) ?? this.bursts[0];
    if (!burst) return;
    burst.animator = new SpriteAnimator({ death: this.deathArt.clip }, 'death');
    burst.view.position.set(x, y - 22);
    burst.view.visible = true;
    const firstFrame = this.deathArt.clip.frames[0]?.frame ?? 0;
    const texture = burst.textures.get(firstFrame);
    if (texture) burst.view.texture = texture;
  }

  /** Advances sparks and bursts by one fixed tick. */
  update(): void {
    for (const spark of this.sparks) {
      if (!spark.active) continue;
      spark.life -= 1;
      if (spark.life <= 0) {
        spark.active = false;
        spark.view.visible = false;
        continue;
      }
      spark.vy += 320 * SIM.dt;
      spark.vx *= 0.94;
      spark.view.position.x += spark.vx * SIM.dt;
      spark.view.position.y += spark.vy * SIM.dt;
      const fade = spark.life / spark.maxLife;
      spark.view.alpha = fade;
      spark.view.scale.set(0.5 + fade * 0.5);
    }

    for (const burst of this.bursts) {
      const animator = burst.animator;
      if (!animator) continue;
      animator.tick();
      const texture = burst.textures.get(animator.frame);
      if (texture) burst.view.texture = texture;
      if (animator.finished) {
        burst.animator = null;
        burst.view.visible = false;
      }
    }
  }
}
