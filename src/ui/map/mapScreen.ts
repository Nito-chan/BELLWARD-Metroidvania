/**
 * The region chart. It is a passive DOM screen inside the accessible pause dialog: one
 * focusable Back control, list semantics for the rooms, and SVG routes hidden from screen
 * readers. No innerHTML, no per-frame work while the simulation is frozen.
 */
import { el } from '../menu/menuDom';
import { buildBackRow } from '../menu/screenBuilders';
import type { MapNodeSnapshot, MapSnapshot } from './mapTypes';

const SVG_NS = 'http://www.w3.org/2000/svg';

export function buildMapScreen(snapshot: MapSnapshot): HTMLElement {
  const screen = el('div', 'map-screen');
  screen.append(buildSummary(snapshot), buildGraph(snapshot), buildLegend(), buildBackRow(0));
  return screen;
}

function buildSummary(snapshot: MapSnapshot): HTMLElement {
  const summary = el('div', 'map-summary');
  summary.append(
    metric('Charted', `${snapshot.visitedCount} / ${snapshot.totalCount}`),
    metric('Sigils', `${snapshot.sigilCount} / ${snapshot.bossCount}`),
  );

  const rest = el('p', 'map-rest');
  rest.append(
    el('span', 'map-meta-label', 'Last rest'),
    el(
      'strong',
      'map-meta-value',
      snapshot.checkpoint
        ? `${snapshot.checkpoint.name} · ${snapshot.checkpoint.roomName}`
        : 'None yet',
    ),
  );
  summary.append(rest);
  return summary;
}

function metric(label: string, value: string): HTMLElement {
  const item = el('p', 'map-metric');
  item.append(el('span', 'map-meta-label', label), el('strong', 'map-meta-value', value));
  return item;
}

function buildGraph(snapshot: MapSnapshot): HTMLOListElement {
  const graph = el('ol', 'map-graph');
  graph.setAttribute('aria-label', 'The Drowned Belfry chamber chart');

  const routes = document.createElementNS(SVG_NS, 'svg');
  routes.setAttribute('viewBox', '0 0 100 100');
  routes.setAttribute('preserveAspectRatio', 'none');
  routes.setAttribute('aria-hidden', 'true');
  routes.setAttribute('focusable', 'false');
  routes.classList.add('map-links');
  const byId = new Map(snapshot.nodes.map((node) => [node.roomId, node]));
  for (const link of snapshot.links) {
    const from = byId.get(link.from);
    const to = byId.get(link.to);
    if (!from || !to) continue;
    const line = document.createElementNS(SVG_NS, 'line');
    line.setAttribute('x1', String(from.x));
    line.setAttribute('y1', String(from.y));
    line.setAttribute('x2', String(to.x));
    line.setAttribute('y2', String(to.y));
    line.setAttribute('data-from', link.from);
    line.setAttribute('data-to', link.to);
    line.classList.add('map-link');
    if (link.revealed) line.classList.add('is-revealed');
    routes.append(line);
  }
  graph.append(routes);

  for (const node of snapshot.nodes) graph.append(buildNode(node));
  return graph;
}

function buildNode(node: MapNodeSnapshot): HTMLLIElement {
  const item = el('li', `map-node is-${node.state}${node.restPoint ? ' has-rest' : ''}`);
  item.dataset.roomId = node.roomId;
  item.dataset.state = node.state;
  item.style.setProperty('--map-x', `${node.x}%`);
  item.style.setProperty('--map-y', `${node.y}%`);
  item.setAttribute('aria-label', node.ariaLabel);
  if (node.state === 'current') item.setAttribute('aria-current', 'location');

  item.append(
    el('span', 'map-node-marker'),
    el('span', 'map-node-kicker', node.kicker),
    el('span', 'map-node-name', node.label),
    el('span', 'map-node-detail', node.detail),
  );
  if (node.restPoint) item.append(el('span', 'map-node-rest', 'REST'));
  return item;
}

function buildLegend(): HTMLElement {
  const legend = el('ul', 'map-legend');
  legend.setAttribute('aria-label', 'Map legend');
  const items = [
    ['is-current', 'You are here'],
    ['is-visited', 'Charted'],
    ['is-unknown', 'Uncharted'],
    ['is-rest', 'Rest point'],
  ] as const;
  for (const [state, label] of items) {
    const item = el('li', 'map-legend-item');
    item.append(el('span', `map-legend-mark ${state}`), el('span', undefined, label));
    legend.append(item);
  }
  return legend;
}
