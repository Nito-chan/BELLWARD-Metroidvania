# The Tideglass — BELLWARD's world map

> **Status:** Proposed design. The map UI is deliberately deferred until after the gameplay/content
> phases. The current `Region Map` remains untouched until then. This document defines what replaces
> it, how it behaves, and what art is needed.
>
> **Rendered mockup:** [tideglass-map.svg](./tideglass-map.svg) · [preview PNG](./tideglass-map-preview.png).
> The desktop and 375 artboards show the real room geometry from the live room data. The frame, wax,
> icons, seals and lens in the mockup are placeholders for the P0 art in the asset brief.

---

## 1. Why the current map has to go

The current map is a constellation of twelve labelled nodes. It tells the player that twelve rooms
exist, shows every one of them before they are found, and has no room shapes, doors, contents, or
sealed paths. It cannot answer the questions a map exists to answer:

- Where am I inside this place?
- Which rooms have I actually charted, and what is still dark?
- Which door is open, which is a dead end, and which is sealed until I find a tool?
- What have I finished, and what is still worth returning for?

It is a progress graph, not a map. It also sits inside the same stone pause panel as settings,
which makes it feel like a menu page rather than an object the player carries.

The replacement is a **real side-view plan of the tower**, drawn from the game's own room
geometry, held inside a magical object.

---

## 2. The object: the Tideglass

**The Tideglass** is a folding wax tablet bound in salt-stained brass. A disc of black salt-glass —
the lens — is set into the hinge. The left wax page is **the Ledger**; the right page is **the
Chart**. A brass stylus, a red thread, and a stick of sealing wax are tucked into the frame.

It was made by the last Bellwright to remember the belfry after the drowning. The lens holds
brine-light; the wax takes the etching. It can only chart what the player has seen. The Last Bell
is not on it, because the Bellwright never came back from there.

**Found:** on the Weeping Stone in the Belfry Terrace, beside the first bench. A small brass
reliquary glints on the stone. Interacting with it grants the `tideglass` key item and opens the map
for the first time. The first opening is the ritual; the map then lives on the `M` action, the touch
HUD, and a `Tideglass` row in the pause menu.

**Why this fits BELLWARD:** wax tablets are genuinely medieval, not a fantasy tablet pasted on. The
lens makes it magical. Black wax and brass belong to the belfry's materials. The object gives the
map the same weight as a weapon without borrowing Hollow Knight's parchment-and-cartographer
language.

**No auto-open on every load.** The first pickup opens the map. On a loaded save, the map is
available immediately, and the first time it is opened in a session the lens performs a short
remembering ripple. It never interrupts Continue.

---

## 3. Research: what to take, what to leave

| Reference                                  | What it gets right                                                                              | What BELLWARD takes                                                              | What BELLWARD avoids                                                           |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| **Hollow Knight**                          | The map is a physical item, incomplete until bought/filled, with pins and bench markers.        | The map as an object and a reward; incomplete knowledge; bench pins.             | Parchment, Cornifer, paper-and-quill language. The Tideglass is wax and brass. |
| **Super Metroid / Metroid Dread**          | Room-by-room geometry, explored/unexplored fills, doors, items, zoom.                           | True room shapes; unexplored negative space; door states; zoom and pan.          | Sci-fi HUD colours and icon clutter.                                           |
| **Resident Evil 2 (2019)**                 | Room status at a glance: red means something remains, blue means cleared; locks and save rooms. | "Swept" wax stamps and a room ledger that answers "is there anything left here?" | Top-down floor-plan presentation. BELLWARD is side-view.                       |
| **Castlevania: Symphony of the Night**     | Completion percentage and secret rooms make exploration measurable.                             | A charted count and a completion footer; secrets that are hidden, not listed.    | A bare grid of squares.                                                        |
| **Ori and the Blind Forest / Blasphemous** | Painted regions, fog, and a strong sense of place.                                              | Region washes; the map as an illustrated relic.                                  | Painterly fog that swallows legibility; copying the religious-parchment look.  |
| **Prince of Persia: The Lost Crown**       | Layers, markers, fast travel, and a map that respects the player's time.                        | Pan/zoom, room selection, filters, pins, a clear selected-room inspector.        | A screen covered in collectible icons. The Tideglass stays quiet.              |
| **Outer Wilds**                            | A rumour map that records knowledge, not waypoints.                                             | Leads that point to the next known threshold and never through the dark.         | A purely abstract web with no spatial geography.                               |
| **Zelda: Breath of the Wild**              | A held device with a boot moment; towers reveal regions; stamps.                                | The diegetic tablet, the reveal ritual, region stamps.                           | Sheikah blue, sci-fi screens, open-world tower iconography.                    |
| **Among Us**                               | The map is a physical tablet the character holds and uses.                                      | The held-object framing and a short boot animation.                              | A flat utilitarian task screen.                                                |
| **Roman wax tablets / astrolabes**         | Real portable writing surfaces; hinged, reusable, brass instruments.                            | The form, the materials, the hinge, the stylus, the seal.                        | Museum-display stiffness. This is a working, worn tool.                        |

