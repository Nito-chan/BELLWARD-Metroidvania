export type AssetSource =
  { strategy: 'direct'; url: string } | { strategy: 'itch'; pageUrl: string };

export type FetchEntry = {
  /** Stable id used by CLI filters and cache file names. */
  id: string;
  /** Target folder under public/assets/. */
  target: string;
  name: string;
  kind: string;
  author: string;
  sourceUrl: string;
  license: string;
  licenseUrl: string;
  /** Exact attribution string required by the license (or best-practice credit). */
  attribution: string;
  /** Verbatim license/attribution notice captured from the source page. */
  licenseNotice: string;
  /** File extensions kept after extraction (everything else is pruned). */
  keepExtensions: readonly string[];
  source: AssetSource;
};

/** One manifest entry shape, shared with the validator. */

export const ASSET_PACKS: readonly FetchEntry[] = [
  {
    id: 'church',
    target: 'ansimuz-church',
    name: 'GothicVania — Church Pack',
    kind: 'tileset+sprites+backgrounds',
    author: 'Luis Zuno (ansimuz)',
    sourceUrl: 'https://opengameart.org/content/gothicvania-church-pack',
    license: 'CC0-1.0',
    licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
    attribution:
      'GothicVania Church Pack by Luis Zuno (ansimuz) — CC0 — https://opengameart.org/content/gothicvania-church-pack',
    licenseNotice: 'License(s): CC0. Copyright/Attribution Notice: by ansimuz (optional).',
    keepExtensions: ['.png'],
    source: {
      strategy: 'direct',
      url: 'https://opengameart.org/sites/default/files/gothicvania%20church%20files.zip',
    },
  },
  {
    id: 'town',
    target: 'ansimuz-town',
    name: 'GothicVania — Town Pack',
    kind: 'tileset+props+backgrounds',
    author: 'Luis Zuno (ansimuz)',
    sourceUrl: 'https://opengameart.org/content/gothicvania-town',
    license: 'CC0-1.0',
    licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
    attribution:
      'GothicVania Town by Luis Zuno (ansimuz) — CC0 — https://opengameart.org/content/gothicvania-town',
    licenseNotice:
      'Artwork created by Luis Zuno @ansimuz. Public domain and free to use on whatever you want, personal or commercial. Credit is not required but appreciated.',
    keepExtensions: ['.png'],
    source: {
      strategy: 'direct',
      url: 'https://opengameart.org/sites/default/files/gothicvania-town-files.zip',
    },
  },
  {
    id: 'caves',
    target: 'ansimuz-caves',
    name: 'Warped Caves — Pixel Art Pack',
    kind: 'tileset+props+backgrounds',
    author: 'Luis Zuno (ansimuz)',
    sourceUrl: 'https://opengameart.org/content/warped-caves-pixel-art-pack',
    license: 'CC0-1.0',
    licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
    attribution:
      'Warped Caves by Luis Zuno (ansimuz) — CC0 — https://opengameart.org/content/warped-caves-pixel-art-pack',
    licenseNotice: 'License(s): CC0. Copyright/Attribution Notice: by ansimuz (optional).',
    keepExtensions: ['.png'],
    source: {
      strategy: 'direct',
      url: 'https://opengameart.org/sites/default/files/warped-files_1.zip',
    },
  },
  {
    id: 'knight',
    target: 'aamatniekss-knight',
    name: 'Fantasy Knight — Free Pixelart Animated Character',
    kind: 'character-sprite-sheets',
    author: 'aamatniekss (Namatnieks)',
    sourceUrl: 'https://aamatniekss.itch.io/fantasy-knight-free-pixelart-animated-character',
    license: 'Custom-Free-Commercial',
    licenseUrl: 'https://aamatniekss.itch.io/fantasy-knight-free-pixelart-animated-character',
    attribution:
      'Fantasy Knight by aamatniekss — https://aamatniekss.itch.io/fantasy-knight-free-pixelart-animated-character. Included in this repository with the author’s permission (see comments, 2026); not redistributed as a standalone asset pack.',
    licenseNotice:
      "LICENCE: This asset pack can be used in both free and commercial projects. You can modify it to suit your own needs. Credit is not necessary, but highly appreciated. You may not redistribute or resell the assets on their own, that includes NFTs, just images, or asset compilations. The assets can't be used in AI creations.",
    keepExtensions: ['.png'],
    source: {
      strategy: 'itch',
      pageUrl: 'https://aamatniekss.itch.io/fantasy-knight-free-pixelart-animated-character',
    },
  },
];
