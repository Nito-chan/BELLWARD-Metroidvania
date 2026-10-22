/**
 * Design-only renderer for the Tideglass map mockup.
 *
 * This is NOT the game map. It reads the real room rows/legend so the design review can
 * see true room geometry, then draws a 1440 desktop artboard and a 375 mobile artboard.
 * The production map will own its own geometry, atlas, and view layer.
 *
 * Run: npx tsx scripts/design-map-mockup.ts
 * Out: docs/design/tideglass-map.svg
 */
import { writeFileSync } from 'node:fs';
import { ROOMS } from '../src/data/rooms';
import type { TileRole } from '../src/world/tiles';

type State = 'charted' | 'current' | 'ghost' | 'hidden';

type Placement = {
  readonly col: number;
  readonly row: number;
  readonly label: string;
  readonly state: State;
  readonly swept?: boolean;
  readonly claimed?: boolean;
};

const COLS = [480, 674, 868, 1062] as const;
const ROWS = [228, 334, 440, 546] as const;
const ROOM_W = 180;
const ROOM_H = 72;
const TILE = 3;

const LAYOUT: Readonly<Record<string, Placement>> = {
  'drowned-gallery': { col: 0, row: 1, label: 'DROWNED GALLERY', state: 'charted' },
  'sunless-aqueduct': { col: 0, row: 2, label: 'AQUEDUCT', state: 'charted' },
  ossuary: { col: 0, row: 3, label: '', state: 'hidden' },
  'wall-claw-shaft': { col: 1, row: 2, label: 'WALL-CLAW SHAFT', state: 'charted' },
  bellows: { col: 1, row: 3, label: 'LOWER BELLOWS', state: 'charted' },
  'upper-gallery': { col: 1, row: 0, label: 'UPPER GALLERY', state: 'charted' },
  'belfry-terrace': { col: 2, row: 1, label: 'BELFRY TERRACE', state: 'charted', swept: true },
  'belfry-antechamber': { col: 2, row: 2, label: 'BELL NAVE', state: 'current', swept: true },
  reliquary: { col: 2, row: 0, label: '', state: 'hidden' },
  'bellbearer-arena': {
    col: 3,
    row: 1,
    label: 'UNDERCROFT',
    state: 'charted',
    claimed: true,
    swept: true,
  },
  'warden-arena': { col: 3, row: 2, label: '', state: 'ghost' },
  'bellthief-arena': { col: 3, row: 3, label: '', state: 'ghost' },
};

const roomX = (p: Placement): number => COLS[p.col] ?? 0;
const roomY = (p: Placement): number => ROWS[p.row] ?? 0;

const fmt = (n: number): string => String(Math.round(n * 10) / 10);
const esc = (s: string): string =>
  s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');

const tower: string[] = [];

function text(x: number, y: number, value: string, cls = 'ui', extra = ''): string {
  return `<text x="${fmt(x)}" y="${fmt(y)}" class="${cls}" ${extra}>${esc(value)}</text>`;
}

function line(x1: number, y1: number, x2: number, y2: number, cls = 'connector'): string {
  return `<line x1="${fmt(x1)}" y1="${fmt(y1)}" x2="${fmt(x2)}" y2="${fmt(y2)}" class="${cls}"/>`;
}

function iconBell(x: number, y: number, fill: string, scale = 1): string {
  const s = scale;
  return `<g transform="translate(${fmt(x)} ${fmt(y)}) scale(${s})">
    <path d="M-5 4h10M-4 4c0-5 1-8 4-8s4 3 4 8M0 4v3M-2 9h4" fill="none" stroke="${fill}" stroke-width="1.4" stroke-linecap="round"/>
    <circle cx="0" cy="2" r="0.8" fill="${fill}"/>
  </g>`;
}

function iconBench(x: number, y: number): string {
  return `<g transform="translate(${fmt(x)} ${fmt(y)})">
    <path d="M-6 0h12M-5 0v4M5 0v4M-7 -3h14" fill="none" stroke="#c9a35a" stroke-width="1.2" stroke-linecap="round"/>
    <circle cx="0" cy="6" r="1.2" fill="#a64b3f"/>
  </g>`;
}

function iconSeal(x: number, y: number, color = '#a64b3f'): string {
  return `<g transform="translate(${fmt(x)} ${fmt(y)})">
    <circle r="7" fill="${color}" stroke="#2a0f0a" stroke-width="1"/>
    <path d="M-3 3c0-4 1-6 3-6s3 2 3 6M-3 3h6M0 3v3" fill="none" stroke="#f2e5c8" stroke-width="0.9" stroke-linecap="round"/>
  </g>`;
}

