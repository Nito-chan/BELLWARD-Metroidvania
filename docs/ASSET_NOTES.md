# Asset notes — sprite sheet & animation data format

Status: **v1.1** (M2 adds the full hero clip table). The tile/parallax/hero data below is live in
`src/data/art.ts`; see D021 for
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

### Hero sheets (M2: all eight clips live)

- Source: `aamatniekss-knight/Colour1/NoOutline/120x80_PNGSheets/` — `_Idle`, `_Run`, `_TurnAround`,
  `_Jump`, `_Fall`, `_Attack`, `_Attack2`, `_Dash` (`_JumpFallInbetween` is unused: the plain jump
  and fall reads are cleaner at 8 px/tick rise).
- Grid: 120×80 per frame, 10 columns, one row, no padding.
- Pivot: **feet-center (54, 80)** — measured from the idle silhouette (x 45..63, feet at y 79).
  Flipping is `sprite.scale.x = ±1` around that pivot.
- All-or-nothing: `KNIGHT_REQUIRED` lists every sheet; if a single one fails to load the whole hero
  falls back to the procedural knight rather than playing a gap.
- Clip table (`src/data/art.ts` → `HERO_ART.animations`, ticks at 60 Hz):

  | Clip      | Sheet         | Frames | Ticks per frame       | Loop | Notes                             |
  | --------- | ------------- | ------ | --------------------- | ---- | --------------------------------- |
  | `idle`    | `_Idle`       | 10     | 8                     | yes  |                                   |
  | `run`     | `_Run`        | 10     | 5                     | yes  |                                   |
  | `turn`    | `_TurnAround` | 3      | 3                     | no   | holds last frame                  |
  | `jump`    | `_Jump`       | 3      | 3                     | no   | rise pose                         |
  | `fall`    | `_Fall`       | 3      | 6                     | yes  | held through the fall             |
  | `attack1` | `_Attack`     | 4      | 3, 3, 4, 6 (16 total) | no   | window ticks 4–11 (cross-checked) |
  | `attack2` | `_Attack2`    | 6      | 2, 3, 3, 3, 4, 5 (20) | no   | window ticks 5–15 (cross-checked) |
  | `dash`    | `_Dash`       | 2      | 3, 5                  | no   | stretched over the 11-tick dash   |

  A unit test asserts `PLAYER.attack.clipTicks` sums match the sheet frame counts, so a retimed
  swing cannot silently desynchronize from its damage window.

- The procedural fallback authors the same eight clip names with the same durations (12 poses,
  32×48 knight, origin (16, 46)); `HeroView` needs no fallback-specific code.
- Run frames lift the feet a few pixels above the idle contact line; the contact shadow keeps the
  hero visually grounded. Per-clip foot offsets remain deferred until the M9 polish pass.

### Tiles

- Roles are semantic (`floor`, `floorFill`, `wall`, `wallTrim`, `pillar`, `ledge`, `window`,
  `backgroundBrick`, `puddle`, `rubble`, `cobweb`); rooms never name atlas cells (see
  `src/world/tiles.ts`, which carries the solid/one-way flags the M2 collision solver reads).
- The church tileset is a chunk kit, not a uniform autotile sheet: only verified 16px cells that
  repeat cleanly are listed in `TILE_ART`. Floor variants are picked per cell by a stable integer
  hash, so a room looks identical every run without hand-placed variation.
- `ledge` reuses three floor-top cells and is flagged `oneWay` (collision reads this flag).

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

## M3 — audio

Four packs, all fetched by `npm run fetch-assets`, each with its verbatim licence archived beside
the files:

| Pack directory         | Contents                                              | Licence                                             | Source                                               |
| ---------------------- | ----------------------------------------------------- | --------------------------------------------------- | ---------------------------------------------------- |
| `kenney-rpg-audio`     | 51 clips: cloth/leather moves, knives, doors, creaks  | CC0 1.0 (Kenney, "RPG Audio")                       | `kenney.nl/assets/rpg-audio`                         |
| `kenney-impact-sounds` | 130 clips: stone footsteps, bells, soft/heavy impacts | CC0 1.0 (Kenney, "Impact Sounds")                   | `kenney.nl/assets/impact-sounds`                     |
| `music-cathedral`      | "Cathedral in the forest (ambient loop)" (2.9 MB ogg) | CC0 1.0 (congusbongus)                              | `opengameart.org` (`forest_2_0.ogg`)                 |
| `alkakrab-boss-loops`  | 2 loops of the 6-track dark-fantasy boss pack         | free commercial use, author-confirmed, no AI (D015) | `alkakrab.itch.io/6-dark-fantasy-boss-battle-tracks` |

The boss pack ships six loops plus intro variants; only **"1. Whispers of the Abyss (Loop)"** and
**"4. Cursed Citadel (After Intro & Loop)"** are kept (6.65 MB). The other four remain in the local
download cache — to add one, widen the entry's `include` filter in `scripts/lib/asset-packs.ts`,
delete `public/assets/alkakrab-boss-loops`, and re-run `npm run fetch-assets -- --only=music-boss`
(the cached zip is reused; nothing is re-downloaded). The itch zip's `Loops ogg/` folder is part of
the URL because the archive also contains a licence PDF at its root.

### Sound map (`src/data/audio.ts`)

Paths below abbreviate `assets/kenney-rpg-audio/Audio/` as `rpg/` and
`assets/kenney-impact-sounds/Audio/` as `impact/`.

| Key         | File(s)                                 | Used by                       |
| ----------- | --------------------------------------- | ----------------------------- |
| `jump`      | `rpg/clothBelt.ogg`                     | jump event                    |
| `land`      | `impact/impactSoft_medium_00{0,2}.ogg`  | landing below 700 px/s        |
| `landHeavy` | `impact/impactSoft_heavy_00{0,2}.ogg`   | landing at 700 px/s or faster |
| `footstep`  | `impact/footstep_concrete_00{0..4}.ogg` | run cadence, every 25 ticks   |
| `skid`      | `rpg/cloth4.ogg`                        | transition into a skid        |
| `attack1`   | `rpg/knifeSlice.ogg`                    | first swing                   |
| `attack2`   | `rpg/knifeSlice2.ogg`                   | chained heavy swing           |
| `dash`      | `rpg/cloth2.ogg`                        | dash start                    |
| `bell`      | `impact/impactBell_heavy_00{0,2,4}.ogg` | distant-bell ambience (D029)  |

| Track         | File                                                                              | Played in                          |
| ------------- | --------------------------------------------------------------------------------- | ---------------------------------- |
| `terrace`     | `assets/music-cathedral/cathedral-in-the-forest.ogg`                              | the Belfry Terrace (M3)            |
| `bossAbyss`   | `assets/alkakrab-boss-loops/Loops ogg/1. Whispers of the Abyss (Loop).ogg`        | reserved for the Bellbearer (M6)   |
| `bossCitadel` | `assets/alkakrab-boss-loops/Loops ogg/4. Cursed Citadel (After Intro & Loop).ogg` | reserved for the tower warden (M6) |

The individual sound choices were made from the packs' file listings without critical listening
(D026), so they are the first thing to retune by ear; replacing one is a data-table edit, and the
unit suite re-checks that every URL exists on disk and is covered by a manifest entry.

Only SFX are preloaded at boot. A music track is registered (downloaded + decoded) the first time a
room requests it, so players who never reach a boss never download the boss loops (D027).

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
