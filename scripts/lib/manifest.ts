/**
 * Pure manifest validation logic. No I/O happens here so it is trivially unit-testable;
 * the CLI wrapper (scripts/assets-check.ts) supplies the list of files found on disk.
 *
 * Semantics (docs/DECISIONS.md D008):
 * - Missing/empty required fields, non-ISO dates, commercialUse:false, declared-but-missing
 *   files, and undeclared files (orphans) are ALWAYS errors.
 * - licenseStatus "UNCLEAR" is a warning normally, an error in strict mode (shipping gate).
 */

export type ManifestIssueLevel = 'error' | 'warning';

export type ManifestIssue = {
  level: ManifestIssueLevel;
  /** Asset name, file path, or "<manifest>" for structural problems. */
  subject: string;
  message: string;
};

export type ManifestAsset = {
  /** Human-readable pack name. */
  name: string;
  /** What it is: sprites | tileset | audio | font | vfx | ui | other. */
  kind: string;
  /** File or directory path relative to public/assets/. A directory covers everything inside. */
  path: string;
  /** Author / studio. */
  author: string;
  /** Where it was downloaded from. */
  sourceUrl: string;
  /** SPDX id or short license name, e.g. "CC0-1.0", "CC-BY-4.0", "OFL-1.1", "UNCLEAR". */
  license: string;
  /** License text URL. */
  licenseUrl: string;
  /** May it be used in a commercial product? Shipping requires true. */
  commercialUse: boolean;
  /** ISO date (YYYY-MM-DD) the asset was retrieved. */
  dateDownloaded: string;
  /** Exact attribution string the license requires (if any). */
  attribution?: string;
  /** "UNCLEAR" while a license is under investigation (demo builds only, see D008). */
  licenseStatus?: string;
};

export type ManifestFile = {
  manifestVersion: number;
  assets: ManifestAsset[];
};

export type ValidateOptions = {
  /** All files present under public/assets/, as forward-slash relative paths. */
  filesOnDisk: string[];
  /** Strict mode turns UNCLEAR licenses into failures (shipping gate). */
  strict: boolean;
};

const REQUIRED_FIELDS: readonly (keyof ManifestAsset)[] = [
  'name',
  'kind',
  'path',
  'author',
  'sourceUrl',
  'license',
  'licenseUrl',
  'commercialUse',
  'dateDownloaded',
];

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Documents and dotfiles that never need a manifest entry. */
const IGNORED_BASENAMES = new Set(['MANIFEST.json', 'LICENSE.txt', 'README.md', 'CREDITS.md']);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isIgnoredFile(file: string): boolean {
  const base = file.split('/').pop() ?? file;
  return base.startsWith('.') || IGNORED_BASENAMES.has(base);
}

function normalizePath(value: string): string {
  return value
    .replace(/\\/g, '/')
    .replace(/^\.?\//, '')
    .replace(/\/+$/, '');
}

function coversPath(file: string, declaredPath: string): boolean {
  return file === declaredPath || file.startsWith(`${declaredPath}/`);
}

function checkStructure(manifest: unknown, issues: ManifestIssue[]): ManifestAsset[] | null {
  if (!isRecord(manifest)) {
    issues.push({
      level: 'error',
      subject: '<manifest>',
      message: 'manifest root must be a JSON object',
    });
    return null;
  }
  if (manifest['manifestVersion'] !== 1) {
    issues.push({
      level: 'error',
      subject: '<manifest>',
      message: `manifestVersion must be 1, got ${JSON.stringify(manifest['manifestVersion'])}`,
    });
  }
  const rawAssets = manifest['assets'];
  if (!Array.isArray(rawAssets)) {
    issues.push({ level: 'error', subject: '<manifest>', message: 'assets must be an array' });
    return null;
  }

  const assets: ManifestAsset[] = [];
  for (let i = 0; i < rawAssets.length; i += 1) {
    const entry: unknown = rawAssets[i];
    if (!isRecord(entry)) {
      issues.push({
        level: 'error',
        subject: `<assets[${i}]>`,
        message: 'entry must be an object',
      });
      continue;
    }
    assets.push(entry as unknown as ManifestAsset);
  }
  return assets;
}

function validateAssetEntry(
  asset: ManifestAsset,
  index: number,
  options: ValidateOptions,
  issues: ManifestIssue[],
  declaredPaths: string[],
): void {
  const subject =
    typeof asset.name === 'string' && asset.name.trim().length > 0
      ? asset.name
      : `<assets[${index}]>`;

  for (const field of REQUIRED_FIELDS) {
    const value = asset[field];
    const isBlankString = typeof value === 'string' && value.trim().length === 0;
    if (value === undefined || value === null || isBlankString) {
      issues.push({
        level: 'error',
        subject,
        message: `missing required field "${String(field)}"`,
      });
    }
  }

  if (asset.commercialUse === false) {
    issues.push({
      level: 'error',
      subject,
      message: 'commercialUse is false — this asset can never ship (no-paid / no-NC rule)',
    });
  }

  if (
    typeof asset.dateDownloaded === 'string' &&
    asset.dateDownloaded.length > 0 &&
    !ISO_DATE.test(asset.dateDownloaded)
  ) {
    issues.push({
      level: 'error',
      subject,
      message: `dateDownloaded must be YYYY-MM-DD, got "${asset.dateDownloaded}"`,
    });
  }

  if (asset.licenseStatus === 'UNCLEAR') {
    issues.push({
      level: options.strict ? 'error' : 'warning',
      subject,
      message: 'licenseStatus is UNCLEAR — investigate before shipping (fails with --strict)',
    });
  }

  if (typeof asset.path === 'string') {
    const path = normalizePath(asset.path);
    if (path.length > 0) declaredPaths.push(path);
  }
}

export function validateManifest(manifest: unknown, options: ValidateOptions): ManifestIssue[] {
  const issues: ManifestIssue[] = [];
  const assets = checkStructure(manifest, issues);
  if (assets === null) return issues;

  const declaredPaths: string[] = [];
  for (let i = 0; i < assets.length; i += 1) {
    const asset = assets[i];
    if (asset) validateAssetEntry(asset, i, options, issues, declaredPaths);
  }

  const files = options.filesOnDisk.filter((file) => !isIgnoredFile(file));

  for (const declaredPath of declaredPaths) {
    if (!files.some((file) => coversPath(file, declaredPath))) {
      issues.push({
        level: 'error',
        subject: declaredPath,
        message: 'declared in the manifest but does not match any file on disk',
      });
    }
  }

  for (const file of files) {
    if (!declaredPaths.some((declaredPath) => coversPath(file, declaredPath))) {
      issues.push({
        level: 'error',
        subject: file,
        message: 'file on disk is not declared in the manifest (add an entry or remove the file)',
      });
    }
  }

  return issues;
}
