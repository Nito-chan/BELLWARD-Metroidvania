import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { SAVE } from '../../src/config/save';
import type { RunSave } from '../../src/save/runSave';
import {
  bootGame,
  debugState,
  loadRoom,
  openTitle,
  startFromTitle,
  waitForBossIdle,
} from './support';

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
  mapPins: [],
  charmsOwned: [],
  charmsEquipped: [],
  nailLevel: 0,
  shards: 0,
  ordeals: [],
  tideDoorOpened: true,
  endingSeen: false,
};

async function seedFullArsenal(page: Page): Promise<void> {
  await page.addInitScript(
    ({ key, save }) => {
      localStorage.setItem(key, JSON.stringify(save));
    },
    { key: SAVE.storageKey, save: FULL_ARSENAL_SAVE },
  );
}

async function seedLastBell(page: Page): Promise<void> {
  await seedFullArsenal(page);
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

type RitualAnswer = {
  readonly note: number;
  readonly windowTick: number;
  readonly answerTick: number;
  readonly margin: number;
};

type RitualRun = {
  readonly outcome: 'solved' | 'timeout' | 'no-game';
  readonly timeline: readonly string[];
  readonly answers: readonly RitualAnswer[];
  readonly phaseTicks: number;
  readonly misses: number;
};

/**
 * Plays the Answer with real inputs: hook the centre ring during the tell, jump off it
 * inside the window, and fire the Toll. Returns the measured tick timeline so the test
 * proves the 24-tick window is reachable instead of bypassing it with a debug solve.
 */
async function playRitualWithToll(page: Page): Promise<RitualRun> {
  return page.evaluate(async () => {
    const game = window.__game;
    if (!game) {
      return {
        outcome: 'no-game' as const,
        timeline: [] as string[],
        answers: [] as { note: number; windowTick: number; answerTick: number; margin: number }[],
        phaseTicks: 0,
        misses: 0,
      };
    }

    game.debugEnterKeeperRitual();
    const timeline: string[] = [];
    const answers: { note: number; windowTick: number; answerTick: number; margin: number }[] = [];
    let phaseStart = 0;
    let note = 0;
    let state: 'reposition' | 'ring' | 'hooked' | 'fired' = 'reposition';
    let noteDeadline = 0;
    let windowStartTick = 0;
    let hookedThisNote = false;
    let fireTick = 0;
    let misses = 0;
    const started = performance.now();

    const release = (code: string): void => {
      window.dispatchEvent(new KeyboardEvent('keyup', { code, bubbles: true }));
    };
    const press = (code: string): void => {
      window.dispatchEvent(new KeyboardEvent('keydown', { code, bubbles: true }));
      window.dispatchEvent(new KeyboardEvent('keyup', { code, bubbles: true }));
    };
    const resetNote = (): void => {
      release('ArrowLeft');
      release('ArrowRight');
      release('Space');
      release('KeyX');
      state = 'reposition';
      hookedThisNote = false;
      noteDeadline = 0;
    };

    while (performance.now() - started < 30_000) {
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      const snapshot = game.debugState();
      const boss = snapshot.scene?.boss;
      const player = snapshot.scene?.player;
      const tick = snapshot.tickCount;
      if (!boss || !player) continue;

      if (phaseStart === 0 && boss.phase === 2 && boss.state === 'ritual') {
        phaseStart = tick;
        timeline.push(`ritual start tick=${tick}`);
      }

      if (note >= 3) {
        if (boss.alive === false) {
          timeline.push(`boss dead tick=${tick} phaseTicks=${tick - phaseStart} misses=${misses}`);
          return {
            outcome: 'solved' as const,
            timeline,
            answers,
            phaseTicks: tick - phaseStart,
            misses,
          };
        }
        continue;
      }

      if (state !== 'reposition' && noteDeadline > 0 && tick > noteDeadline) {
        misses += 1;
        timeline.push(`note timeout note=${note + 1} tick=${tick}`);
        resetNote();
        continue;
      }

      if (state === 'reposition') {
        const dx = 480 - player.x;
        if (Math.abs(dx) > 8) {
          if (dx > 0) {
            window.dispatchEvent(
              new KeyboardEvent('keydown', { code: 'ArrowRight', bubbles: true }),
            );
            release('ArrowLeft');
          } else {
            window.dispatchEvent(
              new KeyboardEvent('keydown', { code: 'ArrowLeft', bubbles: true }),
            );
            release('ArrowRight');
          }
        } else {
          release('ArrowLeft');
          release('ArrowRight');
          if (player.grounded) {
            state = 'ring';
            timeline.push(`ready tick=${tick} x=${player.x} y=${player.y}`);
          }
        }
        continue;
      }

      if (state === 'ring') {
        if (
          boss.ritualStage === 'ring' &&
          player.hook.state === 'idle' &&
          player.hook.cooldown === 0 &&
          !hookedThisNote
        ) {
          hookedThisNote = true;
          state = 'hooked';
          noteDeadline = tick + 120;
          timeline.push(`hook tick=${tick} x=${player.x} y=${player.y}`);
          press('KeyI');
        }
        continue;
      }

      if (state === 'hooked') {
        if (player.hook.state === 'hang' && boss.answerWindow === true) {
          state = 'fired';
          fireTick = tick;
          windowStartTick = tick;
          timeline.push(
            `fire tick=${tick} windowTicks=${boss.answerWindowTicks} x=${player.x} y=${player.y}`,
          );
          window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', bubbles: true }));
          window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyX', bubbles: true }));
          release('KeyX');
          release('Space');
        }
        continue;
      }

      if (state === 'fired') {
        if ((boss.answerCount ?? 0) > note) {
          answers.push({
            note,
            windowTick: windowStartTick,
            answerTick: tick,
            margin: tick - windowStartTick,
          });
          timeline.push(
            `answer ${note + 1} tick=${tick} margin=${tick - windowStartTick} x=${player.x} y=${player.y}`,
          );
          note += 1;
          resetNote();
          continue;
        }
        if (boss.answerWindow === false && tick - fireTick > 24) {
          misses += 1;
          timeline.push(`miss note=${note + 1} tick=${tick}`);
          resetNote();
        }
      }
    }

    return { outcome: 'timeout' as const, timeline, answers, phaseTicks: 0, misses };
  });
}

test.describe('Last Keeper final act', () => {
  test.describe.configure({ timeout: 180_000 });

  test('the title card hides the last-bell gameplay overlays at 375', async ({
    page,
  }, testInfo) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(String(error)));
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text());
    });

    await page.setViewportSize({ width: 375, height: 812 });
    await seedFullArsenal(page);
    await openTitle(page);

    const opening = await debugState(page);
    expect(opening.scene?.roomId).toBe('last-bell');
    expect(opening.scene?.boss?.phaseName).toBe('The Vigil');
    expect(opening.scene?.gameplayUiVisible).toBe(false);
    expect(opening.title.open).toBe(true);

    const width = await page.evaluate(() => ({
      document: document.documentElement.scrollWidth,
      viewport: window.innerWidth,
    }));
    expect(width.document).toBeLessThanOrEqual(width.viewport);

    // The entrance animation must not push the primary frame off the left edge at 375 px.
    const primary = await page.locator('[data-action="primary"]').boundingBox();
    expect(primary).not.toBeNull();
    expect(primary!.x).toBeGreaterThanOrEqual(0);
    expect(primary!.x + primary!.width).toBeLessThanOrEqual(width.viewport + 0.5);

    await testInfo.attach('last-keeper-title-375.png', {
      body: await page.screenshot(),
      contentType: 'image/png',
    });

    await startFromTitle(page);
    expect((await debugState(page)).scene?.gameplayUiVisible).toBe(true);
    expect((await debugState(page)).errors).toEqual([]);
    expect(errors).toEqual([]);
  });

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

  test('the Answer cadence is solvable with three real Toll windows', async ({
    page,
  }, testInfo) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(String(error)));
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text());
    });

    await seedLastBell(page);

    // The swap cycle is the real input path: Nail -> Censer -> Toll.
    for (let swap = 0; swap < 3; swap += 1) {
      if ((await debugState(page)).touch.weapon === 'toll') break;
      await page.keyboard.press('KeyQ');
      await page.waitForTimeout(100);
    }
    expect((await debugState(page)).touch.weapon).toBe('toll');

    const run = await playRitualWithToll(page);
    await testInfo.attach('last-keeper-real-answers.json', {
      body: JSON.stringify(run, null, 2),
      contentType: 'application/json',
    });

    expect(run.outcome).toBe('solved');
    expect(run.answers).toHaveLength(3);
    for (const answer of run.answers) {
      expect(answer.margin).toBeGreaterThan(0);
      expect(answer.margin).toBeLessThanOrEqual(24);
    }
    expect(run.misses).toBe(0);
    expect(run.phaseTicks).toBeGreaterThan(250);
    expect(run.phaseTicks).toBeLessThan(600);

    await page.waitForFunction(
      () => window.__game?.debugState().run.sigils.includes('lastKeeper') === true,
      undefined,
      { timeout: 5_000 },
    );
    const after = await debugState(page);
    expect(after.scene?.boss?.alive).toBe(false);
    expect(after.scene?.boss?.answerCount).toBe(3);
    expect(after.run.sigils).toContain('lastKeeper');
    expect(after.errors).toEqual([]);
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
