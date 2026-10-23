import { expect, test } from '@playwright/test';
import { bootGame, collectPickup, debugState, loadRoom, reloadGame } from './support';

/**
 * M8 proves the slice's progression loop rather than re-testing movement: mask shards and
 * charms, the Wall-Claw gate, both breakable secrets, bench equipment, Ordeals and the
 * Tide-door ending all cross the real simulation, save and DOM overlay boundaries.
 */
test.describe('M8 progression, secrets and the ending', () => {
  test.describe.configure({ timeout: 120_000 });

  test('four mask shards, the Wall Claw and a charm survive a reload', async ({ page }) => {
    await bootGame(page);

    await collectPickup(page, 'drowned-gallery', { x: 480, y: 208 }, 'gallery-quick-mend');
    await collectPickup(page, 'drowned-gallery', { x: 840, y: 208 }, 'gallery-health-shard');
    await collectPickup(page, 'ossuary', { x: 340, y: 256 }, 'ossuary-health-shard');
    await collectPickup(page, 'sunless-aqueduct', { x: 480, y: 208 }, 'aqueduct-wall-claw');
    await collectPickup(page, 'sunless-aqueduct', { x: 440, y: 208 }, 'aqueduct-health-shard');
    await collectPickup(page, 'reliquary', { x: 340, y: 256 }, 'reliquary-health-shard');

    const collected = await debugState(page);
    expect(collected.run.healthShards).toBe(4);
    expect(collected.run.maxHp).toBe(6);
    expect(collected.scene?.player.maxHp).toBe(6);
    expect(collected.run.wallClaw).toBe(true);
    expect(collected.run.charmsOwned).toContain('quickMend');
    expect(collected.run.charmsEquipped).toContain('quickMend');
    expect(collected.save).toMatchObject({ present: true, lastWrite: 'reward' });
    expect(collected.errors).toEqual([]);

    await reloadGame(page);
    const resumed = await debugState(page);
    expect(resumed.run.healthShards).toBe(4);
    expect(resumed.run.maxHp).toBe(6);
    expect(resumed.scene?.player.maxHp).toBe(6);
    expect(resumed.run.wallClaw).toBe(true);
    expect(resumed.run.charmsEquipped).toContain('quickMend');
    expect(resumed.save).toMatchObject({ present: true, loaded: true });
    expect(resumed.errors).toEqual([]);
  });

  test('the Wall-Claw shaft is climbed with real wall jumps', async ({ page }) => {
    await bootGame(page);
    await collectPickup(page, 'sunless-aqueduct', { x: 480, y: 208 }, 'aqueduct-wall-claw');
    await loadRoom(page, 'wall-claw-shaft', { x: 440, y: 320 });
    await page.evaluate(() => window.__game?.debugProtectPlayer());

    const climb = await page.evaluate(async () => {
      const game = window.__game;
      if (!game) throw new Error('window.__game is not available');
      const held = new Set<string>();
      const down = (code: string): void => {
        if (held.has(code)) return;
        held.add(code);
        window.dispatchEvent(new KeyboardEvent('keydown', { code, bubbles: true }));
      };
      const up = (code: string): void => {
        if (!held.delete(code)) return;
        window.dispatchEvent(new KeyboardEvent('keyup', { code, bubbles: true }));
      };
      const frame = (): Promise<void> =>
        new Promise((resolve) => requestAnimationFrame(() => resolve()));

      let target: -1 | 1 = -1;
      let lastContact: -1 | 0 | 1 = 0;
      let wallJumps = 0;
      let minY = Number.POSITIVE_INFINITY;
      const started = performance.now();
      let releaseJumpAt = 0;
      const jump = (): void => {
        // Release before pressing so every wall kick gets a fresh edge; holding through
        // the rise keeps the variable-height jump at its full height.
        up('Space');
        down('Space');
        releaseJumpAt = performance.now() + 230;
      };
      down('ArrowLeft');
      jump();

      try {
        while (performance.now() - started < 12_000) {
          await frame();
          if (releaseJumpAt > 0 && performance.now() >= releaseJumpAt) {
            up('Space');
            releaseJumpAt = 0;
          }
          const scene = game.debugState().scene;
          if (!scene) return { outcome: 'no-scene', wallJumps, minY };
          if (scene.roomId === 'upper-gallery') {
            return { outcome: 'arrived', wallJumps, minY };
          }

          const player = scene.player;
          minY = Math.min(minY, player.y);
          if (player.grounded && player.y < 100) {
            // On the one-way shelf above the pillars: run into the upper doorway.
            up('ArrowLeft');
            down('ArrowRight');
          } else if (!player.grounded && player.wallContact === target) {
            if (lastContact !== target) {
              jump();
              wallJumps += 1;
              target = target === -1 ? 1 : -1;
              up('ArrowLeft');
              up('ArrowRight');
              down(target === 1 ? 'ArrowRight' : 'ArrowLeft');
            }
          } else if (player.grounded && wallJumps > 0 && player.y > 250) {
            // A missed kick dropped the hero; walk back to the left pillar and retry.
            target = -1;
            up('ArrowRight');
            down('ArrowLeft');
            jump();
          }
          lastContact = player.wallContact;
        }
        return { outcome: 'timeout', wallJumps, minY };
      } finally {
        for (const code of [...held]) up(code);
      }
    });

    expect(climb.outcome).toBe('arrived');
    expect(climb.wallJumps).toBeGreaterThanOrEqual(2);
    expect(climb.minY).toBeLessThan(100);
    const arrived = await debugState(page);
    expect(arrived.run.roomId).toBe('upper-gallery');
    expect(arrived.run.visitedRooms).toContain('wall-claw-shaft');
    expect(arrived.errors).toEqual([]);
  });

  test('both breakable walls open their secret rooms and persist', async ({ page }) => {
    await bootGame(page);

    await loadRoom(page, 'drowned-gallery', { x: 890, y: 320 });
    await page.keyboard.press('KeyX');
    await page.waitForFunction(
      () => window.__game?.debugState().run.brokenSecrets.includes('drowned-gallery') === true,
      undefined,
      { timeout: 10_000 },
    );
    const gallery = await debugState(page);
    expect(gallery.scene?.secretBroken).toBe(true);
    expect(gallery.save.lastWrite).toBe('reward');

    await page.keyboard.down('ArrowRight');
    await page.waitForFunction(
      () => window.__game?.debugState().scene?.roomId === 'ossuary',
      undefined,
      { timeout: 10_000 },
    );
    await page.keyboard.up('ArrowRight');
    expect((await debugState(page)).run.roomId).toBe('ossuary');

    await loadRoom(page, 'upper-gallery', { x: 890, y: 320 });
    await page.keyboard.press('KeyX');
    await page.waitForFunction(
      () => window.__game?.debugState().run.brokenSecrets.includes('upper-gallery') === true,
      undefined,
      { timeout: 10_000 },
    );
    expect((await debugState(page)).scene?.secretBroken).toBe(true);

    await page.keyboard.down('ArrowRight');
    await page.waitForFunction(
      () => window.__game?.debugState().scene?.roomId === 'reliquary',
      undefined,
      { timeout: 10_000 },
    );
    await page.keyboard.up('ArrowRight');
    expect((await debugState(page)).run.roomId).toBe('reliquary');

    // The two hidden rooms pay out their charms through the normal pickup path.
    await collectPickup(page, 'ossuary', { x: 496, y: 208 }, 'ossuary-light-step');
    await collectPickup(page, 'reliquary', { x: 496, y: 208 }, 'reliquary-long-reach');
    const rewarded = await debugState(page);
    expect(rewarded.run.brokenSecrets).toEqual(
      expect.arrayContaining(['drowned-gallery', 'upper-gallery']),
    );
    expect(rewarded.run.charmsOwned).toEqual(expect.arrayContaining(['lightStep', 'longReach']));

    await reloadGame(page);
    await loadRoom(page, 'drowned-gallery', { x: 80, y: 320 });
    expect((await debugState(page)).scene?.secretBroken).toBe(true);
    await loadRoom(page, 'upper-gallery', { x: 80, y: 320 });
    const resumed = await debugState(page);
    expect(resumed.scene?.secretBroken).toBe(true);
    expect(resumed.run.brokenSecrets).toEqual(
      expect.arrayContaining(['drowned-gallery', 'upper-gallery']),
    );
    expect(resumed.errors).toEqual([]);
  });

  test('the bench equips charms and tempers the nail durably', async ({ page }) => {
    await bootGame(page);
    await collectPickup(page, 'drowned-gallery', { x: 480, y: 208 }, 'gallery-quick-mend');
    await collectPickup(page, 'drowned-gallery', { x: 300, y: 256 }, 'gallery-shard-low');
    await collectPickup(page, 'drowned-gallery', { x: 680, y: 320 }, 'gallery-shard-high');
    await collectPickup(page, 'sunless-aqueduct', { x: 300, y: 256 }, 'aqueduct-shard-low');

    await loadRoom(page, 'belfry-terrace', { x: 590, y: 320 });
    await page.waitForFunction(
      () => window.__game?.debugState().scene?.bench?.inRange === true,
      undefined,
      { timeout: 5_000 },
    );
    await page.keyboard.press('KeyE');

    const bench = page.getByRole('dialog', { name: 'The Bench' });
    await expect(bench).toBeVisible();
    await expect(bench.locator('.bench-slots')).toContainText('35');
    const quickMend = bench.getByRole('button', { name: /Quick Mend/ });
    await expect(quickMend).toHaveAttribute('aria-pressed', 'true');
    const forgeButton = bench.getByRole('button', { name: /Temper the nail/ });
    const overflow = await bench.locator('.bench-forge-row').evaluate((row) => ({
      scroll: row.scrollWidth,
      client: row.clientWidth,
      forge: row.querySelector<HTMLElement>('.bench-forge-button')?.scrollWidth ?? 0,
      forgeClient: row.querySelector<HTMLElement>('.bench-forge-button')?.clientWidth ?? 0,
    }));
    expect(overflow.scroll).toBeLessThanOrEqual(overflow.client + 1);
    expect(overflow.forge).toBeLessThanOrEqual(overflow.forgeClient + 1);

    await forgeButton.click();
    await expect
      .poll(async () => {
        const state = await debugState(page);
        return `${state.run.nailLevel}:${state.run.shards}`;
      })
      .toBe('1:5');
    await expect(bench.getByRole('status')).toContainText('tempered to +1');
    expect((await debugState(page)).scene?.player.nailLevel).toBe(1);

    await quickMend.click();
    await expect.poll(async () => (await debugState(page)).run.charmsEquipped.length).toBe(0);
    await expect(quickMend).toHaveAttribute('aria-pressed', 'false');

    await bench.getByRole('button', { name: 'Leave the bench' }).click();
    await expect(bench).toBeHidden();
    await expect.poll(async () => (await debugState(page)).tickCount).toBeGreaterThan(0);

    await reloadGame(page);
    const resumed = await debugState(page);
    expect(resumed.run.nailLevel).toBe(1);
    expect(resumed.run.shards).toBe(5);
    expect(resumed.run.charmsEquipped).toEqual([]);
    expect(resumed.scene?.player.nailLevel).toBe(1);
    expect(resumed.run.checkpoint?.benchId).toBe('terrace-weeping-stone');
    expect(resumed.errors).toEqual([]);
  });

  test('a claimed arena relights as an Ordeal and pays its shards once', async ({ page }) => {
    await bootGame(page);
    await loadRoom(page, 'bellbearer-arena');
    const normal = await debugState(page);
    expect(normal.scene?.boss?.ordeal).toBe(false);
    const normalMaxHp = normal.scene?.boss?.maxHp ?? 0;
    expect(normalMaxHp).toBeGreaterThan(0);
    await page.evaluate(() => window.__game?.debugDefeatBoss());
    await page.waitForFunction(
      () =>
        window.__game?.debugState().run.sigils.includes('bellbearer') === true &&
        window.__game?.debugState().save.lastWrite === 'reward',
      undefined,
      { timeout: 15_000 },
    );

    await loadRoom(page, 'bellbearer-arena', { x: 860, y: 320 });
    await page.waitForFunction(() => window.__game?.debugState().scene?.boss === null, undefined, {
      timeout: 5_000,
    });
    await page.keyboard.press('KeyE');
    await page.waitForFunction(
      () => window.__game?.debugState().scene?.boss?.ordeal === true,
      undefined,
      { timeout: 10_000 },
    );
    const ordeal = await debugState(page);
    expect(ordeal.scene?.boss?.maxHp ?? 0).toBeGreaterThan(normalMaxHp);

    await page.evaluate(() => window.__game?.debugDefeatBoss());
    await page.waitForFunction(
      () =>
        window.__game?.debugState().run.ordeals.includes('bellbearer') === true &&
        window.__game?.debugState().run.shards === 40,
      undefined,
      { timeout: 15_000 },
    );
    const cleared = await debugState(page);
    expect(cleared.run.ordeals).toEqual(['bellbearer']);
    expect(cleared.run.shards).toBe(40);
    expect(cleared.save.lastWrite).toBe('reward');
    expect(cleared.errors).toEqual([]);
  });

  test('the Tide door needs its bell, then opens the ending exactly once', async ({ page }) => {
    await bootGame(page);
    await loadRoom(page, 'bellthief-arena');
    await page.evaluate(() => window.__game?.debugDefeatBoss());
    await page.waitForFunction(
      () =>
        window.__game?.debugState().run.sigils.includes('bellThief') === true &&
        window.__game?.debugState().save.lastWrite === 'reward',
      undefined,
      { timeout: 15_000 },
    );

    // Without the Tide-Bell the trigger is inert, even when a debug spawn stands behind it.
    await loadRoom(page, 'upper-gallery', { x: 600, y: 320 });
    const sealed = await debugState(page);
    expect(sealed.scene?.sealOpen).toBe(false);
    await page.waitForTimeout(400);
    await expect(page.locator('.ending-root')).toBeHidden();

    await collectPickup(page, 'bellthief-arena', { x: 660, y: 320 }, 'bellthief-sturdy-shell');
    await collectPickup(page, 'bellthief-arena', { x: 760, y: 320 }, 'bellthief-tide-bell');

    await loadRoom(page, 'upper-gallery', { x: 600, y: 320 });
    const ending = page.getByRole('dialog', { name: /the tide-bell answers/i });
    await expect(ending).toBeVisible();
    await expect(ending.locator('.ending-stats')).toContainText('1 / 3');
    await expect(ending.locator('.ending-stats')).toContainText('CHARMS');
    const completed = await debugState(page);
    expect(completed.run.tideDoorOpened).toBe(true);
    expect(completed.scene?.sealOpen).toBe(true);
    expect(completed.save.lastWrite).toBe('reward');

    const beforeClose = completed.tickCount;
    await ending.getByRole('button', { name: 'Return to the belfry' }).click();
    await expect(ending).toBeHidden();
    // The trigger is one-shot: standing in it after closing must not reopen the card.
    await page.waitForTimeout(500);
    await expect(ending).toBeHidden();
    await expect.poll(async () => (await debugState(page)).tickCount).toBeGreaterThan(beforeClose);

    await reloadGame(page);
    const resumed = await debugState(page);
    expect(resumed.run.tideDoorOpened).toBe(true);
    expect(resumed.scene?.sealOpen).toBe(true);
    await page.waitForTimeout(400);
    await expect(page.locator('.ending-root')).toBeHidden();
    expect(resumed.errors).toEqual([]);
  });
});
