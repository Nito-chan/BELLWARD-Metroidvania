import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { COMBAT } from '../../src/config/combat';
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
    // 12 scene/hero textures plus the parishioner (2), ghoul, adept, death burst and fireball.
    expect(scene?.art.loaded).toHaveLength(18);
    expect(scene?.player.animation).toMatch(/idle|run/);
    expect(scene?.player.grounded).toBe(true);
    expect(scene?.player.y).toBeCloseTo(320, 0);
    expect(scene?.player.hp).toBe(5);
    expect(scene?.player.maxHp).toBe(5);
    expect(scene?.player.dead).toBe(false);
    expect(scene?.enemies.map((enemy) => enemy.kind)).toEqual([
      'parishioner',
      'parishioner',
      'ghoul',
      'adept',
    ]);
    expect(scene?.enemies.every((enemy) => enemy.hp === enemy.maxHp)).toBe(true);
    expect(scene?.projectiles).toBe(0);

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
    expect(ground.scene?.player.lastJumpPeakY).toBeNull();

    // The apex is recorded by the simulation itself, once per tick. A frame sampler
    // flakes when the first-gesture audio decode stalls the main thread and several
    // ticks are caught up in one frame; the tick record cannot skip the arc.
    await page.keyboard.down('Space');
    await page.waitForFunction(
      (previousPeak) => {
        const player = window.__game?.debugState().scene?.player;
        return (
          player !== undefined &&
          player.grounded &&
          player.lastJumpPeakY !== null &&
          player.lastJumpPeakY !== previousPeak
        );
      },
      ground.scene?.player.lastJumpPeakY ?? null,
      { timeout: 5_000 },
    );
    await page.keyboard.up('Space');

    const landed = await debugState(page);
    const peak = landed.scene?.player.lastJumpPeakY ?? groundY;
    expect(groundY - peak).toBeGreaterThan(40);
    expect(groundY - peak).toBeLessThan(95);
    expect(landed.scene?.player.grounded).toBe(true);
    expect(Math.abs((landed.scene?.player.y ?? 0) - groundY)).toBeLessThan(1);
    expect(landed.errors).toEqual([]);
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
    await expect(overlay).toContainText('vitals');
    await expect(overlay).toContainText('hp 5/5');
    await expect(overlay).toContainText('foes');
    await expect(overlay).toContainText('4 live');

    await page.keyboard.press('F1');
    await expect(overlay).toBeHidden();
  });
});

test.describe('M4 combat', () => {
  test('a chained melee swing kills a parishioner', async ({ page }, testInfo) => {
    await bootGame(page);

    // March left until the nearest parishioner is inside the hero's reach.
    await page.keyboard.down('ArrowLeft');
    await page.waitForFunction(
      () => {
        const scene = window.__game?.debugState().scene;
        if (!scene) return false;
        return scene.enemies.some(
          (enemy) =>
            enemy.kind === 'parishioner' &&
            enemy.x < scene.player.x &&
            scene.player.x - enemy.x <= 34,
        );
      },
      undefined,
      { timeout: 15_000 },
    );
    await page.keyboard.up('ArrowLeft');

    // Press on the swing cadence: a press inside the stage-one window chains the heavy
    // stage two (1 + 2 damage), which is exactly a parishioner's 3 HP.
    let killed = false;
    for (let press = 0; press < 24 && !killed; press += 1) {
      await page.keyboard.press('KeyX');
      await page.waitForTimeout(110);
      const scene = (await debugState(page)).scene;
      killed = (scene?.enemies.length ?? 4) < 4;
    }

    const after = await debugState(page);
    expect(killed).toBe(true);
    expect(after.scene?.enemies).toHaveLength(3);
    expect(after.scene?.player.dead).toBe(false);
    expect(after.errors).toEqual([]);

    await testInfo.attach('m4-combat.png', {
      body: await page.screenshot(),
      contentType: 'image/png',
    });
  });

  test('taking a hit grants i-frames, and death rebuilds the room', async ({ page }) => {
    test.setTimeout(90_000);
    await bootGame(page);

    await page.keyboard.down('ArrowLeft');
    await page.waitForFunction(
      () => {
        const scene = window.__game?.debugState().scene;
        if (!scene) return false;
        return scene.enemies.some(
          (enemy) =>
            enemy.kind === 'parishioner' &&
            enemy.x < scene.player.x &&
            scene.player.x - enemy.x <= 24,
        );
      },
      undefined,
      { timeout: 15_000 },
    );
    await page.keyboard.up('ArrowLeft');

    await page.waitForFunction(
      () => (window.__game?.debugState().scene?.player.hp ?? 5) < 5,
      undefined,
      { timeout: 20_000 },
    );
    const hurt = await debugState(page);
    // A single hit takes one of five masks and opens the invulnerability window. The
    // exact HP is read a moment after the hit, so assert the range rather than racing a
    // second (guarded) hit if the audio decode stalls the main thread.
    expect(hurt.scene?.player.hp).toBeLessThan(5);
    expect(hurt.scene?.player.hp).toBeGreaterThan(0);
    expect(hurt.scene?.player.invulnerableTicks).toBeGreaterThan(0);
    expect(hurt.scene?.player.dead).toBe(false);
    const firstHitTick = hurt.tickCount;

    // Stand still and let the parishioner finish the job: one hit per invulnerability
    // window, knockback included, until the fifth mask breaks.
    await page.waitForFunction(
      () => window.__game?.debugState().scene?.player.dead === true,
      undefined,
      { timeout: 45_000 },
    );
    const dead = await debugState(page);
    expect(dead.scene?.player.hp).toBe(0);
    expect(dead.scene?.player.dead).toBe(true);
    // Four more hits at one mask each can only land after four full i-frame windows.
    // Measured on the simulation clock, so a slow or stalled main thread cannot shrink it.
    expect(dead.tickCount - firstHitTick).toBeGreaterThanOrEqual(
      hurt.scene!.player.hp * COMBAT.player.invulnerableTicks,
    );

    // The 100-tick death fade ends in a fresh room: full health, four enemies, spawn point.
    await page.waitForFunction(
      () => {
        const scene = window.__game?.debugState().scene;
        if (!scene) return false;
        return !scene.player.dead && scene.player.hp === 5 && scene.enemies.length === 4;
      },
      undefined,
      { timeout: 15_000 },
    );
    const respawned = await debugState(page);
    expect(respawned.scene?.player.hp).toBe(5);
    expect(respawned.scene?.player.x).toBeCloseTo(420, 0);
    expect(respawned.scene?.player.invulnerableTicks).toBeGreaterThan(0);
    expect(respawned.scene?.enemies.every((enemy) => enemy.hp === enemy.maxHp)).toBe(true);
    expect(respawned.scene?.projectiles).toBe(0);
    expect(respawned.errors).toEqual([]);
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
