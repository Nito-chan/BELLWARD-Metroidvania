import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import type { SceneBossDebugState } from '../../src/debug/DebugState';
import { bootGame, debugState, loadRoom, waitForBossIdle, walkLeftToRoom } from './support';

type BossCondition = Partial<SceneBossDebugState> & { minTelegraph?: number };

/** Waits for named boss fields without serializing a closure into the page. */
async function waitForBoss(page: Page, condition: BossCondition, timeout = 15_000): Promise<void> {
  await page.waitForFunction(
    (expected) => {
      const boss = window.__game?.debugState().scene?.boss;
      if (!boss) return false;
      if (expected.phase !== undefined && boss.phase !== expected.phase) return false;
      if (expected.hp !== undefined && boss.hp !== expected.hp) return false;
      if (expected.warded !== undefined && boss.warded !== expected.warded) return false;
      if (expected.alive !== undefined && boss.alive !== expected.alive) return false;
      if (expected.state !== undefined && boss.state !== expected.state) return false;
      if (expected.phaseName !== undefined && boss.phaseName !== expected.phaseName) return false;
      if (expected.phaseCount !== undefined && boss.phaseCount !== expected.phaseCount) {
        return false;
      }
      if (expected.minTelegraph !== undefined && boss.telegraph < expected.minTelegraph) {
        return false;
      }
      return true;
    },
    condition,
    { timeout },
  );
}

