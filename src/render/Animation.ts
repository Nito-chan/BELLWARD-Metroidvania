/**
 * Frame-clock animation data. Durations are authored in fixed simulation ticks
 * (60 ticks = 1 s) so animation timing is identical on every machine and replays
 * exactly. See docs/ASSET_NOTES.md for the authoring contract.
 */

export type AnimationFrame = {
  /** Zero-based frame index inside the sprite sheet (row-major, `columns` per row). */
  readonly frame: number;
  /** How long this frame is shown, in simulation ticks. */
  readonly ticks: number;
};

export type AnimationClip = {
  /** Optional per-clip sheet override (e.g. idle and run live in separate files). */
  readonly textureKey?: string;
  readonly frames: readonly AnimationFrame[];
  /** Looping clips wrap to frame 0; one-shot clips hold their final frame. */
  readonly loop: boolean;
};

export type AnimationSet = Readonly<Record<string, AnimationClip>>;

/** Geometry of a uniform-grid sprite sheet. */
export type SheetInfo = {
  readonly frameWidth: number;
  readonly frameHeight: number;
  /** Number of frame columns per sheet row. */
  readonly columns: number;
};

/** Everything the renderer needs to draw an animated character. */
export type CharacterArt = {
  /** Texture key registered in Pixi's asset cache. */
  readonly textureKey: string;
  readonly sheet: SheetInfo;
  readonly animations: AnimationSet;
  /** Offset from the frame's top-left to the character's feet-center, in pixels. */
  readonly origin: { readonly x: number; readonly y: number };
};
