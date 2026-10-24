import './style.css';
import './ui/game-ui.css';
import { Game } from './core/Game';
import { formatError } from './core/Errors';

/** Renders an unmissable fatal error state — the game never fails silently. */
function showFatalError(detail: string): void {
  document.getElementById('boot-splash')?.remove();
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

/** The title is already mounted underneath; the splash has done its job once boot resolves. */
function dismissBootSplash(): void {
  document.getElementById('boot-splash')?.remove();
}

async function main(): Promise<void> {
  const game = new Game();
  await game.boot();
  dismissBootSplash();

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
        debugSetKeeperWater: (level: number) => game.debugSetKeeperWater(level),
        debugEnterKeeperRitual: () => game.debugEnterKeeperRitual(),
        debugSolveKeeperRitual: () => game.debugSolveKeeperRitual(),
      }),
      configurable: true,
    });
  }
}

main().catch((error: unknown) => {
  showFatalError(formatError(error));
});
