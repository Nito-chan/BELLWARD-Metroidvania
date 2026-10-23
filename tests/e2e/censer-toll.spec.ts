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

  test('the Swap button appears once a second weapon is owned', async ({ page }) => {
    await bootGame(page);
    await collectPickup(page, 'reliquary', { x: 440, y: 208 }, 'reliquary-censer');

    const touch = page.getByTestId('touch-controls');
    await expect(touch).toHaveClass(/has-weapon/);
    const swap = page.getByRole('button', { name: 'Swap' });
    await expect(swap).toBeVisible();

    const state = await debugState(page);
    expect(state.touch.visible).toBe(true);
    expect(state.run.censer).toBe(true);
  });
});
