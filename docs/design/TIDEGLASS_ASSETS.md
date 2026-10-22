# Tideglass asset brief

> Companion to [TIDEGLASS_MAP.md](./TIDEGLASS_MAP.md). This is the art you (the user) need to make,
> in priority order, with sizes and steps. The map's rooms, lines, labels, and numbers are **not**
> art; they are generated from the game data.

---

## 1. What not to make

Do **not** draw:

- Room shapes, floors, walls, ledges, corridors, or the tower outline. The map reads the live
  `rows`/`legend` from each room, so a hand-drawn room would be wrong after the next layout change.
- Room names, region names, numbers, legend text, controls. Those are DOM/SVG text using Jacquard 12
  and Pixelify Sans.
- A full illustrated map with a sea monster, compass rose, and labels burned into the image. The
  map must stay readable and data-driven.
- A flat "tech tablet" screen. The material is wax, brass, bone, and smoked oak.

Do make **materials and symbols**. The art's job is to make the generated chart feel like a relic.

**Policy:** original art, or a clear CC0/OFL source. No paid, ambiguous-licence, no-redistribution,
or AI-generated final assets. Record source and licence in `public/assets/MANIFEST.json`; derived
textures also get a `SOURCE.txt` beside them.

---

## 2. P0 — make these first

### A1. The tablet frame (9-slice)

**File:** `public/assets/tideglass/frame.png`

- **Canvas:** 1024 × 1024, transparent center. Displayed up to ~1320 × 800.
- **9-slice:** 160 px corners / 160 px edges. The center (704 × 704) stays fully transparent; the
  wax and pages show through it.
- **Look:** a double page opening in a brass-bound wax tablet. Outer edge: smoked oak, worn at the
  corners. Inner edge: a thin bright brass lip, then a dark recess where the wax sits. Add a few
  scratches, dents, and a small repair plate; keep the center clean.
- **Corners:** not identical. Top-left has the hinge shadow; top-right has a small clasp scar;
  bottom corners are rounded and darker.
- **Layers to deliver:** final PNG plus the layered source (PSD/Aseprite/FIG) if convenient.
- **Do not include** the lens, hinge, spine, clasp, hands, or text. Those are separate so the layout
  can change.

### A2. The wax tile

**File:** `public/assets/tideglass/wax.png`

- **Canvas:** 1024 × 1024, seamless, opaque.
- **Base:** `#17110c`, with subtle `#21170f` mottling. No visible grid.
- **Detail:** 2–4% opacity grain; fine 1 px scratches in small clusters; a few fingerprints as soft
  elliptical smudges; soot darkening toward one edge (it will be rotated/tiled, so keep it even);
  two or three tiny air-bubble pits.
- **Do not paint a border, vignette, or light source into the tile.** The UI adds those.
- **Export:** PNG (or lossless WebP). Test tiled 3 × 2 at 100%; no obvious seams.

### A3. Icon sheet

**Files:** one PNG per icon in `public/assets/tideglass/icons/`, 48 × 48 px, transparent.

Logical size is 24 × 24; export at 2× (48) and draw on a 2 px grid. Pixel art, 1 px dark outline,
3 colours max, readable at 24 px. Palette: bone `#f2e5c8`, brass `#c9a35a`, brass-hi `#f2d28a`,
rust `#a64b3f`, verdigris `#6fae96`, echo `#7fe0c3`, ink `#0b0806`.

