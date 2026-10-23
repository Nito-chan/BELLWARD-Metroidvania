import type { Texture } from 'pixi.js';
import type { BossKind } from '../../config/enemies';
import { PALETTE } from '../../config/palette';
import type { AnimationClip, CharacterArt } from '../Animation';
import { hex, paint } from './canvas';

/**
 * Three hand-painted boss silhouettes: a bell-backed keeper, an antlered moss warden
 * and a wide-brimmed thief. Frames are 0-1 idle, 2-3 wind-up, 4 active, 5 hurt. Boss art
 * is always procedural; it is deliberately larger than the regular enemy sheets so the
 * encounter reads as a different class of threat.
 */

const FRAME_W = 64;
const FRAME_H = 72;
const FRAMES = 6;

type Build = { art: CharacterArt; texture: Texture };

function drawBellbearer(ctx: CanvasRenderingContext2D, ox: number, frame: number): void {
  const bob = frame % 2;
  const lean = frame === 2 ? 2 : frame === 3 ? 4 : frame === 4 ? 7 : 0;

  // Back-mounted bell shield, drawn first so the body overlaps its rim.
  ctx.fillStyle = hex(PALETTE.brassDark);
  ctx.beginPath();
  ctx.moveTo(ox + 9, 38 + bob);
  ctx.quadraticCurveTo(ox + 10, 22 + bob, ox + 22, 20 + bob);
  ctx.quadraticCurveTo(ox + 34, 22 + bob, ox + 35, 38 + bob);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = hex(PALETTE.brass);
  ctx.fillRect(ox + 10, 36 + bob, 24, 4);
  ctx.fillStyle = hex(PALETTE.void);
  for (const x of [16, 22, 28]) ctx.fillRect(ox + x, 28 + bob, 1, 8);

  // Boots and heavy cloak.
  ctx.fillStyle = hex(PALETTE.cavern);
  const stride = frame === 4 ? 3 : 0;
  ctx.fillRect(ox + 18 - stride, 60, 7, 11);
  ctx.fillRect(ox + 29 + stride, 60, 7, 11);
  ctx.fillStyle = hex(PALETTE.stone);
  ctx.beginPath();
  ctx.moveTo(ox + 17, 29 + bob);
  ctx.lineTo(ox + 40, 29 + bob);
  ctx.lineTo(ox + 44, 64);
  ctx.lineTo(ox + 12, 64);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = hex(PALETTE.stoneLit);
  ctx.fillRect(ox + 19, 32 + bob, 4, 25);
  ctx.fillStyle = hex(PALETTE.moss);
  ctx.fillRect(ox + 13, 54, 34, 4);

  // Hood and narrow lantern eyes.
  ctx.fillStyle = hex(PALETTE.deepWater);
  ctx.beginPath();
  ctx.ellipse(ox + 28, 23 + bob, 11, 12, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = hex(PALETTE.void);
  ctx.fillRect(ox + 21, 22 + bob, 3, 2);
  ctx.fillRect(ox + 31, 22 + bob, 3, 2);
  ctx.fillStyle = hex(PALETTE.ember);
  ctx.fillRect(ox + 22, 23 + bob, 2, 2);
  ctx.fillRect(ox + 32, 23 + bob, 2, 2);

  // Bell hammer. The active frame reaches down and across the body.
  const handY = 42 + bob - (frame === 2 || frame === 3 ? 10 : 0);
  ctx.fillStyle = hex(PALETTE.brassDark);
  ctx.fillRect(ox + 43 + lean, handY, 5, 24);
  ctx.fillStyle = hex(PALETTE.brass);
  ctx.fillRect(ox + 38 + lean, handY - 2, 17, 7);
  ctx.fillStyle = hex(PALETTE.bone);
  ctx.fillRect(ox + 42 + lean, handY, 9, 2);
}

function drawWardenMoss(ctx: CanvasRenderingContext2D, ox: number, frame: number): void {
  const bob = frame % 2;
  const raise = frame === 2 ? 5 : frame === 3 ? 9 : frame === 4 ? 13 : 0;

  // Antlers, branching upward from a small skull.
  ctx.strokeStyle = hex(PALETTE.bone);
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(ox + 27, 22 + bob);
  ctx.lineTo(ox + 20, 12 + bob);
  ctx.lineTo(ox + 16, 8 + bob);
  ctx.moveTo(ox + 22, 15 + bob);
  ctx.lineTo(ox + 15, 17 + bob);
  ctx.moveTo(ox + 32, 22 + bob);
  ctx.lineTo(ox + 39, 11 + bob);
  ctx.lineTo(ox + 44, 7 + bob);
  ctx.moveTo(ox + 38, 15 + bob);
  ctx.lineTo(ox + 45, 17 + bob);
  ctx.stroke();

  // Root-like legs and moss cloak.
  ctx.fillStyle = hex(PALETTE.cavern);
  ctx.fillRect(ox + 19, 61, 7, 10);
  ctx.fillRect(ox + 31, 61, 7, 10);
  ctx.fillStyle = hex(PALETTE.moss);
  ctx.beginPath();
  ctx.moveTo(ox + 18, 28 + bob);
  ctx.lineTo(ox + 39, 28 + bob);
  ctx.lineTo(ox + 44, 65);
  ctx.lineTo(ox + 13, 65);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = hex(PALETTE.stone);
  ctx.fillRect(ox + 22, 34 + bob, 14, 22);
  ctx.fillStyle = hex(PALETTE.echo);
  ctx.fillRect(ox + 24, 40 + bob, 3, 3);
  ctx.fillRect(ox + 32, 48 + bob, 2, 3);

  // Skull face.
  ctx.fillStyle = hex(PALETTE.bone);
  ctx.beginPath();
  ctx.ellipse(ox + 29, 23 + bob, 8, 9, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = hex(PALETTE.void);
  ctx.fillRect(ox + 24, 22 + bob, 3, 3);
  ctx.fillRect(ox + 31, 22 + bob, 3, 3);
  ctx.fillRect(ox + 27, 27 + bob, 4, 2);

  // Great censer hammer. It rises through the wind-up and crashes on active.
  const handY = 45 + bob - raise;
  ctx.fillStyle = hex(PALETTE.stoneLit);
  ctx.fillRect(ox + 43, handY, 5, 21);
  ctx.fillStyle = hex(PALETTE.brassDark);
  ctx.fillRect(ox + 38, handY - 4, 15, 10);
  ctx.fillStyle = hex(PALETTE.ember);
  ctx.fillRect(ox + 41, handY - 1, 9, 3);
}

function drawBellThief(ctx: CanvasRenderingContext2D, ox: number, frame: number): void {
  const bob = frame % 2;
  const crouch = frame === 2 ? 2 : frame === 3 ? 4 : 0;

  // Long coat and quick feet.
  ctx.fillStyle = hex(PALETTE.cavern);
  const stride = frame === 4 ? 4 : 0;
  ctx.fillRect(ox + 23 - stride, 61, 6, 10);
  ctx.fillRect(ox + 34 + stride, 61, 6, 10);
  ctx.fillStyle = hex(PALETTE.deepWater);
  ctx.beginPath();
  ctx.moveTo(ox + 22, 30 + bob + crouch);
  ctx.lineTo(ox + 41, 30 + bob + crouch);
  ctx.lineTo(ox + 47, 65);
  ctx.lineTo(ox + 16, 65);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = hex(PALETTE.stone);
  ctx.fillRect(ox + 27, 35 + bob + crouch, 9, 18);

  // Wide brim and a brass half-mask.
  ctx.fillStyle = hex(PALETTE.void);
  ctx.beginPath();
  ctx.ellipse(ox + 31, 26, 19, 4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = hex(PALETTE.stone);
  ctx.beginPath();
  ctx.ellipse(ox + 31, 22 + bob, 9, 10, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = hex(PALETTE.brassDark);
  ctx.fillRect(ox + 25, 22 + bob, 12, 5);
  ctx.fillStyle = hex(PALETTE.echo);
  ctx.fillRect(ox + 27, 23 + bob, 2, 2);
  ctx.fillRect(ox + 33, 23 + bob, 2, 2);

  // Bell staff; the active frame sweeps it forward.
  const sweep = frame === 4 ? 6 : 0;
  ctx.fillStyle = hex(PALETTE.brassDark);
  ctx.fillRect(ox + 45 + sweep, 18 + bob, 3, 44);
  ctx.fillStyle = hex(PALETTE.brass);
  ctx.beginPath();
  ctx.arc(ox + 46 + sweep, 18 + bob, 6, Math.PI, Math.PI * 2);
  ctx.fill();
  ctx.fillRect(ox + 42 + sweep, 18 + bob, 9, 2);
  ctx.fillStyle = hex(PALETTE.bone);
  ctx.fillRect(ox + 44 + sweep, 13 + bob, 2, 3);
}

function drawLastKeeper(ctx: CanvasRenderingContext2D, ox: number, frame: number): void {
  const bob = frame % 2;
  const lean = frame === 2 ? -3 : frame === 3 ? -5 : frame === 4 ? 5 : 0;

  // Drowned keeper's robes, heavy and still.
  ctx.fillStyle = hex(PALETTE.cavern);
  const stride = frame === 4 ? 4 : 0;
  ctx.fillRect(ox + 20 - stride, 61, 7, 10);
  ctx.fillRect(ox + 32 + stride, 61, 7, 10);
  ctx.fillStyle = hex(PALETTE.stone);
  ctx.beginPath();
  ctx.moveTo(ox + 18, 30 + bob);
  ctx.lineTo(ox + 39, 30 + bob);
  ctx.lineTo(ox + 44, 65);
  ctx.lineTo(ox + 13, 65);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = hex(PALETTE.stoneLit);
  ctx.fillRect(ox + 24, 36 + bob, 5, 24);
  ctx.fillStyle = hex(PALETTE.moss);
  ctx.fillRect(ox + 14, 55, 33, 4);

  // Masked face: hollow eyes, a thin brass mouth.
  ctx.fillStyle = hex(PALETTE.bone);
  ctx.beginPath();
  ctx.ellipse(ox + 29, 24 + bob, 8, 10, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = hex(PALETTE.void);
  ctx.fillRect(ox + 25, 23 + bob, 2, 2);
  ctx.fillRect(ox + 32, 23 + bob, 2, 2);
  ctx.fillStyle = hex(PALETTE.brass);
  ctx.fillRect(ox + 27, 30 + bob, 5, 2);

  // Great bell-hammer, draped across the body.
  const handY = 44 + bob - (frame === 2 || frame === 3 ? 8 : 0);
  ctx.fillStyle = hex(PALETTE.brassDark);
  ctx.fillRect(ox + 44 + lean, handY, 4, 22);
  ctx.fillStyle = hex(PALETTE.brass);
  ctx.fillRect(ox + 39 + lean, handY - 3, 16, 8);
  ctx.fillStyle = hex(PALETTE.bone);
  ctx.fillRect(ox + 42 + lean, handY + 1, 8, 2);
}

const PAINTERS: Readonly<
  Record<BossKind, (ctx: CanvasRenderingContext2D, ox: number, frame: number) => void>
> = {
  bellbearer: drawBellbearer,
  wardenMoss: drawWardenMoss,
  bellThief: drawBellThief,
  lastKeeper: drawLastKeeper,
};

function buildAnimations(): Record<string, AnimationClip> {
  return {
    idle: {
      loop: true,
      frames: [
        { frame: 0, ticks: 14 },
        { frame: 1, ticks: 14 },
      ],
    },
    walk: {
      loop: true,
      frames: [
        { frame: 0, ticks: 10 },
        { frame: 1, ticks: 10 },
        { frame: 2, ticks: 10 },
        { frame: 3, ticks: 10 },
      ],
    },
    windup: {
      loop: false,
      frames: [
        { frame: 2, ticks: 8 },
        { frame: 3, ticks: 12 },
      ],
    },
    active: {
      loop: false,
      frames: [{ frame: 4, ticks: 14 }],
    },
    hurt: {
      loop: false,
      frames: [{ frame: 5, ticks: 10 }],
    },
  };
}

export function buildBossArt(kind: BossKind): Build {
  const textureKey = `proc.boss.${kind}`;
  const texture = paint(FRAME_W * FRAMES, FRAME_H, (ctx) => {
    for (let frame = 0; frame < FRAMES; frame += 1) {
      PAINTERS[kind](ctx, frame * FRAME_W, frame);
    }
  });
  return {
    texture,
    art: {
      textureKey,
      sheet: { frameWidth: FRAME_W, frameHeight: FRAME_H, columns: FRAMES },
      origin: { x: FRAME_W / 2, y: FRAME_H },
      animations: buildAnimations(),
    },
  };
}