**References to look at:** Hollow Knight's map/Quill screen; Metroid Dread's map zoom; RE2's
red/blue room map; Ori's map; Blasphemous's map; Prince of Persia: The Lost Crown's map; Outer
Wilds' ship log; Breath of the Wild's Sheikah Slate; Roman `tabula cerata`; brass astrolabes.

---

## 4. What the map must answer

At any moment the Tideglass answers five questions, in this order:

1. **Where am I?** Current room, position inside it, facing, last rest.
2. **What have I charted?** Real room shapes, doors, benches, bells, bosses, secrets found.
3. **What is still dark?** Ghost chambers beyond doors I have seen; black wax everywhere else;
   the charted count without revealing locations.
4. **Where can I go?** A lead, unopened exits, known bells, and my own pins.
5. **What is closed to me?** Sealed doors in red wax, with the tool or sigil they require. Never a
   blanket "do not go"; show the cost.

The map never draws a route through an uncharted room, never names a room the player has not
entered, and never auto-reveals a secret.

---

## 5. The chart

### 5.1 Real geometry

- The game's rooms are 60 × 24 tiles at 16 px. The map reads the **actual `rows`/`legend`** of each
  room, not a hand-drawn approximation.
- At 100% zoom, one tile is **4 map pixels**: a room is 240 × 96. The default fit scale is ~0.75,
  so the twelve-room slice fits in the chart area; the full game pans and zooms.
- The map draws the room chamber, its floor line, side walls, ledges, climbable pillars, breakable
  walls, sealed doors, and the real exit anchors. It is a plan, not a screenshot: no backgrounds,
  no enemies, no decoration.
- A separate **map atlas** places each room in the tower and defines which wall its doors occupy.
  This is the canonical geography. Where an in-world exit rectangle is on a different wall, the
  content pass should add a map-door hint or move the prop; the map is not allowed to lie about
  what connects to what.

### 5.2 Slice atlas (proposed)

The tower is four columns wide and four rows tall, plus the unseen Last Bell above.

| Room                 | Chart label            | Region                  | Atlas (col,row) | Doors in the chart                                                     |
| -------------------- | ---------------------- | ----------------------- | --------------- | ---------------------------------------------------------------------- |
| `belfry-terrace`     | Belfry Terrace         | The Bell Nave           | 2,1             | W → Gallery; S → Nave; NW drop from Upper Gallery                      |
| `belfry-antechamber` | Bell Nave              | The Bell Nave           | 2,2             | N → Terrace; E → three bell arenas; SW → Bellows                       |
| `bellbearer-arena`   | Undercroft             | The Bell Nave           | 3,1             | W → Nave                                                               |
| `warden-arena`       | — (ghost)              | The Bell Nave           | 3,2             | W → Nave                                                               |
| `bellthief-arena`    | — (ghost)              | The Bell Nave           | 3,3             | W → Nave                                                               |
| `drowned-gallery`    | Drowned Gallery        | The Drowned Foundations | 0,1             | E → Terrace; S → Aqueduct; S secret → Ossuary                          |
| `ossuary`            | — (hidden until found) | The Drowned Foundations | 0,3             | N → Gallery (secret)                                                   |
| `sunless-aqueduct`   | Aqueduct               | The Drowned Foundations | 0,2             | N → Gallery; E → Bellows                                               |
| `bellows`            | Lower Bellows          | The Drowned Foundations | 1,3             | W → Aqueduct; NE → Nave; N → Shaft                                     |
| `wall-claw-shaft`    | Wall-Claw Shaft        | The Upper Belfry        | 1,2             | S → Bellows; N → Upper Gallery                                         |
| `upper-gallery`      | Upper Gallery          | The Upper Belfry        | 1,0             | S → Shaft; E → Reliquary (secret); SE drop → Terrace; Tide door sealed |
| `reliquary`          | — (hidden until found) | The Upper Belfry        | 2,0             | W → Upper Gallery (secret)                                             |

