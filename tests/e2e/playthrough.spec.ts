import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { bootGame, closeBenchOverlay, debugState, loadRoom, reloadGame } from './support';

type StandingPoint = { readonly x: number; readonly y: number };

const PICKUPS: readonly {
  readonly roomId: string;
  readonly spawn: StandingPoint;
  readonly id: string;
}[] = [
  { roomId: 'drowned-gallery', spawn: { x: 300, y: 256 }, id: 'gallery-shard-low' },
  { roomId: 'drowned-gallery', spawn: { x: 680, y: 320 }, id: 'gallery-shard-high' },
  { roomId: 'drowned-gallery', spawn: { x: 480, y: 208 }, id: 'gallery-quick-mend' },
  { roomId: 'drowned-gallery', spawn: { x: 840, y: 208 }, id: 'gallery-health-shard' },
  { roomId: 'ossuary', spawn: { x: 496, y: 208 }, id: 'ossuary-light-step' },
  { roomId: 'ossuary', spawn: { x: 760, y: 320 }, id: 'ossuary-shard' },
  { roomId: 'ossuary', spawn: { x: 340, y: 256 }, id: 'ossuary-health-shard' },
  { roomId: 'sunless-aqueduct', spawn: { x: 480, y: 208 }, id: 'aqueduct-wall-claw' },
  { roomId: 'sunless-aqueduct', spawn: { x: 300, y: 256 }, id: 'aqueduct-shard-low' },
  { roomId: 'sunless-aqueduct', spawn: { x: 800, y: 208 }, id: 'aqueduct-shard-high' },
  { roomId: 'sunless-aqueduct', spawn: { x: 680, y: 256 }, id: 'aqueduct-ember-greed' },
  { roomId: 'sunless-aqueduct', spawn: { x: 440, y: 208 }, id: 'aqueduct-health-shard' },
  { roomId: 'bellows', spawn: { x: 660, y: 256 }, id: 'bellows-shard-low' },
  { roomId: 'bellows', spawn: { x: 840, y: 208 }, id: 'bellows-shard-high' },
  { roomId: 'wall-claw-shaft', spawn: { x: 456, y: 320 }, id: 'shaft-shard' },
  { roomId: 'upper-gallery', spawn: { x: 300, y: 256 }, id: 'upper-shard-low' },
  { roomId: 'upper-gallery', spawn: { x: 820, y: 208 }, id: 'upper-shard-high' },
  { roomId: 'reliquary', spawn: { x: 496, y: 208 }, id: 'reliquary-long-reach' },
  { roomId: 'reliquary', spawn: { x: 340, y: 256 }, id: 'reliquary-health-shard' },
  { roomId: 'reliquary', spawn: { x: 760, y: 320 }, id: 'reliquary-shard' },
];

const KEYED_PICKUPS: readonly {
  readonly roomId: string;
  readonly spawn: StandingPoint;
  readonly id: string;
}[] = [
  {
    roomId: 'bellthief-arena',
    spawn: { x: 660, y: 320 },
    id: 'bellthief-sturdy-shell',
  },
  { roomId: 'bellthief-arena', spawn: { x: 760, y: 320 }, id: 'bellthief-tide-bell' },
];

async function collect(
  page: Page,
  roomId: string,
  spawn: StandingPoint,
  id: string,
): Promise<void> {
  await loadRoom(page, roomId, spawn);
  await page.evaluate(() => window.__game?.debugProtectPlayer());
  await page.waitForFunction(
    (pickupId) => window.__game?.debugState().run.pickups.includes(pickupId) === true,
    id,
    { timeout: 10_000 },
  );
}

async function breakSecret(page: Page, roomId: string): Promise<void> {
  await loadRoom(page, roomId, { x: 890, y: 320 });
  await page.evaluate(() => window.__game?.debugProtectPlayer());
  await page.keyboard.press('KeyX');
  await page.waitForFunction(
    (secretRoomId) => window.__game?.debugState().run.brokenSecrets.includes(secretRoomId) === true,
    roomId,
    { timeout: 10_000 },
  );
}

async function clearBoss(page: Page, roomId: string, kind: string): Promise<void> {
  await loadRoom(page, roomId);
  await page.evaluate(() => window.__game?.debugProtectPlayer());
  await page.evaluate(() => window.__game?.debugDefeatBoss());
  await page.waitForFunction(
    (bossKind) =>
      window.__game?.debugState().run.sigils.some((sigil) => sigil === bossKind) === true &&
      window.__game?.debugState().save.lastWrite === 'reward',
    kind,
    { timeout: 15_000 },
  );
}

async function clearOrdeal(
  page: Page,
  roomId: string,
  spawn: StandingPoint,
  kind: string,
  expectedShards: number,
): Promise<void> {
  await loadRoom(page, roomId, spawn);
  await page.evaluate(() => window.__game?.debugProtectPlayer());
  await page.waitForFunction(() => window.__game?.debugState().scene?.boss === null, undefined, {
    timeout: 5_000,
  });
  await page.keyboard.press('KeyE');
  await page.waitForFunction(
    () => window.__game?.debugState().scene?.boss?.ordeal === true,
    undefined,
    { timeout: 10_000 },
  );
  await page.evaluate(() => window.__game?.debugProtectPlayer());
  await page.evaluate(() => window.__game?.debugDefeatBoss());
  await page.waitForFunction(
    ({ bossKind, shards }) => {
      const run = window.__game?.debugState().run;
      return run?.ordeals.some((ordeal) => ordeal === bossKind) === true && run.shards === shards;
    },
    { bossKind: kind, shards: expectedShards },
    { timeout: 15_000 },
  );
}

