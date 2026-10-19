import type { Texture } from 'pixi.js';
import { PALETTE } from '../../config/palette';
import type { AnimationClip, CharacterArt } from '../Animation';
import { hex, paint } from './canvas';

/** Six poses of the fallback knight, authored as a single 32x48 strip. */
const HERO_FRAME_W = 32;
const HERO_FRAME_H = 48;
const HERO_FRAMES = 6;

const KNIGHT_POSES = [
  { bob: 0, cloak: 0, left: 0, right: 0 },
  { bob: 1, cloak: 1, left: 0, right: 0 },
  { bob: 0, cloak: 1, left: 2, right: -2 },
  { bob: 1, cloak: 0, left: 0, right: 0 },
  { bob: 0, cloak: -1, left: -2, right: 2 },
  { bob: 1, cloak: 0, left: 0, right: 0 },
] as const;

function drawKnight(ctx: CanvasRenderingContext2D, ox: number, poseIndex: number): void {
  const pose = KNIGHT_POSES[poseIndex] ?? KNIGHT_POSES[0];
  const bob = pose.bob;
  // Cloak first so the body reads on top.
  ctx.fillStyle = hex(PALETTE.cavern);
  ctx.beginPath();
  ctx.moveTo(ox + 10, 22 + bob);
  ctx.lineTo(ox + 22, 22 + bob);
  ctx.lineTo(ox + 24 + pose.cloak, 40 + bob);
  ctx.lineTo(ox + 8 + pose.cloak, 40 + bob);
  ctx.closePath();
  ctx.fill();
  // Legs.
  ctx.fillStyle = hex(PALETTE.stone);
  ctx.fillRect(ox + 12 + pose.left, 35 + bob, 4, 11 - bob);
  ctx.fillRect(ox + 17 + pose.right, 35 + bob, 4, 11 - bob);
  // Torso, belt and pauldrons.
  ctx.fillStyle = hex(PALETTE.stoneLit);
  ctx.fillRect(ox + 11, 22 + bob, 10, 14);
  ctx.fillStyle = hex(PALETTE.brassDark);
  ctx.fillRect(ox + 11, 33 + bob, 10, 2);
  // Head and visor.
  ctx.fillStyle = hex(PALETTE.stone);
  ctx.fillRect(ox + 13, 14 + bob, 6, 8);
  ctx.fillStyle = hex(PALETTE.void);
  ctx.fillRect(ox + 14, 18 + bob, 4, 2);
  // Sword.
  ctx.fillStyle = hex(PALETTE.brass);
  ctx.fillRect(ox + 23, 13 + bob, 2, 19);
  ctx.fillStyle = hex(PALETTE.bone);
  ctx.fillRect(ox + 23, 11 + bob, 2, 2);
}

export function buildHeroArt(): { art: CharacterArt; texture: Texture } {
  const texture = paint(HERO_FRAME_W * HERO_FRAMES, HERO_FRAME_H, (ctx) => {
    for (let frame = 0; frame < HERO_FRAMES; frame += 1) {
      drawKnight(ctx, frame * HERO_FRAME_W, frame);
    }
  });
  const idle: AnimationClip = {
    loop: true,
    frames: [
      { frame: 0, ticks: 30 },
      { frame: 1, ticks: 30 },
    ],
  };
  const run: AnimationClip = {
    loop: true,
    frames: [
      { frame: 2, ticks: 8 },
      { frame: 3, ticks: 8 },
      { frame: 4, ticks: 8 },
      { frame: 5, ticks: 8 },
    ],
  };
  return {
    texture,
    art: {
      textureKey: 'proc.hero',
      sheet: { frameWidth: HERO_FRAME_W, frameHeight: HERO_FRAME_H, columns: HERO_FRAMES },
      origin: { x: 16, y: 46 },
      animations: { idle, run },
    },
  };
}
