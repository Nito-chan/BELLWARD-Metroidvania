/**
 * AudioManager logic, exercised through a recording fake backend: no Web Audio, no
 * Howler, no browser. The suite also cross-checks the data tables against the files on
 * disk and against MANIFEST.json, because a sound that points at a missing file is a
 * silent failure the game must never ship with.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  AudioManager,
  musicVoiceKey,
  sfxVoiceKey,
  type AudioStorage,
} from '../../src/audio/AudioManager';
import type { AudioBackend, BackendContextState, PlaybackHandle } from '../../src/audio/Backend';
import { AUDIO } from '../../src/config/audio';
import { Rng } from '../../src/core/Rng';
import { MUSIC, PLAYER_SFX, SFX } from '../../src/data/audio';
import type { PlayerEvent } from '../../src/player/PlayerController';

const ROOT = process.cwd();

class FakeBackend implements AudioBackend {
  readonly loads: Array<{ key: string; url: string }> = [];
  readonly plays: Array<{ key: string; volume: number; rate: number }> = [];
  readonly loops: Array<{ key: string; volume: number; ms: number }> = [];
  readonly fadeOuts: Array<{ key: string; handle: PlaybackHandle; ms: number }> = [];
  readonly keyVolumes: Array<{ key: string; volume: number }> = [];
  readonly muteCalls: boolean[] = [];
  readonly failed: string[] = [];
  masterVolume = -1;
  context: BackendContextState = 'suspended';
  private readonly playing = new Set<string>();
  private nextHandle = 1;
  private releaseUnlock: (() => void) | null = null;
  private unlocking = false;

  /** Models a context that takes a while to start (a real one can take ~1 s). */
  holdUnlock(): void {
    this.unlocking = true;
  }

  /** Lets a held unlock() resolve. */
  finishUnlock(): void {
    this.unlocking = false;
    this.releaseUnlock?.();
    this.releaseUnlock = null;
  }

  async unlock(): Promise<void> {
    if (this.unlocking) {
      await new Promise<void>((resolve) => {
        this.releaseUnlock = resolve;
      });
    }
    this.context = 'running';
  }

  contextState(): BackendContextState {
    return this.context;
  }

  load(key: string, url: string): void {
    this.loads.push({ key, url });
  }

  failures(): readonly string[] {
    return this.failed;
  }

  play(key: string, volume: number, rate: number): PlaybackHandle {
    this.plays.push({ key, volume, rate });
    this.playing.add(key);
    return this.nextHandle++;
  }

  playLoopFadingIn(key: string, volume: number, ms: number): PlaybackHandle {
    this.loops.push({ key, volume, ms });
    this.playing.add(key);
    return this.nextHandle++;
  }

  setVolume(key: string, volume: number): void {
    this.keyVolumes.push({ key, volume });
  }

  fadeOutAndStop(key: string, handle: PlaybackHandle, ms: number): void {
    this.fadeOuts.push({ key, handle, ms });
    this.playing.delete(key);
  }

  mute(muted: boolean): void {
    this.muteCalls.push(muted);
  }

  setMasterVolume(volume: number): void {
    this.masterVolume = volume;
  }

  isPlaying(key: string): boolean {
    return this.playing.has(key);
  }
}

class MapStorage implements AudioStorage {
  readonly map = new Map<string, string>();

  getItem(key: string): string | null {
    return this.map.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.map.set(key, value);
  }
}

function makeAudio(
  backend: FakeBackend,
  storage: AudioStorage | null = new MapStorage(),
): AudioManager {
  return new AudioManager(backend, { rng: new Rng(0x5eed), storage });
}

function playKeys(backend: FakeBackend): string[] {
  return backend.plays.map((play) => play.key);
}

