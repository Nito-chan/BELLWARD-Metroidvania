import { PALETTE } from '../../config/palette';
import { hex } from './canvas';

/** Gradient sky, moon and two mountain ranges; authored at viewport size. */
export function paintSky(ctx: CanvasRenderingContext2D, width: number, height: number): void {
  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, hex(PALETTE.void));
  gradient.addColorStop(0.55, hex(PALETTE.deepWater));
  gradient.addColorStop(1, hex(PALETTE.cavern));
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  ctx.globalAlpha = 0.16;
  ctx.fillStyle = hex(PALETTE.bone);
  ctx.beginPath();
  ctx.arc(500, 72, 34, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 0.85;
  ctx.beginPath();
  ctx.arc(500, 72, 15, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;

  // Mountain ranges repeat every 80px so the texture tiles without a visible seam.
  ctx.fillStyle = hex(PALETTE.cavern);
  for (let i = 0; i < 8; i += 1) {
    ctx.beginPath();
    ctx.moveTo(i * 80, 330);
    ctx.lineTo(i * 80 + 40, 246);
    ctx.lineTo(i * 80 + 80, 330);
    ctx.closePath();
    ctx.fill();
  }
  ctx.fillStyle = hex(PALETTE.void);
  ctx.globalAlpha = 0.7;
  for (let i = 0; i < 8; i += 1) {
    ctx.beginPath();
    ctx.moveTo(i * 80 - 20, 360);
    ctx.lineTo(i * 80 + 20, 292);
    ctx.lineTo(i * 80 + 60, 360);
    ctx.closePath();
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

/** Layered belfry silhouettes with lit windows, repeating every 160px. */
export function paintSkyline(ctx: CanvasRenderingContext2D, width: number, height: number): void {
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = hex(PALETTE.void);
  for (let cluster = 0; cluster < 4; cluster += 1) {
    const x = cluster * 160;
    ctx.fillRect(x + 4, 286, 34, 74);
    ctx.fillRect(x + 44, 306, 26, 54);
    ctx.fillRect(x + 74, 268, 40, 92);
    ctx.fillRect(x + 118, 300, 38, 60);
    // Spire on the tallest building.
    ctx.beginPath();
    ctx.moveTo(x + 74, 268);
    ctx.lineTo(x + 94, 232);
    ctx.lineTo(x + 114, 268);
    ctx.closePath();
    ctx.fill();
    // A cross-bar to read as a belfry silhouette.
    ctx.fillRect(x + 92, 242, 4, 12);
    ctx.fillRect(x + 88, 248, 12, 3);
  }
  ctx.globalAlpha = 0.55;
  ctx.fillStyle = hex(PALETTE.ember);
  for (let cluster = 0; cluster < 4; cluster += 1) {
    const x = cluster * 160;
    ctx.fillRect(x + 12, 300, 3, 4);
    ctx.fillRect(x + 24, 316, 3, 4);
    ctx.fillRect(x + 84, 284, 3, 4);
    ctx.fillRect(x + 98, 304, 3, 4);
    ctx.fillRect(x + 128, 316, 3, 4);
  }
  ctx.globalAlpha = 1;
}