function iconSwept(x: number, y: number): string {
  return `<g transform="translate(${fmt(x)} ${fmt(y)})">
    <circle r="5" fill="none" stroke="#6fae96" stroke-width="1"/>
    <path d="M-2 0l1.5 2L3 -2" fill="none" stroke="#6fae96" stroke-width="1.1" stroke-linecap="round"/>
  </g>`;
}

function iconMoth(x: number, y: number): string {
  return `<g transform="translate(${fmt(x)} ${fmt(y)})">
    <path d="M0 -6C-5 -8 -9 -5 -8 0c-5 4 2 7 8 3 6 4 13 1 8-3 1-5-3-8-8 0z" fill="#f2d28a" stroke="#4a2f12" stroke-width="0.8"/>
    <path d="M0 -7v13" stroke="#2a160a" stroke-width="0.8"/>
    <circle cx="-4" cy="-1" r="1" fill="#2a160a"/><circle cx="4" cy="-1" r="1" fill="#2a160a"/>
  </g>`;
}

function iconPin(x: number, y: number, color = '#d49a9a'): string {
  return `<g transform="translate(${fmt(x)} ${fmt(y)})">
    <path d="M0 -7c3 0 4 3 2 5L0 4l-2-6c-2-2-1-5 2-5z" fill="${color}" stroke="#2a0f0a" stroke-width="0.8"/>
    <circle cx="0" cy="-3" r="1.1" fill="#2a0f0a"/>
  </g>`;
}

function drawConnectors(): string {
  let out = '';
  out += `<path d="M660 370H868" class="connector"/>`;
  out += `<path d="M958 406V440" class="connector"/>`;
  out += `<path d="M868 500 C 840 500, 846 550, 854 552" class="connector"/>`;
  out += `<path d="M570 406V440" class="connector"/>`;
  out += `<path d="M660 500 C 667 500, 668 552, 674 558" class="connector"/>`;
  out += `<path d="M764 546V512" class="connector"/>`;
  out += `<path d="M764 440V300" class="connector"/>`;
  out += `<path d="M840 300 C 840 320, 916 316, 938 334" class="connector one-way" marker-end="url(#arrow)"/>`;
  out += `<path d="M1048 460 C 1054 460, 1054 370, 1062 370" class="connector"/>`;
  out += `<path d="M1048 476H1062" class="connector ghost-line"/>`;
  out += `<path d="M1048 496 C 1056 496, 1056 582, 1062 582" class="connector ghost-line"/>`;
  out += `<g transform="translate(764 372)">${iconBell(0, 0, '#8a6a3f', 0.7)}</g>`;
  return out;
}

function drawThread(): string {
  return `<g class="thread">
    <path d="M1018 484 C 1036 484, 1044 476, 1062 476" />
    <path d="M1018 492 C 1040 492, 1042 580, 1062 580" />
    ${iconPin(1018, 488, '#d49a9a')}
  </g>`;
}

