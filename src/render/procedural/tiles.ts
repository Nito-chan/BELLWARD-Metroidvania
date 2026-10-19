import { PALETTE } from '../../config/palette';
import type { TileRole } from '../../world/tiles';
import { brick, hex, TILE_SIZE, type Painter } from './canvas';

/** One 16px painter per semantic tile role, indexed by the same keys as the packed art. */
export const TILE_PAINTERS: Record<TileRole, Painter> = {
  floor: (ctx) => {
    ctx.fillStyle = hex(PALETTE.stone);
    ctx.fillRect(0, 0, TILE_SIZE, TILE_SIZE);
    ctx.fillStyle = hex(PALETTE.stoneLit);
    ctx.fillRect(0, 0, TILE_SIZE, 3);
    ctx.fillStyle = hex(PALETTE.bone);
    ctx.fillRect(1, 0, 6, 1);
    ctx.fillRect(9, 0, 5, 1);
    ctx.fillStyle = hex(PALETTE.cavern);
    ctx.fillRect(0, 3, TILE_SIZE, 1);
    ctx.fillRect(7, 4, 1, 5);
    ctx.fillRect(0, 12, TILE_SIZE, 1);
    ctx.fillStyle = hex(PALETTE.stoneLit);
    ctx.fillRect(1, 4, 5, 1);
  },
  floorFill: (ctx) => {
    brick(ctx, PALETTE.cavern, PALETTE.void, PALETTE.stone, PALETTE.void);
  },
  wall: (ctx) => {
    brick(ctx, PALETTE.stone, PALETTE.void, PALETTE.stoneLit, PALETTE.cavern);
  },
  wallTrim: (ctx) => {
    brick(ctx, PALETTE.stone, PALETTE.void, PALETTE.stoneLit, PALETTE.cavern);
    ctx.fillStyle = hex(PALETTE.stoneLit);
    ctx.fillRect(0, 0, TILE_SIZE, 2);
    ctx.fillStyle = hex(PALETTE.bone);
    ctx.fillRect(1, 0, 14, 1);
  },
  pillar: (ctx) => {
    brick(ctx, PALETTE.stone, PALETTE.void, PALETTE.stoneLit, PALETTE.cavern);
    ctx.fillStyle = hex(PALETTE.void);
    ctx.fillRect(0, 0, 2, TILE_SIZE);
    ctx.fillRect(14, 0, 2, TILE_SIZE);
    ctx.fillStyle = hex(PALETTE.stoneLit);
    ctx.fillRect(6, 0, 2, TILE_SIZE);
  },
  ledge: (ctx) => {
    ctx.fillStyle = hex(PALETTE.stone);
    ctx.fillRect(0, 0, TILE_SIZE, 6);
    ctx.fillStyle = hex(PALETTE.stoneLit);
    ctx.fillRect(0, 0, TILE_SIZE, 2);
    ctx.fillStyle = hex(PALETTE.void);
    ctx.fillRect(0, 6, TILE_SIZE, 1);
    ctx.fillRect(4, 2, 1, 4);
    ctx.fillRect(12, 2, 1, 4);
  },
  window: (ctx) => {
    ctx.fillStyle = hex(PALETTE.void);
    ctx.fillRect(0, 0, TILE_SIZE, TILE_SIZE);
    ctx.fillStyle = hex(PALETTE.deepWater);
    ctx.beginPath();
    ctx.arc(8, 9, 6, Math.PI, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(2, 9, 12, 7);
    ctx.strokeStyle = hex(PALETTE.brassDark);
    ctx.lineWidth = 1;
    ctx.strokeRect(1.5, 1.5, 13, 14);
    ctx.fillStyle = hex(PALETTE.ember);
    ctx.globalAlpha = 0.5;
    ctx.fillRect(4, 10, 2, 4);
    ctx.fillRect(10, 10, 2, 4);
    ctx.globalAlpha = 1;
  },
  backgroundBrick: (ctx) => {
    brick(ctx, PALETTE.void, PALETTE.deepWater, PALETTE.cavern, PALETTE.void);
  },
  puddle: (ctx) => {
    ctx.fillStyle = hex(PALETTE.deepWater);
    ctx.globalAlpha = 0.8;
    ctx.beginPath();
    ctx.ellipse(8, 11, 7, 3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = hex(PALETTE.echo);
    ctx.globalAlpha = 0.5;
    ctx.fillRect(4, 10, 5, 1);
    ctx.globalAlpha = 1;
  },
  rubble: (ctx) => {
    ctx.fillStyle = hex(PALETTE.stone);
    ctx.fillRect(2, 10, 5, 4);
    ctx.fillRect(9, 8, 4, 6);
    ctx.fillStyle = hex(PALETTE.stoneLit);
    ctx.fillRect(3, 10, 3, 1);
    ctx.fillRect(10, 8, 2, 1);
    ctx.fillStyle = hex(PALETTE.void);
    ctx.fillRect(6, 13, 3, 1);
  },
  cobweb: (ctx) => {
    ctx.strokeStyle = hex(PALETTE.bone);
    ctx.globalAlpha = 0.25;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(14, 14);
    ctx.moveTo(6, 0);
    ctx.lineTo(14, 8);
    ctx.moveTo(0, 6);
    ctx.lineTo(8, 14);
    ctx.stroke();
    ctx.globalAlpha = 1;
  },
};
