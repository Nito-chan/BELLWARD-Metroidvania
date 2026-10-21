import type { Page } from '@playwright/test';
import type { GameDebugState } from '../../src/debug/DebugState';

export async function bootGame(page: Page): Promise<void> {
  await page.goto('/');
  await page.waitForFunction(() => window.__game?.debugState().ready === true, undefined, {
    timeout: 15_000,
  });
}

/** Reloads the page and waits for the autosaved run to boot. */
export async function reloadGame(page: Page): Promise<void> {
  await page.reload();
  await page.waitForFunction(
    () => window.__game?.debugState().ready === true && window.__game?.debugState().scene !== null,
    undefined,
    { timeout: 15_000 },
  );
}

/** Rest opens the equipment overlay; collapse it before exercising the pause flow. */
export async function closeBenchOverlay(page: Page): Promise<void> {
  await page.waitForFunction(
    () => document.querySelector('.bench-root:not([hidden])') !== null,
    undefined,
    { timeout: 5_000 },
  );
  await page.keyboard.press('Escape');
  await page.waitForFunction(
    () => document.querySelector('.bench-root')?.hasAttribute('hidden') === true,
    undefined,
    { timeout: 5_000 },
  );
}

export async function debugState(page: Page): Promise<GameDebugState> {
  return page.evaluate(() => {
    const game = window.__game;
    if (!game) throw new Error('window.__game is not available (DEV build required)');
    return game.debugState();
  });
}

/**
 * Jumps beside a collectible and waits for the run to grant it. The hero is protected
 * first so a patrolling enemy cannot turn a collection test into a death test; reward
 * persistence still goes through the real pickup path.
 */
export async function collectPickup(
  page: Page,
  roomId: string,
  spawn: { readonly x: number; readonly y: number },
  pickupId: string,
): Promise<void> {
  await loadRoom(page, roomId, spawn);
  await page.evaluate(() => window.__game?.debugProtectPlayer());
  await page.waitForFunction(
    (id) => window.__game?.debugState().run.pickups.includes(id) === true,
    pickupId,
    { timeout: 10_000 },
  );
}

/** Jumps to a room through the DEV handle and waits for the new scene to mount. */
export async function loadRoom(
  page: Page,
  roomId: string,
  spawn?: { readonly x: number; readonly y: number },
): Promise<void> {
  await page.evaluate(
    ({ id, at }) => {
      const game = window.__game;
      if (!game) throw new Error('window.__game is not available (DEV build required)');
      game.debugLoadRoom(id, at);
    },
    { id: roomId, at: spawn },
  );
  await page.waitForFunction((id) => window.__game?.debugState().scene?.roomId === id, roomId, {
    timeout: 15_000,
  });
}

/**
 * Holds left until the room changes, then releases in the same frame. Playwright IPC is
 * too slow here: holding the key across a room transition can walk straight through the
 * next doorway before the test observes the first change.
 */
export async function walkLeftToRoom(page: Page, roomId: string): Promise<string> {
  return page.evaluate(async (target) => {
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowLeft', bubbles: true }));
    const started = performance.now();
    try {
      while (performance.now() - started < 12_000) {
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
        const current = window.__game?.debugState().scene?.roomId;
        if (current === target) return current;
      }
      return window.__game?.debugState().scene?.roomId ?? 'no-scene';
    } finally {
      window.dispatchEvent(new KeyboardEvent('keyup', { code: 'ArrowLeft', bubbles: true }));
    }
  }, roomId);
}

/** Waits until the arena boss has finished its intro and is choosing patterns. */
export async function waitForBossIdle(page: Page): Promise<void> {
  await page.waitForFunction(
    () => {
      const boss = window.__game?.debugState().scene?.boss;
      return boss !== null && boss !== undefined && boss.state === 'idle';
    },
    undefined,
    { timeout: 15_000 },
  );
}

export type StrikeResult = 'struck' | 'killed' | 'dead' | 'timeout' | 'no-scene';

export type DeathRun = {
  /** Snapshot at the first observed hurt tick, while i-frames are still running. */
  firstHurt: GameDebugState | null;
  /** Simulation tick at which the dead flag was first observed. */
  deathTick: number | null;
  /** First snapshot after the room rebuilt, inside the spawn i-frame window. */
  respawn: GameDebugState | null;
  outcome: 'respawned' | 'timeout' | 'no-scene';
};

