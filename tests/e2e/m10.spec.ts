import { expect, test, type Locator, type Page } from '@playwright/test';
import { bootGame, debugState, dismissOnboarding, openTitle } from './support';

/** Dispatch a held touch pointer without relying on Playwright's tap-only touch API. */
async function pressPointer(target: Locator, pointerId: number): Promise<void> {
  await target.dispatchEvent('pointerdown', {
    pointerId,
    pointerType: 'touch',
    isPrimary: true,
    button: 0,
    buttons: 1,
  });
}

async function releasePointer(target: Locator, pointerId: number): Promise<void> {
  await target.dispatchEvent('pointerup', {
    pointerId,
    pointerType: 'touch',
    isPrimary: true,
    button: 0,
    buttons: 0,
  });
}

/** Taps the visual centre of a control through the browser's real touch pipeline. */
async function tap(page: Page, target: Locator): Promise<void> {
  const box = await target.boundingBox();
  if (!box) throw new Error('touch control is not visible');
  await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
}

test.describe('M10 touch controls', () => {
  test.use({ hasTouch: true, viewport: { width: 844, height: 390 } });
  // Headless SwiftShader can spend longer than the default 60 s tearing down a touch
  // context after canvas/audio work. The assertions stay the same; this covers teardown.
  test.describe.configure({ timeout: 120_000 });

  test('mounts thumb controls, scales to the viewport and drives the hero', async ({ page }) => {
    await bootGame(page);

    const state = await debugState(page);
    expect(state.touch).toMatchObject({ enabled: true, visible: true, held: [] });
    expect(state.onboarding.open).toBe(true);
    expect(state.errors).toEqual([]);

    const onboarding = page.getByTestId('onboarding-root');
    await expect(onboarding).toContainText('Use the on-screen controls.');
    await expect(onboarding.locator('kbd')).toHaveCount(0);
    await dismissOnboarding(page);
    await expect(onboarding).toBeHidden();

    const canvas = await page.locator('canvas').boundingBox();
    expect(canvas).not.toBeNull();
    expect(canvas?.width ?? 0).toBeGreaterThan(640);
    expect(canvas?.width ?? 0).toBeLessThanOrEqual(844);
    expect(canvas?.height ?? 0).toBeLessThanOrEqual(390);

    const before = await debugState(page);
    const startX = before.scene?.player.x ?? 0;
    const right = page.getByRole('button', { name: 'Move right' });
    await pressPointer(right, 11);
    await page.waitForFunction(
      (x) => (window.__game?.debugState().scene?.player.x ?? x) > x + 24,
      startX,
      { timeout: 5_000 },
    );
    expect((await debugState(page)).touch.held).toContain('right');
    await releasePointer(right, 11);
    await page.waitForFunction(
      () => window.__game?.debugState().touch.held.length === 0,
      undefined,
      { timeout: 5_000 },
    );

    const groundY = (await debugState(page)).scene?.player.lastJumpPeakY ?? null;
    await tap(page, page.getByRole('button', { name: 'Jump' }));
    await page.waitForFunction(
      (previous) => {
        const player = window.__game?.debugState().scene?.player;
        return (
          player !== undefined && player.lastJumpPeakY !== null && player.lastJumpPeakY !== previous
        );
      },
      groundY,
      { timeout: 5_000 },
    );

    await tap(page, page.getByRole('button', { name: 'Pause' }));
    await expect(page.getByRole('dialog', { name: 'Paused' })).toBeVisible();
    await expect(page.getByTestId('touch-controls')).toBeHidden();
    expect((await debugState(page)).touch).toMatchObject({ enabled: true, visible: false });
    expect((await debugState(page)).menu.open).toBe(true);

    await page.keyboard.press('Escape');
    await expect(page.getByTestId('touch-controls')).toBeVisible();
    expect((await debugState(page)).touch.visible).toBe(true);
    expect((await debugState(page)).errors).toEqual([]);
  });

  test('teaches the touch scheme on the title card', async ({ page }) => {
    await openTitle(page);
    const title = page.getByTestId('title-root');
    await expect(title).toContainText('Touch controls');
    await expect(title).toContainText('Landscape');
    await expect(page.getByRole('button', { name: 'Enter the belfry' })).toBeFocused();

    const state = await debugState(page);
    expect(state.touch).toMatchObject({ enabled: true, visible: false });
    await expect(page.getByTestId('touch-controls')).toBeHidden();
  });
});

test.describe('M10 desktop', () => {
  test('does not mount touch controls for keyboard play', async ({ page }) => {
    await bootGame(page);

    const state = await debugState(page);
    expect(state.touch).toMatchObject({ enabled: false, visible: false, held: [] });
    await expect(page.getByTestId('touch-controls')).toHaveCount(0);
    await expect(page.getByTestId('onboarding-root')).toContainText('Rest at a bell to save.');
    expect(state.errors).toEqual([]);
  });
});
