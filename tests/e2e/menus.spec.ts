import { expect, test } from '@playwright/test';
import { bootGame, debugState, reloadGame } from './support';

test.describe('M5 menus', () => {
  test('freezes the simulation while paused, then resumes cleanly', async ({ page }, testInfo) => {
    await bootGame(page);
    const before = await debugState(page);

    await page.keyboard.press('Escape');
    const dialog = page.getByRole('dialog', { name: 'Paused' });
    await expect(dialog).toBeVisible();

    const paused = await debugState(page);
    expect(paused.menu.open).toBe(true);
    expect(paused.menu.screen).toBe('pause');
    expect(paused.menu.focus).toBe('pause:resume');
    expect(paused.tickCount).toBeGreaterThanOrEqual(before.tickCount);

    const frozenTicks = paused.tickCount;
    const frozenFrames = paused.frameCount;
    await page.waitForTimeout(400);
    const still = await debugState(page);
    expect(still.tickCount).toBe(frozenTicks);
    expect(still.frameCount).toBeGreaterThan(frozenFrames);
    expect(still.menu.open).toBe(true);

    await testInfo.attach('m5-pause-640.png', {
      body: await page.screenshot(),
      contentType: 'image/png',
    });

    await page.getByRole('button', { name: 'Resume', exact: true }).click();
    await expect(dialog).toBeHidden();
    await page.waitForTimeout(250);

    const resumed = await debugState(page);
    expect(resumed.menu.open).toBe(false);
    expect(resumed.tickCount).toBeGreaterThan(frozenTicks);
    expect(resumed.errors).toEqual([]);
    expect(await page.evaluate(() => document.activeElement?.tagName)).toBe('CANVAS');

    // Holding the closing pause key must not let an OS auto-repeat re-open the menu.
    await page.keyboard.press('Escape');
    await expect(dialog).toBeVisible();
    await page.keyboard.down('Escape');
    await expect(dialog).toBeHidden();
    await page.evaluate(() => {
      window.dispatchEvent(
        new KeyboardEvent('keydown', {
          code: 'Escape',
          key: 'Escape',
          repeat: true,
          bubbles: true,
        }),
      );
    });
    await page.waitForTimeout(250);
    expect((await debugState(page)).menu.open).toBe(false);
    await page.keyboard.up('Escape');
    await page.waitForTimeout(100);
    expect((await debugState(page)).menu.open).toBe(false);
  });

  test('adjusts and persists the sound mix', async ({ page }) => {
    await bootGame(page);
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Settings', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Sound' });
    await expect(dialog).toBeVisible();

    const master = page.getByRole('slider', { name: 'Master' });
    await expect(master).toHaveValue('90');
    await master.focus();
    await page.keyboard.press('ArrowLeft');
    await expect(master).toHaveValue('85');
    expect((await debugState(page)).audio.volumes.master).toBeCloseTo(0.85, 2);

    const mute = page.getByRole('switch', { name: 'Silence all audio' });
    await expect(mute.locator('.setting-toggle-state')).toHaveText('Off');
    await mute.click();
    await expect(mute).toHaveAttribute('aria-checked', 'true');
    await expect(mute.locator('.setting-toggle-state')).toHaveText('Muted');
    expect((await debugState(page)).audio.muted).toBe(true);

    await reloadGame(page);
    const restored = await debugState(page);
    expect(restored.audio.volumes.master).toBeCloseTo(0.85, 2);
    expect(restored.audio.muted).toBe(true);

    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Settings', exact: true }).click();
    await expect(page.getByRole('slider', { name: 'Master' })).toHaveValue('85');
    const restoredMute = page.getByRole('switch', { name: 'Silence all audio' });
    await expect(restoredMute).toHaveAttribute('aria-checked', 'true');
    await expect(restoredMute.locator('.setting-toggle-state')).toHaveText('Muted');
    expect(restored.errors).toEqual([]);
  });

  test('rebinds jump, rejects conflicts and applies the new key after reload', async ({ page }) => {
    test.setTimeout(60_000);
    await bootGame(page);
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Controls', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Bindings' });
    await expect(dialog).toBeVisible();

    const jumpKey = page.getByRole('button', {
      name: /Rebind Jump, Key 1, currently Z/,
    });
    await jumpKey.click();
    await expect(dialog.getByRole('status')).toContainText('Press a key for Jump');
    await page.keyboard.press('KeyQ');

    const rebound = page.getByRole('button', {
      name: /Rebind Jump, Key 1, currently Q/,
    });
    await expect(rebound).toBeVisible();
    let state = await debugState(page);
    expect(state.menu.bindings.keyboard.jump?.[0]).toBe('KeyQ');
    expect(state.menu.capture).toBeNull();

    // Right arrow is Move right's primary key; the editor must refuse it and stay in capture.
    await rebound.click();
    await page.keyboard.press('ArrowRight');
    await expect(dialog.getByRole('status')).toContainText('Move right');
    state = await debugState(page);
    expect(state.menu.capture?.action).toBe('jump');
    expect(state.menu.bindings.keyboard.jump?.[0]).toBe('KeyQ');

    // Reserved keys are refused with a status, and capture stays open.
    await page.keyboard.press('Tab');
    await expect(dialog.getByRole('status')).toContainText('belongs to the menu');
    expect((await debugState(page)).menu.capture?.action).toBe('jump');

    await page.keyboard.press('Escape');
    await expect(dialog.getByRole('status')).toContainText('cancelled');

    await page.keyboard.press('Escape'); // controls -> pause
    await page.keyboard.press('Escape'); // pause -> play
    await expect(dialog).toBeHidden();

    const beforeJump = await debugState(page);
    await page.keyboard.press('KeyQ');
    await page.waitForFunction(
      (previous) => {
        const player = window.__game?.debugState().scene?.player;
        return (
          player !== undefined &&
          player.grounded &&
          player.lastJumpPeakY !== null &&
          player.lastJumpPeakY !== previous
        );
      },
      beforeJump.scene?.player.lastJumpPeakY ?? null,
      { timeout: 5_000 },
    );

    await reloadGame(page);
    const restored = await debugState(page);
    expect(restored.menu.bindings.keyboard.jump?.[0]).toBe('KeyQ');

    const beforeReloadJump = restored;
    await page.keyboard.press('KeyQ');
    await page.waitForFunction(
      (previous) => {
        const player = window.__game?.debugState().scene?.player;
        return (
          player !== undefined &&
          player.grounded &&
          player.lastJumpPeakY !== null &&
          player.lastJumpPeakY !== previous
        );
      },
      beforeReloadJump.scene?.player.lastJumpPeakY ?? null,
      { timeout: 5_000 },
    );
    expect((await debugState(page)).errors).toEqual([]);
  });

  test('keeps focus inside the dialog and fits a 640x360 viewport', async ({ page }) => {
    test.setTimeout(90_000);
    await bootGame(page);
    await page.keyboard.press('Escape');
    const dialog = page.getByRole('dialog');
    await expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect((await debugState(page)).menu.focus).toBe('pause:resume');

    await page.keyboard.press('ArrowDown');
    expect((await debugState(page)).menu.focus).toBe('pause:settings');
    await page.keyboard.press('Enter');
    await expect(page.getByRole('dialog', { name: 'Sound' })).toBeVisible();
    expect((await debugState(page)).menu.focus).toBe('settings:master');

    await page.keyboard.press('Tab');
    expect((await debugState(page)).menu.focus).toBe('settings:music');
    await page.keyboard.press('Shift+Tab');
    expect((await debugState(page)).menu.focus).toBe('settings:master');

    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Controls', exact: true }).click();
    await expect(page.getByRole('dialog', { name: 'Bindings' })).toBeVisible();

    const box = await page.getByRole('dialog', { name: 'Bindings' }).boundingBox();
    expect(box).not.toBeNull();
    expect(box?.y ?? -1).toBeGreaterThanOrEqual(0);
    expect((box?.y ?? 0) + (box?.height ?? 999)).toBeLessThanOrEqual(360);

    // Focus the last control, then Tab forward: the trap must wrap to the first binding,
    // and Shift+Tab must wrap back. Two presses are enough and avoid a slow 12-step loop.
    await page.getByRole('button', { name: 'Back', exact: true }).focus();
    expect((await debugState(page)).menu.focus).toBe('screen:back');
    await page.keyboard.press('Tab');
    expect((await debugState(page)).menu.focus).toBe('binding:left:key:0');
    expect(
      await page.evaluate(() => document.activeElement?.closest('[role="dialog"]') !== null),
    ).toBe(true);
    await page.keyboard.press('Shift+Tab');
    expect((await debugState(page)).menu.focus).toBe('screen:back');
    expect(
      await page.evaluate(() => document.activeElement?.closest('[role="dialog"]') !== null),
    ).toBe(true);
  });
});