test.describe('M6 bell bosses', () => {
  test.describe.configure({ timeout: 90_000 });

  test('the bell nave opens all three arenas', async ({ page }) => {
    await bootGame(page);
    await loadRoom(page, 'belfry-antechamber');
    const nave = await debugState(page);
    expect(nave.scene?.roomName).toBe('The Bell Nave');
    expect(nave.scene?.enemies).toEqual([]);
    expect(nave.scene?.boss).toBeNull();
    expect(nave.scene?.player.hp).toBe(5);
    expect(nave.run.sigils).toEqual([]);

    const expected = [
      ['bellbearer-arena', 'bellbearer', 'bossAbyss'],
      ['warden-arena', 'wardenMoss', 'bossCitadel'],
      ['bellthief-arena', 'bellThief', 'bossCitadel'],
    ] as const;
    for (const [roomId, kind, music] of expected) {
      await loadRoom(page, roomId);
      const state = await debugState(page);
      expect(state.scene?.roomName.length).toBeGreaterThan(0);
      expect(state.scene?.boss?.kind).toBe(kind);
      expect(state.scene?.boss?.alive).toBe(true);
      expect(state.scene?.boss?.phase).toBe(0);
      expect(state.audio.music).toBe(music);
      expect(state.scene?.player.maxHp).toBe(5);
      expect(state.errors).toEqual([]);
    }
  });

  test('the Bellbearer shield gates damage, pays a sigil and opens its door', async ({
    page,
  }, testInfo) => {
    await bootGame(page);
    await loadRoom(page, 'bellbearer-arena');
    expect(await page.evaluate(() => window.__game?.debugProtectPlayer())).toBe(true);
    await waitForBossIdle(page);

    const gate = await page.evaluate(() => ({
      blocked: window.__game?.debugDamageBoss(99),
      state: window.__game?.debugState().scene?.boss,
      exitLocked: window.__game?.debugState().scene?.exitLocked,
    }));
    expect(gate.blocked).toBe(false);
    expect(gate.state?.warded).toBe(true);
    expect(gate.state?.hp).toBe(16);
    expect(gate.state?.phaseCount).toBe(2);
    expect(gate.exitLocked).toBe(true);

    const broken = await page.evaluate(() => window.__game?.debugBreakWard());
    expect(broken).toBe(true);
    await waitForBoss(page, { warded: false, phase: 1 });
    const stagger = await debugState(page);
    expect(stagger.scene?.boss?.phaseName).toBe('The Ringing');
    // The 45-tick stagger can end between waitForFunction and this snapshot; the unit
    // suite asserts the exact hold duration, while this checks the gate result.
    expect(stagger.scene?.boss?.warded).toBe(false);

    // The shield break starts a stagger and, under a slow SwiftShader frame, the boss can
    // already be in its next phase/idle window by the time this IPC lands. Retry the real
    // damage path until it sticks instead of asserting one instantaneous call.
    await page.waitForFunction(
      () => {
        const game = window.__game;
        const boss = game?.debugState().scene?.boss;
        if (!game || !boss) return false;
        if (boss.hp === 14) return true;
        if (!boss.alive || boss.warded || boss.phase !== 1) return false;
        game.debugDamageBoss(2);
        return game.debugState().scene?.boss?.hp === 14;
      },
      undefined,
      { timeout: 15_000 },
    );
    await testInfo.attach('m6-bellbearer.png', {
      body: await page.locator('canvas').screenshot(),
      contentType: 'image/png',
    });

    await page.evaluate(() => window.__game?.debugDefeatBoss());
    await waitForBoss(page, { alive: false });
    await page.waitForFunction(
      () => {
        const state = window.__game?.debugState();
        return (
          state?.run.sigils.includes('bellbearer') === true &&
          state.scene?.player.maxHp === 6 &&
          state.scene?.exitLocked === false
        );
      },
      undefined,
      { timeout: 15_000 },
    );

    // The exit is locked while the boss lives; after the kill it must actually walk.
    const entered = await walkLeftToRoom(page, 'belfry-antechamber');
    expect(entered).toBe('belfry-antechamber');
    const returned = await debugState(page);
    expect(returned.scene?.roomId).toBe('belfry-antechamber');
    expect(returned.scene?.player.maxHp).toBe(6);
    expect(returned.run.sigils).toContain('bellbearer');
    expect(returned.errors).toEqual([]);

    // A claimed boss stays dead for the run, so its arena is silent on re-entry.
    await loadRoom(page, 'bellbearer-arena');
    const silent = await debugState(page);
    expect(silent.scene?.boss).toBeNull();
    expect(silent.scene?.exitLocked).toBe(false);
    expect(silent.scene?.player.maxHp).toBe(6);
    expect(silent.run.sigils).toEqual(['bellbearer']);
  });

  test('Warden Moss crosses its phase threshold and telegraphs the overgrowth', async ({
    page,
  }, testInfo) => {
    await bootGame(page);
    await loadRoom(page, 'warden-arena');
    expect(await page.evaluate(() => window.__game?.debugProtectPlayer())).toBe(true);
    await waitForBossIdle(page);

    const hits = await page.evaluate(() => [
      window.__game?.debugDamageBoss(8),
      window.__game?.debugDamageBoss(5),
    ]);
    expect(hits).toEqual([true, true]);
    await waitForBoss(page, { phase: 1 });
    const transition = await debugState(page);
    expect(transition.scene?.boss?.phaseName).toBe('The Overgrowth');
    expect(transition.scene?.boss?.hp).toBe(13);
    // The phase banner and boss HUD persist for ~2 s, unlike a single telegraph frame.
    await testInfo.attach('m6-warden.png', {
      body: await page.locator('canvas').screenshot(),
      contentType: 'image/png',
    });

    // The phase pause is short; by the time Playwright observes it the boss may be back
    // in idle or already winding up. The unit suite asserts the exact FSM hold.
    await waitForBoss(page, { state: 'idle' });
    // Observe the wind-up and snapshot it in one page task. A waitForFunction followed by
    // a separate debugState call can straddle the end of the tell under IPC latency.
    const telling = await page.evaluate(async () => {
      const deadline = performance.now() + 15_000;
      while (performance.now() < deadline) {
        const boss = window.__game?.debugState().scene?.boss;
        if (boss?.state === 'windup' && boss.telegraph > 0.15) {
          return { pattern: boss.pattern, state: boss.state, telegraph: boss.telegraph };
        }
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      }
      return null;
    });
    expect(telling).not.toBeNull();
    expect(telling?.pattern).not.toBeNull();
    expect(telling?.state).toBe('windup');
    expect(telling?.telegraph).toBeGreaterThan(0.15);
    const afterTell = await debugState(page);
    expect(afterTell.errors).toEqual([]);
  });

  test('the Bell Thief reaches its final phase', async ({ page }) => {
    await bootGame(page);
    await loadRoom(page, 'bellthief-arena');
    expect(await page.evaluate(() => window.__game?.debugProtectPlayer())).toBe(true);
    await waitForBossIdle(page);

    expect(await page.evaluate(() => window.__game?.debugDamageBoss(14))).toBe(true);
    await waitForBoss(page, { phase: 1 });
    await waitForBoss(page, { state: 'idle' });

    expect(await page.evaluate(() => window.__game?.debugDamageBoss(10))).toBe(true);
    const middle = await debugState(page);
    expect(middle.scene?.boss?.phase).toBe(1);
    expect(middle.scene?.boss?.hp).toBe(8);
    expect(await page.evaluate(() => window.__game?.debugDamageBoss(1))).toBe(true);
    await waitForBoss(page, { phase: 2 });
    const final = await debugState(page);
    expect(final.scene?.boss?.phaseCount).toBe(3);
    expect(final.scene?.boss?.phaseName).toBe('The Last Silence');
    expect(final.errors).toEqual([]);
  });
});

test.describe('M6 boss audio', () => {
  test.describe.configure({ timeout: 120_000 });

  test('the Warden arena requests and plays its boss loop', async ({ page }) => {
    await bootGame(page);
    await page.waitForFunction(
      () => window.__game?.debugState().audio.context === 'running',
      undefined,
      { timeout: 30_000 },
    );
    await loadRoom(page, 'warden-arena');
    await page.waitForFunction(
      () => window.__game?.debugState().audio.music === 'bossCitadel',
      undefined,
      { timeout: 15_000 },
    );
    try {
      await page.waitForFunction(
        () => window.__game?.debugState().audio.musicPlaying === true,
        undefined,
        { timeout: 45_000 },
      );
    } catch (error) {
      const audio = await page.evaluate(() => window.__game?.debugState().audio);
      throw new Error(`boss loop never became live: ${JSON.stringify(audio)}`, { cause: error });
    }
    const state = await debugState(page);
    expect(state.audio.music).toBe('bossCitadel');
    expect(state.audio.musicPlaying).toBe(true);
    expect(state.audio.failed).toEqual([]);
    expect(state.errors).toEqual([]);
  });
});
