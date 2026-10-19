/**
 * Saves a game frame as a PNG into docs/screenshots/.
 *
 * Usage:
 *   1. npm run dev                 (in another terminal — this script does not start servers)
 *   2. npm run screenshot          (default: docs/screenshots/current.png)
 *      npm run screenshot -- docs/screenshots/M0-boot.png
 *      npm run screenshot -- docs/screenshots/M2-terrace.png --run   (hero running right)
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
const outputPath = resolve(
  args.find((value) => !value.startsWith('--')) ?? 'docs/screenshots/current.png',
);
const settleMs = 1200;

async function main(): Promise<void> {
  const browser = await chromium.launch({ args: ['--enable-unsafe-swiftshader'] });
  try {
    const page = await browser.newPage({ viewport: { width: 640, height: 360 } });
    const response = await page.goto(url).catch(() => null);
    if (!response || !response.ok()) {
      throw new Error(`could not reach ${url} — start the dev server first (npm run dev)`);
    }
    await page.waitForFunction(() => window.__game?.debugState().ready === true, undefined, {
      timeout: 15_000,
    });
    // The run shot drives real input so the frame shows the player controller, not a pose.
    if (runShot) await page.keyboard.down('ArrowRight');
    await page.waitForTimeout(settleMs); // let the scene animate to a representative frame
    await mkdir(dirname(outputPath), { recursive: true });
    await page.locator('canvas').screenshot({ path: outputPath });
    if (runShot) await page.keyboard.up('ArrowRight');
    console.log(`screenshot: saved ${outputPath}`);
  } finally {
    await browser.close();
  }
}

main().catch((error: unknown) => {
  console.error(`screenshot: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
