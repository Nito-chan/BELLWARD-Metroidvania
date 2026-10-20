import { PALETTE } from '../../config/palette';
import type { PropKey } from '../../world/Room';
import { hex, type Painter } from './canvas';

/** Canvas size of each procedural prop, in virtual pixels (bottom-center anchored). */
export const PROP_SIZES: Record<PropKey, { w: number; h: number }> = {
  balustrade: { w: 128, h: 52 },
  column: { w: 64, h: 140 },
  bell: { w: 64, h: 96 },
  door: { w: 48, h: 88 },
};

export const PROP_PAINTERS: Record<PropKey, Painter> = {
  balustrade: (ctx) => {
    ctx.fillStyle = hex(PALETTE.stone);
    ctx.fillRect(0, 44, 128, 8);
    ctx.fillRect(0, 8, 128, 8);
    for (const x of [6, 38, 70, 102]) {
      ctx.fillRect(x, 16, 8, 28);
    }
    ctx.fillStyle = hex(PALETTE.stoneLit);
    ctx.fillRect(0, 8, 128, 2);
    ctx.fillRect(8, 44, 112, 2);
    for (const x of [6, 38, 70, 102]) {
      ctx.fillStyle = hex(PALETTE.ember);
      ctx.fillRect(x + 2, 4, 4, 3);
    }
    ctx.fillStyle = hex(PALETTE.void);
    ctx.fillRect(0, 24, 128, 1);
  },
  column: (ctx) => {
    ctx.fillStyle = hex(PALETTE.stone);
    ctx.fillRect(22, 14, 20, 106);
    ctx.fillStyle = hex(PALETTE.stoneLit);
    ctx.fillRect(26, 16, 4, 102);
    ctx.fillStyle = hex(PALETTE.stone);
    ctx.fillRect(14, 0, 36, 14);
    ctx.fillRect(10, 120, 44, 20);
    ctx.fillStyle = hex(PALETTE.stoneLit);
    ctx.fillRect(14, 0, 36, 2);
    ctx.fillRect(10, 120, 44, 2);
    ctx.fillStyle = hex(PALETTE.cavern);
    ctx.fillRect(22, 60, 20, 2);
    ctx.fillRect(22, 90, 20, 2);
  },
  bell: (ctx) => {
    // Chain and yoke.
    ctx.fillStyle = hex(PALETTE.brassDark);
    ctx.fillRect(30, 0, 4, 30);
    ctx.fillRect(16, 28, 32, 6);
    ctx.fillStyle = hex(PALETTE.brass);
    ctx.fillRect(17, 28, 30, 2);
    // Bell body: a tapered brass skirt with a lit left face and a shadowed right face.
    ctx.fillStyle = hex(PALETTE.brass);
    ctx.beginPath();
    ctx.moveTo(24, 34);
    ctx.lineTo(40, 34);
    ctx.lineTo(50, 74);
    ctx.lineTo(14, 74);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = hex(PALETTE.bone);
    ctx.globalAlpha = 0.25;
    ctx.beginPath();
    ctx.moveTo(26, 37);
    ctx.lineTo(30, 37);
    ctx.lineTo(24, 71);
    ctx.lineTo(18, 71);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = hex(PALETTE.brassDark);
    ctx.beginPath();
    ctx.moveTo(38, 37);
    ctx.lineTo(41, 37);
    ctx.lineTo(47, 71);
    ctx.lineTo(42, 71);
    ctx.closePath();
    ctx.fill();
    // Rim and clapper.
    ctx.fillStyle = hex(PALETTE.brassDark);
    ctx.fillRect(12, 74, 40, 6);
    ctx.fillStyle = hex(PALETTE.void);
    ctx.fillRect(14, 74, 36, 2);
    ctx.fillStyle = hex(PALETTE.brassDark);
    ctx.beginPath();
    ctx.arc(32, 83, 4, 0, Math.PI * 2);
    ctx.fill();
  },
  door: (ctx) => {
    // A deep arch cut into the stone, with a brass rim and a small bell keystone.
    ctx.fillStyle = hex(PALETTE.stone);
    ctx.beginPath();
    ctx.moveTo(2, 88);
    ctx.lineTo(2, 30);
    ctx.arc(24, 30, 22, Math.PI, 0);
    ctx.lineTo(46, 88);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = hex(PALETTE.void);
    ctx.beginPath();
    ctx.moveTo(8, 88);
    ctx.lineTo(8, 31);
    ctx.arc(24, 31, 16, Math.PI, 0);
    ctx.lineTo(40, 88);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = hex(PALETTE.stoneLit);
    ctx.fillRect(4, 32, 3, 56);
    ctx.fillRect(41, 32, 3, 56);
    ctx.fillStyle = hex(PALETTE.brassDark);
    ctx.fillRect(7, 52, 34, 3);
    ctx.fillStyle = hex(PALETTE.brass);
    ctx.beginPath();
    ctx.arc(24, 20, 5, Math.PI, 0);
    ctx.fill();
    ctx.fillRect(19, 20, 10, 2);
    ctx.fillStyle = hex(PALETTE.ember);
    ctx.fillRect(23, 24, 2, 2);
  },
};