The three bell arenas form a vertical stack east of the Nave, so the three sigils read as a triptych.
The Drowned Foundations sit low and west; the Bell Nave is the crossing; the Upper Belfry is the
climb. Above the Upper Gallery is a blank wedge of wax for **The Last Bell**, with a faint bell
outline and no name. It is filled only in the final act.

### 5.3 Knowledge states

| State       | What is drawn                                                                   | What the player knows                                         |
| ----------- | ------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| **Unheard** | Nothing. Black wax.                                                             | Nothing.                                                      |
| **Ghost**   | A dashed chamber outline, no name, a `?`, the door that revealed it.            | A door leads somewhere; not what or where exactly.            |
| **Charted** | True floor/walls, name, doors, benches, bells, bosses, secrets found.           | The room exists and its layout.                               |
| **Swept**   | Charted plus a blue-green wax stamp and a warmer wash.                          | Every known pickup, secret, and boss in the room is resolved. |
| **Sealed**  | A red wax seal on the door, the lock glyph, and the requirement in the ledger.  | This passage is closed until a named tool/sigil.              |
| **Current** | A brass moth marker at the player's true position, a warm cone, a lantern glow. | Exactly where the player stands.                              |

A ghost can be selected. Its ledger entry is one line: _"Beyond the east door. The glass is dark."_
It never leaks the room's name, boss, or shape.

### 5.4 Doors, glyphs, and seals

- **Open**: a gap in the room outline, joined by a brass ink connector.
- **Sealed**: red wax X on the door; the ledger names the requirement. Example: the Tide door in
  the Upper Gallery, sealed until the Tide-Bell.
- **Bell door**: a small black bell. Known to lead to a boss; "The bell waits."
- **Claimed bell**: a teal sigil. The arena is charted and the sigil is owned.
- **Secret**: a hairline crack. Shown only after the breakable wall is broken, or as a room-level
  glint with the Listening Reed.
- **One-way drop**: a short arrow. The Upper Gallery's drop into the Terrace.
- **Climb**: a hook/chain glyph on a vertical connector. The Shaft.
- **Water / grapple gate**: wave or hook glyphs only on the door, not on every anchor. This is a
  room-level map, not an anchor directory.
- **Pin**: a player's wax stud. Not content; the player's own memory.

No door is highlighted just because the player can open it. The map shows the state; the player
chooses.

### 5.5 Fog and negative space

Black wax is the fog. The chart does not draw a grid of unknown rooms. A ghost appears only when a
charted room has a door pointing at it. Secret rooms stay absent until found. This is the main
fix for the current map's spoiler problem: the player sees **8 / 12 charted**, not the locations of
the missing four.

The chart's total is honest, not spatial. Knowing there are four rooms missing is motivation;
seeing where they are would remove the search.

### 5.6 Pan, zoom, and focus

- The chart opens **fit** on desktop, **focused on the current room** on touch.
- Drag, wheel, pinch, triggers, and `+`/`−` zoom; 50–250%.
- `F` fits the charted region; `C` returns to the current room.
- Arrow keys / D-pad move the selection to the nearest room in that direction; the chart pans to
  keep the selected room visible. Free panning is drag, right stick, or `Shift`+arrows.
- A selected room gets a brass outline and updates the Ledger immediately. Double-click or `A`
  zooms to it.
- The map never rotates. The tower's up is the climb.

---

## 6. The Ledger

The left page is not a second map; it is the answer sheet for the room under the cursor.

**Header:** `THE KEEPER'S LEDGER` in small caps, with the region and the charted count.

**Room block**

- Name in display type; region/kicker; state chip (`CHARTED`, `SWEPT`, `SEALED`, `CURRENT`).
- One authored line of place, never a quest instruction. Example: _"Three doors, three bells. The
  Keeper's Rest keeps the middle watch."_
- `You are here` only for the current room.

**Passages**

- Grouped as **Passages** (traversal) and **The Three Bells** (boss doors).
- Each row: direction, target name if charted (otherwise "an uncharted chamber"), glyph, status.
- Sealed rows go to a separate **Sealed** block with the requirement. That is the "where not to
  go" list.

**What remains**

- Rest point; unclaimed bell; relics (`2 / 3`) only with the Listening Reed; secret found; "No
  known remains."
- Hidden secrets are not counted here. The room can look swept while something is still hidden;
  that is honest. The Reed is what turns "hidden" into "known."

