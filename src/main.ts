import './style.css';
import { Game } from './core/Game';
import { formatError } from './core/Errors';

/** Renders an unmissable fatal error state — the game never fails silently. */
function showFatalError(detail: string): void {
  const box = document.createElement('div');
  box.className = 'fatal-error';
  box.setAttribute('role', 'alert');
  box.textContent = [
    'BELLWARD failed to start.',
    '',
    detail,
    '',
    'This build needs WebGL2. Try a recent Chrome, Edge or Firefox with hardware acceleration enabled.',
  ].join('\n');

  const mount = document.getElementById('app');
  if (mount) {
    mount.replaceChildren(box);
  } else {
    document.body.appendChild(box);
  }
}

async function main(): Promise<void> {
  const game = new Game();
  await game.boot();

  if (import.meta.env.DEV) {
    // Read-only debug surface for tooling and the E2E suite. DEV-only by design (D004).
    Object.defineProperty(window, '__game', {
      value: Object.freeze({
        debugState: () => game.debugState(),
        sampleFrame: () => game.sampleFrame(),
        debugLoadRoom: (roomId: string, spawn?: { x: number; y: number }) =>
          game.debugLoadRoom(roomId, spawn),
        debugKillPlayer: () => game.debugKillPlayer(),
        debugProtectPlayer: () => game.debugProtectPlayer(),
        debugDamageBoss: (amount: number) => game.debugDamageBoss(amount),
        debugBreakWard: () => game.debugBreakWard(),
        debugDefeatBoss: () => game.debugDefeatBoss(),
      }),
      configurable: true,
    });
  }
}

main().catch((error: unknown) => {
  showFatalError(formatError(error));
});
