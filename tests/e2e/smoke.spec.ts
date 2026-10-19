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

test.describe('M0 smoke', () => {
  test('boots with no errors and renders a non-blank canvas', async ({ page }, testInfo) => {
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

    const sample = await page.evaluate(() => {
      const game = window.__game;
      if (!game) throw new Error('window.__game is not available');
      return game.sampleFrame();
    });
    expect(sample.width).toBe(640);
    expect(sample.height).toBe(360);
    expect(sample.uniqueColors).toBeGreaterThan(8);

    await testInfo.attach('m0-boot.png', {
      body: await page.screenshot(),
      contentType: 'image/png',
    });
    expect(consoleErrors).toEqual([]);
  });

  test('runs the simulation at a stable frame rate', async ({ page }, testInfo) => {
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

    const before = await debugState(page);
    const sampleSeconds = 2.5;
    await page.waitForTimeout(sampleSeconds * 1000);
    const after = await debugState(page);

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

    await testInfo.attach('m0-running.png', {
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

    await page.keyboard.press('F1');
    await expect(overlay).toBeHidden();
  });
});