**Lead**

- One red-thread line, written as the Bellwright would: _"Two bells still silent. The Nave remembers
  all three."_
- The thread on the chart starts at the current room and ends at every **known** target. If a
  target is beyond an uncharted door, the thread stops at that door with a pin and a `?`. It never
  draws through the dark.
- The lead is derived from progression: unclaimed sigils, then the Tide door, then the Last Bell.

**Marks**

- The player's pins, with a remove action. Base: one pin type, five slots.
- `Place a pin` is a real button, keyboard/gamepad reachable, not a right-click secret.

**Footer**

`CHARTED 8 / 12 · SWEPT 3 · BELLS 1 / 3` — only metrics the player has earned. Secrets are not
counted until the Reed, so the footer cannot spoil their number early.

At 375 the Ledger becomes a bottom sheet with a grab handle and a collapsed one-line state
(`THE BELL NAVE · YOU ARE HERE · 3 BELLS`). It expands to the full page; the chart stays above.

---

## 7. The lead system

The lead is a sentence, not a waypoint.

| Progress            | Lead                                                                                                              |
| ------------------- | ----------------------------------------------------------------------------------------------------------------- |
| No sigils           | "Three bells wait in the Nave. The east door is warm."                                                            |
| 1–2 sigils          | "{n} bells still silent. The Nave remembers all three."                                                           |
| 3 sigils, no ending | "The Tide door waits in the Upper Gallery. It answers only the Tide-Bell."                                        |
| Ending reached      | "The Last Bell was never on this chart."                                                                          |
| Optional side lead  | "A crack answers a hard blow in the Drowned Gallery." (only after the player has heard/seen it, or with the Reed) |

The thread marks all valid known targets, not a single "correct" one. With two bells left, both
ghost doors get the red thread. The player chooses.

**Where not to go** is not a prohibition. It is the **Sealed** block: the red wax, the named
requirement, and the room it protects. The boss doors get a black bell and "The bell waits," not an
arrow. The map trusts the player.

---

## 8. Progression: the three lenses

The base Tideglass is complete enough to navigate the whole game. The lenses are optional finds
that deepen the chart; they are not required to finish.

### The Plumb — found in the Wall-Claw Shaft

A small brass weight on a red thread. Adds:

- Sealed-door requirements shown directly on the chart, not only in the Ledger.
- A **Trace** action: select a charted bench or bell and highlight the known route. The trace stops
  at the first sealed or uncharted door and marks it. No route through the dark.
- The sealed list becomes a region-wide page.

### The Listening Reed — found in the Reliquary

A bone whistle. Adds:

- Room-level relic glints in charted rooms: `2 remains`, not exact coordinates.
- Unbroken secret cracks in charted rooms get a faint hairline. The player still has to find and
  break the wall.
- The footer's relic count appears. This is the later **treasure update** hook.

### The Stylus — found at the Bell-Keeper's Rest after the first sigil

A brass pin. Adds:

- Four pin types: Return, Danger, Secret, Treasure.
- Twelve slots instead of five.
- Pins can carry one of eight short stamped labels, no free-text input.

The lenses show as three small brass rings around the hinge lens. Empty rings are simply empty;
the map does not announce that upgrades exist.

**Fast travel is not in the base map.** The slice is compact, and the benches are rest points, not
a teleport network. If the full game needs it, add it later as a fourth, late-game **Bellows** lens
that lets the player ring between claimed bells. Do not ship fast travel just because maps usually
have it.

---

## 9. First pickup and open/close ritual

### First pickup

1. The player interacts with the reliquary on the Weeping Stone. The `tideglass` key is granted.
2. The world dims and desaturates; the touch controls hide; the simulation pauses.
3. The closed tablet rises into the player's hands. The clasp clicks; the cover opens.
4. The lens catches a cold light. A wax ripple spreads from the Terrace; the room's floor and walls
   etch outward; the bench and the two door-ghosts appear; the title stamps: **THE TIDEGLASS**.
5. One line: _"The glass remembers what the tower forgets."_ Then: _"M — open the glass. Esc — close."_
6. The map is left open. The player can pan, select, and close.

Total: ~1.6 s. Any input after 350 ms skips to the open state. Reduced motion: instant, no fold, no
ripple, 120 ms fade.

### Normal open