| File               | Meaning               | Notes                                                                  |
| ------------------ | --------------------- | ---------------------------------------------------------------------- |
| `current.png`      | You are here          | a brass moth / compass needle, wings up; the primary marker            |
| `bench.png`        | Rest point            | a small stone bench with an ember beneath                              |
| `bell.png`         | Bell / fast travel    | a handbell, clapper visible; brass                                     |
| `sigil.png`        | Claimed bell          | the same bell with a teal ring/seal; must read differently from `bell` |
| `boss.png`         | Unclaimed bell / boss | black bell with a crown or crack; warning, not decoration              |
| `door-open.png`    | Open passage          | a doorway with a warm gap                                              |
| `door-sealed.png`  | Sealed                | door with a red wax X and a small lock                                 |
| `door-bell.png`    | Bell door             | door with a bell cut into the lintel                                   |
| `door-secret.png`  | Secret found          | hairline crack in a wall, teal glint                                   |
| `relic.png`        | Relic / treasure      | a small chest or glint; only used with the Reed                        |
| `pin.png`          | Player pin            | a brass stud with a red wax head                                       |
| `drop.png`         | One-way drop          | a short down arrow with a dust tick                                    |
| `climb.png`        | Climb / grapple       | a hook and a short chain                                               |
| `water.png`        | Flooded / tide gate   | three wave strokes in a circle                                         |
| `unknown.png`      | Ghost                 | a dashed ring with a `?` cut out; no room shape                        |
| `charted.png`      | Charted stamp         | 96 × 96; a brass bell stamp ring; used at low opacity                  |
| `swept.png`        | Swept stamp           | 96 × 96; the same stamp in verdigris, slightly worn                    |
| `tide-seal.png`    | Tide door seal        | 96 × 96; red wax with a wave/bell imprint                              |
| `pin-return.png`   | Return pin            | optional, Stylus                                                       |
| `pin-danger.png`   | Danger pin            | optional, Stylus                                                       |
| `pin-secret.png`   | Secret pin            | optional, Stylus                                                       |
| `pin-treasure.png` | Treasure pin          | optional, Stylus                                                       |

**Icon rules:** no text; no letters; no thin 1 px-only details that vanish at 24 px; all states must
differ by shape, not only hue. On the wax, icons get a 1 px dark halo (CSS drop-shadow) so they read.

### A4. Wax seals

**Files:** `public/assets/tideglass/seal-red.png`, `seal-teal.png`, `seal-brass.png`, 128 × 128.

- A lumpy poured-wax disc with a pressed bell imprint, a bright top-left lip, and a dark bottom-right
  shadow. Red is sealed/danger; teal is swept/secret; brass is a generic chart stamp.
- Transparent background. The seal may overhang the room outline; that is intentional.
- Do not bake a drop shadow; the UI adds one.

### A5. The lens medallion

**File:** `public/assets/tideglass/lens.png`, 512 × 512.

- A brass astrolabe ring, 8–12 px rim at display size, with a dark salt-glass disc. The glass is
  nearly black with a cold green `#7fe0c3` glint and a few faint concentric rings.
- Set at the top center or the hinge. It is the artifact's "eye."
- Keep the center dark; the boot's light is CSS/SVG, not baked in.
- Deliver the ring and the glass as one PNG; a separate glass layer is optional.

---

## 3. P1 — makes it feel finished

### B1. Spine / hinge

`spine.png`, 96 × 800 (or a 96 × 512 vertical 9-slice). Tarnished brass with a leather hinge, two
rivets, and a worn center where thumbs rest. Placed between the Ledger and the Chart.

### B2. Plumb rose / compass

`plumb-rose.png`, 256 × 256. A brass engraving, not a nautical compass: a plumb line, a bell at the
top, `ASCENT` at the top and `THE DROWNED` at the bottom. Place at the chart's top right or bottom
right. Keep it low contrast; it is a watermark, not a control.

### B3. Region washes

`wash-foundations.png`, `wash-nave.png`, `wash-upper.png`, 512 × 512, transparent.

- Irregular watercolour/brine stains, clipped by the engine to charted rooms.
- Foundations: deep teal `#1d3a3a` at 10–16% opacity.
- Nave: warm umber/brass `#3a2a18` at 8–12%.
- Upper: pale bone/blue `#2b3438` at 8–12%.
- No hard edges, no text, no symbols. Test over the wax at 100%; they must not reduce label contrast.

### B4. Gloved hands

`hands.png`, 1600 × 400, transparent, or two 400 × 260 files.

- Pixel art at 2×. The player's forearms and gloved hands enter from the bottom corners and hold the
  tablet's lower frame. Worn leather, brass thimble on one thumb, a thin red thread around one
  wrist.
- They must not cover the Ledger text or the chart. Desktop only; hidden at ≤820 px.
- Optional; the map still works without them.

### B5. Title plate