describe('audio data tables', () => {
  it('points every sound and track at a file that exists on disk', () => {
    const urls = [
      ...Object.values(SFX).flatMap((def) => def.urls),
      ...Object.values(MUSIC).map((def) => def.url),
    ];
    expect(urls.length).toBeGreaterThan(0);
    for (const url of urls) {
      expect(existsSync(join(ROOT, 'public', url)), url).toBe(true);
    }
  });

  it('covers every sound and track with a MANIFEST.json entry', () => {
    const manifest = JSON.parse(
      readFileSync(join(ROOT, 'public', 'assets', 'MANIFEST.json'), 'utf8'),
    ) as { assets: Array<{ path: string }> };
    const prefixes = manifest.assets.map((asset) => `assets/${asset.path}/`);
    const urls = [
      ...Object.values(SFX).flatMap((def) => def.urls),
      ...Object.values(MUSIC).map((def) => def.url),
    ];
    for (const url of urls) {
      expect(
        prefixes.some((prefix) => url.startsWith(prefix)),
        `${url} is not covered by any manifest entry`,
      ).toBe(true);
    }
  });

  it('maps every player event to a usable sound', () => {
    const events: PlayerEvent[] = [
      'jump',
      'land',
      'landHeavy',
      'footstep',
      'skid',
      'attack1',
      'attack2',
      'dash',
      'hurt',
      'death',
    ];
    expect(Object.keys(PLAYER_SFX).sort()).toEqual([...events].sort());
    for (const event of events) {
      expect(SFX[PLAYER_SFX[event]]).toBeDefined();
    }
  });
});