/**
 * Walks into a parishioner, stops, and records the first hurt tick, the death tick and
 * the rebuilt room. All observation happens inside one page task on the render clock,
 * so a slow Playwright round-trip cannot miss a short state transition.
 */
export async function takeHitsUntilDeath(page: Page): Promise<DeathRun> {
  return page.evaluate(async () => {
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowLeft', bubbles: true }));
    const started = performance.now();
    let inReach = false;
    let firstHurt: GameDebugState | null = null;
    let deathTick: number | null = null;
    let respawn: GameDebugState | null = null;

    try {
      for (let frame = 0; frame < 3_600; frame += 1) {
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
        if (performance.now() - started > 40_000) break;
        const state = window.__game?.debugState();
        if (!state) return { firstHurt, deathTick, respawn, outcome: 'no-scene' as const };
        const scene = state.scene;
        if (!scene) return { firstHurt, deathTick, respawn, outcome: 'no-scene' as const };
        const player = scene.player;

        if (!inReach) {
          let target: number | null = null;
          for (const enemy of scene.enemies) {
            if (enemy.kind !== 'parishioner' || enemy.x >= player.x) continue;
            if (target === null || enemy.x > target) target = enemy.x;
          }
          if (target !== null && player.x - target <= 24) {
            window.dispatchEvent(new KeyboardEvent('keyup', { code: 'ArrowLeft', bubbles: true }));
            inReach = true;
          }
        }

        if (
          firstHurt === null &&
          !player.dead &&
          player.hp > 0 &&
          player.hp < player.maxHp &&
          player.invulnerableTicks > 0
        ) {
          firstHurt = state;
        }
        if (player.dead && deathTick === null) deathTick = state.tickCount;
        if (
          deathTick !== null &&
          !player.dead &&
          player.hp === player.maxHp &&
          player.invulnerableTicks > 0 &&
          scene.enemies.length === 4
        ) {
          respawn = state;
          break;
        }
      }
    } finally {
      window.dispatchEvent(new KeyboardEvent('keyup', { code: 'ArrowLeft', bubbles: true }));
    }

    return {
      firstHurt,
      deathTick,
      respawn,
      outcome: respawn ? ('respawned' as const) : ('timeout' as const),
    };
  });
}

/**
 * Walks into the nearest parishioner's reach and lands one light attack.
 *
 * Input events are dispatched inside the page because Playwright's per-command IPC is
 * ~100 ms on a software-rendered headless VM, while the light swing's damage window is
 * only 7 ticks (117 ms). That latency is a test-harness property, not gameplay: the
 * events still travel through the game's real window keydown/keyup handlers and the
 * fixed-tick InputManager. Movement tests continue to use `page.keyboard`.
 */
export async function strikeNearestParishioner(page: Page): Promise<StrikeResult> {
  return page.evaluate(async () => {
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowLeft', bubbles: true }));
    const started = performance.now();
    let mode: 'approach' | 'attack' = 'approach';
    let sawAttack = false;

    try {
      for (let frame = 0; frame < 600; frame += 1) {
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
        if (performance.now() - started > 8_000) return 'timeout';
        const scene = window.__game?.debugState().scene;
        if (!scene) return 'no-scene';
        if (scene.player.dead) return 'dead';
        if (scene.enemies.length < 4) return 'killed';

        const player = scene.player;
        if (mode === 'approach') {
          let target: number | null = null;
          for (const enemy of scene.enemies) {
            if (enemy.kind !== 'parishioner' || enemy.x >= player.x) continue;
            if (target === null || enemy.x > target) target = enemy.x;
          }
          if (target !== null && player.x - target <= 40 && player.state !== 'hurt') {
            window.dispatchEvent(new KeyboardEvent('keyup', { code: 'ArrowLeft', bubbles: true }));
            window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyX', bubbles: true }));
            window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyX', bubbles: true }));
            mode = 'attack';
          }
          continue;
        }

        if (player.state === 'attack' || player.attackActive) sawAttack = true;
        if (
          sawAttack &&
          !player.attackActive &&
          player.state !== 'attack' &&
          player.state !== 'hurt'
        ) {
          return 'struck';
        }
      }
      return 'timeout';
    } finally {
      window.dispatchEvent(new KeyboardEvent('keyup', { code: 'ArrowLeft', bubbles: true }));
    }
  });
}
