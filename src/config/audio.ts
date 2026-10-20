/**
 * Audio tuning. Every number the mix, the fades and the ambience scheduler use lives
 * here so the unit suite can assert the contract and retuning stays a one-file change.
 */
export const AUDIO = {
  /**
   * Bus defaults. The player's saved mix (docs: D029) overrides these at boot; these
   * values are what a first-run session hears.
   */
  defaults: {
    master: 0.9,
    music: 0.65,
    sfx: 0.9,
  },
  /** localStorage key for the persisted mix. Reads/writes are wrapped in try/catch. */
  storageKey: 'bellward.audio.v1',
  /** Keyboard code for the mute toggle (a utility binding, see docs/CONTROLS.md). */
  muteKey: 'KeyB',
  /**
   * Music fades, in wall-clock milliseconds. Audio fades are real time by definition:
   * the renderer may stutter, the soundtrack must not.
   */
  fades: {
    /** Intro fade once the soundtrack starts after the first user gesture. */
    inMs: 2400,
    /** Fade applied to the outgoing track when the scene changes. */
    outMs: 900,
  },
  /**
   * Playback-rate jitter applied to repeated SFX (fraction of 1.0). Enough to stop
   * footsteps and swings from turning into a machine gun, little enough to stay subtle.
   */
  rateJitter: 0.06,
  /**
   * The distant bell: a toll every so often, timed in sim ticks so it lingers in the
   * same time domain as the world. First toll comes early to set the mood, then the
   * span between tolls is drawn from [minTicks, maxTicks]. The toll's volume and
   * sample live in the sound table (`src/data/audio.ts`).
   */
  bell: {
    firstTicks: 1500,
    minTicks: 2100,
    maxTicks: 4200,
  },
} as const;
