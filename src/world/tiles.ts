/**
 * Semantic tile roles. Room layouts reference roles ("this cell is structural wall"),
 * never art frames, so the packed tileset and the procedural fallback can render the
 * same room without duplicating level data.
 *
 * Collision semantics live here too: M2's physics reads the same table.
 */

export type TileRoleInfo = {
  /** Blocks movement on all sides. */
  readonly solid: boolean;
  /** Solid from above only (drop-through platforms). */
  readonly oneWay?: boolean;
};

export const TILE_ROLES = {
  /** Top surface of a floor (lit rim, walkable). */
  floor: { solid: true },
  /** Interior fill below a floor surface. */
  floorFill: { solid: true },
  /** Structural wall interior. */
  wall: { solid: true },
  /** Wall with an exposed, lit edge. */
  wallTrim: { solid: true },
  /** Vertical support column. */
  pillar: { solid: true },
  /** Thin drop-through ledge. */
  ledge: { solid: true, oneWay: true },
  /** Arched window set into a wall (decorative, non-solid). */
  window: { solid: false },
  /** Dark recessed brickwork behind the play space (decorative). */
  backgroundBrick: { solid: false },
  /** Shallow standing water on top of a floor tile (decorative). */
  puddle: { solid: false },
  /** Loose stone debris (decorative). */
  rubble: { solid: false },
  /** Cobweb in a corner (decorative). */
  cobweb: { solid: false },
} as const satisfies Readonly<Record<string, TileRoleInfo>>;

export type TileRole = keyof typeof TILE_ROLES;

/** Typed view of the role table so optional fields (oneWay) are safe to read. */
const ROLE_TABLE: Readonly<Record<TileRole, TileRoleInfo>> = TILE_ROLES;

/** True when the role exists and blocks movement. */
export function roleIsSolid(role: TileRole): boolean {
  return ROLE_TABLE[role].solid;
}

/** True when the role is a one-way (drop-through) platform. */
export function roleIsOneWay(role: TileRole): boolean {
  return ROLE_TABLE[role].oneWay === true;
}
