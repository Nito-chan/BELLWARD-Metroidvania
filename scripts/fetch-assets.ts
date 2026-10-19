/**
 * Downloads the approved asset packs into public/assets/, prunes them to shipping
 * files, archives license text next to each pack, and merges MANIFEST.json entries.
 *
 * Usage:
 *   npm run fetch-assets                  skip packs already present
 *   npm run fetch-assets -- --force       re-download everything
 *   npm run fetch-assets -- --only=church,town
 *
 * Every failure is reported as SKIPPED and never breaks the game: all visuals have
 * procedural fallbacks. Packs that cannot be fetched automatically must be added to
 * docs/MANUAL_DOWNLOADS.md with exact instructions.
 *
 * The pack list itself lives in scripts/lib/asset-packs.ts.
 */
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { dirname, extname, join, relative, resolve } from 'node:path';
import { chromium } from '@playwright/test';
import extract from 'extract-zip';
import { ASSET_PACKS, type FetchEntry } from './lib/asset-packs';
import type { ManifestAsset } from './lib/manifest';

const ROOT = process.cwd();
const ASSETS_ROOT = join(ROOT, 'public', 'assets');
const CACHE_DIR = join(ROOT, '.cache', 'asset-downloads');
const MANIFEST_PATH = join(ASSETS_ROOT, 'MANIFEST.json');

function log(message: string): void {
  console.log(message);
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function safeFileName(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]+/g, '-');
}

function walkFiles(root: string): string[] {
  const files: string[] = [];
  const visit = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name !== '__MACOSX') visit(full);
      } else if (entry.isFile()) {
        files.push(full);
      }
    }
  };
  visit(root);
  return files;
}

function toPosix(value: string): string {
  return value.split('\\').join('/');
}

/** Removes the single top-level folder that most zips wrap their contents in. */
function stripSingleRoot(files: readonly string[], root: string): string[] {
  const relatives = files.map((file) => toPosix(relative(root, file)));
  const firstSegments = new Set(relatives.map((rel) => rel.split('/')[0] ?? rel));
  const hasNested = relatives.some((rel) => rel.includes('/'));
  if (firstSegments.size === 1 && hasNested) {
    const prefix = `${[...firstSegments][0]}/`;
    return relatives.map((rel) => rel.replace(prefix, ''));
  }
  return relatives;
}

function materialize(entry: FetchEntry, extractedRoot: string): number {
  const targetDir = join(ASSETS_ROOT, entry.target);
  rmSync(targetDir, { recursive: true, force: true });
  mkdirSync(targetDir, { recursive: true });

  const files = walkFiles(extractedRoot);
  const relatives = stripSingleRoot(files, extractedRoot);
  const keep = new Set(entry.keepExtensions);

  let copied = 0;
  for (let i = 0; i < files.length; i += 1) {
    const file = files[i];
    const rel = relatives[i];
    if (!file || !rel) continue;
    if (!keep.has(extname(file).toLowerCase())) continue;
    const dest = join(targetDir, rel);
    mkdirSync(dirname(dest), { recursive: true });
    copyFileSync(file, dest);
    copied += 1;
  }
  return copied;
}

function writeLicense(entry: FetchEntry, downloadedOn: string): void {
  const text = [
    entry.name,
    `Author: ${entry.author}`,
    `Source: ${entry.sourceUrl}`,
    `License: ${entry.license} (${entry.licenseUrl})`,
    `Downloaded: ${downloadedOn}`,
    '',
    'Attribution / license notice (from the source page):',
    entry.licenseNotice,
    '',
    'Redistribution note: this copy exists solely as part of the BELLWARD game project.',
    'It is not a standalone redistribution of the asset pack.',
    '',
  ].join('\n');
  writeFileSync(join(ASSETS_ROOT, entry.target, 'LICENSE.txt'), text);
}

function mergeManifest(entry: FetchEntry, downloadedOn: string): void {
  const raw = readFileSync(MANIFEST_PATH, 'utf8');
  const parsed = JSON.parse(raw) as { manifestVersion: number; assets: ManifestAsset[] };
  const assets = parsed.assets.filter((asset) => asset.path !== entry.target);
  assets.push({
    name: entry.name,
    kind: entry.kind,
    path: entry.target,
    author: entry.author,
    sourceUrl: entry.sourceUrl,
    license: entry.license,
    licenseUrl: entry.licenseUrl,
    commercialUse: true,
    dateDownloaded: downloadedOn,
    attribution: entry.attribution,
  });
  assets.sort((a, b) => a.name.localeCompare(b.name));
  writeFileSync(
    MANIFEST_PATH,
    `${JSON.stringify({ manifestVersion: parsed.manifestVersion, assets }, null, 2)}\n`,
  );
}