function drawRoom(id: string): string {
  const room = ROOMS[id];
  const p = LAYOUT[id];
  if (!room || !p) throw new Error(`Missing room or layout for ${id}`);
  const x = roomX(p);
  const y = roomY(p);
  let out = '';

  if (p.state === 'ghost') {
    out += `<rect x="${x}" y="${y}" width="${ROOM_W}" height="${ROOM_H}" rx="3" class="ghost-room"/>`;
    out += text(x + 9, y + 17, '?', 'ghost-mark');
    out += text(x + 9, y + 31, 'THE GLASS', 'tiny muted');
    out += text(x + 9, y + 39, 'IS DARK', 'tiny muted');
    out += `<g transform="translate(${x + ROOM_W / 2} ${y + ROOM_H / 2 + 6})">${iconBell(0, 0, '#8a6a3f', 1.4)}</g>`;
    out += text(x + 9, y + ROOM_H - 7, 'A BELL WAITS', 'tiny ghost-text');
    return out;
  }

  const fillClass =
    p.state === 'current'
      ? 'room-fill current'
      : p.claimed
        ? 'room-fill claimed'
        : 'room-fill charted';
  out += `<rect x="${x}" y="${y}" width="${ROOM_W}" height="${ROOM_H}" rx="3" class="${fillClass}"/>`;
  if (p.state === 'current') {
    out += `<rect x="${x - 4}" y="${y - 4}" width="${ROOM_W + 8}" height="${ROOM_H + 8}" rx="5" class="current-halo"/>`;
    out += `<circle cx="${x + 92}" cy="${y + 54}" r="30" fill="url(#currentGlow)"/>`;
  }

  // True interior: merge runs of the same role per row.
  for (let row = 0; row < room.rows.length; row += 1) {
    const source = room.rows[row] ?? '';
    let start = 0;
    while (start < source.length) {
      const glyph = source[start] ?? ' ';
      const role: TileRole | undefined = room.legend[glyph];
      if (
        !role ||
        role === 'window' ||
        role === 'backgroundBrick' ||
        role === 'puddle' ||
        role === 'rubble' ||
        role === 'cobweb'
      ) {
        start += 1;
        continue;
      }
      let end = start + 1;
      while (end < source.length) {
        const next = source[end] ?? ' ';
        if (room.legend[next] !== role) break;
        end += 1;
      }
      const rx = x + start * TILE;
      const ry = y + row * TILE;
      const rw = (end - start) * TILE;
      if (role === 'ledge') {
        out += `<rect x="${fmt(rx)}" y="${fmt(ry)}" width="${fmt(rw)}" height="1.2" class="strat-ledge"/>`;
      } else if (role === 'floor') {
        out += `<rect x="${fmt(rx)}" y="${fmt(ry)}" width="${fmt(rw)}" height="2" class="strat-floor"/>`;
      } else if (role === 'floorFill') {
        out += `<rect x="${fmt(rx)}" y="${fmt(ry)}" width="${fmt(rw)}" height="3" class="strat-fill"/>`;
      } else if (role === 'sealedDoor') {
        out += `<rect x="${fmt(rx)}" y="${fmt(ry)}" width="${fmt(rw)}" height="3" class="strat-sealed"/>`;
      } else if (role === 'breakable') {
        out += `<rect x="${fmt(rx)}" y="${fmt(ry)}" width="${fmt(rw)}" height="3" class="strat-wall"/>`;
      } else {
        out += `<rect x="${fmt(rx)}" y="${fmt(ry)}" width="${fmt(rw)}" height="3" class="strat-wall"/>`;
      }
      start = end;
    }
  }

  out += `<rect x="${x}" y="${y}" width="${ROOM_W}" height="${ROOM_H}" rx="3" fill="none" class="room-border ${p.state}"/>`;
  out += text(
    x + 9,
    y + 15,
    p.label,
    p.state === 'current' ? 'room-label current-label' : 'room-label',
  );

  if (p.state === 'current') {
    out += text(x + 9, y + 26, 'YOU ARE HERE', 'tiny current-text');
    out += iconMoth(x + 92, y + 52);
  }

  if (p.swept) out += iconSwept(x + ROOM_W - 12, y + 12);
  if (p.claimed)
    out += `<g transform="translate(${x + ROOM_W / 2} ${y + 47})">${iconBell(0, 0, '#6fae96', 1.25)}<circle r="13" fill="none" stroke="#6fae96" stroke-width="0.7" opacity="0.55"/></g>`;

  if (id === 'belfry-terrace' || id === 'belfry-antechamber' || id === 'upper-gallery') {
    const bench = room.props.find((prop) => prop.art === 'bench');
    const bx = bench ? x + (bench.x / 16) * TILE : x + 28;
    out += iconBench(bx, y + 52);
  }

  if (id === 'upper-gallery') {
    out += `<g transform="translate(${x + 96} 0)"><line x1="0" y1="${y + 5}" x2="0" y2="${y + 57}" class="sealed-line"/></g>`;
    out += iconSeal(x + 96, y + 23);
    out += text(x + 106, y + 25, 'SEALED', 'tiny sealed-text');
    out += text(x + 106, y + 33, 'TIDE DOOR', 'tiny muted');
  }

  return out;
}

function drawRegionLabel(x: number, y: number, value: string): string {
  return `<text x="${x}" y="${y}" class="region-label" text-anchor="middle">${value}</text>`;
}

