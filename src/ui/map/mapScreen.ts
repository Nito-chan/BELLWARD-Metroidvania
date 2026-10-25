/**
 * The Tideglass: a wax-and-brass chart built from the run's durable facts.
 *
 * The screen owns only presentation and local camera state. Every room, door, mark and
 * requirement comes from the snapshot; pin changes are delegated to RunSession so a
 * press is saved before the wax is redrawn.
 */
import './map.css';
import { MAP } from '../../config/map';
import { el, markNav } from '../menu/menuDom';
import { mapIcon } from './mapIcons';
import type { MapDoorSnapshot, MapLinkSnapshot, MapRoomSnapshot, MapSnapshot } from './mapTypes';

const NS = 'http://www.w3.org/2000/svg';

export type MapPinResult = 'added' | 'removed' | 'full' | 'unknown';

export type MapScreenOptions = {
  /** First reveal after collecting the Tideglass. */
  readonly boot: boolean;
  /** A later opening: the glass remembers the whole chart. */
  readonly remembering: boolean;
  readonly onPin: (roomId: string) => MapPinResult;
};

type View = { scale: number; x: number; y: number };
type PointerState = { x: number; y: number; startX: number; startY: number };
type Mode = 'chart' | 'list';

const DIRECTION: Readonly<Record<string, string>> = {
  north: 'N',
  east: 'E',
  south: 'S',
  west: 'W',
};

export class TideglassScreen {
  readonly root: HTMLElement;

  private readonly snapshot: MapSnapshot;
  private readonly options: MapScreenOptions;
  private readonly viewport: HTMLElement;
  private readonly stage: HTMLElement;
  private readonly ledger: HTMLElement;
  private readonly list: HTMLElement;
  private readonly chartPanel: HTMLElement;
  private readonly chartTab: HTMLButtonElement;
  private readonly listTab: HTMLButtonElement;
  private readonly zoomOutButton: HTMLButtonElement;
  private readonly zoomInButton: HTMLButtonElement;
  private readonly zoomValue: HTMLElement;
  private readonly footerCounts: HTMLElement;
  private ledgerTitle!: HTMLElement;
  private ledgerKicker!: HTMLElement;
  private ledgerNote!: HTMLElement;
  private ledgerLead!: HTMLElement;
  private chips!: HTMLElement;
  private facts!: HTMLElement;
  private passages!: HTMLElement;
  private pinButton!: HTMLButtonElement;
  private pinStatus!: HTMLElement;
  private readonly roomNodes = new Map<string, HTMLButtonElement>();
  private readonly pins: Set<string>;
  private readonly abort = new AbortController();
  private readonly pointers = new Map<number, PointerState>();

  private selectedId: string;
  private mode: Mode = 'chart';
  private view: View = { scale: 1, x: 0, y: 0 };
  private fitScale = 1;
  private modelReady = false;
  private lastWidth = 0;
  private lastHeight = 0;
  private pointerMoved = false;
  private pinchDistance = 0;
  private pinchScale = 1;
  private pinchWorld = { x: 0, y: 0 };
  private lastDragEnd = 0;
  private suppressClick = false;
  private resizeObserver: ResizeObserver | null = null;
  private introTimer: number | null = null;

