import { Rectangle, Texture } from 'pixi.js';
import type { SheetInfo } from './Animation';

/**
 * Slices one frame from a uniform-grid sheet. The sheet's frame origin is the sheet's
 * top-left, so frame indices are row-major with `columns` per row.
 */
export function sliceFrame(sheet: Texture, info: SheetInfo, index: number): Texture {
  const { frameWidth, frameHeight, columns } = info;
  const column = index % columns;
  const row = Math.floor(index / columns);
  return new Texture({
    source: sheet.source,
    frame: new Rectangle(column * frameWidth, row * frameHeight, frameWidth, frameHeight),
  });
}