function ledger(): string {
  if (LAYOUT['belfry-antechamber']?.state !== 'current') return '';
  const x = 128;
  let out = '';
  out += text(x, 202, "THE KEEPER'S LEDGER", 'ledger-kicker');
  out += text(x, 229, 'The Bell Nave', 'ledger-room');
  out += text(x, 247, 'THE BELL NAVE · HUB', 'tiny muted');
  out += `<rect x="${x}" y="258" width="66" height="13" rx="2" class="chip"/><text x="${x + 33}" y="267" text-anchor="middle" class="chip-text">CHARTED</text>`;
  out += `<text x="${x + 74}" y="267" class="tiny current-text">SWEPT · YOU ARE HERE</text>`;
  out += `<line x1="${x}" y1="282" x2="410" y2="282" class="rule"/>`;
  out += text(x, 302, '“Three doors, three bells.', 'ledger-note');
  out += text(x, 316, 'The Keeper’s Rest keeps', 'ledger-note');
  out += text(x, 330, 'the middle watch.”', 'ledger-note');

  out += text(x, 360, 'PASSAGES', 'section-label');
  out += text(x, 380, '←  Belfry Terrace', 'ledger-row');
  out += text(410, 380, 'charted', 'ledger-state');
  out += text(x, 396, '↙  Lower Bellows', 'ledger-row');
  out += text(410, 396, 'charted', 'ledger-state');

  out += text(x, 426, 'THE THREE BELLS', 'section-label');
  out += text(x, 446, '↑  Ringing Undercroft', 'ledger-row');
  out += text(410, 446, 'sigil claimed', 'ledger-state claimed-text');
  out += text(x, 462, '→  an uncharted bell', 'ledger-row');
  out += text(410, 462, 'the bell waits', 'ledger-state muted');
  out += text(x, 478, '↓  an uncharted bell', 'ledger-row');
  out += text(410, 478, 'the bell waits', 'ledger-state muted');

  out += `<line x1="${x}" y1="496" x2="410" y2="496" class="rule"/>`;
  out += text(x, 515, 'REST', 'row-label');
  out += text(x + 58, 515, "The Bell-Keeper's Rest", 'ledger-row');
  out += text(x, 534, 'SEALED', 'row-label sealed-text');
  out += text(x + 58, 534, 'The Tide door · Upper Gallery', 'ledger-row');
  out += text(x, 561, 'LEAD', 'row-label');
  out += text(x, 577, 'Two bells still silent.', 'ledger-lead');
  out += text(x, 591, 'The Nave remembers all three.', 'ledger-lead');
  out += text(x, 617, 'MARKS', 'row-label');
  out += text(x + 58, 617, 'none', 'ledger-row muted');
  out += `<rect x="${x + 118}" y="602" width="116" height="24" rx="3" class="ledger-button"/>`;
  out += text(x + 176, 618, 'X  PLACE A PIN', 'button-text');

  out += `<line x1="${x}" y1="646" x2="410" y2="646" class="rule"/>`;
  out += text(x, 672, 'CHARTED 8 / 12', 'footer-metric');
  out += text(x + 96, 672, 'SWEPT 3', 'footer-metric');
  out += text(x + 160, 672, 'BELLS 1 / 3', 'footer-metric');
  out += text(x, 691, 'The glass remembers what the tower forgets.', 'tiny muted italic');
  return out;
}

function frame(): string {
  let out = '';
  out += `<rect x="64" y="32" width="1312" height="836" rx="22" fill="url(#frameWood)" stroke="#7d5f2f" stroke-width="1.5"/>`;
  out += `<rect x="80" y="48" width="1280" height="804" rx="14" fill="#120c08" stroke="#3a2a18" stroke-width="1"/>`;
  out += `<rect x="96" y="60" width="1248" height="780" rx="10" fill="none" stroke="#5b452a" stroke-width="0.7" opacity="0.65"/>`;
  // corner ornament
  for (const [cx, cy, sx, sy] of [
    [96, 60, 1, 1],
    [1344, 60, -1, 1],
    [96, 840, 1, -1],
    [1344, 840, -1, -1],
  ] as const) {
    out += `<path d="M${cx} ${cy + sy * 30} V${cy + sy * 10} H${cx + sx * 20} M${cx + sx * 8} ${cy + sy * 18} h${sx * 10} M${cx + sx * 18} ${cy + sy * 8} v${sy * 10}" fill="none" stroke="#c9a35a" stroke-width="1" opacity="0.55"/>`;
  }
  // lens
  out += `<circle cx="720" cy="79" r="27" fill="url(#brass)" stroke="#2a1a0c" stroke-width="2"/>`;
  out += `<circle cx="720" cy="79" r="21" fill="url(#lensGlass)" stroke="#f2d28a" stroke-width="0.7" opacity="0.9"/>`;
  out += `<path d="M707 72c4-6 14-7 19-2" fill="none" stroke="#7fe0c3" stroke-width="1" opacity="0.8"/>`;
  out += text(720, 128, 'THE TIDEGLASS', 'title');
  out += text(720, 146, 'A CHART OF THE DROWNED BELFRY', 'subtitle');
  out += text(1150, 111, 'CHARTED', 'stat-label');
  out += text(1150, 129, '8 / 12', 'stat-value');
  out += text(1224, 111, 'BELLS', 'stat-label');
  out += text(1224, 129, '1 / 3', 'stat-value');
  out += `<rect x="1276" y="103" width="54" height="24" rx="3" class="close-button"/>`;
  out += text(1303, 119, 'M · CLOSE', 'close-text');
  out += line(112, 162, 1328, 162, 'frame-rule');
  return out;
}

