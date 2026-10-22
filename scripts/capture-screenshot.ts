/**
 * Saves a game frame as a PNG into docs/screenshots/.
 *
 * Usage:
 *   1. npm run dev                 (in another terminal — this script does not start servers)
 *   2. npm run screenshot          (default: docs/screenshots/current.png)
 *      npm run screenshot -- docs/screenshots/M0-boot.png
 *      npm run screenshot -- docs/screenshots/M2-terrace.png --run   (hero running right)
 *      npm run screenshot -- docs/screenshots/M3-audio.png --run --overlay
 *      npm run screenshot -- docs/screenshots/M4-combat.png --combat  (mid-fight frame)
 *      npm run screenshot -- docs/screenshots/M5-pause.png --menu      (pause overlay)
 *      npm run screenshot -- docs/screenshots/M5-bindings.png --controls
 *      npm run screenshot -- docs/screenshots/M5-sound.png --settings
 *      (--overlay presses F1 and captures the whole page, so the DOM debug panel shows)
 *      (--menu opens the pause overlay and captures the whole page)
 *      (--controls opens the pause overlay, then the bindings screen)
 *      (--settings opens the pause overlay, then the sound screen)
 *      (--small captures any menu screen at the 640x360 E2E viewport)
 *      (--viewport=375x667 overrides the capture viewport for responsive QA)
 *      (--title captures the boot title card; add --saved for a real saved-run title)
 *      (--onboarding starts a fresh run and captures the first-run hints)
 *      (--touch emulates a touch device, starts play and captures the on-screen controls)
 *      (--bench rests at the terrace and captures the bench equipment overlay)
 *      (--ending opens the Tide-door ending with one sigil and two charms)
 *      (--map charts every room, rests at the nave, claims one sigil, then captures the map)
 *      (--combat walks into the nearest parishioner and shoots on the first impact)
 *      (--boss loads a boss arena through the debug handle; --boss-room=<id> selects it)
 *      (--boss-phase captures a phase banner after crossing the threshold; add --boss-room=<id>)
 *      (boss shots freeze via the pause flow so slow capture cannot lose the tell)
 *
 * Depends on the DEV-only `window.__game` handle, hence the dev server. Uses the same
 * software-WebGL flags and native viewport as the E2E suite so frames match CI captures.
 */
import { mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { chromium } from '@playwright/test';

const url = process.env.GAME_URL ?? 'http://localhost:5173';
const args = process.argv.slice(2);
const runShot = args.includes('--run');
const overlayShot = args.includes('--overlay');
const combatShot = args.includes('--combat');
const bossShot =
  args.includes('--boss') ||
  args.includes('--boss-phase') ||
  args.some((value) => value.startsWith('--boss-room='));
const bossPhaseShot = args.includes('--boss-phase');
const bossRoom =
  args.find((value) => value.startsWith('--boss-room='))?.slice('--boss-room='.length) ??
  (bossPhaseShot ? 'warden-arena' : 'bellbearer-arena');
const menuShot =
  args.includes('--menu') || args.includes('--controls') || args.includes('--settings');
const controlsShot = args.includes('--controls');
const settingsShot = args.includes('--settings');
const benchShot = args.includes('--bench');
const endingShot = args.includes('--ending');
const mapShot = args.includes('--map');
const titleShot = args.includes('--title');
const onboardingShot = args.includes('--onboarding');
const touchShot = args.includes('--touch');
/** Menus and the chart are normally captured at 1280x720; --small checks the 640x360 view. */
const smallShot = args.includes('--small');
const savedShot = args.includes('--saved');
const viewportArg = args
  .find((value) => value.startsWith('--viewport='))
  ?.slice('--viewport='.length);

function parseViewport(value: string | undefined): { width: number; height: number } | null {
  if (!value) return null;
  const match = /^(\d+)x(\d+)$/.exec(value);
  if (!match) return null;
  const width = Number(match[1]);
  const height = Number(match[2]);
  return width > 0 && height > 0 ? { width, height } : null;
}

const customViewport = parseViewport(viewportArg);
const pageShot =
  overlayShot ||
  menuShot ||
  mapShot ||
  titleShot ||
  onboardingShot ||
  touchShot ||
  benchShot ||
  endingShot;
const outputPath = resolve(
  args.find((value) => !value.startsWith('--')) ?? 'docs/screenshots/current.png',
);
const settleMs = 1200;

async function main(): Promise<void> {
  const browser = await chromium.launch({ args: ['--enable-unsafe-swiftshader'] });
  try {
    const page = await browser.newPage({
      viewport:
        customViewport ??
        (touchShot
          ? { width: 844, height: 390 }
          : pageShot && !smallShot
            ? { width: 1280, height: 720 }
            : { width: 640, height: 360 }),
      hasTouch: touchShot,
    });
    const response = await page.goto(url).catch(() => null);
    if (!response || !response.ok()) {
      throw new Error(`could not reach ${url} — start the dev server first (npm run dev)`);
    }
    await page.waitForFunction(() => window.__game?.debugState().ready === true, undefined, {
      timeout: 15_000,
    });
    // Boot owns the title card. Gameplay and menu captures begin through the real
    // primary action so the shot reflects the shipped start flow. A saved title
    // starts once, enters a room so the run is written, then reloads to the card.
    if (titleShot && savedShot) {
      await page.locator('[data-testid="title-root"] [data-action="primary"]').click();
      await page.waitForFunction(
        () =>
          window.__game?.debugState().title.open === false &&
          (window.__game?.debugState().tickCount ?? 0) > 0,
        undefined,
        { timeout: 15_000 },
      );
      await page.evaluate(() => window.__game?.debugLoadRoom('belfry-terrace', { x: 590, y: 320 }));
      await page.waitForFunction(
        () => window.__game?.debugState().scene?.roomId === 'belfry-terrace',
        undefined,
        { timeout: 10_000 },
      );
      await page
        .waitForFunction(
          () => {
            const save = window.__game?.debugState().save;
            return save !== null && save !== undefined && save.lastWrite !== undefined;
          },
          undefined,
          { timeout: 10_000 },
        )
        .catch(() => console.warn('screenshot: run did not report a save before reload'));
      await page.reload();
      await page.waitForFunction(() => window.__game?.debugState().ready === true, undefined, {
        timeout: 15_000,
      });
    } else if (!titleShot) {
      await page.locator('[data-testid="title-root"] [data-action="primary"]').click();
      await page.waitForFunction(
        () =>
          window.__game?.debugState().title.open === false &&
          (window.__game?.debugState().tickCount ?? 0) > 0,
        undefined,
        { timeout: 15_000 },
      );
    }
    if (!titleShot && !onboardingShot) {
      await page
        .locator('[data-testid="onboarding-root"] .onboarding-dismiss')
        .click({ timeout: 2_000 })
        .catch(() => undefined);
    }
    // The run shot drives real input so the frame shows the player controller, not a pose.
    // The title's start click already supplied the audio gesture; the arrow adds motion.
    if (runShot || overlayShot) await page.keyboard.down('ArrowRight');
    if (overlayShot) await page.keyboard.press('F1');
    // A diagnostics shot should show a live audio path, not a context still starting
    // up (browsers only start audio after the gesture above, and can take seconds).
    if (overlayShot) {
      await page
        .waitForFunction(
          () => {
            const audio = window.__game?.debugState().audio;
            return audio?.context === 'running' && audio.musicPlaying;
          },
          undefined,
          { timeout: 20_000 },
        )
        .catch(() => console.warn('screenshot: audio never reported a live, playing path'));
      // Waiting for audio can take seconds, by which time the hero has reached the dais
      // step. Turn around so the captured frame shows him mid-stride on open walkway.
      if (runShot) {
        await page.keyboard.up('ArrowRight');
        await page.keyboard.down('ArrowLeft');
      }
    }
    if (bossShot) {
      await page.evaluate((roomId) => window.__game?.debugLoadRoom(roomId), bossRoom);
      await page.waitForFunction(
        (roomId) => window.__game?.debugState().scene?.roomId === roomId,
        bossRoom,
        { timeout: 15_000 },
      );
      await page.waitForFunction(
        () => {
          const state = window.__game?.debugState().scene?.boss?.state;
          return state !== undefined && state !== 'intro';
        },
        undefined,
        { timeout: 10_000 },
      );
      if (bossPhaseShot) {
        await page.waitForFunction(
          () => window.__game?.debugState().scene?.boss?.state === 'idle',
          undefined,
          { timeout: 10_000 },
        );
        await page.evaluate(() => {
          window.__game?.debugDamageBoss(8);
          window.__game?.debugDamageBoss(7);
        });
        await page.waitForFunction(
          () => window.__game?.debugState().scene?.boss?.phase === 1,
          undefined,
          { timeout: 5_000 },
        );
      } else {
        // Capture the first readable wind-up, while the boss is still on its spawn mark.
        await page.waitForFunction(
          () => {
            const boss = window.__game?.debugState().scene?.boss;
            return boss?.state === 'windup' && boss.telegraph > 0.15 && !boss.hidden;
          },
          undefined,
          { timeout: 10_000 },
        );
      }
    }
    // The combat shot walks into the nearest parishioner and captures the first impact,
    // so the frame shows a live hitbox, a stagger flash and the damage HUD.
    if (combatShot) {
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
      await page.keyboard.press('KeyX');
      await page
        .waitForFunction(() => (window.__game?.debugState().scene?.hitstop ?? 0) > 0, undefined, {
          timeout: 5_000,
        })
        .catch(() => console.warn('screenshot: no impact frame observed; capturing anyway'));
    }
    if (benchShot) {
      await page.evaluate(() => window.__game?.debugLoadRoom('belfry-terrace', { x: 590, y: 320 }));
      await page.waitForFunction(
        () => window.__game?.debugState().scene?.bench?.inRange === true,
        undefined,
        { timeout: 10_000 },
      );
      await page.keyboard.press('KeyE');
      await page
        .getByRole('dialog', { name: 'The Bench' })
        .waitFor({ state: 'visible', timeout: 5_000 });
    }
    if (endingShot) {
      const collect = async (
        roomId: string,
        x: number,
        y: number,
        pickupId: string,
      ): Promise<void> => {
        await page.evaluate(
          ({ id, spawnX, spawnY }) => window.__game?.debugLoadRoom(id, { x: spawnX, y: spawnY }),
          { id: roomId, spawnX: x, spawnY: y },
        );
        await page.waitForFunction(
          (id) => window.__game?.debugState().scene?.roomId === id,
          roomId,
          { timeout: 10_000 },
        );
        await page.evaluate(() => window.__game?.debugProtectPlayer());
        await page.waitForFunction(
          (id) => window.__game?.debugState().run.pickups.includes(id) === true,
          pickupId,
          { timeout: 10_000 },
        );
      };

      await page.evaluate(() => window.__game?.debugLoadRoom('bellthief-arena'));
      await page.waitForFunction(
        () => window.__game?.debugState().scene?.roomId === 'bellthief-arena',
        undefined,
        { timeout: 10_000 },
      );
      await page.evaluate(() => window.__game?.debugProtectPlayer());
      await page.evaluate(() => window.__game?.debugDefeatBoss());
      await page.waitForFunction(
        () =>
          window.__game?.debugState().run.sigils.includes('bellThief') === true &&
          window.__game?.debugState().save.lastWrite === 'reward',
        undefined,
        { timeout: 15_000 },
      );
      await collect('bellthief-arena', 660, 320, 'bellthief-sturdy-shell');
      await collect('bellthief-arena', 760, 320, 'bellthief-tide-bell');
      await page.evaluate(() => window.__game?.debugLoadRoom('upper-gallery', { x: 600, y: 320 }));
      await page
        .getByRole('dialog', { name: /the bell remembers/i })
        .waitFor({ state: 'visible', timeout: 10_000 });
    }
    if (mapShot) {
      const visitRoom = async (roomId: string): Promise<void> => {
        await page.evaluate((id) => window.__game?.debugLoadRoom(id), roomId);
        await page.waitForFunction(
          (id) => window.__game?.debugState().scene?.roomId === id,
          roomId,
          { timeout: 10_000 },
        );
      };

      await page.evaluate(() =>
        window.__game?.debugLoadRoom('belfry-antechamber', { x: 90, y: 320 }),
      );
      await page.waitForFunction(
        () => window.__game?.debugState().scene?.bench?.inRange === true,
        undefined,
        { timeout: 10_000 },
      );
      await page.keyboard.press('KeyE');
      await page.waitForFunction(
        () => window.__game?.debugState().run.checkpoint?.benchId === 'nave-bell-keepers-rest',
        undefined,
        { timeout: 10_000 },
      );
      // The bench overlay freezes the run; close it before charting the arenas.
      await page.keyboard.press('Escape');
      await page.waitForFunction(
        () => document.querySelector('.bench-root')?.hasAttribute('hidden') === true,
        undefined,
        { timeout: 5_000 },
      );
      await visitRoom('bellbearer-arena');
      await page.evaluate(() => window.__game?.debugProtectPlayer());
      await page.waitForFunction(
        () => {
          const state = window.__game?.debugState().scene?.boss?.state;
          return state !== undefined && state !== 'intro';
        },
        undefined,
        { timeout: 10_000 },
      );
      await page.evaluate(() => window.__game?.debugDefeatBoss());
      await page.waitForFunction(
        () => window.__game?.debugState().run.sigils.includes('bellbearer'),
        undefined,
        { timeout: 10_000 },
      );
      await visitRoom('warden-arena');
      await visitRoom('bellthief-arena');
      await visitRoom('belfry-antechamber');
      await page.keyboard.press('KeyM');
      await page
        .getByRole('dialog', { name: 'Region Map' })
        .waitFor({ state: 'visible', timeout: 5_000 });
    }
    if (menuShot) {
      await page.keyboard.press('Escape');
      await page
        .getByRole('dialog', { name: 'Paused' })
        .waitFor({ state: 'visible', timeout: 5_000 });
      if (controlsShot) {
        await page.getByRole('button', { name: 'Controls', exact: true }).click();
        await page.getByRole('dialog', { name: 'Bindings' }).waitFor({ timeout: 5_000 });
      }
      if (settingsShot) {
        await page.getByRole('button', { name: 'Settings', exact: true }).click();
        await page.getByRole('dialog', { name: 'Sound' }).waitFor({ timeout: 5_000 });
      }
    }
    // Screenshot capture is slower than a boss pattern in SwiftShader. Freezing the
    // simulation through the pause menu (the canvas is captured alone) keeps the chosen
    // telegraph/phase on screen instead of letting the boss kill the idle player.
    if (bossShot) {
      await page.evaluate(
        () =>
          new Promise<void>((resolve) => {
            requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
          }),
      );
      await page.keyboard.press('Escape');
      await page
        .getByRole('dialog', { name: 'Paused' })
        .waitFor({ state: 'visible', timeout: 5_000 });
      // The menu is a DOM sibling of the canvas; hide it after pausing so a canvas
      // screenshot shows the frozen arena, not the pause overlay on top of it.
      await page.evaluate(() => {
        const root = document.querySelector<HTMLElement>('[data-testid="menu-root"]');
        if (root) root.style.visibility = 'hidden';
      });
    }
    await page.waitForTimeout(
      titleShot
        ? 1_400
        : onboardingShot
          ? 1_250
          : menuShot || mapShot
            ? 320
            : benchShot || endingShot
              ? 360
              : combatShot
                ? 40
                : bossPhaseShot
                  ? 120
                  : bossShot
                    ? 30
                    : settleMs,
    );
    await mkdir(dirname(outputPath), { recursive: true });
    // DOM overlays only appear in a whole-page shot; gameplay uses the canvas alone.
    const target = pageShot ? page : page.locator('canvas');
    await target.screenshot({ path: outputPath });
    if (runShot) await page.keyboard.up('ArrowLeft');
    console.log(`screenshot: saved ${outputPath}`);
  } finally {
    await browser.close();
  }
}

main().catch((error: unknown) => {
  console.error(`screenshot: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
