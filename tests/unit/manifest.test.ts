import { describe, expect, it } from 'vitest';
import { validateManifest } from '../../scripts/lib/manifest';
import type { ManifestAsset } from '../../scripts/lib/manifest';

function asset(overrides: Partial<ManifestAsset> = {}): ManifestAsset {
  return {
    name: 'Test Pack',
    kind: 'sprites',
    path: 'test-pack/sprite.png',
    author: 'Someone',
    sourceUrl: 'https://example.com/pack',
    license: 'CC0-1.0',
    licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
    commercialUse: true,
    dateDownloaded: '2026-10-19',
    attribution: 'Test Pack by Someone (CC0)',
    ...overrides,
  };
}

const baseOptions = { filesOnDisk: ['test-pack/sprite.png'], strict: false };

describe('validateManifest', () => {
  it('accepts an empty, well-formed manifest', () => {
    expect(
      validateManifest({ manifestVersion: 1, assets: [] }, { filesOnDisk: [], strict: false }),
    ).toEqual([]);
  });

  it('accepts a complete asset entry', () => {
    const manifest = { manifestVersion: 1, assets: [asset()] };
    expect(validateManifest(manifest, baseOptions)).toEqual([]);
  });

  it('accepts directory paths that cover multiple files', () => {
    const manifest = { manifestVersion: 1, assets: [asset({ path: 'test-pack' })] };
    const options = { filesOnDisk: ['test-pack/a.png', 'test-pack/sub/b.png'], strict: false };
    expect(validateManifest(manifest, options)).toEqual([]);
  });

  it('fails on a missing required field', () => {
    const manifest = { manifestVersion: 1, assets: [{ ...asset(), author: '' }] };
    const issues = validateManifest(manifest, baseOptions);
    expect(
      issues.some((issue) => issue.level === 'error' && issue.message.includes('author')),
    ).toBe(true);
  });

  it('fails when commercialUse is false', () => {
    const manifest = { manifestVersion: 1, assets: [asset({ commercialUse: false })] };
    const issues = validateManifest(manifest, baseOptions);
    expect(
      issues.some((issue) => issue.level === 'error' && issue.message.includes('commercialUse')),
    ).toBe(true);
  });

  it('fails on a non-ISO dateDownloaded', () => {
    const manifest = { manifestVersion: 1, assets: [asset({ dateDownloaded: '19/10/2026' })] };
    const issues = validateManifest(manifest, baseOptions);
    expect(
      issues.some((issue) => issue.level === 'error' && issue.message.includes('dateDownloaded')),
    ).toBe(true);
  });

  it('warns on UNCLEAR licenses in normal mode and fails in strict mode', () => {
    const manifest = { manifestVersion: 1, assets: [asset({ licenseStatus: 'UNCLEAR' })] };

    const normal = validateManifest(manifest, { ...baseOptions, strict: false });
    expect(normal).toHaveLength(1);
    expect(normal[0]?.level).toBe('warning');

    const strict = validateManifest(manifest, { ...baseOptions, strict: true });
    expect(strict).toHaveLength(1);
    expect(strict[0]?.level).toBe('error');
  });

  it('fails when a declared path is missing on disk', () => {
    const manifest = { manifestVersion: 1, assets: [asset()] };
    const issues = validateManifest(manifest, { filesOnDisk: [], strict: false });
    expect(
      issues.some((issue) => issue.level === 'error' && issue.message.includes('does not match')),
    ).toBe(true);
  });

  it('fails on files that are not declared (orphans)', () => {
    const manifest = { manifestVersion: 1, assets: [] };
    const issues = validateManifest(manifest, { filesOnDisk: ['stray/file.png'], strict: false });
    expect(
      issues.some((issue) => issue.level === 'error' && issue.subject === 'stray/file.png'),
    ).toBe(true);
  });

  it('ignores MANIFEST.json, LICENSE.txt, README.md, CREDITS.md and dotfiles', () => {
    const manifest = { manifestVersion: 1, assets: [] };
    const options = {
      filesOnDisk: [
        'MANIFEST.json',
        'pack/LICENSE.txt',
        'pack/README.md',
        'pack/CREDITS.md',
        '.gitkeep',
      ],
      strict: false,
    };
    expect(validateManifest(manifest, options)).toEqual([]);
  });

  it('fails loudly on malformed manifests', () => {
    expect(validateManifest('nope', { filesOnDisk: [], strict: false })[0]?.level).toBe('error');
    expect(
      validateManifest({ assets: [] }, { filesOnDisk: [], strict: false }).length,
    ).toBeGreaterThan(0);
    expect(
      validateManifest({ manifestVersion: 1, assets: 'nope' }, { filesOnDisk: [], strict: false })
        .length,
    ).toBeGreaterThan(0);
    expect(
      validateManifest(
        { manifestVersion: 1, assets: ['not-an-object'] },
        { filesOnDisk: [], strict: false },
      ).length,
    ).toBeGreaterThan(0);
  });
});