function footer(): string {
  let out = '';
  const y = 770;
  out += `<rect x="96" y="746" width="1248" height="70" rx="5" fill="#0d0906" stroke="#2a1e12"/>`;
  const items: Array<[string, string]> = [
    ['●', 'YOU ARE HERE'],
    ['□', 'CHARTED'],
    ['◌', 'UNCHARTED'],
    ['♨', 'REST'],
    ['♪', 'BELL'],
    ['✕', 'SEALED'],
    ['⌁', 'SECRET'],
  ];
  let x = 114;
  for (const [glyph, label] of items) {
    out += text(x, y, glyph, 'legend-glyph');
    out += text(x + 14, y, label, 'legend-label');
    x += glyph === '●' ? 118 : 96;
  }
  out += text(1030, y, '−   100%   +', 'legend-label');
  out += `<rect x="1138" y="${y - 14}" width="34" height="20" rx="2" class="mini-button"/>`;
  out += text(1155, y, 'FIT', 'mini-text');
  out += `<rect x="1180" y="${y - 14}" width="52" height="20" rx="2" class="mini-button"/>`;
  out += text(1206, y, 'CURRENT', 'mini-text');
  out += text(
    114,
    y + 22,
    'Drag to pan  ·  Wheel to zoom  ·  Click a room for its ledger  ·  Esc to close',
    'tiny muted',
  );
  out += text(1226, y + 22, 'DESIGN MOCKUP · NOT FINAL ART', 'tiny muted');
  return out;
}

function chart(): string {
  let out = `<rect x="472" y="176" width="856" height="552" rx="4" class="chart-bg"/>`;
  out += `<g clip-path="url(#chartClip)">`;
  out += `<rect x="480" y="184" width="848" height="536" fill="url(#wax)" opacity="0.9"/>`;
  out += `<rect x="480" y="184" width="848" height="536" filter="url(#grain)" opacity="0.35"/>`;
  out += drawRegionWash();
  out += drawConnectors();
  for (const id of Object.keys(LAYOUT)) {
    const p = LAYOUT[id];
    if (!p || p.state === 'hidden') continue;
    tower.push(drawRoom(id));
  }
  out += tower.join('');
  out += drawThread();
  out += drawRegionLabel(570, 326, 'THE DROWNED FOUNDATIONS');
  out += drawRegionLabel(958, 326, 'THE BELL NAVE');
  out += drawRegionLabel(764, 220, 'THE UPPER BELFRY');
  out += text(880, 208, 'THE GLASS IS DARK', 'region-label last-bell');
  out += `<g transform="translate(1010 212)">${iconBell(0, 0, '#5b452a', 0.8)}</g>`;
  // plumb rose
  out += `<g transform="translate(1286 212)" opacity="0.55">
    <circle r="27" fill="none" stroke="#c9a35a" stroke-width="0.8"/>
    <circle r="20" fill="none" stroke="#c9a35a" stroke-width="0.4"/>
    <path d="M0 -24V24M-24 0H24M-7 -7L7 7" stroke="#c9a35a" stroke-width="0.6"/>
    <path d="M0 -20l3 7h-6z" fill="#c9a35a"/>
    <text x="0" y="-31" text-anchor="middle" class="tiny muted">ASCENT</text>
    <text x="0" y="35" text-anchor="middle" class="tiny muted">THE DROWNED</text>
  </g>`;
  // scale
  out += line(492, 698, 540, 698, 'scale');
  out += line(492, 693, 492, 703, 'scale');
  out += line(540, 693, 540, 703, 'scale');
  out += text(492, 712, '10 PACES', 'tiny muted');
  out += `<text x="1212" y="712" text-anchor="end" class="tiny muted">The tower remembers in rooms, not miles.</text>`;
  out += `</g>`;
  out += `<rect x="472" y="176" width="856" height="552" rx="4" fill="none" stroke="#3a2a18"/>`;
  return out;
}

function drawRegionWash(): string {
  return `<g opacity="0.85">
    <path d="M470 520 C 450 470, 520 430, 570 440 C 640 452, 660 500, 650 560 C 640 630, 560 650, 510 620 C 470 596, 486 552, 470 520Z" fill="#1d3a3a" opacity="0.22"/>
    <path d="M820 318 C 880 296, 1010 300, 1070 340 C 1120 380, 1100 520, 1050 580 C 1000 630, 900 620, 850 570 C 810 520, 780 370, 820 318Z" fill="#3a2a18" opacity="0.2"/>
    <path d="M640 210 C 720 180, 880 190, 960 230 C 1010 260, 1000 300, 940 310 C 860 320, 700 320, 650 286 C 610 260, 610 228, 640 210Z" fill="#2b3438" opacity="0.25"/>
  </g>`;
}

