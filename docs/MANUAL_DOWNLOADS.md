# Manual downloads

Assets that `scripts/fetch-assets.ts` could not (or must not) fetch automatically.
Currently: **none.**

M1 status: all four visual packs (church, town, caves, knight — 352 files) download and unpack
automatically via `npm run fetch-assets`. Each pack's verbatim license is written next to the
files as `LICENSE.txt`, and `npm run assets:check` verifies the manifest against disk.

Rules for anything listed here:

- The fetch script prints `SKIPPED` for these entries and continues; the game always runs with
  procedural fallbacks, so nothing blocks on this list.
- To resolve an entry: download it yourself, unzip into the listed target folder, add a
  MANIFEST.json entry (`npm run assets:check` must pass), then delete the row.

## Excluded by policy

- **Bosses Pixel Art Pack** (free-game-assets.itch.io / CraftPix) — paid (min $0.60).
  Excluded by the user's directive "no paid assets" (2026-10-19, `docs/DECISIONS.md` D013).
