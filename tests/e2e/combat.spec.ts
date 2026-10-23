import { expect, test } from '@playwright/test';
import { bootGame, dismissOnboarding, loadRoom } from './support';

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
    // Return the opening state from the same observation that proves the brace; a second
    // read after a yield can race the parishioner's first strike.
    const opening = await (
      await page.waitForFunction(
        () => {
          const state = window.__game?.debugState();
          const player = state?.scene?.player;
          if (!state || player?.guarding !== true) return null;
          return { guarding: player.guarding, maxPosture: player.maxPosture, errors: state.errors };
        },
        undefined,
        { timeout: 5_000 },
      )
    ).jsonValue();
    if (opening === null) throw new Error('guard opening was not observed');
    expect(opening.guarding).toBe(true);
    expect(opening.maxPosture).toBeGreaterThan(0);
    expect(opening.errors).toEqual([]);

    // The parishioner at x=150 chases into range; the held brace spends posture. Require
    // both facts in one settled observation so a hit cannot masquerade as a block.
    const blocked = await (
      await page.waitForFunction(
        () => {
          const state = window.__game?.debugState();
          const player = state?.scene?.player;
          if (!state || player === undefined) return null;
          if (player.guarding !== true || player.posture >= player.maxPosture) return null;
          return {
            guarding: player.guarding,
            posture: player.posture,
            maxPosture: player.maxPosture,
            errors: state.errors,
          };
        },
        undefined,
        { timeout: 15_000 },
      )
    ).jsonValue();
    if (blocked === null) throw new Error('guarded block was not observed');
    expect(blocked.guarding).toBe(true);
    expect(blocked.posture).toBeLessThan(blocked.maxPosture);
    expect(blocked.errors).toEqual([]);

    await page.keyboard.up('KeyF');
    await page.waitForFunction(
      () => window.__game?.debugState().scene?.player.guarding === false,
      undefined,
      { timeout: 5_000 },
    );
  });
});