function mobileArtboard(): string {
  let out = '';
  out += `<rect x="1480" y="44" width="375" height="812" rx="10" fill="#070504" stroke="#7d5f2f"/>`;
  out += `<rect x="1480" y="44" width="375" height="48" fill="#140d08"/>`;
  out += text(1496, 73, 'THE TIDEGLASS', 'mobile-title');
  out += text(1790, 73, '8 / 12', 'mobile-count');
  out += `<rect x="1808" y="53" width="36" height="30" rx="4" fill="#21170f" stroke="#7d5f2f"/>`;
  out += `<path d="M1820 63l12 10m0-10l-12 10" stroke="#f2e5c8" stroke-width="1.4"/>`;
  out += `<defs><clipPath id="mobileChartClip"><rect x="1480" y="92" width="375" height="420"/></clipPath></defs>`;
  out += `<g clip-path="url(#mobileChartClip)">`;
  out += `<rect x="1480" y="92" width="375" height="420" fill="url(#wax)"/>`;
  out += `<g transform="translate(1480 92) translate(187 230) scale(0.62) translate(-958 -476)">`;
  out += `<use href="#towerGeometry"/>`;
  out += `</g>`;
  out += `</g>`;
  out += `<rect x="1498" y="110" width="166" height="22" rx="3" fill="#17110c" stroke="#c9a35a" opacity="0.95"/>`;
  out += text(1508, 125, 'CURRENT · THE BELL NAVE', 'tiny current-text');
  out += `<rect x="1480" y="500" width="375" height="356" fill="#140d08" stroke="#3a2a18"/>`;
  out += `<rect x="1648" y="508" width="40" height="4" rx="2" fill="#5b452a"/>`;
  out += text(1496, 540, 'THE BELL NAVE', 'mobile-room');
  out += text(1496, 556, 'CHARTED · SWEPT · YOU ARE HERE', 'tiny current-text');
  out += text(1496, 578, 'Three doors, three bells. The', 'mobile-note');
  out += text(1496, 592, 'Keeper’s Rest keeps the middle', 'mobile-note');
  out += text(1496, 606, 'watch.', 'mobile-note');
  out += `<line x1="1496" y1="620" x2="1836" y2="620" class="rule"/>`;
  out += text(1496, 640, 'THE THREE BELLS', 'section-label');
  out += text(1496, 658, '↑ Ringing Undercroft', 'mobile-row');
  out += text(1836, 658, 'sigil', 'ledger-state claimed-text');
  out += text(1496, 676, '→ an uncharted bell', 'mobile-row');
  out += text(1836, 676, 'waits', 'ledger-state muted');
  out += text(1496, 694, '↓ an uncharted bell', 'mobile-row');
  out += text(1836, 694, 'waits', 'ledger-state muted');
  out += text(1496, 716, 'Two bells still silent. The Nave remembers all three.', 'mobile-lead');
  out += `<rect x="1496" y="730" width="343" height="40" rx="4" class="ledger-button"/>`;
  out += text(1667, 755, 'OPEN THE LEDGER', 'button-text');
  out += text(1496, 792, 'Tap a room  ·  Pinch to zoom  ·  The map stays open', 'tiny muted');
  out += `<line x1="1496" y1="560" x2="1836" y2="560" class="rule" opacity="0.35"/>`;
  return out;
}

