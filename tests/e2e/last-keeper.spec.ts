import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { SAVE } from '../../src/config/save';
import type { RunSave } from '../../src/save/runSave';
import { bootGame, debugState, loadRoom, waitForBossIdle } from './support';

/**
 * A valid post-Tide-door save with the complete arsenal. The Last Keeper's phase 2/3
 * mechanics are only reachable with Hookline, Censer and Toll, so the final-act tests
 * start from a real progress document instead of a starter loadout.
 */
const FULL_ARSENAL_SAVE: RunSave = {
  version: SAVE.version,
  roomId: 'last-bell',
  spawn: { x: 120, y: 320 },
  hp: 8,
  sigils: ['bellbearer', 'wardenMoss', 'bellThief'],
  visitedRooms: [
    'belfry-terrace',
    'belfry-antechamber',
    'bellbearer-arena',
    'warden-arena',
    'bellthief-arena',
    'upper-gallery',
    'last-bell',
  ],
  checkpointBenchId: null,
  pickups: [
    'aqueduct-hookline',
    'reliquary-censer',
    'upper-toll',
    'bellthief-tide-bell',
    'terrace-tideglass',
  ],
  brokenSecrets: [],
  charmsOwned: [],
  charmsEquipped: [],
  nailLevel: 0,
  shards: 0,
  ordeals: [],
  tideDoorOpened: true,
  endingSeen: false,
};

async function seedLastBell(page: Page): Promise<void> {
  await page.addInitScript(
    ({ key, save }) => {
      localStorage.setItem(key, JSON.stringify(save));
    },
    { key: SAVE.storageKey, save: FULL_ARSENAL_SAVE },
  );
  await bootGame(page);
  await loadRoom(page, 'last-bell', { x: 480, y: 320 });
  await page.evaluate(() => window.__game?.debugProtectPlayer());
  await waitForBossIdle(page);
}

async function waitForKeeper(
  page: Page,
  expected: { phase?: number; state?: string; waterLevel?: number; answerCount?: number },
  timeout = 15_000,
): Promise<void> {
  await page.waitForFunction(
    (want) => {
      const boss = window.__game?.debugState().scene?.boss;
      if (!boss) return false;
      if (want.phase !== undefined && boss.phase !== want.phase) return false;
      if (want.state !== undefined && boss.state !== want.state) return false;
      if (want.waterLevel !== undefined && boss.waterLevel !== want.waterLevel) return false;
      if (want.answerCount !== undefined && boss.answerCount !== want.answerCount) return false;
      return true;
    },
    expected,
    { timeout },
  );
}

test.describe('Last Keeper final act', () => {
  test.describe.configure({ timeout: 180_000 });

  test('the Drowning Toll seals health at 1 and raises the flood in three readable steps', async ({
    page,
  }, testInfo) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(String(error)));
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text());
    });

    await seedLastBell(page);

    expect(await page.evaluate(() => window.__game?.debugDamageBoss(16))).toBe(true);
    await waitForKeeper(page, { phase: 1, state: 'idle' });

    const toll = await debugState(page);
    expect(toll.scene?.boss?.phaseName).toBe('The Drowning Toll');
    expect(toll.scene?.boss?.hp).toBe(1);
    expect(toll.scene?.boss?.waterLevel).toBe(0);

    // Body damage is blocked, not silently absorbed by a bar that still ticks.
    expect(await page.evaluate(() => window.__game?.debugDamageBoss(5))).toBe(false);
    await waitForKeeper(page, { phase: 1 });
    expect((await debugState(page)).scene?.boss?.hp).toBe(1);

    for (const level of [1, 2, 3]) {
      expect(await page.evaluate((water) => window.__game?.debugSetKeeperWater(water), level)).toBe(
        true,
      );
      await waitForKeeper(page, { waterLevel: level });
      const state = await debugState(page);
      expect(state.scene?.boss?.waterLevel).toBe(level);
      expect(state.scene?.boss?.hp).toBe(1);
    }

    await testInfo.attach('last-keeper-final-flood.png', {
      body: await page.locator('canvas').screenshot(),
      contentType: 'image/png',
    });
    expect((await debugState(page)).errors).toEqual([]);
    expect(errors).toEqual([]);
  });

  test('the Answer cadence and the great bell pay the earned ending', async ({
    page,
  }, testInfo) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(String(error)));
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text());
    });

    await seedLastBell(page);

    expect(await page.evaluate(() => window.__game?.debugEnterKeeperRitual())).toBe(true);
    await waitForKeeper(page, { phase: 2, state: 'ritual' });
    const ritual = await debugState(page);
    expect(ritual.scene?.boss?.phaseName).toBe('The Answer');
    expect(ritual.scene?.boss?.waterLevel).toBe(3);
    expect(ritual.scene?.boss?.answerCount).toBe(0);

    // The cadence must open a real window after the kneel and ring tell, not solve itself.
    await page.waitForFunction(
      () => window.__game?.debugState().scene?.boss?.answerWindow === true,
      undefined,
      { timeout: 15_000 },
    );
    await testInfo.attach('last-keeper-answer.png', {
      body: await page.locator('canvas').screenshot(),
      contentType: 'image/png',
    });

    expect(await page.evaluate(() => window.__game?.debugSolveKeeperRitual())).toBe(true);
    await page.waitForFunction(
      () => window.__game?.debugState().scene?.boss?.alive === false,
      undefined,
      { timeout: 15_000 },
    );

    // Hook the authored centre ring and ring the final note. Both inputs go through the
    // real window listeners; the loop only avoids Playwright IPC missing the 18-tick hang.
    const finalNote = await page.evaluate(async () => {
      const started = performance.now();
      let interacted = false;
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyI', bubbles: true }));
      window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyI', bubbles: true }));
      while (performance.now() - started < 10_000) {
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
        const scene = window.__game?.debugState().scene;
        if (!scene) return { outcome: 'no-scene' as const };
        if (scene.finalBellPrompt && !interacted) {
          interacted = true;
          window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyE', bubbles: true }));
          window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyE', bubbles: true }));
        }
        const ending = document.querySelector('[data-screen="ending"]')?.closest('[role="dialog"]');
        if (interacted && ending instanceof HTMLElement && !ending.hidden) {
          return { outcome: 'ending' as const };
        }
      }
      return { outcome: 'timeout' as const };
    });
    expect(finalNote.outcome).toBe('ending');

    const dialog = page.getByRole('dialog', { name: 'THE BELL REMEMBERS' });
    await expect(dialog).toBeVisible();
    await expect(dialog.locator('#ending-title')).toHaveText('THE BELL REMEMBERS');
    await expect(dialog.locator('.menu-eyebrow')).toHaveText('THE LAST BELL');
    await expect(dialog.locator('#ending-subtitle')).toHaveText(
      'The Keeper sets down the bell. The water is still.',
    );
    await expect(dialog.getByRole('button', { name: 'Continue the climb' })).toBeVisible();
    await expect(dialog.locator('.ending-stat', { hasText: 'ARSENAL' })).toContainText('4 / 4');
    await expect(dialog.locator('.ending-stat', { hasText: 'TIDEGLASS' })).toContainText('Found');

    const ended = await debugState(page);
    expect(ended.run.endingSeen).toBe(true);
    expect(ended.save.lastWrite).toBe('ending');
    expect(ended.errors).toEqual([]);
    expect(errors).toEqual([]);
  });
});
