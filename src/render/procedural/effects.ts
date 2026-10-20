import type { Texture } from 'pixi.js';
import { PALETTE } from '../../config/palette';
import type { EffectArt, EffectKey } from '../../data/effects';
import { hex, paint } from './canvas';

/**
 * Canvas stand-ins for the two M4 effects, keeping the zero-asset build fully playable.
 * The death burst is drawn as an eight-frame radial shatter; the fireball is a three-frame
 * glowing orb. The clips deliberately mirror the packed effect lengths so timing and
 * tests are unchanged when art falls back.
 */

type Build = { art: EffectArt; texture: Texture };

const DEATH_SIZE = 40;
const DEATH_FRAMES = 8;
const FIRE_SIZE = 16;
const FIRE_FRAMES = 3;

function drawDeath(ctx: CanvasRenderingContext2D, ox: number, frame: number): void {
  const p = frame / (DEATH_FRAMES - 1);
  const cx = ox + DEATH_SIZE / 2;
  const cy = DEATH_SIZE / 2;
  const radius = 3 + p * 15;
  const alpha = 1 - p * 0.9;

  ctx.globalAlpha = alpha * 0.55;
  ctx.fillStyle = hex(PALETTE.ember);
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fill();

  ctx.globalAlpha = alpha;
  ctx.fillStyle = hex(PALETTE.bone);
  ctx.beginPath();
  ctx.arc(cx, cy, Math.max(1, radius * 0.35), 0, Math.PI * 2);
  ctx.fill();

  // Eight deterministic shards, longer as the burst expands.
  ctx.strokeStyle = hex(PALETTE.ember);
  ctx.lineWidth = 2;
  for (let i = 0; i < 8; i += 1) {
    const angle = (i / 8) * Math.PI * 2 + 0.3;
    const inner = radius * 0.7;
    const outer = radius + 2 + p * 4;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(angle) * inner, cy + Math.sin(angle) * inner);
    ctx.lineTo(cx + Math.cos(angle) * outer, cy + Math.sin(angle) * outer);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

function drawFireball(ctx: CanvasRenderingContext2D, ox: number, frame: number): void {
  const cx = ox + FIRE_SIZE / 2;
  const cy = FIRE_SIZE / 2;
  const pulse = frame % 2 === 0 ? 0 : 1;
  ctx.fillStyle = hex(PALETTE.ember);
  ctx.globalAlpha = 0.45;
  ctx.beginPath();
  ctx.arc(cx, cy, 6.5 + pulse, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.fillStyle = hex(PALETTE.ember);
  ctx.beginPath();
  ctx.arc(cx, cy, 4 + pulse, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = hex(PALETTE.bone);
  ctx.beginPath();
  ctx.arc(cx + 1, cy - 1, 1.8, 0, Math.PI * 2);
  ctx.fill();
}

export function buildEffectArt(key: EffectKey): Build {
  if (key === 'enemyDeath') {
    const textureKey = 'proc.fx.enemyDeath';
    const texture = paint(DEATH_SIZE * DEATH_FRAMES, DEATH_SIZE, (ctx) => {
      for (let frame = 0; frame < DEATH_FRAMES; frame += 1) {
        drawDeath(ctx, frame * DEATH_SIZE, frame);
      }
    });
    return {
      texture,
      art: {
        textureKey,
        sheet: { frameWidth: DEATH_SIZE, frameHeight: DEATH_SIZE, columns: DEATH_FRAMES },
        anchor: { x: 0.5, y: 0.5 },
        scale: 1,
        clip: {
          loop: false,
          frames: Array.from({ length: DEATH_FRAMES }, (_, frame) => ({ frame, ticks: 3 })),
        },
      },
    };
  }

  const textureKey = 'proc.fx.fireball';
  const texture = paint(FIRE_SIZE * FIRE_FRAMES, FIRE_SIZE, (ctx) => {
    for (let frame = 0; frame < FIRE_FRAMES; frame += 1) {
      drawFireball(ctx, frame * FIRE_SIZE, frame);
    }
  });
  return {
    texture,
    art: {
      textureKey,
      sheet: { frameWidth: FIRE_SIZE, frameHeight: FIRE_SIZE, columns: FIRE_FRAMES },
      anchor: { x: 0.5, y: 0.5 },
      scale: 1,
      clip: {
        loop: true,
        frames: Array.from({ length: FIRE_FRAMES }, (_, frame) => ({ frame, ticks: 4 })),
      },
    },
  };
}
