/** Line-only Tideglass marks. No raster art, no external icons. */
const NS = 'http://www.w3.org/2000/svg';

export type MapIconKind =
  | 'pin'
  | 'bell'
  | 'bench'
  | 'sealed'
  | 'secret'
  | 'swept'
  | 'drop'
  | 'close'
  | 'minus'
  | 'plus'
  | 'fit'
  | 'locate';

export function mapIcon(kind: MapIconKind): SVGSVGElement {
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 16 16');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  svg.classList.add('tg-icon', `tg-icon--${kind}`);
  for (const path of paths(kind)) {
    const node = document.createElementNS(NS, 'path');
    node.setAttribute('d', path);
    svg.append(node);
  }
  return svg;
}

function paths(kind: MapIconKind): readonly string[] {
  switch (kind) {
    case 'pin':
      return [
        'M8 14.4c3-3.6 4.4-6 4.4-8.2a4.4 4.4 0 0 0-8.8 0c0 2.2 1.4 4.6 4.4 8.2Z',
        'M8 8.4a2.1 2.1 0 1 0 0-4.2 2.1 2.1 0 0 0 0 4.2Z',
      ];
    case 'bell':
      return [
        'M4.2 11.2h7.6l-1.2-2.1V6.3a2.6 2.6 0 0 0-5.2 0v2.8l-1.2 2.1Z',
        'M6.6 12.5c.3.8.8 1.2 1.4 1.2s1.1-.4 1.4-1.2',
        'M8 2.1v1.1',
      ];
    case 'bench':
      return ['M2.4 6.2h11.2v2H2.4z', 'M4 8.2v4.4', 'M12 8.2v4.4', 'M3 12.6h10'];
    case 'sealed':
      return ['M8 1.8 13.4 8 8 14.2 2.6 8 8 1.8Z', 'M5.3 8h5.4'];
    case 'secret':
      return ['M8 1.8 13.4 8 8 14.2 2.6 8 8 1.8Z', 'M8 5.2v5.6'];
    case 'swept':
      return ['m3.2 8.2 3.1 3.2 6.5-6.6'];
    case 'drop':
      return ['M8 2.2v10.6', 'm4.6 9.4 3.4 3.4 3.4-3.4'];
    case 'close':
      return ['m4 4 8 8', 'm12 4-8 8'];
    case 'minus':
      return ['M3.5 8h9'];
    case 'plus':
      return ['M3.5 8h9', 'M8 3.5v9'];
    case 'fit':
      return ['M2.5 5.8V2.5h3.3', 'M13.5 10.2v3.3h-3.3', 'M10.2 2.5h3.3v3.3', 'M5.8 13.5H2.5v-3.3'];
    case 'locate':
      return [
        'M8 1.8v2.1',
        'M8 12.1v2.1',
        'M1.8 8h2.1',
        'M12.1 8h2.1',
        'M8 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z',
      ];
  }
}
