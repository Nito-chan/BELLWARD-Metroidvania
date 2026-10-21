import { RENDER } from '../config/render';
import { BellwardError } from '../core/Errors';
import { TILE_ROLES, roleIsOneWay, type TileRole } from './tiles';

/**
 * A parsed room layout: a fixed grid of semantic tile roles. Parsing validates the
 * level data (rectangular rows, complete legend) and fails loudly so a typo in an
 * ASCII room can never ship as a mysterious invisible hole.
 */
export class Tilemap {
  readonly width: number;
  readonly height: number;
  /** Number of non-empty cells (handy for debug state and tests). */
  private tileCountValue: number;
  /** Row-major roles; null means empty space. Mutable only through removeAll(). */
  private readonly roles: (TileRole | null)[];

  private constructor(width: number, height: number, roles: (TileRole | null)[]) {
    this.width = width;
    this.height = height;
    this.roles = roles;
    let count = 0;
    for (const role of roles) {
      if (role !== null) count += 1;
    }
    this.tileCountValue = count;
  }

  get tileCount(): number {
    return this.tileCountValue;
  }

  /**
   * Builds a tilemap from ASCII rows. Space is always empty; every other glyph must
   * map to a known tile role.
   */
  static fromRows(rows: readonly string[], legend: Readonly<Record<string, TileRole>>): Tilemap {
    if (rows.length === 0) {
      throw new BellwardError('room layout must contain at least one row');
    }
    const width = rows[0]?.length ?? 0;
    if (width === 0) {
      throw new BellwardError('room layout rows must not be empty');
    }
    for (const glyph of Object.keys(legend)) {
      if (glyph.length !== 1 || glyph === ' ') {
        throw new BellwardError(
          `legend glyph ${JSON.stringify(glyph)} must be a single non-space character`,
        );
      }
    }

    const roles: (TileRole | null)[] = [];
    for (let ty = 0; ty < rows.length; ty += 1) {
      const row = rows[ty] ?? '';
      if (row.length !== width) {
        throw new BellwardError(
          `room row ${ty} has length ${row.length}, expected ${width} (rows must be rectangular)`,
        );
      }
      for (let tx = 0; tx < width; tx += 1) {
        const glyph = row.charAt(tx);
        if (glyph === ' ') {
          roles.push(null);
          continue;
        }
        const role = legend[glyph];
        if (role === undefined) {
          throw new BellwardError(
            `room glyph ${JSON.stringify(glyph)} at (${tx},${ty}) is missing from the legend`,
          );
        }
        if (!(role in TILE_ROLES)) {
          throw new BellwardError(
            `room glyph ${JSON.stringify(glyph)} at (${tx},${ty}) maps to unknown role "${role}"`,
          );
        }
        roles.push(role);
      }
    }

    return new Tilemap(width, rows.length, roles);
  }

  /** Room width in world pixels. */
  get pixelWidth(): number {
    return this.width * RENDER.tileSize;
  }

  /** Room height in world pixels. */
  get pixelHeight(): number {
    return this.height * RENDER.tileSize;
  }

  contains(tx: number, ty: number): boolean {
    return tx >= 0 && ty >= 0 && tx < this.width && ty < this.height;
  }

  /** Role at a tile coordinate, or null for empty space / out of bounds. */
  roleAt(tx: number, ty: number): TileRole | null {
    if (!this.contains(tx, ty)) return null;
    return this.roles[ty * this.width + tx] ?? null;
  }

  /** True when the tile blocks movement (out-of-bounds counts as empty). */
  isSolid(tx: number, ty: number): boolean {
    const role = this.roleAt(tx, ty);
    return role !== null && TILE_ROLES[role].solid;
  }

  /** True when the tile is a drop-through one-way platform. */
  isOneWay(tx: number, ty: number): boolean {
    const role = this.roleAt(tx, ty);
    return role !== null && roleIsOneWay(role);
  }

  /**
   * True when the tile blocks sideways movement: solid, but not a one-way platform.
   * The collision solver is the consumer; out-of-bounds handling stays in the solver.
   */
  isWall(tx: number, ty: number): boolean {
    const role = this.roleAt(tx, ty);
    return role !== null && TILE_ROLES[role].solid && !roleIsOneWay(role);
  }

  /**
   * Removes every tile of a role, returning how many cells changed. Used for broken
   * secret walls and for the Tide door once its key is owned; the collision grid and the
   * render layer read the same mutation, so no phantom collider survives.
   */
  removeAll(role: TileRole): number {
    let removed = 0;
    for (let index = 0; index < this.roles.length; index += 1) {
      if (this.roles[index] === role) {
        this.roles[index] = null;
        removed += 1;
      }
    }
    this.tileCountValue -= removed;
    return removed;
  }

  /** True when any matching role sits inside the rect. Used by nail vs. cracked stone. */
  hasRoleInRect(role: TileRole, rect: { x: number; y: number; w: number; h: number }): boolean {
    const size = RENDER.tileSize;
    const left = Math.max(0, Math.floor(rect.x / size));
    const top = Math.max(0, Math.floor(rect.y / size));
    const right = Math.min(this.width - 1, Math.floor((rect.x + rect.w - 0.001) / size));
    const bottom = Math.min(this.height - 1, Math.floor((rect.y + rect.h - 0.001) / size));
    for (let ty = top; ty <= bottom; ty += 1) {
      for (let tx = left; tx <= right; tx += 1) {
        if (this.roleAt(tx, ty) === role) return true;
      }
    }
    return false;
  }
  /** Visits every non-empty tile in row-major order (stable rendering order). */
  forEachTile(visit: (tx: number, ty: number, role: TileRole) => void): void {
    for (let ty = 0; ty < this.height; ty += 1) {
      for (let tx = 0; tx < this.width; tx += 1) {
        const role = this.roles[ty * this.width + tx];
        if (role) visit(tx, ty, role);
      }
    }
  }
}