- `M` / gamepad View / touch lens button / pause-menu `Tideglass` row.
- First open in a session: ~0.9 s remembering ripple.
- Subsequent opens: 260 ms: the lens lights, the chart fades in, the current marker settles.
- Close: `Esc`, `M`, `B`, or the close button. The wax dims; the frame folds; 220 ms.
- The game is paused for the whole time. No time passes; no boss cheats.

**Disabled during an active boss encounter and the ending.** The map action shows a short toast:
_"The glass will not open here."_ The pause menu still works. This prevents pausing a live boss to
read the map.

### Saved game

The title's Continue card already shows `Charted 8 / 12`; the Tideglass is a run item, not a
separate save. On load, the map is available but does **not** auto-open. The first open in that
session performs the short ripple. Old v2 saves are migrated by granting the Tideglass if the
player has visited the Terrace; the map is a quality-of-life key, not a progression gate.

---

## 10. Screen anatomy

### 1440 × 900

```
┌──────────────────────────────────────────────────────────────────────────┐
│  [lens]  THE TIDEGLASS              CHARTED 8/12   BELLS 1/3      M close│
│  ┌──────────────────────┬───────────────────────────────────────────────┐│
│  │ THE KEEPER'S LEDGER  │                                               ││
│  │                      │          T H E   C H A R T                    ││
│  │ The Bell Nave        │   ┌────┐   ┌────┐   ┌────┐   ┌────┐          ││
│  │ THE BELL NAVE · HUB  │   │    │   │    │   │    │   │    │          ││
│  │ CHARTED · YOU ARE    │   │    │   │    │   │    │   │    │          ││
│  │                      │   └────┘   └────┘   └────┘   └────┘          ││
│  │ "Three doors, three  │                                               ││
│  │  bells..."           │   ┌────┐   ┌────┐   ┌────┐   ┌────┐          ││
│  │                      │   │    │   │    │   │    │   │    │          ││
│  │ PASSAGES             │   │    │   │    │   │    │   │    │          ││
│  │  ← Belfry Terrace    │   └────┘   └────┘   └────┘   └────┘          ││
│  │  ↙ Lower Bellows     │                                               ││
│  │                      │        [LEAD thread → two ghost bells]        ││
│  │ THE THREE BELLS      │                                               ││
│  │  ↑ Undercroft  ✓     │   ┌────┐   ┌────┐   ┌────┐                   ││
│  │  → uncharted bell    │   │    │   │    │   │    │                   ││
│  │  ↓ uncharted bell    │   └────┘   └────┘   └────┘                   ││
│  │                      │                                               ││
│  │ LEAD ...             │   plumb rose              scale              ││
│  │ MARKS ...            │                                               ││
│  │ CHARTED 8/12 · ...   │                                               ││
│  └──────────────────────┴───────────────────────────────────────────────┘│
│  ● here  ○ charted  ◌ uncharted  ♨ rest  ♪ bell  ✕ sealed  ⌁ secret     │
└──────────────────────────────────────────────────────────────────────────┘
```

- The chart is the dominant surface, roughly 66% of the tablet. The frame is a border, not a stone
  wall. This is the direct correction to the current map's tiny chart in a huge panel.
- The artifact is centered at ~1320 × 800 with 40 px of world visible around it. The player's gloved
  hands may overlap the bottom corners on desktop; they are decorative and click-through.
- Header: lens at left, title, counters, close. Footer: legend chips and zoom/fit/current.

### 768

- The tablet fills ~94vw. The Ledger becomes a 240–260 px left rail; the chart gets the rest.
- If the viewport is portrait or shorter than 700 px, the Ledger becomes a bottom sheet instead.
- Room names remain visible at fit; region names drop to the negative space.
- The frame drops the hands and the outer ornament; the lens shrinks to a small hinge detail.

### 375

- Full-screen chart. Top bar 48 px: `TIDEGLASS · 8/12` and a 44 px close.
- The chart occupies 55–60% of the viewport, centered on the current room at ~1.2× fit.
- The bottom sheet is 40–45%, collapsed to 76 px: room name, state, `YOU ARE HERE`, bell count.
- Expanded sheet: note, passages, the three bells, lead, marks. Scrolls independently.
- Map controls: 44 px zoom + / −, Fit, Current; legend opens as a sheet; all touch targets ≥ 44 px.
- Room labels: current + selected only. Everything else is icon + shape. Pinch to inspect.
- No hands, no lens medallion, no ornate frame corners. A thin brass border and the wax remain.

### 640 × 360 (landscape phone)

- The chart is full-bleed. The Ledger is a **slide-over side rail** (or a bottom sheet at 45%) that
  starts collapsed.
