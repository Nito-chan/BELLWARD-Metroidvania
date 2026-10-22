import { expect, test } from '@playwright/test';
import { bootGame, debugState, loadRoom, openTitle, reloadGame, startFromTitle } from './support';

/**
 * M9 owns the threshold: the title card, the first gesture, continuing or starting over,
 * first-run teaching, and the accessibility switch that removes camera kicks. These tests
 * use the shipped DOM controls; only the room jump uses the DEV handle.
 */
test.describe('M9 title, onboarding and accessibility', () => {
  test('titles the run, focuses the primary action, and begins through the keyboard', async ({
    page,
  }, testInfo) => {
    await openTitle(page);

    const title = page.getByTestId('title-root');
    await expect(title).toBeVisible();
    await expect(page.getByRole('dialog', { name: 'BELLWARD' })).toBeVisible();
    await expect(title).toContainText('The water is listening');
    await expect(title).toContainText('A silent bell');
    await expect(page.getByRole('button', { name: 'Enter the belfry' })).toBeFocused();
    await expect(title).not.toContainText('Continue the climb');

    const before = await debugState(page);
    expect(before.title).toMatchObject({
      open: true,
      hasSave: false,
      newRunArmed: false,
      primaryLabel: 'Enter the belfry',
      focus: 'title:primary',
    });
    expect(before.onboarding.open).toBe(false);
    expect(before.tickCount).toBe(0);
    expect(before.save.present).toBe(false);
    await testInfo.attach('M9-title.png', {
      body: await page.screenshot(),
      contentType: 'image/png',
    });

    await page.keyboard.press('Enter');
    await expect(title).toBeHidden();
    await expect(page.getByTestId('onboarding-root')).toBeVisible();
    await page.waitForFunction(() => (window.__game?.debugState().tickCount ?? 0) > 0);

    const started = await debugState(page);
    expect(started.title.open).toBe(false);
    expect(started.onboarding.open).toBe(true);
    expect(started.scene?.roomId).toBe('belfry-terrace');
    expect(started.save).toMatchObject({ present: true, loaded: false, lastWrite: 'boot' });
    expect(started.errors).toEqual([]);

    await page.getByRole('button', { name: 'Dismiss first steps' }).click();
    await expect(page.getByTestId('onboarding-root')).toBeHidden();
    expect((await debugState(page)).onboarding.open).toBe(false);
  });

  test('continues the saved room, and Begin anew needs a second confirmation', async ({ page }) => {
    await bootGame(page);
    await loadRoom(page, 'belfry-antechamber', { x: 90, y: 320 });
    expect((await debugState(page)).scene?.roomId).toBe('belfry-antechamber');

    await page.reload();
    await page.waitForFunction(() => window.__game?.debugState().ready === true, undefined, {
      timeout: 15_000,
    });
    const title = page.getByTestId('title-root');
    await expect(title).toBeVisible();
    await expect(page.getByRole('dialog', { name: 'BELLWARD' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Continue the climb' })).toBeFocused();
    await expect(page.getByRole('button', { name: 'Begin anew' })).toBeVisible();

    const waiting = await debugState(page);
    expect(waiting.title).toMatchObject({ open: true, hasSave: true });
    expect(waiting.onboarding.open).toBe(false);

    // Starting fresh is destructive, so the first click only arms the action.
    await page.getByRole('button', { name: 'Begin anew' }).click();
    await expect(page.getByRole('button', { name: /Confirm new run/ })).toBeVisible();
    await expect(title).toContainText('This erases the saved climb.');
    expect(await debugState(page)).toMatchObject({
      title: { open: true, newRunArmed: true },
    });

    await page.keyboard.press('Escape');
    await expect(page.getByRole('button', { name: 'Begin anew' })).toBeVisible();
    await expect(title).toContainText('New run cancelled.');
    expect((await debugState(page)).title.newRunArmed).toBe(false);

    await page.getByRole('button', { name: 'Begin anew' }).click();
    await page.getByRole('button', { name: /Confirm new run/ }).click();
    await page.waitForFunction(
      () =>
        window.__game?.debugState().title.open === false &&
        (window.__game?.debugState().tickCount ?? 0) > 0,
      undefined,
      { timeout: 15_000 },
    );

    const fresh = await debugState(page);
    expect(fresh.scene?.roomId).toBe('belfry-terrace');
    expect(fresh.run.visitedRooms).toEqual(['belfry-terrace']);
    expect(fresh.run.sigils).toEqual([]);
    expect(fresh.run.pickups).toEqual([]);
    expect(fresh.save.lastWrite).toBe('boot');
    expect(fresh.onboarding.open).toBe(true);
    expect(fresh.errors).toEqual([]);
  });

  test('continues a saved room without lowering its progress', async ({ page }) => {
    await bootGame(page);
    await loadRoom(page, 'drowned-gallery', { x: 300, y: 256 });
    const before = await debugState(page);

    await page.reload();
    await page.waitForFunction(() => window.__game?.debugState().ready === true, undefined, {
      timeout: 15_000,
    });
    await expect(page.getByTestId('title-root')).toBeVisible();
    await startFromTitle(page);

    const resumed = await debugState(page);
    expect(resumed.scene?.roomId).toBe('drowned-gallery');
    expect(resumed.run.visitedRooms).toEqual(before.run.visitedRooms);
    expect(resumed.save).toMatchObject({ loaded: true, lastWrite: null });
    expect(resumed.onboarding.open).toBe(false);
    expect(resumed.errors).toEqual([]);
  });

  test('camera shake can be disabled and the choice survives a reload', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await bootGame(page);
    expect((await debugState(page)).accessibility.screenShake).toBe(true);

    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Settings', exact: true }).click();
    const shake = page.getByRole('switch', { name: 'Camera shake' });
    await expect(shake).toHaveAttribute('aria-checked', 'true');
    await shake.click();
    await expect(shake).toHaveAttribute('aria-checked', 'false');
    expect((await debugState(page)).accessibility.screenShake).toBe(false);

    await page.keyboard.press('Escape');
    await page.keyboard.press('Escape');
    await reloadGame(page);
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Settings', exact: true }).click();
    await expect(page.getByRole('switch', { name: 'Camera shake' })).toHaveAttribute(
      'aria-checked',
      'false',
    );
    expect((await debugState(page)).accessibility.screenShake).toBe(false);
    expect((await debugState(page)).errors).toEqual([]);
  });

  test('honours the operating system motion preference on first boot', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await openTitle(page);
    expect((await debugState(page)).accessibility.screenShake).toBe(false);
    await startFromTitle(page);
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Settings', exact: true }).click();
    await expect(page.getByRole('switch', { name: 'Camera shake' })).toHaveAttribute(
      'aria-checked',
      'false',
    );
    expect((await debugState(page)).errors).toEqual([]);
  });
});
