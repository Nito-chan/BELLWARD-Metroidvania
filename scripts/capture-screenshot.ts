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
 *      (--combat walks into the nearest parishioner and shoots on the first impact)
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
const menuShot =
  args.includes('--menu') || args.includes('--controls') || args.includes('--settings');
const controlsShot = args.includes('--controls');
const settingsShot = args.includes('--settings');
/** Menus are normally captured at 1280x720; --small checks the 640x360 E2E viewport. */
const smallShot = args.includes('--small');
const outputPath = resolve(
  args.find((value) => !value.startsWith('--')) ?? 'docs/screenshots/current.png',
);
const settleMs = 1200;

async function main(): Promise<void> {
  const browser = await chromium.launch({ args: ['--enable-unsafe-swiftshader'] });
  try {
    const page = await browser.newPage({
      viewport: menuShot && !smallShot ? { width: 1280, height: 720 } : { width: 640, height: 360 },
    });
    const response = await page.goto(url).catch(() => null);
    if (!response || !response.ok()) {
      throw new Error(`could not reach ${url} — start the dev server first (npm run dev)`);
    }
    await page.waitForFunction(() => window.__game?.debugState().ready === true, undefined, {
      timeout: 15_000,
    });
    // The run shot drives real input so the frame shows the player controller, not a pose.
    // Audio may only start after a gesture; the first arrow press is that gesture.
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
    if (menuShot) {
      await page.keyboard.press('Escape');
      await page.locator('[role="dialog"]').waitFor({ state: 'visible', timeout: 5_000 });
      if (controlsShot) {
        await page.getByRole('button', { name: 'Controls', exact: true }).click();
        await page.getByRole('dialog', { name: 'Bindings' }).waitFor({ timeout: 5_000 });
      }
      if (settingsShot) {
        await page.getByRole('button', { name: 'Settings', exact: true }).click();
        await page.getByRole('dialog', { name: 'Sound' }).waitFor({ timeout: 5_000 });
      }
    }
    await page.waitForTimeout(menuShot ? 320 : combatShot ? 40 : settleMs);
    await mkdir(dirname(outputPath), { recursive: true });
    // DOM overlays only appear in a whole-page shot; gameplay uses the canvas alone.
    const target = overlayShot || menuShot ? page : page.locator('canvas');
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
