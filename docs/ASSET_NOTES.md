# Asset notes — sprite sheet & animation data format

Status: **draft v0** (M0). This is the contract that lets original art drop in later with no code
changes (design doc §10.4). The exact loader/Animator lands in M1; any change to this format is a
DECISIONS.md entry.

## Goals

1. New art = new PNG + JSON entry. No code edits.
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

## Licensing side

Every downloaded pack gets `public/assets/<pack>/LICENSE.txt` containing the verbatim license
wording + URL + retrieval date, and one MANIFEST.json entry. Validate everything with
`npm run assets:check` (strict mode is the shipping gate).
