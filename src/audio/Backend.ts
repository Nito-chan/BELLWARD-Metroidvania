/**
 * The seam between AudioManager and whatever actually makes noise. Howler implements
 * this in the browser (HowlerBackend); unit tests inject a recording fake, so unlock
 * gating, mixing, cooldowns and crossfades are all testable without a Web Audio device.
 *
 * Implementations are given stable sound keys (`sfx:<key>:<variant>`, `music:<key>`)
 * and must tolerate missing files: a load error marks the key as failed and every
 * later call for it is a no-op, because the game must run with zero audio assets.
 */

export type BackendContextState = 'running' | 'suspended' | 'closed' | 'interrupted' | 'none';

/** A playback handle; -1 means "did not start". */
export type PlaybackHandle = number;

export interface AudioBackend {
  /** Creates the audio context if needed and resumes it. Call from a user gesture. */
  unlock(): Promise<void>;

  /** Audio context state; 'none' while no context exists. */
  contextState(): BackendContextState;

  /** Registers a sound under a stable key. Idempotent; loading starts immediately. */
  load(key: string, url: string): void;

  /** Keys whose files failed to load (missing file, decode error, no audio device). */
  failures(): readonly string[];

  /** Starts a one-shot at the given volume and playback rate. */
  play(key: string, volume: number, rate: number): PlaybackHandle;

  /** Starts a loop at volume 0 and fades it in over `ms` wall-clock milliseconds. */
  playLoopFadingIn(key: string, volume: number, ms: number): PlaybackHandle;

  /** Applies a volume to a sound's active and future playbacks (music bus changes). */
  setVolume(key: string, volume: number): void;

  /** Fades one playback out and stops it. Safe for an already-finished handle. */
  fadeOutAndStop(key: string, handle: PlaybackHandle, ms: number): void;

  /** Mutes or unmutes everything. */
  mute(muted: boolean): void;

  /** Applies a master volume in [0, 1] to every sound. */
  setMasterVolume(volume: number): void;

  /** True while at least one playback of the key is running. */
  isPlaying(key: string): boolean;
}
