/**
 * The game's audio director. It owns the mix, the unlock gate, per-sound cooldowns, the
 * music state, and the distant-bell ambience. It talks to an `AudioBackend` (Howler in
 * the browser, a recording fake in tests) and to the two content tables in
 * `src/data/audio.ts`, so all of its logic runs in plain Node.
 *
 * Volume math: the backend applies `master` globally (one gain on the whole context);
 * every play request is therefore scaled by its bus only — `sfx` for one-shots,
 * `music` for tracks.
 */
import { AUDIO } from '../config/audio';
import { clamp } from '../core/Math2D';
import type { Rng } from '../core/Rng';
import { MUSIC, PLAYER_SFX, SFX, rateJitterOf, type MusicKey, type SfxKey } from '../data/audio';
import type { PlayerEvent } from '../player/PlayerController';
import type { AudioBackend } from './Backend';

export type AudioBus = 'master' | 'music' | 'sfx';

/** The three faders, each in [0, 1]. */
export type AudioMix = Record<AudioBus, number>;

export type AudioDebugState = {
  /** Underlying audio context state; 'running' once unlocked on a healthy device. */
  context: string;
  /** True once the first user gesture ran the unlock pass. */
  unlocked: boolean;
  muted: boolean;
  /** The track the current room asked for; null when silence is requested. */
  music: MusicKey | null;
  /** True while that track is actually sounding. */
  musicPlaying: boolean;
  volumes: AudioMix;
  /** Most recent one-shot: the key and the tick it fired on. */
  lastSfx: { key: SfxKey; tick: number } | null;
  /** Voice keys that failed to load; empty in a healthy build. */
  failed: string[];
};

/** The slice of localStorage the mix lives in; injectable so tests never touch a browser. */
export type AudioStorage = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
};

const BUSES: readonly AudioBus[] = ['master', 'music', 'sfx'];

/** Backend key for one variant of a sound. Stable across sessions (tests assert it). */
export function sfxVoiceKey(key: SfxKey, variant: number): string {
  return `sfx:${key}:${variant}`;
}

/** Backend key for a music track. */
export function musicVoiceKey(key: MusicKey): string {
  return `music:${key}`;
}

/** localStorage when it exists and is reachable, else null (private mode, embedded). */
function defaultStorage(): AudioStorage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

export class AudioManager {
  private unlocked = false;
  /** The one in-flight unlock, shared so later gesture handlers can await the same start. */
  private unlockPromise: Promise<void> | null = null;
  private muted = false;
  private requestedMusic: MusicKey | null = null;
  private playingMusic: MusicKey | null = null;
  private playingHandle = -1;
  private tickCount = 0;
  private nextBellTick = Number.POSITIVE_INFINITY;
  private lastSfx: { key: SfxKey; tick: number } | null = null;
  private readonly volumes: AudioMix = { ...AUDIO.defaults };
  private readonly lastPlayedAt = new Map<SfxKey, number>();
  private readonly rng: Rng;
  private readonly storage: AudioStorage | null;

  constructor(
    private readonly backend: AudioBackend,
    options: { rng: Rng; storage?: AudioStorage | null },
  ) {
    this.rng = options.rng;
    this.storage = options.storage === undefined ? defaultStorage() : options.storage;
    this.readSavedMix();
    this.backend.setMasterVolume(this.volumes.master);
    this.backend.mute(this.muted);
  }

  /**
   * Registers the one-shot sounds with the backend. Music is deliberately absent here:
   * a track is registered the first time a room asks for it (see requestMusic), so
   * tracks that are never requested are neither downloaded nor decoded.
   */
  load(): void {
    for (const key of Object.keys(SFX) as SfxKey[]) {
      SFX[key].urls.forEach((url, variant) => this.backend.load(sfxVoiceKey(key, variant), url));
    }
  }

  /**
   * Runs the unlock pass from the first user gesture. The gate opens synchronously — a
   * gesture means audio is permitted, and the simulation must not stall behind a context
   * that takes a moment to start. The soundtrack begins once the context is live.
   * Safe to call repeatedly; concurrent callers share the same in-flight promise.
   */
  unlock(): Promise<void> {
    if (this.unlockPromise) return this.unlockPromise;
    this.unlocked = true;
    this.unlockPromise = this.finishUnlock();
    return this.unlockPromise;
  }

  private async finishUnlock(): Promise<void> {
    await this.backend.unlock();
    this.nextBellTick = this.tickCount + AUDIO.bell.firstTicks;
    if (this.requestedMusic) this.startMusic(this.requestedMusic);
  }

  /** Advances the ambience clock. Called once per simulated tick. */
  tick(tickCount: number): void {
    this.tickCount = tickCount;
    if (!this.canPlay) return;
    if (tickCount < this.nextBellTick) return;
    this.nextBellTick = tickCount + this.rng.int(AUDIO.bell.minTicks, AUDIO.bell.maxTicks);
    this.playSfx('bell');
  }

  /** Plays the sound a simulation event maps to. */
  onPlayerEvent(event: PlayerEvent): void {
    this.playSfx(PLAYER_SFX[event]);
  }

