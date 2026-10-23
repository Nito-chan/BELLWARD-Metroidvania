import { expect, test } from '@playwright/test';
import { bootGame, collectPickup, debugState, loadRoom } from './support';

type HangSample = {
  readonly x: number;
  readonly y: number;
  readonly anchorId: string | null;
  readonly state: string;
};

type HookSample = {
  readonly hang: HangSample;
  /** Highest cooldown observed after the hang, sampled on the same page task. */
  readonly cooldown: number;
};

test.describe('Hookline', () => {
  test('does not cast before the ability is earned', async ({ page }) => {
    await bootGame(page);
    await page.evaluate(() => window.__game?.debugProtectPlayer());

    const before = await debugState(page);
    expect(before.run.hookline).toBe(false);
    expect(before.scene?.player.hook.enabled).toBe(false);

    await page.keyboard.press('KeyI');
    await page.waitForTimeout(250);
    const after = await debugState(page);
    expect(after.scene?.player.hook.state).toBe('idle');
    expect(after.scene?.player.animation).not.toBe('hook');
    expect(after.errors).toEqual([]);
  });

  test('pulls to a ring, hangs at the authored height, then cools down', async ({ page }) => {
    await bootGame(page);
    await collectPickup(page, 'sunless-aqueduct', { x: 800, y: 208 }, 'aqueduct-hookline');
    expect((await debugState(page)).run.hookline).toBe(true);
    expect((await debugState(page)).scene?.player.hook.range).toBe(176);

    // The span ring hangs directly over the aqueduct floor, giving the pull enough travel
    // to be observed reliably even on a software-rendered test machine.
    await loadRoom(page, 'sunless-aqueduct', { x: 560, y: 320 });
    await page.evaluate(() => window.__game?.debugProtectPlayer());

    const sample = await page.evaluate(async (): Promise<HookSample | null> => {
      let hang: HangSample | null = null;
      let cooldown = 0;
      let lastPress = -100;
      for (let frame = 0; frame < 420; frame += 1) {
        const before = window.__game?.debugState().scene?.player;
        // A lunge can land between loadRoom() and the first i-frame grant. Re-cast once
        // the hero is idle again instead of trusting a single key press.
        const ready =
          hang === null &&
          before !== undefined &&
          before.hook.state === 'idle' &&
          before.state !== 'hurt' &&
          before.state !== 'dead';
        if (ready && frame - lastPress >= 12) {
          window.__game?.debugProtectPlayer();
          window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyI', bubbles: true }));
          window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyI', bubbles: true }));
          lastPress = frame;
        }
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
        const player = window.__game?.debugState().scene?.player;
        if (player?.hook.state === 'hang' && hang === null) {
          hang = {
            x: player.x,
            y: player.y,
            anchorId: player.hook.anchorId,
            state: player.animation,
          };
        }
        if (hang !== null) {
          // Keep sampling the release in this same task; a second evaluate can begin
          // after the whole 12-tick cooldown has already elapsed on a slow frame.
          cooldown = Math.max(cooldown, player?.hook.cooldown ?? 0);
          if (player?.hook.state === 'idle') return { hang, cooldown };
        }
      }
      return hang === null ? null : { hang, cooldown };
    });

    expect(sample).not.toBeNull();
    expect(sample?.hang.anchorId).toBe('aqueduct-span');
    expect(sample?.hang.x).toBeCloseTo(560, 3);
    expect(sample?.hang.y).toBeCloseTo(168 + 28, 3);
    expect(sample?.hang.state).toBe('hook');
    expect(sample?.cooldown).toBeGreaterThan(0);
    expect(sample?.cooldown).toBeLessThanOrEqual(12);
    expect((await debugState(page)).errors).toEqual([]);
  });

  test('Longline raises the owned range', async ({ page }) => {
    await bootGame(page);
    await collectPickup(page, 'wall-claw-shaft', { x: 820, y: 80 }, 'shaft-longline');
    const state = await debugState(page);
    expect(state.run.longline).toBe(true);
    expect(state.scene?.player.hook.enabled).toBe(true);
    expect(state.scene?.player.hook.range).toBe(220);
    expect(state.errors).toEqual([]);
  });
});