  constructor(snapshot: MapSnapshot, options: MapScreenOptions) {
    this.snapshot = snapshot;
    this.options = options;
    this.pins = new Set(snapshot.rooms.filter((room) => room.pinned).map((room) => room.roomId));
    this.selectedId = snapshot.currentRoomId;

    this.root = el('div', 'tg');
    this.root.dataset.testid = 'tideglass';
    this.root.dataset.view = this.mode;
    if (options.boot) this.root.classList.add('is-booting');
    else if (options.remembering) this.root.classList.add('is-remembering');

    const head = el('header', 'tg-head');
    const brand = el('div', 'tg-brand');
    const lens = el('div', 'tg-lens');
    lens.setAttribute('aria-hidden', 'true');
    lens.append(
      el('span', 'tg-lens-ring tg-lens-ring--outer'),
      el('span', 'tg-lens-ring tg-lens-ring--inner'),
      el('span', 'tg-lens-bead'),
      el('span', 'tg-lens-glint'),
    );
    const brandCopy = el('div', 'tg-brand-copy');
    const title = el('h2', 'tg-title', 'THE TIDEGLASS');
    title.id = 'tg-map-title';
    const subtitle = el('p', 'tg-subtitle', 'A chart of what the water has taken.');
    subtitle.id = 'tg-map-subtitle';
    brandCopy.append(el('p', 'tg-eyebrow', 'THE DROWNED BELFRY · KEEPER’S CHART'), title, subtitle);
    brand.append(lens, brandCopy);

    const headSide = el('div', 'tg-head-side');
    const metrics = el('div', 'tg-metrics');
    metrics.append(
      metric('Charted', `${snapshot.chartedCount} / ${snapshot.totalCount}`),
      metric('Bells', `${snapshot.sigilCount} / ${snapshot.bossCount}`),
    );

    const tabs = el('div', 'tg-tabs');
    tabs.setAttribute('role', 'tablist');
    tabs.setAttribute('aria-label', 'Tideglass views');
    this.chartTab = tabButton('Chart', 'chart', 'tg-chart-panel');
    this.listTab = tabButton('List', 'list', 'tg-list-panel');
    markNav(this.chartTab, 'map:tab:chart', 0, 0);
    markNav(this.listTab, 'map:tab:list', 0, 1);
    this.chartTab.addEventListener('click', () => this.setMode('chart'));
    this.listTab.addEventListener('click', () => this.setMode('list'));
    tabs.append(this.chartTab, this.listTab);

    const close = el('button', 'tg-close');
    close.type = 'button';
    close.dataset.command = 'back';
    close.setAttribute('aria-label', 'Close the Tideglass');
    markNav(close, 'map:close', 0, 2);
    close.append(mapIcon('close'), el('span', 'tg-close-label', 'Close'));

    headSide.append(metrics, tabs, close);
    head.append(brand, headSide);

    this.chartPanel = el('main', 'tg-main');
    this.chartPanel.id = 'tg-chart-panel';
    this.chartPanel.setAttribute('role', 'tabpanel');
    this.chartPanel.setAttribute('aria-labelledby', 'tg-tab-chart');

    const chart = el('section', 'tg-chart');
    chart.dataset.testid = 'tideglass-chart';
    this.viewport = el('div', 'tg-viewport');
    this.viewport.setAttribute(
      'aria-label',
      'Chart of the Drowned Belfry. Use the room buttons to inspect a chamber.',
    );
    const links = this.buildLinks();
    this.stage = el('div', 'tg-stage');
    this.stage.style.width = `${this.snapshot.bounds.w}px`;
    this.stage.style.height = `${this.snapshot.bounds.h}px`;
    this.buildRooms();
    this.stage.append(links);
    this.viewport.append(this.stage);

    const toolbar = el('div', 'tg-toolbar');
    toolbar.setAttribute('role', 'group');
    toolbar.setAttribute('aria-label', 'Chart controls');
    this.zoomOutButton = toolButton('minus', 'Zoom out', 'map:zoom-out', 6, 0);
    const fit = toolButton('fit', 'Fit chart', 'map:fit', 6, 1);
    this.zoomInButton = toolButton('plus', 'Zoom in', 'map:zoom-in', 6, 2);
    const locate = toolButton('locate', 'Find current chamber', 'map:locate', 6, 3);
    this.zoomValue = el('output', 'tg-zoom-value', '100%');
    this.zoomValue.setAttribute('aria-label', 'Chart zoom');
    this.zoomOutButton.addEventListener('click', () =>
      this.zoomAt(1 / MAP.zoomStep, ...this.center()),
    );
    this.zoomInButton.addEventListener('click', () => this.zoomAt(MAP.zoomStep, ...this.center()));
    fit.addEventListener('click', () => this.fitView());
    locate.addEventListener('click', () => this.locateCurrent());
    toolbar.append(this.zoomOutButton, fit, this.zoomInButton, locate, this.zoomValue);

    const compass = el('div', 'tg-compass');
    compass.setAttribute('aria-hidden', 'true');
    compass.append(el('span', 'tg-compass-n', 'N'), el('span', 'tg-compass-needle'));
    const hint = el('p', 'tg-chart-hint', 'Drag to pan · Scroll to zoom · F to fit');
    hint.setAttribute('aria-hidden', 'true');
    const boot = el('div', 'tg-boot');
    boot.setAttribute('aria-hidden', 'true');
    boot.append(
      el('span', 'tg-boot-ring tg-boot-ring--one'),
      el('span', 'tg-boot-ring tg-boot-ring--two'),
      el('span', 'tg-boot-flare'),
    );

    chart.append(this.viewport, toolbar, compass, hint, boot);
    this.ledger = this.buildLedger();
    this.chartPanel.append(chart, this.ledger);

    this.list = el('section', 'tg-list');
    this.list.id = 'tg-list-panel';
    this.list.setAttribute('role', 'tabpanel');
    this.list.setAttribute('aria-labelledby', 'tg-tab-list');
    this.list.hidden = true;
    this.list.inert = true;

    this.footerCounts = el('p', 'tg-counts');
    const footer = el('footer', 'tg-foot');
    footer.append(this.buildLegend(), this.footerCounts);
    this.root.append(head, this.chartPanel, this.list, footer);
    this.root.dataset.tideglass = 'ready';

    this.syncTabs();
    this.select(this.selectedId, false);
    this.updateCounters();

    this.viewport.addEventListener('wheel', this.onWheel, {
      passive: false,
      signal: this.abort.signal,
    });
    this.viewport.addEventListener('pointerdown', this.onPointerDown, {
      signal: this.abort.signal,
    });
    window.addEventListener('pointermove', this.onPointerMove, { signal: this.abort.signal });
    window.addEventListener('pointerup', this.onPointerUp, { signal: this.abort.signal });
    window.addEventListener('pointercancel', this.onPointerUp, { signal: this.abort.signal });
    this.viewport.addEventListener('click', this.onClickCapture, {
      capture: true,
      signal: this.abort.signal,
    });

    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => this.measure());
      this.resizeObserver.observe(this.viewport);
    }
    window.requestAnimationFrame(() => this.measure());

    if (options.boot || options.remembering) {
      this.introTimer = window.setTimeout(() => {
        this.root.classList.remove('is-booting', 'is-remembering');
        this.introTimer = null;
      }, 1800);
    }
  }

  handleKey(code: string): boolean {
    this.ensureReady();
    if (code === 'Equal' || code === 'NumpadAdd') {
      this.zoomAt(MAP.zoomStep, ...this.center());
      return true;
    }
    if (code === 'Minus' || code === 'NumpadSubtract') {
      this.zoomAt(1 / MAP.zoomStep, ...this.center());
      return true;
    }
    if (code === 'KeyF' || code === 'Home') {
      this.fitView();
      return true;
    }
    if (code === 'KeyC') {
      this.locateCurrent();
      return true;
    }
    return false;
  }

  destroy(): void {
    this.abort.abort();
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    if (this.introTimer !== null) {
      window.clearTimeout(this.introTimer);
      this.introTimer = null;
    }
  }

  private buildRooms(): void {
    const { bounds } = this.snapshot;
    for (const room of this.snapshot.rooms) {
      if (room.state === 'unheard') continue;
      const node = el('button', 'tg-room');
      node.type = 'button';
      node.dataset.roomId = room.roomId;
      node.dataset.state = room.state;
      node.style.left = `${room.rect.x - bounds.x}px`;
      node.style.top = `${room.rect.y - bounds.y}px`;
      node.style.width = `${room.rect.w}px`;
      node.style.height = `${room.rect.h}px`;
      node.setAttribute('aria-label', room.ariaLabel);
      node.dataset.nav = '';
      node.dataset.focusId = `map:room:${room.roomId}`;
      node.dataset.row = String(this.rowFor(room));
      node.dataset.col = String(this.colFor(room));
      if (room.state === 'current') node.setAttribute('aria-current', 'true');

      if (room.state === 'ghost') {
        const ghost = el('span', 'tg-ghost');
        ghost.append(el('span', 'tg-ghost-mark', '?'), el('span', 'tg-ghost-label', 'Uncharted'));
        node.append(ghost);
      } else {
        node.append(this.buildPlan(room), this.buildRoomLabel(room), this.buildBadges(room));
        if (room.state === 'current') node.append(this.buildYou(room));
      }

      node.addEventListener('focus', () => this.select(room.roomId, false));
      node.addEventListener('click', () => this.select(room.roomId, true));
      node.addEventListener('dblclick', () => this.focusRoom(room.roomId));
      this.roomNodes.set(room.roomId, node);
      this.stage.append(node);
    }
  }

  private buildPlan(room: MapRoomSnapshot): SVGSVGElement {
    const svg = svgElement('svg', 'tg-plan');
    svg.setAttribute('viewBox', `0 0 ${room.rect.w} ${room.rect.h}`);
    svg.setAttribute('preserveAspectRatio', 'none');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
    const geometry = room.geometry;
    if (geometry) {
      for (const rect of geometry.solid) {
        svg.append(svgRect(rect.x, rect.y, rect.w, rect.h, 'tg-solid'));
      }
      for (const rect of geometry.ledges) {
        svg.append(svgRect(rect.x, rect.y, rect.w, rect.h, 'tg-ledge'));
      }
      for (const rect of geometry.breakables) {
        svg.append(svgRect(rect.x, rect.y, rect.w, rect.h, 'tg-break'));
      }
      for (const rect of geometry.sealed) {
        svg.append(svgRect(rect.x, rect.y, rect.w, rect.h, 'tg-seal'));
      }
      for (const segment of geometry.surfaces) {
        const line = svgElement('line', 'tg-surface');
        line.setAttribute('x1', String(segment.x1));
        line.setAttribute('y1', String(segment.y1));
        line.setAttribute('x2', String(segment.x2));
        line.setAttribute('y2', String(segment.y2));
        svg.append(line);
      }
    }
    for (const door of room.exits) {
      const notch = svgElement('line', `tg-notch tg-notch--${door.state}`);
      const notchLength = 8;
      if (door.side === 'north' || door.side === 'south') {
        const x = room.rect.w * door.at;
        notch.setAttribute('x1', String(x - notchLength / 2));
        notch.setAttribute('y1', door.side === 'north' ? '0' : String(room.rect.h));
        notch.setAttribute('x2', String(x + notchLength / 2));
        notch.setAttribute('y2', door.side === 'north' ? '0' : String(room.rect.h));
      } else {
        const y = room.rect.h * door.at;
        notch.setAttribute('x1', door.side === 'west' ? '0' : String(room.rect.w));
        notch.setAttribute('y1', String(y - notchLength / 2));
        notch.setAttribute('x2', door.side === 'west' ? '0' : String(room.rect.w));
        notch.setAttribute('y2', String(y + notchLength / 2));
      }
      svg.append(notch);
    }
    return svg;
  }

  private buildRoomLabel(room: MapRoomSnapshot): HTMLElement {
    const label = el('span', 'tg-room-label');
    label.append(el('span', 'tg-room-kicker', room.kicker), el('span', 'tg-room-name', room.label));
    return label;
  }

  private buildBadges(room: MapRoomSnapshot): HTMLElement {
    const badges = el('span', 'tg-room-badges');
    if (room.benchName) {
      const bench = el('span', 'tg-room-badge tg-room-badge--bench');
      bench.title = room.benchName;
      bench.append(mapIcon('bench'));
      badges.append(bench);
    }
    if (room.bossName) {
      const bell = el(
        'span',
        `tg-room-badge tg-room-badge--bell${room.bossClaimed ? ' is-claimed' : ''}`,
      );
      bell.title = room.bossClaimed ? `${room.bossName} claimed` : `${room.bossName} waits`;
      bell.append(mapIcon('bell'));
      badges.append(bell);
    }
    if (room.swept) {
      const swept = el('span', 'tg-room-badge tg-room-badge--swept');
      swept.title = 'Swept';
      swept.append(mapIcon('swept'));
      badges.append(swept);
    }
    const pin = el('span', 'tg-room-badge tg-room-badge--pin');
    pin.append(mapIcon('pin'));
    pin.hidden = !this.pins.has(room.roomId);
    badges.append(pin);
    return badges;
  }

  private buildYou(room: MapRoomSnapshot): HTMLElement {
    const position = this.snapshot.currentPosition;
    const you = el('span', 'tg-you');
    you.setAttribute('aria-hidden', 'true');
    if (position) {
      you.style.left = `${((position.x - room.rect.x) / room.rect.w) * 100}%`;
      you.style.top = `${((position.y - room.rect.y) / room.rect.h) * 100}%`;
    }
    you.append(el('span', 'tg-you-ring'), el('span', 'tg-you-label', 'You'));
    return you;
  }

  private buildLinks(): SVGSVGElement {
    const svg = svgElement('svg', 'tg-links');
    const { bounds } = this.snapshot;
    svg.setAttribute('viewBox', `${bounds.x} ${bounds.y} ${bounds.w} ${bounds.h}`);
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');

    const defs = svgElement('defs');
    const marker = svgElement('marker');
    marker.setAttribute('id', 'tg-arrow');
    marker.setAttribute('viewBox', '0 0 10 10');
    marker.setAttribute('refX', '8');
    marker.setAttribute('refY', '5');
    marker.setAttribute('markerWidth', '4');
    marker.setAttribute('markerHeight', '4');
    marker.setAttribute('orient', 'auto-start-reverse');
    const arrow = svgElement('path', 'tg-arrow-head');
    arrow.setAttribute('d', 'M 0 0 L 10 5 L 0 10 z');
    marker.append(arrow);
    defs.append(marker);
    svg.append(defs);

    for (const link of this.snapshot.links) {
      const path = svgElement('path', `tg-link tg-link--${link.state} tg-link--${link.kind}`);
      path.setAttribute('d', link.path);
      if (link.oneWay) path.setAttribute('marker-end', 'url(#tg-arrow)');
      svg.append(path);
      if (link.state !== 'open' && link.state !== 'ghost') {
        svg.append(this.buildLinkMark(link));
      }
    }
    return svg;
  }

  private buildLinkMark(link: MapLinkSnapshot): SVGGElement {
    const group = svgElement('g', `tg-link-mark tg-link-mark--${link.state}`);
    group.setAttribute('transform', `translate(${link.midPoint.x} ${link.midPoint.y})`);
    const backdrop = svgElement('circle', 'tg-link-mark-back');
    backdrop.setAttribute('r', '6.5');
    group.append(backdrop);
    const icon =
      link.state === 'sealed'
        ? mapIcon('sealed')
        : link.state === 'secret'
          ? mapIcon('secret')
          : link.state === 'drop'
            ? mapIcon('drop')
            : mapIcon('bell');
    icon.setAttribute('x', '-4');
    icon.setAttribute('y', '-4');
    icon.setAttribute('width', '8');
    icon.setAttribute('height', '8');
    group.append(icon);
    return group;
  }

  private buildLedger(): HTMLElement {
    const aside = el('aside', 'tg-ledger');
    aside.dataset.testid = 'tideglass-ledger';
    aside.setAttribute('aria-label', 'Keeper’s ledger');
    const kicker = el('p', 'tg-ledger-kicker', 'THE KEEPER’S LEDGER');
    this.ledgerKicker = el('p', 'tg-ledger-kicker tg-ledger-kicker--room');
    this.ledgerTitle = el('h3', 'tg-ledger-title');
    this.ledgerNote = el('p', 'tg-ledger-note');
    this.ledgerLead = el('p', 'tg-lead');
    this.ledgerLead.append(
      el('span', 'tg-lead-label', 'THE THREAD'),
      el('span', 'tg-lead-copy', this.snapshot.lead),
    );
    this.chips = el('div', 'tg-chips');
    this.chips.setAttribute('aria-label', 'Chamber state');
    this.facts = el('div', 'tg-facts');
    this.passages = el('nav', 'tg-passages');
    this.passages.setAttribute('aria-label', 'Passages');
    this.pinButton = el('button', 'tg-pin');
    this.pinButton.type = 'button';
    markNav(this.pinButton, 'map:pin', 7, 0);
    this.pinButton.addEventListener('click', () => this.togglePin());
    this.pinStatus = el('p', 'tg-pin-status');
    this.pinStatus.setAttribute('role', 'status');
    this.pinStatus.setAttribute('aria-live', 'polite');
    this.pinStatus.hidden = true;
    aside.append(
      kicker,
      this.ledgerKicker,
      this.ledgerTitle,
      this.ledgerNote,
      this.ledgerLead,
      this.chips,
      this.facts,
      this.passages,
      this.pinButton,
      this.pinStatus,
    );
    return aside;
  }

  private buildLegend(): HTMLElement {
    const legend = el('div', 'tg-legend');
    legend.setAttribute('aria-hidden', 'true');
    const keys: readonly [string, string, string][] = [
      ['current', 'Here', 'is-current'],
      ['charted', 'Charted', 'is-charted'],
      ['swept', 'Swept', 'is-swept'],
      ['ghost', 'Uncharted', 'is-ghost'],
      ['sealed', 'Sealed', 'is-sealed'],
      ['drop', 'One-way', 'is-drop'],
    ];
    for (const [kind, label, className] of keys) {
      const key = el('span', `tg-key tg-key--${kind} ${className}`);
      key.append(el('span', 'tg-key-mark'), el('span', 'tg-key-label', label));
      legend.append(key);
    }
    return legend;
  }

  private buildList(): void {
    this.list.replaceChildren();
    const head = el('div', 'tg-list-head');
    head.append(
      el('p', 'tg-eyebrow', 'THE KEEPER’S LEDGER · ROOMS'),
      el('h3', 'tg-list-title', 'Every chamber the glass has touched'),
      el(
        'p',
        'tg-list-note',
        `${this.snapshot.chartedCount} charted · ${this.snapshot.ghostCount} uncharted · ${this.snapshot.sweptCount} swept`,
      ),
    );
    this.list.append(head);

    const groups = new Map<string, MapRoomSnapshot[]>();
    for (const room of this.snapshot.rooms) {
      if (room.state === 'unheard') continue;
      const group = groups.get(room.region);
      if (group) group.push(room);
      else groups.set(room.region, [room]);
    }
    let index = 0;
    for (const [region, rooms] of groups) {
      const section = el('section', 'tg-list-group');
      const heading = el('h4', 'tg-list-region');
      heading.id = `tg-region-${index}`;
      heading.append(
        el('span', 'tg-list-region-name', region),
        el('span', 'tg-list-region-count', String(rooms.length)),
      );
      section.setAttribute('aria-labelledby', heading.id);
      section.append(heading);
      for (const room of rooms) {
        section.append(this.buildListRoom(room, index));
        index += 1;
      }
      this.list.append(section);
    }
  }

  private buildListRoom(room: MapRoomSnapshot, index: number): HTMLButtonElement {
    const button = el('button', `tg-list-room tg-list-room--${room.state}`);
    button.type = 'button';
    if (room.state === 'current') {
      button.classList.add('tg-list-current');
      button.setAttribute('aria-current', 'true');
    }
    button.setAttribute('aria-label', room.ariaLabel);
    button.dataset.nav = '';
    button.dataset.focusId = `map:list:${room.roomId}`;
    button.dataset.row = String(1 + index);
    button.dataset.col = '0';
    const mark = el('span', 'tg-list-mark');
    mark.append(
      mapIcon(
        room.state === 'ghost'
          ? 'secret'
          : room.state === 'current'
            ? 'locate'
            : room.swept
              ? 'swept'
              : room.bossName
                ? 'bell'
                : room.benchName
                  ? 'bench'
                  : 'fit',
      ),
    );
    const copy = el('span', 'tg-list-copy');
    copy.append(
      el('span', 'tg-list-kicker', room.state === 'ghost' ? 'UNCHARTED' : room.kicker),
      el('span', 'tg-list-name', room.label),
      el('span', 'tg-list-detail', room.state === 'ghost' ? 'Beyond the glass.' : summary(room)),
    );
    const side = el('span', 'tg-list-side');
    side.append(el('span', 'tg-list-state', stateLabel(room)));
    if (this.pins.has(room.roomId)) side.append(mapIcon('pin'));
    button.append(mark, copy, side);
    button.addEventListener('click', () => {
      this.select(room.roomId, false);
      this.setMode('chart');
      this.focusRoom(room.roomId);
    });
    return button;
  }

  private select(roomId: string, focusRoom: boolean): void {
    const room = this.snapshot.rooms.find((entry) => entry.roomId === roomId);
    if (!room || room.state === 'unheard') return;
    this.selectedId = roomId;
    for (const [id, node] of this.roomNodes) {
      node.classList.toggle('is-selected', id === roomId);
    }
    this.renderLedger(room);
    if (focusRoom) this.centerOnRoom(room, false);
  }

  private renderLedger(room: MapRoomSnapshot): void {
    this.ledger.dataset.room = room.roomId;
    this.ledger.dataset.state = room.state;
    this.ledgerKicker.textContent =
      room.state === 'ghost' ? 'UNCHARTED PLACE' : `${room.region.toUpperCase()} · ${room.kicker}`;
    this.ledgerTitle.textContent = room.state === 'ghost' ? 'Uncharted chamber' : room.name;
    this.ledgerNote.textContent = room.note;
    this.chips.replaceChildren();
    const chipLabels: readonly [string, boolean][] = [
      [room.state === 'current' ? 'Here' : room.state === 'ghost' ? 'Uncharted' : 'Charted', true],
      ['Swept', room.swept],
      ['Wax', this.pins.has(room.roomId)],
      ['Secret', room.secretFound],
    ];
    for (const [label, active] of chipLabels) {
      if (!active) continue;
      const chip = el('span', 'tg-chip', label);
      if (label === 'Here') chip.classList.add('tg-chip--current');
      if (label === 'Swept') chip.classList.add('tg-chip--swept');
      if (label === 'Secret') chip.classList.add('tg-chip--secret');
      if (label === 'Wax') chip.classList.add('tg-chip--wax');
      this.chips.append(chip);
    }

    this.facts.replaceChildren();
    if (room.state !== 'ghost') {
      const rows: [string, string][] = [];
      if (room.benchName) rows.push(['Rest', room.benchName]);
      if (room.bossName) {
        rows.push(['Bell', `${room.bossName} · ${room.bossClaimed ? 'claimed' : 'unclaimed'}`]);
      }
      if (room.pickupTotal > 0) {
        rows.push(['Relics', `${room.pickupFound} / ${room.pickupTotal}`]);
      }
      if (room.remainingSecret) rows.push(['Secret', 'A seam remains unbroken']);
      if (rows.length === 0) {
        this.facts.append(el('p', 'tg-empty', 'Nothing waits here but the room itself.'));
      } else {
        const dl = el('dl', 'tg-fact-list');
        for (const [label, value] of rows) {
          dl.append(fact(label, value));
        }
        this.facts.append(dl);
      }
    } else {
      this.facts.append(el('p', 'tg-empty', 'The glass has not touched this place.'));
    }

    this.passages.replaceChildren();
    const heading = el('h4', 'tg-passages-title', 'Passages');
    this.passages.append(heading);
    if (room.exits.length === 0) {
      this.passages.append(el('p', 'tg-empty', 'No passage is written here.'));
    } else {
      const list = el('ul', 'tg-passage-list');
      for (const door of room.exits) {
        list.append(this.buildPassage(door));
      }
      this.passages.append(list);
    }

    this.renderPin(room);
  }

  private buildPassage(door: MapDoorSnapshot): HTMLElement {
    const item = el('li', `tg-passage tg-passage--${door.state}`);
    const direction = el('span', 'tg-passage-dir', DIRECTION[door.side] ?? '?');
    direction.setAttribute('aria-label', `${door.side} passage`);
    const copy = el('span', 'tg-passage-copy');
    copy.append(
      el('span', 'tg-passage-target', door.targetName ?? 'Uncharted chamber'),
      el('span', 'tg-passage-state', doorStatus(door)),
    );
    item.append(direction, copy);
    return item;
  }

  private renderPin(room: MapRoomSnapshot): void {
    const pinned = this.pins.has(room.roomId);
    const ghost = room.state === 'ghost';
    this.pinButton.replaceChildren();
    this.pinButton.append(mapIcon('pin'));
    this.pinButton.append(
      el(
        'span',
        'tg-pin-label',
        ghost
          ? 'Cannot mark an uncharted chamber'
          : pinned
            ? 'Remove wax mark'
            : 'Mark this chamber',
      ),
      el('span', 'tg-pin-count', `${this.pins.size} / ${this.snapshot.pinLimit}`),
    );
    this.pinButton.setAttribute('aria-pressed', String(pinned));
    this.pinButton.disabled = ghost;
    this.pinButton.classList.toggle('is-pinned', pinned);
    this.pinButton.classList.toggle('is-ghost', ghost);
    this.pinStatus.hidden = true;
    this.pinStatus.textContent = '';
    this.pinStatus.dataset.tone = 'info';
  }

  private togglePin(): void {
    const room = this.snapshot.rooms.find((entry) => entry.roomId === this.selectedId);
    if (!room || room.state === 'ghost') return;
    const result = this.options.onPin(room.roomId);
    let message: string;
    let tone: 'info' | 'error' = 'info';
    if (result === 'added') {
      this.pins.add(room.roomId);
      message = 'The Keeper’s mark is pressed in wax.';
    } else if (result === 'removed') {
      this.pins.delete(room.roomId);
      message = 'The wax mark is smoothed away.';
    } else if (result === 'full') {
      message = `The wax holds ${this.snapshot.pinLimit} marks. Remove one before pressing another.`;
      tone = 'error';
    } else {
      message = 'This chamber cannot be marked yet.';
      tone = 'error';
    }
    this.updatePinBadges();
    this.renderPin(room);
    this.setPinStatus(message, tone);
    this.updateCounters();
  }

  private setPinStatus(text: string, tone: 'info' | 'error'): void {
    this.pinStatus.textContent = text;
    this.pinStatus.dataset.tone = tone;
    this.pinStatus.hidden = false;
  }

  private updatePinBadges(): void {
    for (const [roomId, node] of this.roomNodes) {
      const badge = node.querySelector<HTMLElement>('.tg-room-badge--pin');
      if (badge) badge.hidden = !this.pins.has(roomId);
      node.classList.toggle('is-pinned', this.pins.has(roomId));
    }
  }

  private updateCounters(): void {
    this.footerCounts.textContent = `CHARTED ${this.snapshot.chartedCount} / ${this.snapshot.totalCount} · SWEPT ${this.snapshot.sweptCount} · WAX ${this.pins.size} / ${this.snapshot.pinLimit}`;
  }

  private setMode(mode: Mode): void {
    if (this.mode === mode && mode === 'list' && !this.list.hidden) return;
    this.mode = mode;
    this.root.dataset.view = mode;
    if (mode === 'list') {
      this.buildList();
      this.chartPanel.hidden = true;
      this.chartPanel.inert = true;
      this.list.hidden = false;
      this.list.inert = false;
    } else {
      this.list.hidden = true;
      this.list.inert = true;
      this.chartPanel.hidden = false;
      this.chartPanel.inert = false;
    }
    this.syncTabs();
  }

  private syncTabs(): void {
    const chart = this.mode === 'chart';
    this.chartTab.classList.toggle('is-active', chart);
    this.listTab.classList.toggle('is-active', !chart);
    this.chartTab.setAttribute('aria-selected', String(chart));
    this.listTab.setAttribute('aria-selected', String(!chart));
    this.chartTab.tabIndex = chart ? 0 : -1;
    this.listTab.tabIndex = chart ? -1 : 0;
  }

  private measure(): void {
    if (!this.viewport.isConnected) return;
    const width = this.viewport.clientWidth;
    const height = this.viewport.clientHeight;
    if (width <= 0 || height <= 0) return;
    this.fitScale = clamp(
      Math.min(
        (width - MAP.fitPadding * 2) / this.snapshot.bounds.w,
        (height - MAP.fitPadding * 2) / this.snapshot.bounds.h,
      ),
      0.12,
      MAP.zoomMax,
    );

    if (!this.modelReady) {
      this.lastWidth = width;
      this.lastHeight = height;
      if (this.options.boot) {
        this.view.scale = clamp(Math.max(this.fitScale, 0.9), this.minScale(), MAP.zoomMax);
        const current = this.snapshot.currentPosition;
        this.view.x = width / 2 - (current?.x ?? this.snapshot.bounds.x) * this.view.scale;
        this.view.y = height / 2 - (current?.y ?? this.snapshot.bounds.y) * this.view.scale;
        this.clampView();
      } else {
        this.view = {
          scale: this.fitScale,
          x: width / 2 - (this.snapshot.bounds.x + this.snapshot.bounds.w / 2) * this.fitScale,
          y: height / 2 - (this.snapshot.bounds.y + this.snapshot.bounds.h / 2) * this.fitScale,
        };
        this.clampView();
      }
      this.modelReady = true;
      this.applyView();
      return;
    }

    if (width === this.lastWidth && height === this.lastHeight) return;
    const center = this.worldAt(this.lastWidth / 2, this.lastHeight / 2);
    this.lastWidth = width;
    this.lastHeight = height;
    this.view.x = width / 2 - center.x * this.view.scale;
    this.view.y = height / 2 - center.y * this.view.scale;
    this.fitScale = clamp(
      Math.min(
        (width - MAP.fitPadding * 2) / this.snapshot.bounds.w,
        (height - MAP.fitPadding * 2) / this.snapshot.bounds.h,
      ),
      0.12,
      MAP.zoomMax,
    );
    this.view.scale = clamp(this.view.scale, this.minScale(), MAP.zoomMax);
    this.clampView();
    this.applyView();
  }

  private ensureReady(): void {
    if (!this.modelReady) this.measure();
  }

  private applyView(): void {
    this.stage.style.transform = `translate(${this.view.x}px, ${this.view.y}px) scale(${this.view.scale})`;
    this.stage.style.setProperty('--tg-inv', String(1 / this.view.scale));
    this.root.dataset.zoom =
      this.view.scale < 0.5 ? 'far' : this.view.scale < 0.78 ? 'mid' : 'near';
    this.zoomValue.textContent = `${Math.round(this.view.scale * 100)}%`;
    this.zoomOutButton.disabled = this.view.scale <= this.minScale() + 0.001;
    this.zoomInButton.disabled = this.view.scale >= MAP.zoomMax - 0.001;
  }

  private fitView(): void {
    this.ensureReady();
    const width = this.viewport.clientWidth;
    const height = this.viewport.clientHeight;
    if (width <= 0 || height <= 0) return;
    this.fitScale = clamp(
      Math.min(
        (width - MAP.fitPadding * 2) / this.snapshot.bounds.w,
        (height - MAP.fitPadding * 2) / this.snapshot.bounds.h,
      ),
      0.12,
      MAP.zoomMax,
    );
    this.view = {
      scale: this.fitScale,
      x: width / 2 - (this.snapshot.bounds.x + this.snapshot.bounds.w / 2) * this.fitScale,
      y: height / 2 - (this.snapshot.bounds.y + this.snapshot.bounds.h / 2) * this.fitScale,
    };
    this.clampView();
    this.applyView();
  }

  private locateCurrent(): void {
    this.select(this.snapshot.currentRoomId, false);
    const room = this.snapshot.rooms.find((entry) => entry.roomId === this.snapshot.currentRoomId);
    if (room) this.centerOnRoom(room, true);
    this.focusRoom(this.snapshot.currentRoomId);
  }

  private focusRoom(roomId: string): void {
    const room = this.snapshot.rooms.find((entry) => entry.roomId === roomId);
    if (!room) return;
    this.select(roomId, false);
    if (room.state !== 'unheard') this.centerOnRoom(room, false);
    this.roomNodes.get(roomId)?.focus({ preventScroll: true });
  }

  private centerOnRoom(room: MapRoomSnapshot, zoomIn: boolean): void {
    this.ensureReady();
    if (zoomIn) {
      const target = clamp(Math.max(this.view.scale, 0.95), this.minScale(), MAP.zoomMax);
      if (target !== this.view.scale) {
        const center = this.center();
        this.zoomAt(target / this.view.scale, center[0], center[1]);
      }
    }
    this.centerOn({
      x: room.rect.x + room.rect.w / 2,
      y: room.rect.y + room.rect.h / 2,
    });
  }

  private centerOn(point: { x: number; y: number }): void {
    const width = this.viewport.clientWidth;
    const height = this.viewport.clientHeight;
    if (width <= 0 || height <= 0) return;
    this.view.x = width / 2 - point.x * this.view.scale;
    this.view.y = height / 2 - point.y * this.view.scale;
    this.clampView();
    this.applyView();
  }

  private zoomAt(factor: number, px: number, py: number): void {
    this.ensureReady();
    const next = clamp(this.view.scale * factor, this.minScale(), MAP.zoomMax);
    if (Math.abs(next - this.view.scale) < 0.001) return;
    const world = this.worldAt(px, py);
    this.view.scale = next;
    this.view.x = px - world.x * next;
    this.view.y = py - world.y * next;
    this.clampView();
    this.applyView();
  }

  private minScale(): number {
    return Math.min(this.fitScale, MAP.zoomMin);
  }

  private clampView(): void {
    const width = this.viewport.clientWidth;
    const height = this.viewport.clientHeight;
    if (width <= 0 || height <= 0) return;
    const scaledWidth = this.snapshot.bounds.w * this.view.scale;
    const scaledHeight = this.snapshot.bounds.h * this.view.scale;
    const pad = MAP.fitPadding;
    if (scaledWidth <= width - pad * 2) {
      this.view.x = (width - scaledWidth) / 2;
    } else {
      this.view.x = Math.min(pad, Math.max(width - scaledWidth - pad, this.view.x));
    }
    if (scaledHeight <= height - pad * 2) {
      this.view.y = (height - scaledHeight) / 2;
    } else {
      this.view.y = Math.min(pad, Math.max(height - scaledHeight - pad, this.view.y));
    }
  }

  private worldAt(px: number, py: number): { x: number; y: number } {
    return {
      x: (px - this.view.x) / this.view.scale,
      y: (py - this.view.y) / this.view.scale,
    };
  }

  private center(): [number, number] {
    return [this.viewport.clientWidth / 2, this.viewport.clientHeight / 2];
  }

  private rowFor(room: MapRoomSnapshot): number {
    return room.row + 2;
  }

  private colFor(room: MapRoomSnapshot): number {
    return room.col;
  }

  private readonly onWheel = (event: WheelEvent): void => {
    event.preventDefault();
    this.ensureReady();
    const rect = this.viewport.getBoundingClientRect();
    const factor = event.deltaY < 0 ? 1.12 : 1 / 1.12;
    this.zoomAt(factor, event.clientX - rect.left, event.clientY - rect.top);
  };

  private readonly onPointerDown = (event: PointerEvent): void => {
    if (event.button !== 0) return;
    this.ensureReady();
    const rect = this.viewport.getBoundingClientRect();
    this.pointers.set(event.pointerId, {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
      startX: event.clientX,
      startY: event.clientY,
    });
    this.pointerMoved = false;
    if (this.pointers.size === 2) {
      this.beginPinch();
    }
  };

  private readonly onPointerMove = (event: PointerEvent): void => {
    const pointer = this.pointers.get(event.pointerId);
    if (!pointer) return;
    const rect = this.viewport.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const dx = x - pointer.x;
    const dy = y - pointer.y;
    const total = Math.hypot(event.clientX - pointer.startX, event.clientY - pointer.startY);
    if (total > 4) {
      this.pointerMoved = true;
      this.root.classList.add('is-panning');
      this.viewport.setPointerCapture?.(event.pointerId);
    }
    if (!this.pointerMoved) return;
    event.preventDefault();
    pointer.x = x;
    pointer.y = y;

    if (this.pointers.size === 1) {
      this.view.x += dx;
      this.view.y += dy;
      this.clampView();
      this.applyView();
      return;
    }
    if (this.pointers.size === 2) {
      this.updatePinch();
    }
  };

  private readonly onPointerUp = (event: PointerEvent): void => {
    if (!this.pointers.has(event.pointerId)) return;
    this.pointers.delete(event.pointerId);
    if (this.pointers.size < 2) {
      this.pinchDistance = 0;
    }
    if (this.pointers.size === 1) {
      const remaining = [...this.pointers.values()][0];
      if (remaining) {
        remaining.x = event.clientX - this.viewport.getBoundingClientRect().left;
        remaining.y = event.clientY - this.viewport.getBoundingClientRect().top;
      }
    }
    if (this.pointerMoved) {
      this.suppressClick = true;
      this.lastDragEnd = performance.now();
    }
    this.pointerMoved = false;
    this.root.classList.remove('is-panning');
    if (this.pointers.size === 0) {
      window.setTimeout(() => {
        this.suppressClick = false;
      }, 40);
    }
  };

  private readonly onClickCapture = (event: MouseEvent): void => {
    if (this.suppressClick || performance.now() - this.lastDragEnd < 180) {
      event.preventDefault();
      event.stopPropagation();
    }
  };

  private beginPinch(): void {
    const [a, b] = [...this.pointers.values()];
    if (!a || !b) return;
    this.pinchDistance = Math.hypot(a.x - b.x, a.y - b.y);
    this.pinchScale = this.view.scale;
    this.pinchWorld = this.worldAt((a.x + b.x) / 2, (a.y + b.y) / 2);
  }

  private updatePinch(): void {
    const [a, b] = [...this.pointers.values()];
    if (!a || !b || this.pinchDistance <= 0) return;
    const distance = Math.hypot(a.x - b.x, a.y - b.y);
    const midpoint = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    const next = clamp(
      this.pinchScale * (distance / this.pinchDistance),
      this.minScale(),
      MAP.zoomMax,
    );
    this.view.scale = next;
    this.view.x = midpoint.x - this.pinchWorld.x * next;
    this.view.y = midpoint.y - this.pinchWorld.y * next;
    this.clampView();
    this.applyView();
  }
}

