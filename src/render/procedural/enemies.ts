import type { Texture } from 'pixi.js';
import type { EnemyKind } from '../../config/enemies';
import { PALETTE } from '../../config/palette';
import type { AnimationClip, CharacterArt } from '../Animation';
import { hex, paint } from './canvas';

/**
 * Canvas stand-ins for the three enemy kinds. Every kind shares one 4-frame strip and
 * the same clip names (`idle`, `walk`, `hurt`, plus `cast` for the adept), so gameplay
 * and debug state are identical with or without the packed church/town art. Silhouettes
 * are deliberately different: hunched and hooded, tall and burning, robed and masked.
 */

const FRAME_W = 40;
const FRAME_H = 52;
const FRAMES = 4;

type Build = { art: CharacterArt; texture: Texture };

function drawParishioner(ctx: CanvasRenderingContext2D, ox: number, frame: number): void {
  const bob = frame % 2;
  // Hunched cloak.
  ctx.fillStyle = hex(PALETTE.moss);
  ctx.beginPath();
  ctx.moveTo(ox + 10, 26 + bob);
  ctx.lineTo(ox + 30, 26 + bob);
  ctx.lineTo(ox + 34, 48);
  ctx.lineTo(ox + 6, 48);
  ctx.closePath();
  ctx.fill();
  // Legs: alternate on the walk frames.
  ctx.fillStyle = hex(PALETTE.cavern);
  const stride = frame >= 2 ? 2 : 0;
  ctx.fillRect(ox + 14 - stride, 44, 5, 8);
  ctx.fillRect(ox + 21 + stride, 44, 5, 8);
  // Bent back and hood.
  ctx.fillStyle = hex(PALETTE.stone);
  ctx.beginPath();
  ctx.ellipse(ox + 20, 24 + bob, 8, 9, 0.25, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = hex(PALETTE.void);
  ctx.fillRect(ox + 17, 22 + bob, 7, 3);
  // Lantern: the only warm point on the silhouette.
  ctx.fillStyle = hex(PALETTE.ember);
  ctx.fillRect(ox + 31, 30 + bob, 3, 4);
}

function drawGhoul(ctx: CanvasRenderingContext2D, ox: number, frame: number): void {
  const bob = frame % 2;
  // Legs and hunched body.
  ctx.fillStyle = hex(PALETTE.stone);
  ctx.fillRect(ox + 14, 40, 5, 12);
  ctx.fillRect(ox + 21, 40, 5, 12);
  ctx.fillStyle = hex(PALETTE.cavern);
  ctx.fillRect(ox + 12, 24 + bob, 16, 20);
  ctx.fillStyle = hex(PALETTE.stoneLit);
  ctx.fillRect(ox + 13, 24 + bob, 4, 14);
  // Arms reaching forward.
  ctx.fillStyle = hex(PALETTE.stone);
  ctx.fillRect(ox + 26, 30 + bob, 9, 4);
  ctx.fillRect(ox + 4, 30 + bob, 8, 4);
  // Burning head: layered polygons so it flickers between frames.
  const flick = frame % 2 === 0 ? 0 : -2;
  ctx.fillStyle = hex(PALETTE.ember);
  ctx.beginPath();
  ctx.moveTo(ox + 14, 24 + bob);
  ctx.lineTo(ox + 20 + flick, 4 + bob);
  ctx.lineTo(ox + 27, 24 + bob);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = hex(PALETTE.bone);
  ctx.beginPath();
  ctx.moveTo(ox + 18, 22 + bob);
  ctx.lineTo(ox + 20 + flick, 12 + bob);
  ctx.lineTo(ox + 23, 22 + bob);
  ctx.closePath();
  ctx.fill();
}

function drawAdept(ctx: CanvasRenderingContext2D, ox: number, frame: number): void {
  const bob = frame % 2;
  // Tall robe.
  ctx.fillStyle = hex(PALETTE.deepWater);
  ctx.beginPath();
  ctx.moveTo(ox + 12, 22 + bob);
  ctx.lineTo(ox + 28, 22 + bob);
  ctx.lineTo(ox + 33, 50);
  ctx.lineTo(ox + 7, 50);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = hex(PALETTE.cavern);
  ctx.fillRect(ox + 15, 28 + bob, 10, 14);
  // Hood and brass mask.
  ctx.fillStyle = hex(PALETTE.deepWater);
  ctx.beginPath();
  ctx.ellipse(ox + 20, 18 + bob, 8, 9, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = hex(PALETTE.brassDark);
  ctx.fillRect(ox + 16, 16 + bob, 8, 5);
  ctx.fillStyle = hex(PALETTE.void);
  ctx.fillRect(ox + 17, 18 + bob, 2, 2);
  ctx.fillRect(ox + 21, 18 + bob, 2, 2);
  // Ember hands; they rise on the cast frames.
  const lift = frame >= 2 ? 6 : 0;
  ctx.fillStyle = hex(PALETTE.ember);
  ctx.fillRect(ox + 6, 30 + bob - lift, 5, 5);
  ctx.fillRect(ox + 29, 30 + bob - lift, 5, 5);
}

const PAINTERS: Readonly<
  Record<EnemyKind, (ctx: CanvasRenderingContext2D, ox: number, f: number) => void>
> = {
  parishioner: drawParishioner,
  ghoul: drawGhoul,
  adept: drawAdept,
};

export function buildEnemyArt(kind: EnemyKind): Build {
  const textureKey = `proc.enemy.${kind}`;
  const texture = paint(FRAME_W * FRAMES, FRAME_H, (ctx) => {
    for (let frame = 0; frame < FRAMES; frame += 1) {
      PAINTERS[kind](ctx, frame * FRAME_W, frame);
    }
  });

  const animations: Record<string, AnimationClip> = {
    idle: {
      loop: true,
      frames: [
        { frame: 0, ticks: 12 },
        { frame: 1, ticks: 12 },
      ],
    },
    walk: {
      loop: true,
      frames: [
        { frame: 0, ticks: 7 },
        { frame: 1, ticks: 7 },
        { frame: 2, ticks: 7 },
        { frame: 3, ticks: 7 },
      ],
    },
    hurt: {
      loop: false,
      frames: [
        { frame: 2, ticks: 8 },
        { frame: 3, ticks: 8 },
      ],
    },
  };
  if (kind === 'adept') {
    animations.cast = {
      loop: false,
      frames: [
        { frame: 2, ticks: 12 },
        { frame: 3, ticks: 18 },
      ],
    };
  }

  return {
    texture,
    art: {
      textureKey,
      sheet: { frameWidth: FRAME_W, frameHeight: FRAME_H, columns: FRAMES },
      origin: { x: FRAME_W / 2, y: FRAME_H },
      animations,
    },
  };
}
