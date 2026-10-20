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

/**
 * Waits until the soundtrack is actually audible. Audio may only start after a gesture,
 * and in a headless VM the context start plus track decode can take far longer than on a
 * desktop; on timeout the audio snapshot is attached to the error so a regression is
 * distinguishable from a slow machine.
 */
async function waitForLiveMusic(page: Page, timeout = 45_000): Promise<void> {
  try {
    await page.waitForFunction(
      () => {
        const audio = window.__game?.debugState().audio;
        return audio?.context === 'running' && audio.musicPlaying === true;
      },
      undefined,
      { timeout },
    );
  } catch (error) {
    const audio = await page.evaluate(() => window.__game?.debugState().audio);
    throw new Error(`audio path never became live: ${JSON.stringify(audio)}`, { cause: error });
  }
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

    const playerBefore = before.scene?.player.x ?? 0;
    const playerRunning = running.scene?.player.x ?? 0;
    const cameraBefore = before.scene?.camera.x ?? 0;
    const cameraRunning = running.scene?.camera.x ?? 0;

    expect(playerRunning).toBeGreaterThan(playerBefore + 60);
    expect(cameraRunning).toBeGreaterThan(cameraBefore + 10);
    expect(running.scene?.player.animation).toBe('run');
    expect(running.scene?.player.facing).toBe(1);
    expect(running.errors).toEqual([]);
    // The first key press opened the audio gate; the context itself starts on its own
    // schedule, so wait for it before expecting a sound to be audible.
    expect(running.audio.unlocked).toBe(true);
    await page.waitForFunction(
      () => window.__game?.debugState().audio.context === 'running',
      undefined,
      { timeout: 20_000 },
    );

    await page.keyboard.up('ArrowRight');
    await page.waitForTimeout(400);
    const stopped = await debugState(page);

    const playerStopped = stopped.scene?.player.x ?? 0;
    expect(playerStopped).toBeGreaterThan(playerRunning);
    expect(stopped.scene?.player.animation).toBe('idle');
    expect(Math.abs(stopped.scene?.player.vx ?? 99)).toBeLessThan(1);

    // Run back the other way (the hero has reached the dais step by now) and watch the
    // simulation's footfalls arrive as sound: sim -> event buffer -> AudioManager.
    await page.keyboard.down('ArrowLeft');
    await page.waitForFunction(
      () => window.__game?.debugState().audio.lastSfx?.key === 'footstep',
      undefined,
      { timeout: 15_000 },
    );
    await page.keyboard.up('ArrowLeft');
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

test.describe('M3 audio', () => {
  // Browsers only start the audio context after a gesture, and this headless VM adds a
  // software decode of the terrace track on top (measured ~3 s to resume, ~12 s to play).
  // These tests assert the path, not the speed, so they get a budget a slow VM can meet.
  test.describe.configure({ timeout: 120_000 });

  test('stays silent until the first gesture, then the terrace track plays', async ({
    page,
  }, testInfo) => {
    await bootGame(page);
    const before = await debugState(page);
    expect(before.audio.music).toBe('terrace');
    expect(before.audio.unlocked).toBe(false);
    expect(before.audio.musicPlaying).toBe(false);
    expect(before.audio.failed).toEqual([]);

    await page.keyboard.press('ArrowRight');
    await page.waitForFunction(
      () => window.__game?.debugState().audio.unlocked === true,
      undefined,
      {
        timeout: 5_000,
      },
    );

    // The context takes a moment to start, and the terrace track decodes with it; once
    // it is live the soundtrack is playing and the gate is fully open.
    await waitForLiveMusic(page);

    const after = await debugState(page);
    expect(after.audio.musicPlaying).toBe(true);
    expect(after.audio.volumes).toEqual({ master: 0.9, music: 0.65, sfx: 0.9 });
    expect(after.audio.failed).toEqual([]);
    expect(after.errors).toEqual([]);

    // The overlay reports the mix, because a broken audio path must be visible.
    await page.keyboard.press('F1');
    const overlay = page.getByTestId('debug-overlay');
    await expect(overlay).toContainText('audio');
    await expect(overlay).toContainText('terrace (playing)');
    await expect(overlay).toContainText('mix');
    await testInfo.attach('m3-overlay.png', {
      body: await page.screenshot(),
      contentType: 'image/png',
    });
  });

  test('mute silences the mix without stopping the track, and survives a reload', async ({
    page,
  }) => {
    await bootGame(page);
    await page.keyboard.press('ArrowRight'); // unlock
    await waitForLiveMusic(page);

    await page.keyboard.press('KeyB');
    const muted = await debugState(page);
    expect(muted.audio.muted).toBe(true);
    // Muting is a master fade, not a stop: the track keeps its place in the region.
    expect(muted.audio.musicPlaying).toBe(true);

    await page.reload();
    await page.waitForFunction(() => window.__game?.debugState().ready === true, undefined, {
      timeout: 15_000,
    });
    expect((await debugState(page)).audio.muted).toBe(true);

    await page.keyboard.press('KeyB');
    expect((await debugState(page)).audio.muted).toBe(false);
  });
});