export function buildMapScreen(snapshot: MapSnapshot, options: MapScreenOptions): TideglassScreen {
  return new TideglassScreen(snapshot, options);
}

function tabButton(label: string, mode: Mode, controls: string): HTMLButtonElement {
  const button = el('button', 'tg-tab', label);
  button.type = 'button';
  button.id = `tg-tab-${mode}`;
  button.setAttribute('role', 'tab');
  button.setAttribute('aria-controls', controls);
  button.setAttribute('aria-selected', 'false');
  button.dataset.mode = mode;
  return button;
}

function toolButton(
  icon: 'minus' | 'fit' | 'plus' | 'locate',
  label: string,
  focusId: string,
  row: number,
  col: number,
): HTMLButtonElement {
  const button = el('button', 'tg-tool');
  button.type = 'button';
  button.setAttribute('aria-label', label);
  markNav(button, focusId, row, col);
  button.append(mapIcon(icon));
  return button;
}

function metric(label: string, value: string): HTMLElement {
  const metricNode = el('div', 'tg-metric');
  metricNode.append(el('span', 'tg-metric-label', label), el('span', 'tg-metric-value', value));
  return metricNode;
}

function fact(label: string, value: string): HTMLElement {
  const row = el('div', 'tg-fact');
  row.append(el('dt', 'tg-fact-label', label), el('dd', 'tg-fact-value', value));
  return row;
}

