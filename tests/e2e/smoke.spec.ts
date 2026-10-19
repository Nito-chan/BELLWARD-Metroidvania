import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import type { GameDebugState } from '../../src/debug/DebugState';

async function bootGame(page: Page): Promise<void> {
  await page.goto('/');
  await page.waitForFunction(() => window.__game?.debugState().ready === true, undefined, {
    timeout: 15_000,
  });
}

async function debugState(page: Page): Promise<GameDebugState> {
  return page.evaluate(() => {
    const game = window.__game;
    if (!game) throw new Error('window.__game is not available (DEV build required)');
    return game.debugState();
  });
}

test.describe('M2 smoke', () => {
  test('boots into the belfry terrace with packed art', async ({ page }, testInfo) => {
    const consoleErrors: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error') consoleErrors.push(message.text());
    });
    page.on('pageerror', (error) => consoleErrors.push(String(error)));

    await bootGame(page);

    const state = await debugState(page);
    expect(state.canvas.width).toBe(640);
    expect(state.canvas.height).toBe(360);
    expect(state.renderer).toContain('webgl');
    expect(state.errors).toEqual([]);

    const scene = state.scene;
    expect(scene).not.toBeNull();
    expect(scene?.roomId).toBe('belfry-terrace');
    expect(scene?.roomName).toBe('The Belfry Terrace');
    expect(scene?.tiles).toBe(449);
    expect(scene?.art.mode).toBe('packed');
    expect(scene?.art.failures).toEqual([]);
    expect(scene?.art.loaded).toHaveLength(12);
    expect(scene?.player.animation).toMatch(/idle|run/);
    expect(scene?.player.grounded).toBe(true);
    expect(scene?.player.y).toBeCloseTo(320, 0);

    const sample = await page.evaluate(() => {
      const game = window.__game;
      if (!game) throw new Error('window.__game is not available');
      return game.sampleFrame();
    });
    expect(sample.width).toBe(640);
    expect(sample.height).toBe(360);
    // Packed art plus the parallax skyline must produce far more than flat shapes.
    expect(sample.uniqueColors).toBeGreaterThan(24);

    await testInfo.attach('m2-boot.png', {
      body: await page.screenshot(),
      contentType: 'image/png',
    });
    expect(consoleErrors).toEqual([]);
  });

  test('walks with the keyboard and the camera follows', async ({ page }) => {
    await bootGame(page);
    const before = await debugState(page);

    await page.keyboard.down('ArrowRight');
    await page.waitForTimeout(1_200);
    const running = await debugState(page);
    await page.keyboard.up('ArrowRight');
    await page.waitForTimeout(400);
    const stopped = await debugState(page);

    const playerBefore = before.scene?.player.x ?? 0;
    const playerRunning = running.scene?.player.x ?? 0;
    const playerStopped = stopped.scene?.player.x ?? 0;
    const cameraBefore = before.scene?.camera.x ?? 0;
    const cameraRunning = running.scene?.camera.x ?? 0;

    expect(playerRunning).toBeGreaterThan(playerBefore + 60);
    expect(cameraRunning).toBeGreaterThan(cameraBefore + 10);
    expect(playerStopped).toBeGreaterThan(playerRunning);
    expect(running.scene?.player.animation).toBe('run');
    expect(running.scene?.player.facing).toBe(1);
    expect(stopped.scene?.player.animation).toBe('idle');
    expect(Math.abs(stopped.scene?.player.vx ?? 99)).toBeLessThan(1);
    expect(running.errors).toEqual([]);
  });

  test('jumps to a readable height and lands back on the ground', async ({ page }) => {
    await bootGame(page);
    const ground = await debugState(page);
    const groundY = ground.scene?.player.y ?? 0;
    expect(ground.scene?.player.grounded).toBe(true);

    // Hold the button for the whole arc; the sampler runs inside the page so it sees
    // every frame (polling from the test process is too slow to catch a 0.5 s jump).
    await page.keyboard.down('Space');
    const arc = await page.evaluate(
      () =>
        new Promise<{ minY: number; airborne: number; endY: number; grounded: boolean }>(
          (resolve) => {
            const game = window.__game;
            if (!game) throw new Error('window.__game is not available (DEV build required)');
            const start = game.debugState().scene?.player.y ?? 0;
            let minY = start;
            let airborne = 0;
            const deadline = performance.now() + 900;
            const tick = (): void => {
              const player = game.debugState().scene?.player;
              if (player) {
                minY = Math.min(minY, player.y);
                if (!player.grounded) airborne += 1;
              }
              if (performance.now() >= deadline) {
                resolve({
                  minY,
                  airborne,
                  endY: player?.y ?? start,
                  grounded: player?.grounded ?? false,
                });
                return;
              }
              requestAnimationFrame(tick);
            };
            requestAnimationFrame(tick);
          },
        ),
    );
    await page.keyboard.up('Space');

    expect(arc.airborne).toBeGreaterThan(10);
    expect(groundY - arc.minY).toBeGreaterThan(40);
    expect(groundY - arc.minY).toBeLessThan(95);
    expect(arc.grounded).toBe(true);
    expect(Math.abs(arc.endY - groundY)).toBeLessThan(1);
    expect((await debugState(page)).errors).toEqual([]);
  });

  test('the dais step blocks the hero until he jumps it', async ({ page }) => {
    await bootGame(page);

    await page.keyboard.down('ArrowRight');
    await page.waitForTimeout(3_000);
    const blocked = await debugState(page);
    const blockedX = blocked.scene?.player.x ?? 0;
    // Tile 42 (x=672) is the step face: the run stops flush against it.
    expect(blockedX).toBeGreaterThan(660);
    expect(blockedX).toBeLessThan(669);
    expect(blocked.scene?.player.grounded).toBe(true);
    expect(Math.abs(blocked.scene?.player.vx ?? 99)).toBeLessThan(1);

    await page.keyboard.down('Space');
    await page.waitForTimeout(350);
    await page.keyboard.up('Space');
    await page.waitForTimeout(900);
    const climbed = await debugState(page);
    await page.keyboard.up('ArrowRight');

    expect(climbed.scene?.player.x ?? 0).toBeGreaterThan(690);
    expect(climbed.errors).toEqual([]);
  });

  test('runs the simulation at a stable frame rate while moving', async ({ page }, testInfo) => {
    // First: what can this environment pace at all? (software-composited headless
    // often cannot reach 60; the render must come close to the machine's ceiling.)
    await page.goto('about:blank');
    const bareFps = await page.evaluate(
      () =>
        new Promise<number>((resolve) => {
          let frames = 0;
          const start = performance.now();
          const tick = (): void => {
            frames += 1;
            const elapsed = performance.now() - start;
            if (elapsed >= 1000) resolve(frames / (elapsed / 1000));
            else requestAnimationFrame(tick);
          };
          requestAnimationFrame(tick);
        }),
    );
    console.log(`[smoke] bare RAF ceiling=${bareFps.toFixed(1)} fps`);

    await bootGame(page);
    await page.keyboard.down('ArrowRight');
    const before = await debugState(page);
    const sampleSeconds = 2.5;
    await page.waitForTimeout(sampleSeconds * 1000);
    const after = await debugState(page);
    await page.keyboard.up('ArrowRight');

    const frames = after.frameCount - before.frameCount;
    const averageFps = frames / sampleSeconds;
    // Self-calibrating floor: 75% of what this environment can pace at all, clamped
    // to [30, 45]. Full-speed machines must clear 45; software-composited headless
    // environments that cannot pace 60 still get a meaningful regression gate.
    // Threshold policy recorded in docs/DECISIONS.md (D016).
    const floor = Math.max(30, Math.min(45, bareFps * 0.75));
    console.log(`[smoke] average fps=${averageFps.toFixed(1)} (floor ${floor.toFixed(1)})`);
    expect(averageFps).toBeGreaterThanOrEqual(floor);

    const simulated = after.simTime - before.simTime;
    expect(simulated).toBeGreaterThanOrEqual(sampleSeconds * 0.75);
    expect(after.errors).toEqual([]);

    await testInfo.attach('m2-running.png', {
      body: await page.screenshot(),
      contentType: 'image/png',
    });
  });

  test('F1 toggles the debug overlay', async ({ page }) => {
    await bootGame(page);
    const overlay = page.getByTestId('debug-overlay');

    await expect(overlay).toBeHidden();
    await page.keyboard.press('F1');
    await expect(overlay).toBeVisible();
    await expect(overlay).toContainText('fps');
    await expect(overlay).toContainText('belfry-terrace');
    await expect(overlay).toContainText('art');
    await expect(overlay).toContainText('camera');
    await expect(overlay).toContainText('player');
    await expect(overlay).toContainText('ground');

    await page.keyboard.press('F1');
    await expect(overlay).toBeHidden();
  });
});