`title-plate.png`, 512 × 128, transparent. A narrow brass/bone cartouche for `THE TIDEGLASS`.
The text is DOM; leave the center empty. A simple engraved border is enough.

---

## 4. P2 — polish

- `tower-etching.png`, 1024 × 1536, transparent: a faint architectural underlay of the belfry's
  outer arches, waterline, and bell chamber. 12–18% brass. The room atlas sits over it; it must not
  depict specific rooms.
- `wax-ripple.png`, 512 × 512: a single radial ripple texture; CSS animates scale/opacity.
- `lens-flare.png`, 256 × 256: a cold green pinpoint flare for the lens.
- `pin-stamps.png`: eight short stamped labels (`RETURN`, `DANGER`, `SECRET`, `BELL`, `REST`,
  `TIDE`, `UP`, `?`) on a 512 × 256 sheet. Text is baked here only because these are stamps, not
  information; keep them optional and localize later if needed.
- `frame-repair.png`: a small riveted brass patch for the top-left corner; variation, not required.

---

## 5. Palette and style

```
void        #070504
wax         #17110c
wax-raised  #21170f
bone        #f2e5c8
bone-dim    #d8c7a6
brass       #c9a35a
brass-hi    #f2d28a
brass-dark  #7d5f2f
rust        #a64b3f
verdigris   #6fae96
echo        #7fe0c3
rose        #d49a9a
```

**Materials:** black beeswax, tarnished brass, bone inlay, smoked oak, red sealing wax, brine.
**Light:** upper-left candle; warm centre, dark edges; a cold green lens glint. **Detail level:**
worn and specific, not ornate for its own sake. A few fingerprints beat a hundred filigree curls.
**Reference:** Roman wax tablets, brass astrolabes, portolan charts, brass rubbings; the existing
BELLWARD UI kit's wood/brass/stone panels. **Avoid:** parchment, quills, Cornifer, sci-fi blue
screens, flat web cards, glow-heavy magic.

---

## 6. How to make it

### Frame (A1)

1. Set up 1024 × 1024 with a 160 px safe border and a 704 × 704 transparent center.
2. Block the outer silhouette: rounded 24 px corners, a slight asymmetry. Keep the center empty.
3. Lay the smoked-oak base; add grain along the edges, not across the center.
4. Add the brass inner lip as a 3–5 px band with a bright top-left edge and a dark bottom-right.
5. Cut the page recess: a 8–12 px dark inner shadow, then a 1 px worn brass line.
6. Add wear: corner dents, a scratch cluster on the bottom edge, a small repair plate, two empty
   rivet holes. Do not add text or symbols.
7. Test at 320 px wide and at 1320 px wide. The 9-slice must not stretch a distinctive detail in the
   center of an edge. If a detail would stretch, move it into a corner.
8. Export PNG with alpha; verify the center's alpha is 0.

### Wax (A2)

1. 1024 × 1024; fill `#17110c`; add 3 octaves of very low-opacity noise.
2. Add 20–30 short 1 px scratches in clusters of 2–4, at 6–10% opacity.
3. Add 4–6 fingerprints: soft elliptical smudges at 3–5% opacity, rotated.
4. Add 2–3 tiny pits (1–2 px) with a light top edge.
5. Offset/tile 3 × 2; fix seams by cloning across the edges, not by adding a border.
6. Export; test over the frame with the brass lines on top.

### Icons (A3)

1. Draw at 24 × 24 logical, 2× export. Use a 2 px grid; keep the silhouette readable at 24 px.
2. Start with the current marker, bench, bell, boss, sealed door, and unknown. Those six carry the
   map.
3. Add a 1 px ink outline; 2–3 interior colours; one highlight.
4. Test on the wax at 24 px at 100% zoom and at 48 px selected. If it disappears, simplify.
5. Export each icon separately, transparent, with the exact filenames above.

### Seals (A4)

1. 128 × 128; draw an irregular disc, not a perfect circle.
2. Add a raised rim, a pressed bell in the center, 2–3 drips.
3. Light top-left, shadow bottom-right. No background; no text.
4. Make red first; recolour for teal/brass with a palette shift, not a flat fill.

### Lens (A5)

