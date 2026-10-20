export type AssetSource =
  | { strategy: 'direct'; url: string }
  /** A single non-archive file (e.g. one .ogg track) saved straight into the target folder. */
  | { strategy: 'file'; url: string; saveAs?: string }
  /** An itch.io free download; `fileMatch` picks one file when the page offers several. */
  | { strategy: 'itch'; pageUrl: string; fileMatch?: RegExp };

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
  /**
   * Optional filter on the posix-style relative path inside the archive. Big music packs
   * ship gigabytes we never reference, so only matching files are materialized.
   */
  include?: RegExp;
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
  {
    id: 'sfx-rpg',
    target: 'kenney-rpg-audio',
    name: 'RPG Audio',
    kind: 'audio-sfx',
    author: 'Kenney (kenney.nl)',
    sourceUrl: 'https://kenney.nl/assets/rpg-audio',
    license: 'CC0-1.0',
    licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
    attribution: 'RPG Audio by Kenney (kenney.nl) — CC0',
    licenseNotice:
      'License: Creative Commons CC0 (public domain). "This content is free to use in personal, educational and commercial projects. Support us by crediting Kenney or www.kenney.nl (this is not mandatory)."',
    keepExtensions: ['.ogg'],
    // The preview track and browser links live outside Audio/; the pack itself ships here.
    include: /^Audio\//,
    source: {
      strategy: 'direct',
      url: 'https://kenney.nl/media/pages/assets/rpg-audio/8e99002d76-1677590336/kenney_rpg-audio.zip',
    },
  },
  {
    id: 'sfx-impact',
    target: 'kenney-impact-sounds',
    name: 'Impact Sounds',
    kind: 'audio-sfx',
    author: 'Kenney (kenney.nl)',
    sourceUrl: 'https://kenney.nl/assets/impact-sounds',
    license: 'CC0-1.0',
    licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
    attribution: 'Impact Sounds by Kenney (kenney.nl) — CC0',
    licenseNotice:
      'License: Creative Commons CC0 (public domain). "This content is free to use in personal, educational and commercial projects. Support us by crediting Kenney or www.kenney.nl (this is not mandatory)."',
    keepExtensions: ['.ogg'],
    include: /^Audio\//,
    source: {
      strategy: 'direct',
      url: 'https://kenney.nl/media/pages/assets/impact-sounds/87b4ddecda-1677589768/kenney_impact-sounds.zip',
    },
  },
  {
    id: 'music-cathedral',
    target: 'music-cathedral',
    name: 'Cathedral in the forest (ambient loop)',
    kind: 'audio-music',
    author: 'congusbongus',
    sourceUrl: 'https://opengameart.org/content/cathedral-in-the-forest-ambient-loop',
    license: 'CC0-1.0',
    licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
    attribution:
      'Cathedral in the forest by congusbongus — CC0 — https://opengameart.org/content/cathedral-in-the-forest-ambient-loop',
    licenseNotice:
      'License(s): CC0. "Seamless ambient loop, for space or dark games — pads and bells. Made for an unfinished jam game."',
    keepExtensions: ['.ogg'],
    source: {
      strategy: 'file',
      url: 'https://opengameart.org/sites/default/files/forest_2_0.ogg',
      saveAs: 'cathedral-in-the-forest.ogg',
    },
  },
  {
    id: 'music-boss',
    target: 'alkakrab-boss-loops',
    name: 'Free 6 Dark Fantasy Boss Battle Tracks (loops)',
    kind: 'audio-music',
    author: 'alkakrab',
    sourceUrl: 'https://alkakrab.itch.io/6-dark-fantasy-boss-battle-tracks',
    license: 'Custom-Free-Commercial',
    licenseUrl: 'https://alkakrab.itch.io/6-dark-fantasy-boss-battle-tracks',
    attribution:
      'Dark Fantasy Boss Battle Tracks by alkakrab — https://alkakrab.itch.io/6-dark-fantasy-boss-battle-tracks',
    licenseNotice:
      'Page states "Absolutely Free For Commercial use"; the author confirmed in comments that selling a game with this music is fine. "All tracks are original and human made, no AI was used in the creation process."',
    keepExtensions: ['.ogg'],
    // Six loops ship in the pack; the region fields two bosses for now. The rest stay in
    // the download cache — widen this filter (and delete the target folder) when the
    // later bosses need a voice.
    include: /(Whispers of the Abyss \(Loop\)|Cursed Citadel \(After Intro & Loop\))\.ogg$/,
    source: {
      strategy: 'itch',
      pageUrl: 'https://alkakrab.itch.io/6-dark-fantasy-boss-battle-tracks',
      fileMatch: /Loops ogg/i,
    },
  },
];