- The top bar is 40 px; close and fit are 44 px hit areas even if visually smaller.
- The map is the priority; the ledger can wait.

---

## 11. Art direction

**North star:** a relic you could hold. A chart scratched into black wax by a dead cartographer,
lit by one candle, carried in brass. Not a screen; not a parchment; not a dashboard.

### Palette

| Token            | Value     | Use                                   |
| ---------------- | --------- | ------------------------------------- |
| `--tg-wax`       | `#17110c` | chart and ledger base                 |
| `--tg-wax-hi`    | `#21170f` | raised page edge, selected room wash  |
| `--tg-wax-deep`  | `#0a0705` | uncharted void                        |
| `--tg-bone`      | `#f2e5c8` | primary room names, ledger text       |
| `--tg-bone-dim`  | `#d8c7a6` | secondary text                        |
| `--tg-brass`     | `#c9a35a` | walls, connectors, frame lines        |
| `--tg-brass-hi`  | `#f2d28a` | current marker, focus, bell icons     |
| `--tg-rust`      | `#a64b3f` | sealed wax, danger                    |
| `--tg-verdigris` | `#6fae96` | claimed sigils, secrets, swept stamps |
| `--tg-echo`      | `#7fe0c3` | lens light, brine ripple              |
| `--tg-rose`      | `#d49a9a` | lead thread, soft warning             |

Text and icons must clear 4.5:1 on the wax. Decorative hatching may be lower. Sealed, claimed,
swept, and secret are never encoded by colour alone: each has a distinct glyph and a text label in
the Ledger.

### Materials and light

- **Black beeswax**, slightly sheened, with fingerprints, soot at the edges, fine scratches, and a
  few bubbles. No repeating grid.
- **Brass**: warm, tarnished, with a thin bright edge where the candle catches it.
- **Bone inlay** on the frame; smoked oak beneath.
- **Red sealing wax** for seals; a red thread for the lead.
- **Light** from the upper left: the wax center is warm; the corners fall into shadow; the lens
  casts a cold green glint across the hinge and the top of the Ledger.
- The chart's empty space is part of the composition. Leave room for the eye between rooms.

### Type

- **Jacquard 12**: `THE TIDEGLASS`, region names, `THE LAST BELL`, large `?`.
- **Pixelify Sans**: room labels, Ledger, counts, controls. Room labels 11–12 px at fit, 13–14 px
  when zoomed; Ledger body 13–14 px; counts 10–11 px, letterspaced.
- No new font. No baked text in art. All labels are DOM/SVG text so they stay legible and
  translatable.

### Motion

- Boot: lens light, wax ripple, room etch-out, title stamp. 1.6 s first time; 0.9 s per session;
  260 ms after. Reduced motion: instant.
- Current marker: a slow 3 s brass shimmer, no bounce. Reduced motion: static.
- Selection: 120 ms brass outline; the Ledger swaps without sliding.
- Lead thread: 400 ms draw-on, once per open. No looping pulse.
- Pin: 160 ms press into wax; seal: 180 ms stamp. No confetti.
- Pan/zoom: direct manipulation, no inertia longer than 120 ms. The chart must never feel floaty.

### Sound

- Open: low bell + wax crackle; close: a soft clasp.
- Etch: a dry scratch, quiet, under the bell.
- Select: a small metal tick. Pin: a wax press. Seal: a heavier press.
- New region: one muted choir note, never a fanfare.
- Use the existing CC0 audio pack where possible. The user may make custom bell/wax cues later.

---

## 12. Accessibility

Non-negotiable, because this is a game map and the current UI already sets the bar.

- **Keyboard/gamepad/touch parity.** Every room, filter, pin, zoom, and close action is reachable.
- **Focus trap** in the map dialog; `Esc`/`B` closes; focus returns to the game or the pause row
  that opened it.
- **Room focus**: each room is a real button (`<g role="button" tabindex="0">` or a DOM overlay
  button); arrow keys move to the nearest room; the Ledger is an `aria-live="polite"` region.
- **List view**: a complete text index grouped by region, with name, state, doors, and contents.
  It is always available as a button and is the primary screen-reader path. It is not a fallback
  hidden from sighted keyboard players.
- **Announcements**: room selected, state, exits, seal requirements, pins. Do not announce pan/zoom
  every frame.
- **Reduced motion**: boot, ripple, thread, and shimmer are removed; focus changes are instant.
- **High contrast**: the existing accessibility mode raises the wax/lines/ink contrast and hides
  decorative washes. The map must remain usable.