  /**
   * Plays one keyed sound: gated on unlock and mute, rate-limited by the key's
   * cooldown, with a random variant and a small pitch jitter so repeats never rattle.
   */
  playSfx(key: SfxKey): void {
    if (!this.canPlay) return;
    const def = SFX[key];
    const last = this.lastPlayedAt.get(key);
    if (last !== undefined && this.tickCount - last < def.cooldownTicks) return;
    this.lastPlayedAt.set(key, this.tickCount);

    const jitter = rateJitterOf(def);
    const rate = jitter > 0 ? 1 + this.rng.float(-jitter, jitter) : 1;
    const variant = this.rng.pickIndex(def.urls.length);
    this.backend.play(sfxVoiceKey(key, variant), def.volume * this.volumes.sfx, rate);
    this.lastSfx = { key, tick: this.tickCount };
  }

  /**
   * Sets the track that should play; crossfades when one is already sounding. This is
   * also where a track is registered with the backend, so a room that never asks for
   * the boss theme never pays for it.
   */
  requestMusic(key: MusicKey | null): void {
    if (key === this.requestedMusic) return;
    this.requestedMusic = key;
    if (key !== null) this.backend.load(musicVoiceKey(key), MUSIC[key].url);
    if (!this.unlocked) return;

    if (this.playingMusic !== null) {
      this.backend.fadeOutAndStop(
        musicVoiceKey(this.playingMusic),
        this.playingHandle,
        AUDIO.fades.outMs,
      );
      this.playingMusic = null;
      this.playingHandle = -1;
    }
    if (key !== null) this.startMusic(key);
  }

  /** Applies a bus volume (clamped to [0, 1]), updates live audio and persists it. */
  setVolume(bus: AudioBus, value: number): void {
    const clamped = clamp(value, 0, 1);
    if (this.volumes[bus] === clamped) return;
    this.volumes[bus] = clamped;
    this.backend.setMasterVolume(this.volumes.master);
    if (this.playingMusic !== null) {
      this.backend.setVolume(musicVoiceKey(this.playingMusic), this.musicLevel(this.playingMusic));
    }
    this.writeMix();
  }

  /** Read-only copy of the three faders for the settings UI. */
  getMix(): AudioMix {
    return { ...this.volumes };
  }

  /** True while master mute is engaged. */
  isMuted(): boolean {
    return this.muted;
  }

  /** Sets master mute idempotently, persists it, and returns the state. */
  setMuted(muted: boolean): boolean {
    if (this.muted === muted) return this.muted;
    this.muted = muted;
    this.backend.mute(this.muted);
    this.writeMix();
    return this.muted;
  }

  /** Flips the master mute, persists it, and returns the new state. */
  toggleMute(): boolean {
    return this.setMuted(!this.muted);
  }

  /** Read-only snapshot for the F1 overlay and the E2E suite. */
  debugState(): AudioDebugState {
    return {
      context: this.backend.contextState(),
      unlocked: this.unlocked,
      muted: this.muted,
      music: this.requestedMusic,
      musicPlaying:
        this.playingMusic !== null && this.backend.isPlaying(musicVoiceKey(this.playingMusic)),
      volumes: { ...this.volumes },
      lastSfx: this.lastSfx,
      failed: [...this.backend.failures()],
    };
  }

  /**
   * True when a play request would actually be heard: the gesture happened, nothing is
   * muted, and the context is live. Sounds requested while the context is still starting
   * up are dropped rather than scheduled into a frozen clock, which would otherwise
   * release them all at once the moment it resumes.
   */
  private get canPlay(): boolean {
    return this.unlocked && !this.muted && this.backend.contextState() === 'running';
  }

  private startMusic(key: MusicKey): void {
    this.playingMusic = key;
    this.playingHandle = this.backend.playLoopFadingIn(
      musicVoiceKey(key),
      this.musicLevel(key),
      AUDIO.fades.inMs,
    );
  }

  /** Bus-relative level for a track (master is applied globally by the backend). */
  private musicLevel(key: MusicKey): number {
    return MUSIC[key].volume * this.volumes.music;
  }

  private readSavedMix(): void {
    if (!this.storage) return;
    try {
      const raw = this.storage.getItem(AUDIO.storageKey);
      if (raw === null) return;
      const parsed = JSON.parse(raw) as Partial<Record<AudioBus | 'muted', unknown>>;
      for (const bus of BUSES) {
        const value = parsed[bus];
        if (typeof value === 'number' && Number.isFinite(value)) {
          this.volumes[bus] = clamp(value, 0, 1);
        }
      }
      if (typeof parsed.muted === 'boolean') this.muted = parsed.muted;
    } catch (error) {
      // A corrupted or blocked storage must never break the boot.
      console.warn('[BELLWARD] ignoring unreadable saved audio mix', error);
    }
  }

  private writeMix(): void {
    if (!this.storage) return;
    try {
      this.storage.setItem(
        AUDIO.storageKey,
        JSON.stringify({ ...this.volumes, muted: this.muted }),
      );
    } catch (error) {
      console.warn('[BELLWARD] could not persist the audio mix', error);
    }
  }
}
