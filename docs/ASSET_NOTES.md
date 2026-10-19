# Asset notes — sprite sheet & animation data format

Status: **v1** (M1). The tile/parallax/hero data below is live in `src/data/art.ts`; see D021 for
why the shipped content is typed TypeScript rather than runtime JSON. The JSON shape described
here remains the contract for external packs and in-house art dropped in later (design doc §10.4).

## M1 — what actually ships

### Loaded packs (all via `npm run fetch-assets`, 352 files)

| Pack                          | Author              | License                                                              | Used for                                          |
| ----------------------------- | ------------------- | -------------------------------------------------------------------- | ------------------------------------------------- |
| GothicVania — Church Pack     | Luis Zuno (ansimuz) | CC0-1.0                                                              | terrace tileset cells + carved column             |
| GothicVania — Town Pack       | Luis Zuno (ansimuz) | CC0-1.0                                                              | far sky and skyline parallax sheets               |
| Warped Caves — Pixel Art Pack | Luis Zuno (ansimuz) | CC0-1.0                                                              | fetched and manifested; first use in a later room |
| Fantasy Knight                | aamatniekss         | custom: free commercial, credit + link, no standalone redistribution | hero idle/run (D014)                              |

`MANIFEST.json` has 4 entries, all `commercialUse: true`; `npm run assets:check` reports
474 on-disk files and 0 warnings.

### Hero sheets

- Source: `aamatniekss-knight/Colour1/NoOutline/120x80_PNGSheets/_Idle.png` and `_Run.png`.
- Grid: 120×80 per frame, 10 columns, one row; 10 frames per clip.
- Pivot: **feet-center (54, 80)** — measured from the idle silhouette (x 45..63, feet at y 79).
  Flipping is `sprite.scale.x = ±1` around that pivot.
- Timing: idle 8 ticks/frame, run 5 ticks/frame (sim ticks, 60 Hz).
- The procedural fallback is a 6-frame 32×48 knight with origin (16, 46); it uses the same clip
  interface, so `HeroView` needs no fallback-specific code.
- Run frames lift the feet a few pixels above the idle contact line; the contact shadow keeps the
  hero visually grounded. Per-clip foot offsets are deliberately deferred until the real
  controller (M2) shows whether it matters.

### Tiles

- Roles are semantic (`floor`, `floorFill`, `wall`, `wallTrim`, `pillar`, `ledge`, `window`,
  `backgroundBrick`, `puddle`, `rubble`, `cobweb`); rooms never name atlas cells (see
  `src/world/tiles.ts`, which also carries the solid/one-way flags M2 will read).
- The church tileset is a chunk kit, not a uniform autotile sheet: only verified 16px cells that
  repeat cleanly are listed in `TILE_ART`. Floor variants are picked per cell by a stable integer
  hash, so a room looks identical every run without hand-placed variation.
- `ledge` reuses three floor-top cells and is flagged `oneWay` for M2 collision.

### Background layers ("parallax" contract)

| Key   | Sheet                                                          | Crop                                 | Factor | Anchor                       |
| ----- | -------------------------------------------------------------- | ------------------------------------ | ------ | ---------------------------- |
| `far` | town `background.png` (384×288)                                | rows 0..230 (clouds + mountain tops) | 0.2    | top pinned to world y 0      |
| `mid` | town `middleground.png` (384×288, transparent above the roofs) | full sheet                           | 0.5    | bottom pinned to world y 380 |

- Layers scroll as a short strip of plain sprites covering `640 + maxShift` px; this 960px-wide
  room uses 2 sprites for `far` and 3 for `mid` (D018).
- Tints: `duskFar` / `duskMid`. The extra `deepWater` wash at 12 % is a full-screen ambient layer,
  not part of the parallax art.
- The mid layer's base sits 60 px below the walkway so its painted ground shadow stays hidden;
  only the skyline is visible above the terrace (D019).

### Props

- `balustrade`: church tileset rect (192, 92, 128, 52), bottom-center anchored.
- `column`: `church/ENVIRONMENT/column.png` (114×190).
- `bell`: procedural only (procedural art is deliberately a first-class path, not a degraded one).

### Licensing side

Every downloaded pack gets `public/assets/<pack>/LICENSE.txt` containing the verbatim license
wording + URL + retrieval date, and one MANIFEST.json entry. Validate everything with
`npm run assets:check` (strict mode is the shipping gate).

## Goals

1. New art = new PNG + data entry. No code edits (D021 covers the typed-TypeScript data form).
2. Hit windows, footsteps, projectile spawns etc. are **frame events in data**, never timers in
   code.
3. Every visual key has a procedural fallback (ProceduralArt), so the game runs with zero
   downloaded assets.

## Sheet format

- One PNG per character/boss pack, uniform grid, no padding between frames.
- `frameWidth` / `frameHeight` in source pixels; frames indexed row-major:
  `index = row * columns + column`.
- One grid per sheet; oversized effects get their own sheet.
- Sprite anchors: each animation declares `anchor: { "x": ..., "y": ... }` (flip point; usually
  between the feet), plus optional per-frame `offset` / `trim` to fix sheets whose frames are not
  centered (e.g. the ~4 px shift noted on the Fantasy Knight page).

## Animation JSON (per entity; validated at load, load failures are fatal and readable)

```json
{
  "id": "hero",
  "texture": "sprites/hero.png",
  "frameWidth": 80,
  "frameHeight": 120,
  "animations": {
    "idle": {
      "loop": true,
      "frames": [
        { "index": 0, "durationTicks": 8 },
        { "index": 1, "durationTicks": 8, "events": ["sfx:footstep"] }
      ]
    },
    "attack": {
      "loop": false,
      "frames": [
        { "index": 0, "durationTicks": 2, "events": ["sfx:swing"] },
        {
          "index": 2,
          "durationTicks": 3,
          "events": ["hitboxOn"],
          "hitboxes": [{ "x": 8, "y": -4, "w": 28, "h": 20, "damage": 5 }]
        },
        { "index": 3, "durationTicks": 4, "events": ["hitboxOff"] }
      ]
    }
  }
}
```

- Durations are in **sim ticks** (60 Hz), so animation timing is render-independent.
- Events are string keys routed through the EventBus by the Animator; unknown events fail loudly
  at load time against a registry.
- `hitboxes` are in source pixels, origin = anchor.
