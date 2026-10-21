import { expect, test } from '@playwright/test';
import { bootGame, closeBenchOverlay, debugState, loadRoom, reloadGame } from './support';

test.describe('M7 persistence and the region loop', () => {
  // Reloads re-decode the packed score under SwiftShader, so give these three flows headroom.
  test.describe.configure({ timeout: 90_000 });

  test('resting saves at the bench, the map charts the run and reload resumes there', async ({
    page,
  }, testInfo) => {
    await bootGame(page);

    const initial = await debugState(page);
    expect(initial.run.roomId).toBe('belfry-terrace');
    expect(initial.run.visitedRooms).toEqual(['belfry-terrace']);
    expect(initial.run.checkpoint).toBeNull();
    expect(initial.save).toMatchObject({ present: true, loaded: false, lastWrite: 'boot' });

    // Start inside the bench's interaction range. Walking there is covered by the room
    // traversal suite; this test owns the rest interaction, autosave and reload contract.
    await loadRoom(page, 'belfry-terrace', { x: 590, y: 320 });
    await page.waitForFunction(
      () => window.__game?.debugState().scene?.bench?.inRange === true,
      undefined,
      { timeout: 5_000 },
    );
    const nearBench = await debugState(page);
    expect(nearBench.scene?.bench).toMatchObject({
      id: 'terrace-weeping-stone',
      inRange: true,
    });
    await testInfo.attach('m7-bench.png', {
      body: await page.locator('canvas').screenshot(),
      contentType: 'image/png',
    });

    await page.keyboard.press('KeyE');
    await page.waitForFunction(
      () =>
        window.__game?.debugState().run.checkpoint?.benchId === 'terrace-weeping-stone' &&
        window.__game?.debugState().save.lastWrite === 'bench',
      undefined,
      { timeout: 15_000 },
    );

    const rested = await debugState(page);
    expect(rested.scene?.roomId).toBe('belfry-terrace');
    expect(rested.scene?.player.x).toBeCloseTo(566, 0);
    expect(rested.scene?.player.hp).toBe(rested.scene?.player.maxHp);
    expect(rested.run.checkpoint).toEqual({
      roomId: 'belfry-terrace',
      benchId: 'terrace-weeping-stone',
      name: 'The Weeping Stone',
    });
    expect(rested.save).toMatchObject({ present: true, lastWrite: 'bench' });
    await closeBenchOverlay(page);

    await page.keyboard.press('KeyM');
    const map = page.getByRole('dialog', { name: 'Region Map' });
    await expect(map).toBeVisible();
    const mapBox = await map.boundingBox();
    expect(mapBox).not.toBeNull();
    expect(mapBox?.y ?? -1).toBeGreaterThanOrEqual(0);
    expect((mapBox?.y ?? 0) + (mapBox?.height ?? 999)).toBeLessThanOrEqual(360);
    expect((mapBox?.x ?? 0) + (mapBox?.width ?? 999)).toBeLessThanOrEqual(640);
    await expect(map).toHaveAttribute('data-screen', 'map');
    await expect(map.locator('.menu-footer')).toContainText('Esc');
    await expect(map.locator('.menu-footer')).toContainText('M');
    await expect(map.locator('.map-node[data-state="current"]')).toHaveAttribute(
      'data-room-id',
      'belfry-terrace',
    );
    await expect(map.locator('.map-node[data-state="unknown"]')).toHaveCount(11);
    await expect(map.locator('.map-summary')).toContainText('1 / 12');
    await expect(map.locator('.map-summary')).toContainText('0 / 3');
    await expect(map.locator('.map-summary')).toContainText('The Weeping Stone');
    await expect(map.locator('.map-node[data-room-id="belfry-terrace"]')).toHaveAttribute(
      'aria-current',
      'location',
    );

    const frozen = await debugState(page);
    expect(frozen.menu.screen).toBe('map');
    await page.waitForTimeout(250);
    expect((await debugState(page)).tickCount).toBe(frozen.tickCount);
    await testInfo.attach('m7-map.png', {
      body: await page.screenshot(),
      contentType: 'image/png',
    });

    await page.keyboard.press('KeyM');
    await expect(map).toBeHidden();
    await expect
      .poll(async () => (await debugState(page)).tickCount)
      .toBeGreaterThan(frozen.tickCount);

    // The pause flow's Map entry and Back control close straight back to the run.
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog', { name: 'Paused' })).toBeVisible();
    await page.getByRole('button', { name: 'Map', exact: true }).click();
    await expect(map).toBeVisible();
    expect((await debugState(page)).menu.focus).toBe('screen:back');
    await page.getByRole('button', { name: 'Back', exact: true }).click();
    await expect(map).toBeHidden();
    await expect
      .poll(async () => (await debugState(page)).tickCount)
      .toBeGreaterThan(frozen.tickCount);

    await reloadGame(page);
    const resumed = await debugState(page);
    expect(resumed.run.roomId).toBe('belfry-terrace');
    expect(resumed.run.checkpoint).toEqual(rested.run.checkpoint);
    expect(resumed.run.visitedRooms).toEqual(['belfry-terrace']);
    expect(resumed.scene?.player.x).toBeCloseTo(566, 0);
    expect(resumed.scene?.player.hp).toBe(rested.scene?.player.hp);
    expect(resumed.save).toMatchObject({ present: true, loaded: true, lastWrite: null });
    expect(resumed.errors).toEqual([]);
  });

  test('death returns the run to the last bench, not the room that killed it', async ({
    page,
  }, testInfo) => {
    await bootGame(page);
    await loadRoom(page, 'belfry-antechamber');
    await page.waitForFunction(
      () => window.__game?.debugState().scene?.bench?.inRange === true,
      undefined,
      { timeout: 5_000 },
    );
    await page.keyboard.press('KeyE');
    await page.waitForFunction(
      () => window.__game?.debugState().run.checkpoint?.benchId === 'nave-bell-keepers-rest',
      undefined,
      { timeout: 15_000 },
    );
    await closeBenchOverlay(page);

    // Leave the checkpoint room so the respawn target is distinct from the death room.
    await loadRoom(page, 'belfry-terrace');
    await page.waitForFunction(
      () => (window.__game?.debugState().scene?.player.invulnerableTicks ?? 0) === 0,
      undefined,
      { timeout: 15_000 },
    );

    const killed = await page.evaluate(() => window.__game?.debugKillPlayer() ?? false);
    expect(killed).toBe(true);
    await page.waitForFunction(
      () => {
        const state = window.__game?.debugState();
        return (
          state?.run.roomId === 'belfry-antechamber' &&
          state.save.lastWrite === 'respawn' &&
          state.scene?.player.dead === false
        );
      },
      undefined,
      { timeout: 30_000 },
    );

    const respawned = await debugState(page);
    expect(respawned.scene?.roomId).toBe('belfry-antechamber');
    expect(respawned.scene?.player.x).toBeCloseTo(64, 0);
    expect(respawned.scene?.player.hp).toBe(respawned.scene?.player.maxHp);
    expect(respawned.run.checkpoint?.benchId).toBe('nave-bell-keepers-rest');
    expect(respawned.save.lastWrite).toBe('respawn');
    await testInfo.attach('m7-respawn.png', {
      body: await page.locator('canvas').screenshot(),
      contentType: 'image/png',
    });

    await reloadGame(page);
    const resumed = await debugState(page);
    expect(resumed.scene?.roomId).toBe('belfry-antechamber');
    expect(resumed.scene?.player.x).toBeCloseTo(64, 0);
    expect(resumed.save).toMatchObject({ present: true, loaded: true, lastWrite: null });
  });

  test('a claimed sigil and its extra mask survive a reload and silence the arena', async ({
    page,
  }, testInfo) => {
    await bootGame(page);
    await loadRoom(page, 'bellbearer-arena');
    await page.evaluate(() => window.__game?.debugDefeatBoss());
    await page.waitForFunction(
      () => {
        const state = window.__game?.debugState();
        return (
          state?.run.sigils.includes('bellbearer') === true &&
          state.scene?.player.maxHp === 6 &&
          state.save.lastWrite === 'reward'
        );
      },
      undefined,
      { timeout: 15_000 },
    );

    const rewarded = await debugState(page);
    expect(rewarded.run.sigils).toEqual(['bellbearer']);
    expect(rewarded.run.maxHp).toBe(6);
    expect(rewarded.scene?.player.maxHp).toBe(6);
    // The extra mask is granted mid-fight; the reward heals one, it does not reset the run.
    expect(rewarded.scene?.player.hp).toBeGreaterThan(0);
    expect(rewarded.scene?.player.hp).toBeLessThanOrEqual(6);
    expect(rewarded.save).toMatchObject({ present: true, lastWrite: 'reward' });

    await reloadGame(page);
    const resumed = await debugState(page);
    expect(resumed.run.roomId).toBe('bellbearer-arena');
    expect(resumed.run.sigils).toEqual(['bellbearer']);
    expect(resumed.run.maxHp).toBe(6);
    expect(resumed.scene?.player.maxHp).toBe(6);
    expect(resumed.scene?.boss).toBeNull();
    expect(resumed.scene?.exitLocked).toBe(false);
    expect(resumed.save).toMatchObject({ present: true, loaded: true });

    await loadRoom(page, 'belfry-antechamber');
    await page.keyboard.press('KeyM');
    const map = page.getByRole('dialog', { name: 'Region Map' });
    await expect(map).toBeVisible();
    await expect(map.locator('.map-summary')).toContainText('3 / 12');
    await expect(map.locator('.map-summary')).toContainText('1 / 3');
    await expect(map.locator('.map-node[data-room-id="bellbearer-arena"]')).toHaveAttribute(
      'data-state',
      'visited',
    );
    await expect(map.locator('.map-node[data-room-id="bellbearer-arena"]')).toContainText(
      'Sigil claimed',
    );
    await testInfo.attach('m7-sigil-map.png', {
      body: await page.screenshot(),
      contentType: 'image/png',
    });
    expect((await debugState(page)).errors).toEqual([]);
  });
});
