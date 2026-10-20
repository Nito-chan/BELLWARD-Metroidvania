/**
 * Audio content data: which file answers which logical sound, and how each one is mixed.
 * Gameplay code never names a file — only a key from these tables — so replacing or
 * retuning a sound is a one-line change that never touches the simulation.
 *
 * Every URL here must exist on disk and be covered by a MANIFEST.json entry; the unit
 * suite enforces both (tests/unit/audio.test.ts).
 */
import { AUDIO } from '../config/audio';
import type { PlayerEvent } from '../player/PlayerController';

export type SfxDef = {
  /** One or more files; a key with several files picks one at random per play. */
  readonly urls: readonly string[];
  /** Bus-relative volume (the manager multiplies in the sfx bus and master). */
  readonly volume: number;
  /** Minimum ticks between two plays; guards against double triggers in one tick. */
  readonly cooldownTicks: number;
  /** Playback-rate jitter half-range; defaults to AUDIO.rateJitter. */
  readonly rateJitter?: number;
};

const rpg = (file: string): string => `assets/kenney-rpg-audio/Audio/${file}`;
const impact = (file: string): string => `assets/kenney-impact-sounds/Audio/${file}`;

/**
 * The sound set. Kenney's RPG pack answers cloth/leather movements (the knight's armor
 * shifts when he moves) and blades; the impact pack answers stone, bells and thuds.
 * These two CC0 packs cover the movement kit; later milestones add combat hits, menu
 * and world sounds from the same folders.
 */
export const SFX = {
  jump: { urls: [rpg('clothBelt.ogg')], volume: 0.45, cooldownTicks: 6 },
  land: {
    urls: [impact('impactSoft_medium_000.ogg'), impact('impactSoft_medium_002.ogg')],
    volume: 0.6,
    cooldownTicks: 6,
  },
  landHeavy: {
    urls: [impact('impactSoft_heavy_000.ogg'), impact('impactSoft_heavy_002.ogg')],
    volume: 0.75,
    cooldownTicks: 6,
  },
  footstep: {
    urls: [
      impact('footstep_concrete_000.ogg'),
      impact('footstep_concrete_001.ogg'),
      impact('footstep_concrete_002.ogg'),
      impact('footstep_concrete_003.ogg'),
      impact('footstep_concrete_004.ogg'),
    ],
    volume: 0.5,
    cooldownTicks: 6,
  },
  skid: { urls: [rpg('cloth4.ogg')], volume: 0.4, cooldownTicks: 12 },
  attack1: { urls: [rpg('knifeSlice.ogg')], volume: 0.6, cooldownTicks: 8 },
  attack2: { urls: [rpg('knifeSlice2.ogg')], volume: 0.7, cooldownTicks: 8 },
  dash: { urls: [rpg('cloth2.ogg')], volume: 0.5, cooldownTicks: 10 },
  /** Blade meeting a body: the enemy hit feedback. */
  enemyHurt: {
    urls: [impact('impactSoft_medium_001.ogg'), impact('impactSoft_medium_004.ogg')],
    volume: 0.55,
    cooldownTicks: 4,
  },
  /** The body gives way; heavier and longer than a hit. */
  enemyDie: {
    urls: [impact('impactSoft_heavy_001.ogg'), impact('impactSoft_heavy_003.ogg')],
    volume: 0.7,
    cooldownTicks: 6,
  },
  /** The player is hit: a blunt, close, unpleasant thud. */
  playerHurt: { urls: [impact('impactPunch_heavy_000.ogg')], volume: 0.7, cooldownTicks: 10 },
  /** The adept's wind-up: a dry, resonant creak that reads as "something is coming". */
  cast: { urls: [rpg('creak2.ogg')], volume: 0.5, cooldownTicks: 10, rateJitter: 0.02 },
  /** Fire leaving the adept's hands. */
  fireball: { urls: [rpg('cloth3.ogg')], volume: 0.45, cooldownTicks: 8 },
  /** Fireball meeting stone (or a player). */
  fireballHit: {
    urls: [impact('impactGlass_light_001.ogg'), impact('impactGlass_light_003.ogg')],
    volume: 0.55,
    cooldownTicks: 4,
  },
  /**
   * The region's signature: a distant bell. Played by the ambience scheduler in
   * AudioManager; the rate jitter is pinned low so the toll keeps a stable pitch.
   */
  bell: {
    urls: [
      impact('impactBell_heavy_000.ogg'),
      impact('impactBell_heavy_002.ogg'),
      impact('impactBell_heavy_004.ogg'),
    ],
    volume: 0.4,
    cooldownTicks: 600,
    rateJitter: 0.01,
  },
} as const satisfies Record<string, SfxDef>;

export type SfxKey = keyof typeof SFX;

export type MusicDef = {
  readonly url: string;
  /** Bus-relative volume; the manager adds the music bus and master. */
  readonly volume: number;
};

/** One looping track per state the region can be in. */
export const MUSIC = {
  terrace: { url: 'assets/music-cathedral/cathedral-in-the-forest.ogg', volume: 0.85 },
  /**
   * Boss loops, kept for M6: the drowned depths answer the Bellbearer, the citadel
   * answers the tower's warden. Nothing plays them yet; the rooms will ask by key.
   */
  bossAbyss: {
    url: 'assets/alkakrab-boss-loops/Loops ogg/1. Whispers of the Abyss (Loop).ogg',
    volume: 0.8,
  },
  bossCitadel: {
    url: 'assets/alkakrab-boss-loops/Loops ogg/4. Cursed Citadel (After Intro & Loop).ogg',
    volume: 0.8,
  },
} as const satisfies Record<string, MusicDef>;

export type MusicKey = keyof typeof MUSIC;

/**
 * The bridge from simulation events to sound keys. Typed as a total map, so adding a
 * new PlayerEvent is a compile error until it has a sound.
 */
export const PLAYER_SFX: Record<PlayerEvent, SfxKey> = {
  jump: 'jump',
  land: 'land',
  landHeavy: 'landHeavy',
  footstep: 'footstep',
  skid: 'skid',
  attack1: 'attack1',
  attack2: 'attack2',
  dash: 'dash',
  hurt: 'playerHurt',
  // The region answers a death with its signature sound: the distant bell.
  death: 'bell',
};

/** The rate the manager wants for a key: the table's jitter, or the global default. */
export function rateJitterOf(def: SfxDef): number {
  return def.rateJitter ?? AUDIO.rateJitter;
}
