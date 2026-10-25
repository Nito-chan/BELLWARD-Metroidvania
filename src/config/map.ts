/**
 * The Tideglass chart contract. Values here are shared by the save document, the pure
 * chart model and the DOM screen so the wax never disagrees with the run.
 */

export const MAP = {
  /** One world tile becomes this many chart pixels. */
  tileSize: 4,
  /** Authored atlas spacing, in chart tiles. Rooms are 60x24 tiles. */
  columnStep: 66,
  rowStep: 32,
  roomWidth: 60,
  roomHeight: 24,
  /** Base map holds five wax marks; the Stylus lens will raise this later. */
  pinLimit: 5,
  /** The save accepts future lens capacity without requiring a new version. */
  savePinLimit: 12,
  zoomMin: 0.28,
  zoomMax: 2.5,
  zoomStep: 1.25,
  fitPadding: 24,
  /** Touch opens on the current chamber at this scale rather than a postage stamp. */
  mobileFocusScale: 0.55,
} as const;

export const MAP_PIN_KINDS = ['mark'] as const;
export type MapPinKind = (typeof MAP_PIN_KINDS)[number];

/** A wax mark the Keeper pressed into the chart. Pins are durable run facts. */
export type MapPin = {
  readonly roomId: string;
  readonly kind: MapPinKind;
};

export function isMapPinKind(value: unknown): value is MapPinKind {
  return typeof value === 'string' && (MAP_PIN_KINDS as readonly string[]).includes(value);
}