function summary(room: MapRoomSnapshot): string {
  const bits: string[] = [];
  if (room.bossName) bits.push(room.bossClaimed ? 'Bell claimed' : 'Bell waits');
  if (room.pickupTotal > 0) bits.push(`${room.pickupFound} / ${room.pickupTotal} relics`);
  if (room.remainingSecret) bits.push('Secret unbroken');
  if (room.benchName) bits.push('Rest');
  return bits.length > 0 ? bits.join(' · ') : 'No obligation remains.';
}

function stateLabel(room: MapRoomSnapshot): string {
  if (room.state === 'ghost') return 'Uncharted';
  if (room.state === 'current') return 'Here';
  if (room.swept) return 'Swept';
  return 'Charted';
}

function doorStatus(door: MapDoorSnapshot): string {
  if (door.state === 'sealed') return `Sealed · ${door.requirement ?? 'a missing ward'}`;
  if (door.state === 'unknown') return 'Beyond the glass';
  if (door.state === 'secret') return 'Hidden seam';
  if (door.state === 'drop') return 'One-way drop';
  if (door.kind === 'bell') return 'Bell door';
  return 'Open';
}

function svgElement<K extends keyof SVGElementTagNameMap>(
  tag: K,
  className?: string,
): SVGElementTagNameMap[K] {
  const node = document.createElementNS(NS, tag);
  if (className) node.setAttribute('class', className);
  return node;
}

function svgRect(x: number, y: number, w: number, h: number, className: string): SVGRectElement {
  const rect = svgElement('rect', className);
  rect.setAttribute('x', String(x));
  rect.setAttribute('y', String(y));
  rect.setAttribute('width', String(w));
  rect.setAttribute('height', String(h));
  return rect;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
