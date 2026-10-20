import type { GameDebugState } from './DebugState';

/**
 * Developer overlay (F1). DOM-based on purpose: it cannot perturb the render
 * pipeline, costs nothing while hidden, and stays trivially inspectable by tests.
 */
export class DebugOverlay {
  private readonly element: HTMLPreElement;
  private isVisible = false;
  private lastText = '';

  constructor() {
    this.element = document.createElement('pre');
    this.element.className = 'debug-overlay';
    this.element.dataset.testid = 'debug-overlay';
    this.element.hidden = true;
    this.element.setAttribute('role', 'status');
    this.element.setAttribute('aria-live', 'polite');
  }

  get visible(): boolean {
    return this.isVisible;
  }

  /** Attaches the overlay to the page. Safe to call once, after DOM is ready. */
  mount(): void {
    document.body.appendChild(this.element);
  }

  toggle(): void {
    this.isVisible = !this.isVisible;
    this.element.hidden = !this.isVisible;
  }

  /** Formats the debug snapshot. The caller throttles; this only writes when text changed. */
  update(state: GameDebugState): void {
    if (!this.isVisible) return;
    const lines = [
      `fps        ${state.smoothedFps.toFixed(1)}`,
      `frame      ${state.frameCount}`,
      `ticks      ${state.tickCount} (${state.simTime.toFixed(2)} s)`,
      `canvas     ${state.canvas.width}x${state.canvas.height}`,
      `renderer   ${state.renderer}`,
    ];
    if (state.scene) {
      const { scene } = state;
      const player = scene.player;
      lines.push(
        `room       ${scene.roomName} (${scene.roomId})`,
        `tiles      ${scene.tiles}`,
        `art        ${scene.art.mode} (${scene.art.loaded.length} packed, ${scene.art.failures.length} fallback)`,
        `camera     ${scene.camera.x.toFixed(1)}, ${scene.camera.y.toFixed(1)}`,
        `player     ${player.state}/${player.animation} @ ${player.x.toFixed(1)},${player.y.toFixed(1)}`,
        `velocity   ${player.vx.toFixed(0)}, ${player.vy.toFixed(0)} facing ${player.facing} ${player.grounded ? 'ground' : 'air'}`,
      );
    }
    const { audio } = state;
    lines.push(
      `audio      ${audio.context} ${audio.unlocked ? 'unlocked' : 'locked'} ${audio.muted ? 'muted' : 'on'}`,
      `mix        master ${audio.volumes.master.toFixed(2)} music ${audio.volumes.music.toFixed(2)} sfx ${audio.volumes.sfx.toFixed(2)}`,
      `music      ${audio.music ?? '-'}${audio.musicPlaying ? ' (playing)' : ''}  last-sfx ${audio.lastSfx ? `${audio.lastSfx.key}@${audio.lastSfx.tick}` : '-'}`,
    );
    if (audio.failed.length > 0) {
      lines.push(`audio-load ${audio.failed.join(', ')}`);
    }
    lines.push(`errors     ${state.errors.length}`);
    if (state.errors.length > 0) {
      lines.push('', state.errors[0] ?? '');
    }
    const text = lines.join('\n');
    if (text !== this.lastText) {
      this.lastText = text;
      this.element.textContent = text;
    }
  }
}