- **Colour-blind safe**: icons + labels + patterns, never colour alone.
- **Zoom**: browser zoom and the map's own zoom; the Ledger reflows; no horizontal page scroll.
- **Touch**: 44 px minimum; pinch/drag; no hover-only information; the collapsed sheet is
  keyboard and screen-reader operable.
- **No flashing**, no essential audio-only cues, no timed interactions.
- **Screen-reader copy** includes the seal requirement, e.g. _"Upper Gallery, charted, rest point.
  The Tide door is sealed. It answers only the Tide-Bell."_

---

## 13. Data and implementation plan

### Content metadata (add during content phases, before the UI build)

Add map metadata without building the UI:

- `src/data/mapAtlas.ts`: `{ roomId, region, col, row, label, doors: { targetId, side, anchor }[] }`.
  Validate every room is placed and every door target exists.
- `src/data/mapNotes.ts`: one authored line per room; sealed requirements; lead copy.
- Add a `tideglass` key pickup at the Weeping Stone. Add `tideglass` to the key registry.
- Add a map-door hint to each exit if the in-world door side and the atlas side differ. This is
  content work; it prevents the map from lying.
- Save v3 adds `mapPins: { roomId, kind }[]` (max 12). `visitedRooms`, `pickups`,
  `brokenSecrets`, `sigils`, and `checkpointBenchId` already give the chart everything else.
- v2 → v3 migration grants `tideglass` if the Terrace has been visited; starts pins empty.

### Map foundation (after the content phases)

1. **Geometry**: read room rows → wall/floor/ledge runs, exit anchors, secret/gate cells. Cache
   per room. No hand-drawn room art.
2. **Model**: build a snapshot from `RunProgress` + current room + player position. Derive charted,
   ghost, swept, sealed, claimed, current, lead, pins.
3. **Screen**: chart SVG + Ledger DOM + list view + bottom sheet. One `TideglassView` owns the
   dialog, focus trap, pan/zoom, and close.
4. **Artifact**: first pickup, boot, open/close, touch/menu integration, disabled-in-boss rule,
   audio.
5. **Save/tests**: v3, unit tests for model/atlas/geometry, E2E for pickup, first open, room
   selection, ghost, seal, pin, list view, reduced motion, 375/768/1440, and boss disable.
6. **Art pass**: replace placeholders with the P0/P1 assets; 9-slice frame; wax; icons; seals;
   lens; hands; washes. Measure contrast and performance.
7. **Post-slice lenses**: Plumb, Reed, Stylus; optional fast travel only if the full game needs it.

### MVP vs later

**MVP (must ship):** true chart, atlas, charted/ghost/sealed/swept, current marker, bench/bell/boss
icons, Ledger, lead, pan/zoom, keyboard/gamepad/touch, list view, boot, first pickup, responsive,
save v3, tests.

**Later:** Plumb trace, Reed relic glints, Stylus pin types, fast travel, region washes, the Last
Bell page, completion stamp.

### Files that change

- Replace: `src/ui/map/mapLayout.ts`, `mapModel.ts`, `mapScreen.ts`, `mapTypes.ts`.
- Add: `src/ui/map/mapAtlas.ts`, `mapGeometry.ts`, `mapView.ts`, `mapBoot.ts`, `mapPins.ts`,
  `TideglassView.ts`, `map.css`.
- Integrate: `MenuView`/`MenuSystem` (pause row), `Game` (pickup + action + boss gate), `RunProgress`
  (key/pins/save v3), `InputManager` (map action, list/pin), touch HUD, assets manifest.
- Tests: `tests/unit/map*.test.ts`, `tests/e2e/map.spec.ts`; update `tests/e2e/menus.spec.ts`.

### Risks

- **Atlas vs content drift.** Mitigate with build-time validation and map-door hints. The map must
  never invent a door.
- **Dark-map legibility.** Mitigate with the bone/brass contrast, large labels, and a high-contrast
  mode. Test at 375 first, not last.
- **Scope.** Base map is a feature; the three lenses are a second feature. Do not glue them
  together. The base must be excellent without upgrades.
- **Old saves.** Migration must grant the Tideglass; otherwise existing players lose the map.
- **First pickup missable.** Put it on the first bench, with a prompt; do not hide it in a secret.
- **The current map's tests and labels.** The accessible name becomes "The Tideglass — chart of the
  Drowned Belfry"; keep a `Map` synonym in tests/announcements if needed. The required labels
  (`Enter the belfry`, `Continue the climb`, `Begin anew`, `Paused`, `The Bench`) are untouched.

