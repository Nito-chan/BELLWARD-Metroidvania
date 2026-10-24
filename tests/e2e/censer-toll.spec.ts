import { expect, test } from '@playwright/test';
import { bootGame, collectPickup, debugState, loadRoom, reloadGame } from './support';

test.describe('Censer and Toll', () => {
  test('the Censer is found in the Reliquary and marks the run', async ({ page }) => {
    await bootGame(page);
    await collectPickup(page, 'reliquary', { x: 440, y: 208 }, 'reliquary-censer');
    const state = await debugState(page);
    expect(state.run.pickups).toContain('reliquary-censer');
    expect(state.run.censer).toBe(true);
    expect(state.run.toll).toBe(false);
  });

  test('the Toll is found on the Upper Gallery high ledge and marks the run', async ({ page }) => {
    await bootGame(page);
    await collectPickup(page, 'upper-gallery', { x: 780, y: 208 }, 'upper-toll');
    const state = await debugState(page);
    expect(state.run.pickups).toContain('upper-toll');
    expect(state.run.toll).toBe(true);
    expect(state.run.censer).toBe(false);
  });

  test('picking up both weapons persists across a reload', async ({ page }) => {
    await bootGame(page);
    await collectPickup(page, 'reliquary', { x: 440, y: 208 }, 'reliquary-censer');
    await collectPickup(page, 'upper-gallery', { x: 780, y: 208 }, 'upper-toll');

    await reloadGame(page);
    await loadRoom(page, 'upper-gallery', { x: 780, y: 208 });
    const state = await debugState(page);
    expect(state.run.pickups).toContain('reliquary-censer');
    expect(state.run.pickups).toContain('upper-toll');
    expect(state.run.censer).toBe(true);
    expect(state.run.toll).toBe(true);
  });
});

test.describe('Censer and Toll touch', () => {
  test.use({ hasTouch: true, viewport: { width: 844, height: 390 } });

  test('the Swap and Hookline controls appear once their arsenal is owned', async ({ page }) => {
    await bootGame(page);
    await collectPickup(page, 'sunless-aqueduct', { x: 800, y: 208 }, 'aqueduct-hookline');
    await collectPickup(page, 'reliquary', { x: 440, y: 208 }, 'reliquary-censer');
    await collectPickup(page, 'upper-gallery', { x: 780, y: 208 }, 'upper-toll');

    const touch = page.getByTestId('touch-controls');
    const swap = touch.getByRole('button', { name: /^Swap weapon\. Current:/ });
    const hook = touch.getByRole('button', { name: 'Hookline' });
    await expect(swap).toBeVisible();
    await expect(hook).toBeVisible();
    await expect(swap).toHaveAttribute('data-weapon', 'nail');
    await expect(swap).toContainText('Nail');

    // The touch swap uses the same attack-cycle input as Q and gamepad LB.
    await swap.tap();
    await expect(swap).toHaveAttribute('data-weapon', 'censer');
    await expect(swap).toContainText('Censer');

    // A touch strike travels through the same virtual input path as the other devices.
    await page.evaluate(() => window.__game?.debugProtectPlayer());
    await touch.getByRole('button', { name: 'Strike' }).tap();
    await page.waitForFunction(
      () => {
        const player = window.__game?.debugState().scene?.player;
        return player?.attackActive === true || player?.state === 'attack';
      },
      undefined,
      { timeout: 5_000 },
    );

    const state = await debugState(page);
    expect(state.touch.visible).toBe(true);
    expect(state.touch.weapon).toBe('censer');
    expect(state.run.censer).toBe(true);
    expect(state.run.toll).toBe(true);
  });

  test('the touch layout keeps every target at least 44 px and pads clear at three widths', async ({
    page,
  }) => {
    test.setTimeout(120_000);
    await bootGame(page);
    await collectPickup(page, 'sunless-aqueduct', { x: 800, y: 208 }, 'aqueduct-hookline');
    await collectPickup(page, 'reliquary', { x: 440, y: 208 }, 'reliquary-censer');
    await collectPickup(page, 'upper-gallery', { x: 780, y: 208 }, 'upper-toll');

    const touch = page.getByTestId('touch-controls');
    for (const viewport of [
      { width: 375, height: 667 },
      { width: 768, height: 1024 },
      { width: 1440, height: 900 },
    ]) {
      await page.setViewportSize(viewport);
      await page.waitForTimeout(150);

      const buttons = await touch.locator('button:visible').evaluateAll((elements) =>
        elements.map((element) => {
          const rect = element.getBoundingClientRect();
          return {
            label: element.getAttribute('aria-label') ?? element.textContent ?? '',
            width: rect.width,
            height: rect.height,
            left: rect.left,
            top: rect.top,
            right: rect.right,
            bottom: rect.bottom,
          };
        }),
      );
      expect(buttons.length).toBeGreaterThanOrEqual(12);
      for (const button of buttons) {
        expect(button.width, `${viewport.width}px target ${button.label}`).toBeGreaterThanOrEqual(
          44,
        );
        expect(button.height, `${viewport.width}px target ${button.label}`).toBeGreaterThanOrEqual(
          44,
        );
        expect(button.left).toBeGreaterThanOrEqual(0);
        expect(button.top).toBeGreaterThanOrEqual(0);
        expect(button.right).toBeLessThanOrEqual(viewport.width + 0.5);
        expect(button.bottom).toBeLessThanOrEqual(viewport.height + 0.5);
      }

      const move = await touch.locator('.touch-move').boundingBox();
      const actions = await touch.locator('.touch-actions').boundingBox();
      const utility = await touch.locator('.touch-utility').boundingBox();
      expect(move).not.toBeNull();
      expect(actions).not.toBeNull();
      expect(utility).not.toBeNull();
      if (!move || !actions || !utility) return;
      expect(move.x + move.width, `${viewport.width}px thumbs`).toBeLessThanOrEqual(actions.x);
      expect(utility.y + utility.height, `${viewport.width}px utility row`).toBeLessThanOrEqual(
        actions.y,
      );
    }
  });
});
