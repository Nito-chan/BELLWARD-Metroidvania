/**
 * CLI: validates public/assets/MANIFEST.json against the files actually on disk.
 *
 * Usage:
 *   npm run assets:check          normal mode — warns on UNCLEAR licenses
 *   npm run assets:check:strict   strict mode — UNCLEAR licenses fail (shipping gate)
 *
 * Exit codes: 0 = clean (warnings allowed in normal mode), 1 = errors, 2 = unusable input.
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { validateManifest } from './lib/manifest';

const assetsRoot = join(process.cwd(), 'public', 'assets');
const strict = process.argv.includes('--strict');

function listFiles(directory: string): string[] {
  const entries = readdirSync(directory, { withFileTypes: true, recursive: true });
  return entries
    .filter((entry) => entry.isFile())
    .map((entry) => relative(assetsRoot, join(entry.parentPath, entry.name)).split(sep).join('/'))
    .sort();
}

function readManifest(): unknown {
  const manifestPath = join(assetsRoot, 'MANIFEST.json');
  let text: string;
  try {
    text = readFileSync(manifestPath, 'utf8');
  } catch (error) {
    console.error(`assets:check: cannot read ${manifestPath}: ${String(error)}`);
    process.exit(2);
  }
  try {
    return JSON.parse(text) as unknown;
  } catch (error) {
    console.error(`assets:check: ${manifestPath} is not valid JSON: ${String(error)}`);
    process.exit(2);
  }
}

function main(): number {
  if (!existsSync(assetsRoot)) {
    console.error(`assets:check: ${assetsRoot} does not exist`);
    return 2;
  }

  const manifest = readManifest(); // Exits with code 2 on unreadable/invalid input.
  const files = listFiles(assetsRoot);
  const issues = validateManifest(manifest, { filesOnDisk: files, strict });

  const errors = issues.filter((issue) => issue.level === 'error');
  const warnings = issues.filter((issue) => issue.level === 'warning');

  console.log(
    `assets:check — ${files.length} file(s) on disk, mode: ${strict ? 'strict' : 'normal'}`,
  );
  for (const issue of warnings) {
    console.warn(`  WARN  ${issue.subject}: ${issue.message}`);
  }
  for (const issue of errors) {
    console.error(`  FAIL  ${issue.subject}: ${issue.message}`);
  }

  if (errors.length > 0) {
    console.error(`assets:check: ${errors.length} error(s), ${warnings.length} warning(s)`);
    return 1;
  }
  console.log(`assets:check: OK (${warnings.length} warning(s))`);
  return 0;
}

process.exitCode = main();