const style = `
  :root { color-scheme: dark; }
  .ui { font-family: 'Pixelify Sans', 'Segoe UI', Consolas, monospace; fill: #d8c7a6; }
  .title { font-family: 'Jacquard 12', Georgia, serif; font-size: 27px; fill: #f2e5c8; text-anchor: middle; letter-spacing: 2px; }
  .subtitle { font-family: 'Pixelify Sans', Consolas, monospace; font-size: 8px; fill: #b9a98d; text-anchor: middle; letter-spacing: 2.2px; }
  .mobile-title { font-family: 'Jacquard 12', Georgia, serif; font-size: 15px; fill: #f2e5c8; letter-spacing: 1.2px; }
  .mobile-count { font-family: 'Pixelify Sans', Consolas, monospace; font-size: 9px; fill: #c9a35a; text-anchor: end; }
  .mobile-room { font-family: 'Jacquard 12', Georgia, serif; font-size: 20px; fill: #f2e5c8; }
  .mobile-note { font-family: 'Pixelify Sans', Consolas, monospace; font-size: 11px; fill: #b9a98d; }
  .mobile-row { font-family: 'Pixelify Sans', Consolas, monospace; font-size: 11px; fill: #d8c7a6; }
  .mobile-lead { font-family: 'Pixelify Sans', Consolas, monospace; font-size: 10px; fill: #d49a9a; }
  .stat-label { font-family: 'Pixelify Sans', Consolas, monospace; font-size: 6.5px; fill: #b9a98d; letter-spacing: 1.6px; }
  .stat-value { font-family: 'Pixelify Sans', Consolas, monospace; font-size: 10px; fill: #f2d28a; letter-spacing: 0.8px; }
  .close-button { fill: #17110c; stroke: #7d5f2f; }
  .close-text { font-family: 'Pixelify Sans', Consolas, monospace; font-size: 7px; fill: #d8c7a6; text-anchor: middle; letter-spacing: 0.7px; }
  .frame-rule { stroke: #3a2a18; stroke-width: 1; }
  .chart-bg { fill: #0b0806; }
  .room-fill { fill: #221a12; }
  .room-fill.charted { fill: #221a12; }
  .room-fill.current { fill: #322515; }
  .room-fill.claimed { fill: #1b2822; }
  .room-border { stroke: #8a6a3f; stroke-width: 1; }
  .room-border.current { stroke: #f2d28a; stroke-width: 1.4; }
  .room-border.claimed { stroke: #6fae96; stroke-width: 1; }
  .current-halo { fill: none; stroke: #f2d28a; stroke-width: 0.7; opacity: 0.45; }
  .room-label { font-family: 'Pixelify Sans', Consolas, monospace; font-size: 8px; fill: #d8c7a6; letter-spacing: 0.5px; }
  .room-label.current-label { fill: #f2d28a; }
  .current-text { fill: #f2d28a; }
  .tiny { font-family: 'Pixelify Sans', Consolas, monospace; font-size: 6.5px; }
  .muted { fill: #8a7a5f; }
  .italic { font-style: italic; }
  .ghost-room { fill: none; stroke: #6b5a44; stroke-width: 1; stroke-dasharray: 4 4; }
  .ghost-mark { font-family: 'Jacquard 12', Georgia, serif; font-size: 22px; fill: #6b5a44; }
  .ghost-text { fill: #8a6a3f; letter-spacing: 1px; }
  .connector { fill: none; stroke: #8a6a3f; stroke-width: 1; }
  .ghost-line { stroke-dasharray: 4 4; opacity: 0.75; }
  .one-way { stroke: #b08a4f; }
  .thread { fill: none; stroke: #d49a9a; stroke-width: 1.2; opacity: 0.9; }
  .sealed-line { stroke: #a64b3f; stroke-width: 1.6; stroke-dasharray: 3 3; }
  .sealed-text { fill: #d49a9a; letter-spacing: 1px; }
  .strat-wall { fill: #3a2a1a; opacity: 0.9; }
  .strat-fill { fill: #2a1e14; opacity: 0.9; }
  .strat-floor { fill: #c9a35a; opacity: 0.85; }
  .strat-ledge { fill: #d8c7a6; opacity: 0.75; }
  .strat-sealed { fill: #a64b3f; opacity: 0.9; }
  .region-label { font-family: 'Pixelify Sans', Consolas, monospace; font-size: 6.5px; fill: #8a7a5f; letter-spacing: 1.7px; }
  .last-bell { fill: #5b452a; opacity: 0.85; }
  .scale { stroke: #8a6a3f; stroke-width: 0.8; }
  .ledger-kicker { font-family: 'Pixelify Sans', Consolas, monospace; font-size: 7px; fill: #c9a35a; letter-spacing: 1.6px; }
  .ledger-room { font-family: 'Jacquard 12', Georgia, serif; font-size: 19px; fill: #f2e5c8; }
  .chip { fill: #21170f; stroke: #7d5f2f; }
  .chip-text { font-family: 'Pixelify Sans', Consolas, monospace; font-size: 6px; fill: #f2d28a; letter-spacing: 0.6px; }
  .rule { stroke: #3a2a18; stroke-width: 0.8; }
  .ledger-note { font-family: 'Pixelify Sans', Consolas, monospace; font-size: 9px; fill: #b9a98d; }
  .section-label { font-family: 'Pixelify Sans', Consolas, monospace; font-size: 6.5px; fill: #c9a35a; letter-spacing: 1.5px; }
  .ledger-row { font-family: 'Pixelify Sans', Consolas, monospace; font-size: 8.5px; fill: #d8c7a6; }
  .ledger-state { font-family: 'Pixelify Sans', Consolas, monospace; font-size: 7px; fill: #8a7a5f; text-anchor: end; }
  .claimed-text { fill: #6fae96; }
  .row-label { font-family: 'Pixelify Sans', Consolas, monospace; font-size: 6.5px; fill: #8a7a5f; letter-spacing: 1px; }
  .ledger-lead { font-family: 'Pixelify Sans', Consolas, monospace; font-size: 8.5px; fill: #d49a9a; }
  .ledger-button { fill: #21170f; stroke: #7d5f2f; }
  .button-text { font-family: 'Pixelify Sans', Consolas, monospace; font-size: 7px; fill: #f2d28a; text-anchor: middle; letter-spacing: 0.6px; }
  .footer-metric { font-family: 'Pixelify Sans', Consolas, monospace; font-size: 7px; fill: #c9a35a; letter-spacing: 0.7px; }
  .legend-glyph { font-family: 'Pixelify Sans', Consolas, monospace; font-size: 8px; fill: #c9a35a; }
  .legend-label { font-family: 'Pixelify Sans', Consolas, monospace; font-size: 6.5px; fill: #b9a98d; letter-spacing: 0.8px; }
  .mini-button { fill: #21170f; stroke: #5b452a; }
  .mini-text { font-family: 'Pixelify Sans', Consolas, monospace; font-size: 6px; fill: #d8c7a6; text-anchor: middle; }
`;

