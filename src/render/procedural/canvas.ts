import { Texture } from 'pixi.js';
import { BellwardError } from '../../core/Errors';

/** Shared canvas plumbing for every procedural stand-in. */

export const TILE_SIZE = 16;

export type Painter = (ctx: CanvasRenderingContext2D) => void;

export function hex(color: number): string {
  return `#${color.toString(16).padStart(6, '0')}`;
}

export function paint(width: number, height: number, painter: Painter): Texture {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new BellwardError('procedural art requires a 2D canvas context');
  }
  ctx.imageSmoothingEnabled = false;
  painter(ctx);
  const texture = Texture.from(canvas);
  texture.source.scaleMode = 'nearest';
  return texture;
}

/** One 16px brick cell with mortar and a lit top / shadowed bottom bevel. */
export function brick(
  ctx: CanvasRenderingContext2D,
  base: number,
  mortar: number,
  light: number,
  dark: number,
): void {
  ctx.fillStyle = hex(base);
  ctx.fillRect(0, 0, TILE_SIZE, TILE_SIZE);
  ctx.fillStyle = hex(mortar);
  ctx.fillRect(0, 0, TILE_SIZE, 1);
  ctx.fillRect(0, 8, TILE_SIZE, 1);
  ctx.fillRect(0, 0, 1, 8);
  ctx.fillRect(8, 8, 1, 8);
  ctx.fillStyle = hex(light);
  ctx.fillRect(1, 1, 7, 1);
  ctx.fillRect(9, 9, 6, 1);
  ctx.fillStyle = hex(dark);
  ctx.fillRect(1, 7, 7, 1);
  ctx.fillRect(9, 15, 6, 1);
}