describe('AudioManager', () => {
  it('registers every sfx variant at boot, and only the requested track for music', () => {
    const backend = new FakeBackend();
    const audio = makeAudio(backend);
    audio.load();

    const expectedSfxKeys = Object.entries(SFX).flatMap(([key, def]) =>
      def.urls.map((_, variant) => sfxVoiceKey(key as keyof typeof SFX, variant)),
    );
    expect(backend.loads.map((load) => load.key)).toEqual(expectedSfxKeys);
    // Nothing musical has been touched yet: the boss themes are not downloaded or
    // decoded until a room asks for them.
    expect(backend.loads.some((load) => load.key.startsWith('music:'))).toBe(false);
    expect(backend.masterVolume).toBe(AUDIO.defaults.master);
    expect(backend.muteCalls.at(-1)).toBe(false);

    audio.requestMusic('terrace');
    expect(backend.loads.at(-1)).toEqual({
      key: musicVoiceKey('terrace'),
      url: MUSIC.terrace.url,
    });
    expect(backend.loads.filter((load) => load.key.startsWith('music:'))).toHaveLength(1);

    // Asking twice is a no-op, so a re-entering room cannot double-register a track.
    audio.requestMusic('terrace');
    expect(backend.loads.filter((load) => load.key.startsWith('music:'))).toHaveLength(1);
  });

  it('stays silent until the unlock gesture, then starts the requested track', async () => {
    const backend = new FakeBackend();
    const audio = makeAudio(backend);
    audio.load();
    audio.requestMusic('terrace');

    audio.tick(30);
    audio.onPlayerEvent('jump');
    expect(backend.loops).toEqual([]);
    expect(backend.plays).toEqual([]);

    await audio.unlock();
    expect(backend.loops).toEqual([
      {
        key: musicVoiceKey('terrace'),
        volume: MUSIC.terrace.volume * AUDIO.defaults.music,
        ms: AUDIO.fades.inMs,
      },
    ]);
    expect(audio.debugState().musicPlaying).toBe(true);
    expect(audio.debugState().context).toBe('running');
  });

  it('opens the gate with the gesture, but waits for a live context to start music', async () => {
    const backend = new FakeBackend();
    backend.holdUnlock();
    const audio = makeAudio(backend);
    audio.requestMusic('terrace');

    const unlocking = audio.unlock();
    // The gate is open immediately: gameplay may request sounds from the next tick on.
    expect(audio.debugState().unlocked).toBe(true);
    // But nothing is scheduled into a context that is still starting up.
    expect(backend.loops).toEqual([]);
    audio.tick(60);
    audio.onPlayerEvent('footstep');
    expect(backend.plays).toEqual([]);

    backend.finishUnlock();
    await unlocking;
    expect(backend.loops.map((loop) => loop.key)).toEqual([musicVoiceKey('terrace')]);

    audio.tick(61);
    audio.onPlayerEvent('footstep');
    expect(playKeys(backend)).toEqual([expect.stringMatching(/^sfx:footstep:/)]);
  });

  it('plays the mapped sound for a player event and rate-limits repeats', async () => {
    const backend = new FakeBackend();
    const audio = makeAudio(backend);
    await audio.unlock();

    audio.tick(100);
    audio.onPlayerEvent('jump');
    expect(playKeys(backend).at(-1)).toMatch(/^sfx:jump:/);

    audio.onPlayerEvent('jump');
    expect(playKeys(backend)).toHaveLength(1);

    audio.tick(100 + SFX.jump.cooldownTicks);
    audio.onPlayerEvent('jump');
    expect(playKeys(backend)).toHaveLength(2);
    expect(backend.plays.at(-1)?.rate).toBeGreaterThan(0);
  });

  it('scales one-shots by the sfx bus and tracks by the music bus', async () => {
    const backend = new FakeBackend();
    const audio = makeAudio(backend);
    await audio.unlock();
    audio.requestMusic('terrace');

    audio.setVolume('sfx', 0.5);
    audio.setVolume('music', 0.25);
    audio.tick(200);
    audio.onPlayerEvent('dash');

    expect(backend.plays.at(-1)?.volume).toBeCloseTo(SFX.dash.volume * 0.5, 6);
    expect(backend.keyVolumes.at(-1)).toEqual({
      key: musicVoiceKey('terrace'),
      volume: MUSIC.terrace.volume * 0.25,
    });
    expect(backend.masterVolume).toBe(AUDIO.defaults.master);
  });

  it('crossfades when the room asks for another track, and ignores repeats', async () => {
    const backend = new FakeBackend();
    const audio = makeAudio(backend);
    await audio.unlock();
    audio.requestMusic('terrace');
    expect(backend.loops).toHaveLength(1);

    audio.requestMusic('bossCitadel');
    expect(backend.fadeOuts).toEqual([
      { key: musicVoiceKey('terrace'), handle: 1, ms: AUDIO.fades.outMs },
    ]);
    expect(backend.loops.at(-1)?.key).toBe(musicVoiceKey('bossCitadel'));

    // Asking for the track that is already playing must not restart it.
    audio.requestMusic('bossCitadel');
    expect(backend.loops).toHaveLength(2);
  });

  it('mutes instantly, silences new sounds, and remembers the choice', async () => {
    const backend = new FakeBackend();
    const storage = new MapStorage();
    const audio = makeAudio(backend, storage);
    await audio.unlock();

    expect(audio.toggleMute()).toBe(true);
    expect(backend.muteCalls.at(-1)).toBe(true);
    audio.tick(300);
    audio.onPlayerEvent('footstep');
    expect(backend.plays).toEqual([]);

    expect(audio.toggleMute()).toBe(false);
    audio.tick(320);
    audio.onPlayerEvent('footstep');
    expect(playKeys(backend).at(-1)).toMatch(/^sfx:footstep:/);

    const saved = JSON.parse(storage.getItem(AUDIO.storageKey) ?? '{}') as { muted?: boolean };
    expect(saved.muted).toBe(false);
  });

  it('restores a saved mix and falls back to defaults for corrupt data', () => {
    const storage = new MapStorage();
    storage.setItem(
      AUDIO.storageKey,
      JSON.stringify({ master: 0.4, music: 0.2, sfx: 0.3, muted: true }),
    );
    const restored = makeAudio(new FakeBackend(), storage);
    expect(restored.debugState().volumes).toEqual({ master: 0.4, music: 0.2, sfx: 0.3 });
    expect(restored.debugState().muted).toBe(true);

    storage.setItem(AUDIO.storageKey, '{ this is not json');
    const fallback = makeAudio(new FakeBackend(), storage);
    expect(fallback.debugState().volumes).toEqual(AUDIO.defaults);
    expect(fallback.debugState().muted).toBe(false);
  });

  it('tolls the distant bell on the configured schedule once unlocked', async () => {
    const backend = new FakeBackend();
    const audio = makeAudio(backend);
    await audio.unlock();

    audio.tick(AUDIO.bell.firstTicks - 1);
    expect(backend.plays).toEqual([]);

    audio.tick(AUDIO.bell.firstTicks);
    expect(playKeys(backend)).toEqual([expect.stringMatching(/^sfx:bell:/)]);

    // The next toll lands inside the configured window, on the sim clock.
    let tick = AUDIO.bell.firstTicks;
    for (let i = 0; i <= AUDIO.bell.maxTicks && backend.plays.length < 2; i += 1) {
      tick += 1;
      audio.tick(tick);
    }
    const gap = tick - AUDIO.bell.firstTicks;
    expect(backend.plays).toHaveLength(2);
    expect(gap).toBeGreaterThanOrEqual(AUDIO.bell.minTicks);
    expect(gap).toBeLessThanOrEqual(AUDIO.bell.maxTicks);
  });

  it('surfaces load failures from the backend in the debug snapshot', () => {
    const backend = new FakeBackend();
    backend.failed.push('sfx:bell:0');
    const audio = makeAudio(backend);
    expect(audio.debugState().failed).toEqual(['sfx:bell:0']);
  });
});