const defsSvg = `
  <defs>
    <linearGradient id="frameWood" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#24170e"/>
      <stop offset="0.5" stop-color="#170f09"/>
      <stop offset="1" stop-color="#0d0805"/>
    </linearGradient>
    <radialGradient id="brass" cx="35%" cy="30%" r="75%">
      <stop offset="0" stop-color="#f2d28a"/>
      <stop offset="0.45" stop-color="#a57b38"/>
      <stop offset="1" stop-color="#4a351b"/>
    </radialGradient>
    <radialGradient id="lensGlass" cx="38%" cy="35%" r="70%">
      <stop offset="0" stop-color="#315a50"/>
      <stop offset="0.4" stop-color="#142a25"/>
      <stop offset="1" stop-color="#050b09"/>
    </radialGradient>
    <radialGradient id="currentGlow" cx="50%" cy="50%" r="50%">
      <stop offset="0" stop-color="#f2d28a" stop-opacity="0.25"/>
      <stop offset="1" stop-color="#f2d28a" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="wax" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#1d1510"/>
      <stop offset="0.55" stop-color="#17110c"/>
      <stop offset="1" stop-color="#0e0a07"/>
    </linearGradient>
    <filter id="grain" x="0" y="0" width="100%" height="100%">
      <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed="7"/>
      <feColorMatrix type="saturate" values="0"/>
      <feComponentTransfer><feFuncA type="table" tableValues="0 0.10"/></feComponentTransfer>
    </filter>
    <marker id="arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto">
      <path d="M0 0L8 4L0 8z" fill="#b08a4f"/>
    </marker>
    <clipPath id="chartClip"><rect x="472" y="176" width="856" height="552" rx="4"/></clipPath>
  </defs>
`;

const chartSvg = chart();
const frameSvg = frame();
const footerSvg = footer();
const ledgerSvg = ledger();
const mobileSvg = mobileArtboard();

const total = `<svg xmlns="http://www.w3.org/2000/svg" width="1900" height="920" viewBox="0 0 1900 920" role="img" aria-label="Design mockup of the Tideglass map, a wax and brass room-by-room chart">
  <title>Tideglass map — design mockup</title>
  <style>${style}</style>
  ${defsSvg}
  <rect width="1900" height="920" fill="#050403"/>
  ${frameSvg}
  ${ledgerSvg}
  ${chartSvg}
  ${footerSvg}
  <g id="towerGeometry" style="display:none"></g>
  ${mobileSvg}
  <text x="720" y="892" text-anchor="middle" class="tiny muted">TIDEGLASS · DESIGN MOCKUP · room geometry from the live room data · final frame, wax, icons, seals and lens are your P0 assets</text>
  <text x="1667" y="892" text-anchor="middle" class="tiny muted">375 × 812</text>
</svg>`;

// The tower group is referenced by the mobile artboard. Fill it now that all geometry exists.
const towerMarkup = `<g id="towerGeometry">${drawConnectors()}${Object.keys(LAYOUT)
  .map((id) => {
    const p = LAYOUT[id];
    return p && p.state !== 'hidden' ? drawRoom(id) : '';
  })
  .join('')}${drawThread()}</g>`;

// Rebuild the SVG with the tower group in defs (hidden as a symbol-like group).
const finalSvg = total
  .replace('<g id="towerGeometry" style="display:none"></g>', `<defs>${towerMarkup}</defs>`)
  .replace('</svg>', '</svg>\n');

writeFileSync(new URL('../docs/design/tideglass-map.svg', import.meta.url), finalSvg);
console.log('Wrote docs/design/tideglass-map.svg');
