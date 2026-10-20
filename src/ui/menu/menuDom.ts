/** Small DOM factories shared by the menu screens. No framework, no innerHTML. */
export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

export function makeButton(label: string, command: string, className: string): HTMLButtonElement {
  const button = el('button', className, label);
  button.type = 'button';
  button.dataset.command = command;
  return button;
}

/** Marks an element as a focus target and a cell in the menu's spatial navigation grid. */
export function markNav(node: HTMLElement, focusId: string, row: number, col: number): void {
  node.dataset.nav = '';
  node.dataset.focusId = focusId;
  node.dataset.row = String(row);
  node.dataset.col = String(col);
}

export function makeHint(keys: string, label: string): HTMLElement {
  const hint = el('span', 'menu-hint');
  hint.append(el('kbd', 'menu-key', keys), el('span', 'menu-hint-label', label));
  return hint;
}

/** A line-drawn bell, the only illustration in the pause flow. Decorative by contract. */
export function makeBellMark(): SVGSVGElement {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 120 160');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  svg.classList.add('menu-bell');

  const paths = [
    'M60 10v14',
    'M28 94c0-42 14-66 32-66s32 24 32 66l9 22H19l9-22Z',
    'M48 124c3 10 8 15 12 15s9-5 12-15',
    'M76 42 66 70l9 8-12 18',
    'M60 142v6',
  ];
  for (const d of paths) {
    const path = document.createElementNS(ns, 'path');
    path.setAttribute('d', d);
    svg.append(path);
  }
  return svg;
}
