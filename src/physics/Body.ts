/**
 * A dynamic axis-aligned box. `x`/`y` is the top-left corner in world pixels; velocity is
 * in pixels per second. Pure data plus its constructor — the solver lives in
 * `TileCollision.ts`.
 */
export type Body = {
  x: number;
  y: number;
  w: number;
  h: number;
  vx: number;
  vy: number;
  /** True when a solid surface is directly under the body (set by moveAndCollide). */
  grounded: boolean;
  /** While > 0, one-way platforms are ignored: the body is dropping through one. */
  dropThroughTicks: number;
};

export function createBody(x: number, y: number, w: number, h: number): Body {
  return { x, y, w, h, vx: 0, vy: 0, grounded: false, dropThroughTicks: 0 };
}

/** Feet-center of the body in world pixels (sprite anchor, camera focus). */
export function bodyFeet(body: Body): { x: number; y: number } {
  return { x: body.x + body.w / 2, y: body.y + body.h };
}