async function downloadDirect(entry: FetchEntry, url: string): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`);
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.byteLength === 0) {
    throw new Error(`empty download from ${url}`);
  }
  const name = decodeURIComponent(new URL(url).pathname.split('/').pop() ?? 'download.zip');
  const zipPath = join(CACHE_DIR, `${entry.id}-${safeFileName(name)}`);
  writeFileSync(zipPath, buffer);
  return zipPath;
}

async function downloadItch(entry: FetchEntry, pageUrl: string): Promise<string> {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ acceptDownloads: true });
    await page.goto(pageUrl, { waitUntil: 'domcontentloaded', timeout: 60_000 });

    // "Download Now" leads to the name-your-price page.
    const downloadNow = page.getByRole('link', { name: /download now/i }).first();
    await downloadNow.waitFor({ state: 'visible', timeout: 30_000 });
    await downloadNow.click();

    // Free assets expose a "No thanks, just take me to the downloads" bypass. It is a
    // JavaScript-driven link (no href), so wait for the resulting /download/ URL.
    const noThanks = page.getByText(/no thanks/i).first();
    await noThanks.waitFor({ state: 'visible', timeout: 30_000 });
    await noThanks.click();
    await page.waitForURL(/\/download\//, { timeout: 60_000 });

    // The file row's "Download" control is JS-driven as well; the resulting transfer
    // is reported by Playwright as a regular download event.
    const fileLink = page.getByRole('link', { name: 'Download', exact: true }).first();
    await fileLink.waitFor({ state: 'visible', timeout: 30_000 });
    const downloadPromise = page.waitForEvent('download', { timeout: 120_000 });
    await fileLink.click();
    const download = await downloadPromise;

    const suggested = safeFileName(download.suggestedFilename() || `${entry.id}.zip`);
    const zipPath = join(CACHE_DIR, `${entry.id}-${suggested}`);
    await download.saveAs(zipPath);
    return zipPath;
  } catch (error) {
    throw new Error(`itch flow failed at ${entry.sourceUrl} — ${String(error)}`, { cause: error });
  } finally {
    await browser.close();
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const force = args.includes('--force');
  const onlyArg = args.find((arg) => arg.startsWith('--only='));
  const only = onlyArg ? new Set(onlyArg.slice('--only='.length).split(',')) : null;

  mkdirSync(CACHE_DIR, { recursive: true });
  mkdirSync(ASSETS_ROOT, { recursive: true });

  const downloadedOn = todayIso();
  let fetched = 0;
  let present = 0;
  let skipped = 0;

  for (const entry of ASSET_PACKS) {
    if (only && !only.has(entry.id)) continue;

    const targetDir = join(ASSETS_ROOT, entry.target);
    const alreadyThere =
      existsSync(join(targetDir, 'LICENSE.txt')) &&
      walkFiles(targetDir).some((file) => file.endsWith('.png'));
    if (alreadyThere && !force) {
      log(`SKIP  ${entry.id} — already present (use --force to re-download)`);
      present += 1;
      continue;
    }

    log(`FETCH ${entry.id} — ${entry.name}`);
    try {
      const zipPath =
        entry.source.strategy === 'direct'
          ? await downloadDirect(entry, entry.source.url)
          : await downloadItch(entry, entry.source.pageUrl);

      const extractRoot = join(CACHE_DIR, `${entry.id}-unzipped`);
      rmSync(extractRoot, { recursive: true, force: true });
      mkdirSync(extractRoot, { recursive: true });
      await extract(zipPath, { dir: resolve(extractRoot) });

      const copied = materialize(entry, extractRoot);
      if (copied === 0) {
        throw new Error('extracted no files with the allowed extensions');
      }
      writeLicense(entry, downloadedOn);
      mergeManifest(entry, downloadedOn);

      const bytes = walkFiles(targetDir).reduce((sum, file) => sum + statSync(file).size, 0);
      log(
        `OK    ${entry.id} — ${copied} file(s), ${(bytes / (1024 * 1024)).toFixed(2)} MB -> public/assets/${entry.target}`,
      );
      fetched += 1;
    } catch (error) {
      log(`SKIP  ${entry.id} — ${error instanceof Error ? error.message : String(error)}`);
      skipped += 1;
    }
  }

  log('');
  log(`Done. fetched=${fetched} present=${present} skipped=${skipped}`);
  if (skipped > 0) {
    log('Skipped packs need a manual download — see docs/MANUAL_DOWNLOADS.md');
  }
}

main().catch((error: unknown) => {
  console.error(`fetch-assets: ${error instanceof Error ? error.stack : String(error)}`);
  process.exitCode = 1;
});