1. 512 × 512; brass ring 36–48 px thick; 8 rivets; two hairline engravings.
2. Dark glass `#101716`; add concentric rings at 4–8% opacity; a green glint crescent top-left.
3. Keep the glass's center nearly black; the boot's light will animate.
4. Export as one PNG; if you make a separate glass layer, name it `lens-glass.png`.

### Region washes (B3)

1. 512 × 512, transparent, 300 dpi not required.
2. Paint 3–5 overlapping soft blobs; erase the edges with a rough brush; keep the center uneven.
3. Reduce to 8–16% opacity; no hard lines; no text.
4. Test clipped inside a 240 × 96 room over the wax; the room name must stay 4.5:1.

---

## 7. Delivery

```
public/assets/tideglass/
  frame.png
  wax.png
  lens.png
  spine.png
  plumb-rose.png
  hands.png
  title-plate.png
  seal-red.png
  seal-teal.png
  seal-brass.png
  wash-foundations.png
  wash-nave.png
  wash-upper.png
  tower-etching.png
  wax-ripple.png
  lens-flare.png
  icons/
    current.png
    bench.png
    bell.png
    sigil.png
    boss.png
    door-open.png
    door-sealed.png
    door-bell.png
    door-secret.png
    relic.png
    pin.png
    drop.png
    climb.png
    water.png
    unknown.png
    charted.png
    swept.png
    tide-seal.png
  SOURCE.txt
```

`SOURCE.txt` line per file: name, author, date, tools, licence (`Original work, all rights reserved`
or CC0), and any derivation. Add the same to `public/assets/MANIFEST.json` before `assets:check` is
expected to pass.

**Naming:** lowercase, hyphens, no spaces. **Scaling:** icons/drop shadows nearest-neighbour;
frame/wax/lens smooth. **Colour profile:** sRGB. **Alpha:** keep it; no matte. **Max file size:**
frame ≤ 4 MB, wax ≤ 1.5 MB, each icon ≤ 8 KB; use lossless WebP only if the loader supports it and
the visual test passes.

---

## 8. Minimum viable art

If you want the map playable before the full art pass, make only:

1. `frame.png` (even a simplified 9-slice)
2. `wax.png`
3. the six core icons (`current`, `bench`, `bell`, `boss`, `door-sealed`, `unknown`)
4. `seal-red.png`
5. `lens.png`

The rest can be CSS/SVG placeholders. Do not ship the placeholder frame as final; the frame and wax
are what make the map feel like BELLWARD rather than a web dashboard.

---

## 9. Locked decisions and next step

- **Frame:** a **folding diptych opened flat**. Two wax pages, a visible brass hinge/spine at the
  center, the salt-glass lens at the top of the spine, a clasp scar on the top-right corner. The
  mockup shows this exact composition. Draw the 9-slice frame, spine and lens as separate files so
  the fold can animate at the spine; do not bake the lens into the frame.
- **Lens:** top of the spine, not a screen corner and not a science-fiction bezel.
- **Pickup:** the Weeping Stone, first bench; auto-opens once.
- **First assets:** frame, wax, the six core icons (`current`, `bench`, `bell`, `boss`,
  `door-sealed`, `unknown`), red seal, lens. If you only make one, make the frame.
- Tell me which P0 assets you want to make first; I will wire placeholders around them.
- If any asset feels like the wrong job for you (e.g. hands), say so and we cut it. The map does not
  depend on hands.

---

## 10. Reference links

- Hollow Knight map/Quill: <https://hollowknight.wiki/w/Map_and_Quill_(Hollow_Knight)>
- Metroid Dread map notes: <https://metroid.fandom.com/wiki/Map>
- Resident Evil 2 room status: <https://www.ign.com/wikis/re2-remake/Maps_and_Item_Locations>
- Outer Wilds ship log: <https://outerwilds.fandom.com/wiki/Computer>
- Breath of the Wild map review: <https://stamen.com/cartographers-play-video-games-a-review-of-the-map-in-the-legend-of-zelda-breath-of-the-wild/>
- Roman wax tablets: <https://en.wikipedia.org/wiki/Wax_tablet>
- Hollow Knight world design: <https://gmtk.substack.com/p/the-world-design-of-hollow-knight>
