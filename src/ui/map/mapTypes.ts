/** Shared vocabulary for the Tideglass chart. Pure data; no DOM types leak in here. */
import type { MapPin } from '../../config/map';

export type MapSide = 'north' | 'east' | 'south' | 'west';

/** Four wax states. Swept is a badge on a charted room, not a fifth state. */
export type MapRoomState = 'unheard' | 'ghost' | 'charted' | 'current';

export type MapDoorKind = 'open' | 'bell' | 'secret' | 'sealed' | 'drop';

/** What the glass knows about a specific passage right now. */
export type MapDoorState = 'open' | 'unknown' | 'sealed' | 'secret' | 'drop';

export type MapRect = {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
};

export type MapSegment = {
  readonly x1: number;
  readonly y1: number;
  readonly x2: number;
  readonly y2: number;
};

/** Local room plan, in chart pixels. The room's placed origin is not included. */
export type MapRoomGeometry = {
  readonly solid: readonly MapRect[];
  readonly ledges: readonly MapRect[];
  readonly breakables: readonly MapRect[];
  readonly sealed: readonly MapRect[];
  /** Lit top surfaces, merged into long runs for a drawn-plan look. */
  readonly surfaces: readonly MapSegment[];
};

export type MapDoorSnapshot = {
  readonly targetRoomId: string;
  /** Null while the destination is still a ghost. */
  readonly targetName: string | null;
  readonly side: MapSide;
  /** 0..1 along the room's edge. */
  readonly at: number;
  readonly kind: MapDoorKind;
  readonly state: MapDoorState;
  /** Human requirement for a sealed door, or null. */
  readonly requirement: string | null;
  readonly ariaLabel: string;
};

export type MapRoomSnapshot = {
  readonly roomId: string;
  readonly name: string;
  readonly label: string;
  readonly kicker: string;
  readonly region: string;
  readonly note: string;
  /** Authored atlas cell, used for spatial menu navigation. */
  readonly row: number;
  readonly col: number;
  readonly state: MapRoomState;
  readonly swept: boolean;
  /** Placed room bounds, in chart pixels. */
  readonly rect: MapRect;
  /** Null until the room is charted; ghost rooms never leak their plan. */
  readonly geometry: MapRoomGeometry | null;
  readonly exits: readonly MapDoorSnapshot[];
  readonly benchName: string | null;
  readonly bossName: string | null;
  readonly bossKind: string | null;
  readonly bossClaimed: boolean;
  readonly pickupTotal: number;
  readonly pickupFound: number;
  readonly secret: boolean;
  readonly secretFound: boolean;
  readonly remainingBoss: boolean;
  readonly remainingPickups: number;
  readonly remainingSecret: boolean;
  readonly pinned: boolean;
  readonly ariaLabel: string;
};

export type MapLinkState = 'open' | 'ghost' | 'sealed' | 'secret' | 'drop';

export type MapLinkSnapshot = {
  readonly id: string;
  readonly from: string;
  readonly to: string;
  readonly fromPoint: { readonly x: number; readonly y: number };
  readonly toPoint: { readonly x: number; readonly y: number };
  readonly midPoint: { readonly x: number; readonly y: number };
  readonly path: string;
  readonly state: MapLinkState;
  readonly kind: MapDoorKind;
  readonly oneWay: boolean;
  /** The missing ward or key when state is sealed. */
  readonly requirement: string | null;
};

export type MapSnapshot = {
  readonly rooms: readonly MapRoomSnapshot[];
  readonly links: readonly MapLinkSnapshot[];
  readonly currentRoomId: string;
  readonly currentPosition: { readonly x: number; readonly y: number } | null;
  readonly bounds: MapRect;
  readonly chartedCount: number;
  readonly totalCount: number;
  readonly ghostCount: number;
  readonly sealedCount: number;
  readonly sweptCount: number;
  readonly sigilCount: number;
  readonly bossCount: number;
  readonly checkpoint: { readonly name: string; readonly roomId: string } | null;
  readonly lead: string;
  readonly pins: readonly MapPin[];
  readonly pinCount: number;
  readonly pinLimit: number;
  readonly tideglass: boolean;
  readonly endingSeen: boolean;
  readonly hasTideBell: boolean;
  readonly arsenal: boolean;
};
