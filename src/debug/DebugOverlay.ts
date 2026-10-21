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
        `vitals     hp ${player.hp}/${player.maxHp} iframes ${player.invulnerableTicks}${player.dead ? ' DEAD' : ''}${player.attackActive ? ' swing-open' : ''}`,
        `velocity   ${player.vx.toFixed(0)}, ${player.vy.toFixed(0)} facing ${player.facing} ${player.grounded ? 'ground' : 'air'}`,
        `arc        ${player.jumpPeakY !== null ? `apex ${player.jumpPeakY.toFixed(1)}` : player.lastJumpPeakY !== null ? `last ${player.lastJumpPeakY.toFixed(1)}` : '-'}`,
        `foes       ${scene.enemies.length} live · ${scene.projectiles} shots · hitstop ${scene.hitstop}`,
        `sigils     ${state.run.sigils.length > 0 ? state.run.sigils.join(', ') : '-'} · max hp ${state.run.maxHp}`,
        `charted    ${state.run.visitedRooms.length} rooms · rest ${state.run.checkpoint?.name ?? '-'}`,
        `bench      ${scene.bench ? `${scene.bench.name}${scene.bench.inRange ? ' IN RANGE' : ''}` : '-'}`,
        `save       ${state.save.present ? 'present' : 'none'} · ${state.save.loaded ? 'loaded' : 'fresh'} · last ${state.save.lastWrite ?? '-'}`,
      );
      for (const foe of scene.enemies) {
        lines.push(
          `  ${foe.kind.padEnd(11)} hp ${foe.hp}/${foe.maxHp} ${foe.state}/${foe.animation} @ ${foe.x.toFixed(0)}`,
        );
      }
      if (scene.boss) {
        const boss = scene.boss;
        lines.push(
          `boss       ${boss.name} @ ${boss.x.toFixed(0)},${boss.y.toFixed(0)} hp ${boss.hp}/${boss.maxHp} phase ${boss.phase + 1}/${boss.phaseCount} ${boss.phaseName}${boss.warded ? ' WARDED' : ''}${boss.hidden ? ' HIDDEN' : ''}${scene.exitLocked ? ' EXIT LOCKED' : ''}`,
          `pattern    ${boss.pattern ?? '-'} ${boss.state} telegraph ${boss.telegraph.toFixed(2)}`,
        );
      }
    }
    const { audio } = state;
    lines.push(
      `audio      ${audio.context} ${audio.unlocked ? 'unlocked' : 'locked'} ${audio.muted ? 'muted' : 'on'}`,
      `mix        master ${audio.volumes.master.toFixed(2)} music ${audio.volumes.music.toFixed(2)} sfx ${audio.volumes.sfx.toFixed(2)}`,
      `music      ${audio.music ?? '-'}${audio.musicPlaying ? ' (playing)' : ''}  last-sfx ${audio.lastSfx ? `${audio.lastSfx.key}@${audio.lastSfx.tick}` : '-'}`,
    );
    const { menu } = state;
    lines.push(
      `menu       ${menu.open ? `${menu.screen ?? '-'}${menu.capture ? ` capture ${menu.capture.action}.${menu.capture.kind}` : ''}` : 'closed'}${menu.focus ? ` focus ${menu.focus}` : ''}`,
    );
    if (menu.open && menu.status) lines.push(`menu-note  ${menu.status}`);
    const { touch } = state;
    lines.push(
      `touch      ${touch.enabled ? 'on' : 'off'} ${touch.visible ? 'visible' : 'hidden'}${touch.held.length > 0 ? ` held ${touch.held.join(',')}` : ''}`,
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
