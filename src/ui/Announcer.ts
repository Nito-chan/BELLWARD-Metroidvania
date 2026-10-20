/**
 * Off-screen live region for boss phase and reward announcements. The game itself is
 * visual, but combat state changes should still reach assistive technology. Kept outside
 * the Pixi tree so screen readers see real DOM text updates.
 */
export class Announcer {
  private readonly element: HTMLElement;

  constructor() {
    const element = document.createElement('div');
    element.className = 'sr-only';
    element.setAttribute('role', 'status');
    element.setAttribute('aria-live', 'polite');
    element.setAttribute('aria-atomic', 'true');
    document.body.appendChild(element);
    this.element = element;
  }

  say(text: string): void {
    // Clearing first makes repeated phrases announce again instead of being deduped.
    this.element.textContent = '';
    this.element.textContent = text;
  }
}
