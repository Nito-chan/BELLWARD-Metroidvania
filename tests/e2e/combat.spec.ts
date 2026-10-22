import { expect, test } from '@playwright/test';
import { bootGame, debugState, dismissOnboarding, loadRoom } from './support';

/**
 * Browser-level proof for the Keeper's Guard: the real key path must start the brace,
 * show the opening parry window, and let an approaching parishioner spend posture rather
 * than health. The deterministic window math lives in tests/unit/guard.test.ts.
 */
test.describe('the Keeper’s Guard', () => {
  test('braces, opens the parry window, and blocks a real enemy strike', async ({ page }) => {
    await bootGame(page);
    await dismissOnboarding(page);
    await loadRoom(page, 'belfry-terrace', { x: 130, y: 320 });

    await page.keyboard.down('KeyF');
    await page.waitForFunction(
      () => window.__game?.debugState().scene?.player.guarding === true,
      undefined,
      { timeout: 5_000 },
    );
    expect((await debugState(page)).errors).toEqual([]);

    const opening = await debugState(page);
    expect(opening.scene?.player.guarding).toBe(true);
    expect(opening.scene?.player.maxPosture).toBeGreaterThan(0);

    // The parishioner at x=150 chases into range; the held brace spends posture.
    await page.waitForFunction(
      () => {
        const player = window.__game?.debugState().scene?.player;
        return player !== undefined && player.posture < player.maxPosture;
      },
      undefined,
      { timeout: 15_000 },
    );

    const blocked = await debugState(page);
    expect(blocked.scene?.player.guarding).toBe(true);
    expect(blocked.scene?.player.posture).toBeLessThan(blocked.scene?.player.maxPosture ?? 0);
    expect(blocked.errors).toEqual([]);

    await page.keyboard.up('KeyF');
    await page.waitForFunction(
      () => window.__game?.debugState().scene?.player.guarding === false,
      undefined,
      { timeout: 5_000 },
    );
  });
});
