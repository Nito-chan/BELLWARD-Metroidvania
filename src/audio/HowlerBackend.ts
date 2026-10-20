/**
 * The Howler implementation of AudioBackend. This is the only module in `src/` that
 * knows `howler` exists — everything else talks to the interface, so the simulation and
 * its tests never touch Web Audio.
 */
import { Howl, Howler } from 'howler';
import type { AudioBackend, BackendContextState, PlaybackHandle } from './Backend';

export class HowlerBackend implements AudioBackend {
  private readonly howls = new Map<string, Howl>();
  private readonly failed = new Set<string>();

  constructor() {
    // Unlocking is driven by the first user gesture (see Game), not by Howler's own
    // document listeners, so the unlock moment is explicit and inspectable.
    Howler.autoUnlock = false;
  }

  async unlock(): Promise<void> {
    const ctx = Howler.ctx;
    // No context yet means no sound was ever registered; nothing to resume.
    if (!ctx || ctx.state === 'running') return;
    await ctx.resume();
  }

  contextState(): BackendContextState {
    const ctx = Howler.ctx;
    if (!ctx) return 'none';
    return ctx.state;
  }

  load(key: string, url: string): void {
    if (this.howls.has(key) || this.failed.has(key)) return;
    const howl = new Howl({
      src: [url],
      preload: true,
      // WebAudio path: needed for per-playback rate control and precise fades.
      html5: false,
      volume: 1,
      onloaderror: (_id: number, error: unknown) => {
        this.failed.add(key);
        console.warn(`[BELLWARD] audio failed to load: ${key} — ${url} (${String(error)})`);
      },
    });
    this.howls.set(key, howl);
  }

  failures(): readonly string[] {
    return [...this.failed].sort();
  }

  play(key: string, volume: number, rate: number): PlaybackHandle {
    const howl = this.howls.get(key);
    if (!howl || this.failed.has(key)) return -1;
    const handle = howl.play();
    howl.volume(volume, handle);
    howl.rate(rate, handle);
    return handle;
  }

  playLoopFadingIn(key: string, volume: number, ms: number): PlaybackHandle {
    const howl = this.howls.get(key);
    if (!howl || this.failed.has(key)) return -1;
    const handle = howl.play();
    howl.volume(0, handle);
    howl.fade(0, volume, ms, handle);
    return handle;
  }

  setVolume(key: string, volume: number): void {
    this.howls.get(key)?.volume(volume);
  }

  fadeOutAndStop(key: string, handle: PlaybackHandle, ms: number): void {
    const howl = this.howls.get(key);
    if (!howl || handle < 0) return;
    const current = howl.volume(handle);
    howl.fade(typeof current === 'number' ? current : 0, 0, ms, handle);
    howl.once(
      'fade',
      () => {
        howl.stop(handle);
      },
      handle,
    );
  }

  mute(muted: boolean): void {
    Howler.mute(muted);
  }

  setMasterVolume(volume: number): void {
    Howler.volume(volume);
  }

  isPlaying(key: string): boolean {
    const howl = this.howls.get(key);
    return howl ? howl.playing() : false;
  }
}