/**
 * The milestone playthrough. It uses the DEV room loader to skip locomotion between
 * authored encounters (movement and transitions have their own suites) while every
 * reward, secret, boss, bench purchase and the ending travel the real simulation,
 * save and DOM paths. One continuous run must be able to finish all 12 rooms.
 */
test.describe('M8 complete playthrough', () => {
  test.describe.configure({ timeout: 360_000 });

  test('one run clears all rooms, pickups, secrets, bosses, Ordeals and the ending', async ({
    page,
  }) => {
    await bootGame(page);

    for (const pickup of PICKUPS) {
      await collect(page, pickup.roomId, pickup.spawn, pickup.id);
    }
    await breakSecret(page, 'drowned-gallery');
    await breakSecret(page, 'upper-gallery');

    await clearBoss(page, 'bellbearer-arena', 'bellbearer');
    await clearBoss(page, 'warden-arena', 'wardenMoss');
    await clearBoss(page, 'bellthief-arena', 'bellThief');
    await collect(page, 'bellthief-arena', { x: 660, y: 320 }, 'bellthief-sturdy-shell');
    await collect(page, 'bellthief-arena', { x: 760, y: 320 }, 'bellthief-tide-bell');
    await loadRoom(page, 'belfry-antechamber', { x: 80, y: 320 });

    await clearOrdeal(page, 'bellbearer-arena', { x: 860, y: 320 }, 'bellbearer', 235);
    await clearOrdeal(page, 'warden-arena', { x: 840, y: 320 }, 'wardenMoss', 275);
    await clearOrdeal(page, 'bellthief-arena', { x: 860, y: 320 }, 'bellThief', 315);

    // Rest at the terrace bench and spend the run's shards on both nail levels.
    await loadRoom(page, 'belfry-terrace', { x: 590, y: 320 });
    await page.waitForFunction(
      () => window.__game?.debugState().scene?.bench?.inRange === true,
      undefined,
      { timeout: 5_000 },
    );
    await page.keyboard.press('KeyE');
    const bench = page.getByRole('dialog', { name: 'The Bench' });
    await expect(bench).toBeVisible();
    const forge = bench.getByRole('button', { name: /Temper the nail/ });
    await forge.click();
    await page.waitForFunction(() => window.__game?.debugState().run.nailLevel === 1, undefined, {
      timeout: 5_000,
    });
    await forge.click();
    await page.waitForFunction(
      () =>
        window.__game?.debugState().run.nailLevel === 2 &&
        window.__game?.debugState().run.shards === 225,
      undefined,
      { timeout: 5_000 },
    );
    await closeBenchOverlay(page);

    // The Tide-Bell opens the sealed door; the ending card must appear once.
    await loadRoom(page, 'upper-gallery', { x: 600, y: 320 });
    const ending = page.getByRole('dialog', { name: /the bell remembers/i });
    await expect(ending).toBeVisible();
    const statValues = ending.locator('.ending-stat-value');
    await expect(statValues.nth(0)).toHaveText('3 / 3');
    await expect(statValues.nth(1)).toHaveText('225');
    await expect(statValues.nth(2)).toHaveText('5');
    await ending.getByRole('button', { name: 'Return to the belfry' }).click();
    await expect(ending).toBeHidden();

    const completed = await debugState(page);
    expect(completed.run.visitedRooms).toHaveLength(12);
    expect(completed.run.pickups).toEqual(
      [...PICKUPS, ...KEYED_PICKUPS].map((pickup) => pickup.id).sort(),
    );
    expect(completed.run.brokenSecrets).toEqual(['drowned-gallery', 'upper-gallery']);
    expect(completed.run.sigils).toEqual(['bellbearer', 'wardenMoss', 'bellThief']);
    expect(completed.run.ordeals).toEqual(['bellbearer', 'wardenMoss', 'bellThief']);
    expect(completed.run.healthShards).toBe(4);
    expect(completed.run.maxHp).toBe(9);
    expect(completed.run.charmsOwned).toEqual([
      'quickMend',
      'longReach',
      'lightStep',
      'emberGreed',
      'sturdyShell',
    ]);
    expect(completed.run.charmsEquipped).toEqual(['quickMend', 'lightStep', 'emberGreed']);
    expect(completed.run.nailLevel).toBe(2);
    expect(completed.run.shards).toBe(225);
    expect(completed.run.checkpoint?.benchId).toBe('terrace-weeping-stone');
    expect(completed.run.sliceComplete).toBe(true);
    expect(completed.save.lastWrite).toBe('reward');
    expect(completed.errors).toEqual([]);

    await expect
      .poll(async () => (await debugState(page)).tickCount)
      .toBeGreaterThan(completed.tickCount);
    await page.keyboard.press('KeyM');
    const map = page.getByRole('dialog', { name: 'Region Map' });
    await expect(map).toBeVisible();
    await expect(map.locator('.map-summary')).toContainText('12 / 12');
    await expect(map.locator('.map-summary')).toContainText('3 / 3');
    await expect(map.locator('.map-node[data-state="unknown"]')).toHaveCount(0);
    await page.keyboard.press('KeyM');
    await expect(map).toBeHidden();

    await reloadGame(page);
    const resumed = await debugState(page);
    expect(resumed.run.visitedRooms).toHaveLength(12);
    expect(resumed.run.pickups).toHaveLength(22);
    expect(resumed.run.sigils).toHaveLength(3);
    expect(resumed.run.ordeals).toHaveLength(3);
    expect(resumed.run.maxHp).toBe(9);
    expect(resumed.run.nailLevel).toBe(2);
    expect(resumed.run.shards).toBe(225);
    expect(resumed.run.sliceComplete).toBe(true);
    expect(resumed.save).toMatchObject({ present: true, loaded: true });
    await page.waitForTimeout(400);
    await expect(page.locator('.ending-root')).toBeHidden();
    expect(resumed.errors).toEqual([]);
  });
});