---

## 14. Asset brief

The full, makeable list is in [TIDEGLASS_ASSETS.md](./TIDEGLASS_ASSETS.md). The short version:

**Do not draw the rooms, labels, map lines, or text.** Those are generated from the game data and
fonts; drawing them by hand would make the map inaccurate the moment a room changes.

**Make the materials and symbols:**

- P0: 9-slice brass/wood frame; 1024² black-wax tile; 18 core icon states at 48 × 48 (2× of 24),
  plus optional pin stamps; red/teal/brass wax seals; lens medallion.
- P1: spine, compass/plumb rose, three region washes, gloved hands (desktop only).
- P2: tower etching, wax ripple, lens flare, title plate, extra pin stamps.

**If you only make five things:** the frame, the wax tile, the icon sheet, the seals, and the lens.
Those carry 90% of the look. Everything else can be CSS for the first playable version.

**Format:** PNG with alpha; 2× source; no baked text; no AI-generated final assets; original work
or a clear CC0/OFL licence. Record everything in `public/assets/MANIFEST.json` and a `SOURCE.txt`
for the folder. Pixel-art icons: nearest-neighbour; frame/wax: smooth scaling.

---

## 15. Decisions taken (and what is still open)

**Taken:**

- The map is the **Tideglass**, a folding wax tablet with a salt-glass lens. It is found on the
  Weeping Stone and auto-opens once.
- It is a **true room-by-room side-view chart** generated from the room tilemaps, placed by an
  authored atlas. Not a node graph.
- Unknown rooms are **not shown** until a door is seen (ghost) or the room is entered. Secret rooms
  stay hidden.
- The **Ledger** answers where/ what/ sealed/ remaining; the lead is a sentence and a thread that
  stops at the dark.
- Black wax, brass, bone, brine. No parchment. No Hollow Knight pastiche.
- The base map is complete; the Plumb/Reed/Stylus are optional post-slice lenses. Fast travel is not
  in the base.
- The map build starts **after** the gameplay/content phases. Only content metadata and the
  `tideglass` pickup are added earlier.

**Open for approval:**

- The name **Tideglass** and the Weeping Stone pickup.
- The exact atlas positions (they are proposals; the content pass may move rooms).
- Whether the full game eventually adds fast travel via a fourth lens.
- Which P0 assets you want to make first; the build can start with CSS placeholders and swap them.

---

## Appendix A — room notes (proposed copy)

| Room               | Note                                                                |
| ------------------ | ------------------------------------------------------------------- |
| Belfry Terrace     | The last open sky. A broken bell hangs above the Weeping Stone.     |
| Bell Nave          | Three doors, three bells. The Keeper's Rest keeps the middle watch. |
| Ringing Undercroft | The Bellbearer's ring. The first sigil cools in the wax.            |
| Moss Choir         | The Warden's green silence. A bell waits under the moss.            |
| Silent Vault       | The Bell Thief's vault. The third bell has no tongue.               |
| Drowned Gallery    | The water has taken the west wall. A hard blow answers somewhere.   |
| Ossuary            | A shelf of bones behind the gallery. The dead keep their own door.  |
| Sunless Aqueduct   | The old water road. The Hookline waits on the high ledge.           |
| Lower Bellows      | The lungs of the tower. The shaft breathes above.                   |
| Wall-Claw Shaft    | A climb of rusted beams. The Hookline remembers the way.            |
| Upper Gallery      | The Tide door. It answers only the Tide-Bell.                       |
| Reliquary          | A secret chapel. Something long-reach waits on the ledge.           |

## Appendix B — example Ledger (current: Bell Nave)

```
THE KEEPER'S LEDGER
The Bell Nave
THE BELL NAVE · HUB
CHARTED · YOU ARE HERE

"Three doors, three bells. The Keeper's Rest keeps the middle watch."

PASSAGES
← Belfry Terrace            charted
↙ Lower Bellows             charted

THE THREE BELLS
↑ Ringing Undercroft        sigil claimed
→ an uncharted bell         the bell waits
↓ an uncharted bell         the bell waits

REST      The Bell-Keeper's Rest
LEAD      Two bells still silent. The Nave remembers all three.
MARKS     none                       [ X Place a pin ]

CHARTED 8 / 12 · SWEPT 3 · BELLS 1 / 3
```
