import { Application, Rectangle } from 'pixi.js';
import { AudioManager } from '../audio/AudioManager';
import { HowlerBackend } from '../audio/HowlerBackend';
import { AUDIO } from '../config/audio';
import { DEBUG } from '../config/debug';
import { PALETTE } from '../config/palette';
import { RENDER } from '../config/render';
import { SIM, VIEW, WORLD } from '../config/world';
import { belfryTerrace } from '../data/rooms/belfry-terrace';
import type { GameDebugState } from '../debug/DebugState';
import { DebugOverlay } from '../debug/DebugOverlay';
import { InputManager } from '../input/InputManager';
import { ArtProvider } from '../render/ArtProvider';
import { RoomScene } from '../render/RoomScene';
import { createRoom } from '../world/Room';
import { BellwardError, formatError } from './Errors';
import { EventBus } from './EventBus';
import { Loop } from './Loop';
import { Rng } from './Rng';
import type { GameEvents } from './Types';

/** Result of Game.sampleFrame(): a cheap framebuffer read-back probe for smoke tests. */
export type FrameSample = {
  /** Number of distinct RGB colors found in the framebuffer. */
  uniqueColors: number;
  width: number;
  height: number;
};

/**
 * Composition root. Owns the renderer, the loop, the event bus and the RNG, and
 * wires them together. Nothing room- or gameplay-specific lives in here.
 */
export class Game {
  private readonly app = new Application();
  private readonly errors: string[] = [];
  private readonly events = new EventBus<GameEvents>((event, error) => {
    this.recordError(`event listener for "${event}" threw`, error);
  });
  private readonly rng = new Rng(WORLD.rngSeed);
  private readonly overlay = new DebugOverlay();
  private readonly input = new InputManager();
  /** Audio stays silent until the first user gesture; everything is queued before that. */
  private readonly audio = new AudioManager(new HowlerBackend(), { rng: this.rng.fork() });
  private readonly loop = new Loop({
    dt: SIM.dt,
    maxFrameTime: SIM.maxFrameTime,
    step: () => this.onTick(),
    render: (alpha: number) => this.onRender(alpha),
    onError: (error: unknown) => this.recordError('simulation frame failed', error),
  });

  private scene: RoomScene | null = null;
  private ready = false;
  private lastWholeSecond = 0;
  private overlayFrameCounter = 0;

  /** Initializes the renderer, mounts the canvas, starts the loop. Throws on failure. */
  async boot(): Promise<void> {
    try {
      await this.app.init({
        width: VIEW.width,
        height: VIEW.height,
        resolution: 1,
        autoDensity: false,
        roundPixels: true,
        antialias: false,
        background: PALETTE.void,
        preference: 'webgl',
      });
    } catch (error) {
      throw new BellwardError(`WebGL2 renderer init failed — ${formatError(error)}`);
    }

    // The Loop drives rendering explicitly; Pixi's own ticker must stay out of it.
    this.app.ticker.stop();

    // Keep the batch shader cheap: it loops over this many texture lookups per pixel.
    // Must be set before the first render, while the batcher is still unbuilt (D018).
    this.app.renderer.limits.maxBatchableTextures = RENDER.maxBatchableTextures;

    const mount = document.getElementById('app');
    if (!mount) {
      throw new BellwardError('index.html is missing the #app mount element');
    }
    mount.appendChild(this.app.canvas);
    this.app.canvas.setAttribute('tabindex', '0');

    this.scene = new RoomScene(
      createRoom(belfryTerrace),
      await ArtProvider.load(),
      this.rng.fork(),
    );
    this.app.stage.addChild(this.scene.view);

    window.addEventListener('resize', this.onResize);
    this.onResize();

    this.overlay.mount();
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onBlur);
    window.addEventListener('pointerdown', this.onGesture);

    // Registering sounds before any gesture lets Howler buffer them while the context
    // is still suspended; nothing is audible until the first gesture unlocks it.
    this.audio.load();
    this.audio.requestMusic('terrace');

    this.ready = true;
    this.loop.start();
  }

  /** Read-only runtime snapshot (F1 overlay, E2E smoke tests). Allocates a small object. */
  debugState(): GameDebugState {
    return {
      ready: this.ready,
      canvas: {
        width: this.ready ? this.app.canvas.width : 0,
        height: this.ready ? this.app.canvas.height : 0,
      },
      frameCount: this.loop.stats.frameCount,
      tickCount: this.loop.stats.tickCount,
      simTime: this.loop.stats.simTime,
      smoothedFps: this.loop.stats.smoothedFps,
      renderer: this.ready ? this.app.renderer.name : 'none',
      scene: this.scene?.debugState() ?? null,
      audio: this.audio.debugState(),
      errors: [...this.errors],
    };
  }

  /**
   * Renders the stage into an extraction texture and reads it back, counting unique
   * colors. Used by the E2E smoke test to prove the canvas is actually drawing.
   */
  sampleFrame(): FrameSample {
    if (!this.ready) {
      throw new BellwardError('Game.sampleFrame() called before boot() completed');
    }
    const { pixels, width, height } = this.app.renderer.extract.pixels({
      // Explicit screen-sized frame: extraction must match what the renderer draws,
      // not the (possibly larger) bounds of the stage's contents.
      target: this.app.stage,
      frame: new Rectangle(0, 0, VIEW.width, VIEW.height),
    });
    const colors = new Set<number>();
    for (let i = 0; i < pixels.length; i += 4) {
      const r = pixels[i] ?? 0;
      const g = pixels[i + 1] ?? 0;
      const b = pixels[i + 2] ?? 0;
      colors.add((r << 16) | (g << 8) | b);
    }
    return { uniqueColors: colors.size, width, height };
  }

  private onTick(): void {
    const wholeSecond = Math.floor(this.loop.stats.tickCount * SIM.dt);
    if (wholeSecond > this.lastWholeSecond) {
      this.lastWholeSecond = wholeSecond;
      this.events.emit('secondElapsed', { seconds: wholeSecond });
    }
    if (this.scene) {
      const events = this.scene.update(this.loop.stats.tickCount, this.input.snapshot());
      for (const event of events) this.audio.onPlayerEvent(event);
    }
    this.audio.tick(this.loop.stats.tickCount);
  }

  private onRender(alpha: number): void {
    if (this.scene) {
      this.scene.render(alpha);
    }
    this.app.render();
    this.overlayFrameCounter += 1;
    if (this.overlay.visible && this.overlayFrameCounter >= DEBUG.overlayUpdateEveryFrames) {
      this.overlayFrameCounter = 0;
      this.overlay.update(this.debugState());
    }
  }

  private readonly onResize = (): void => {
    // Integer scale keeps pixels crisp; never shrink below native size.
    const fit = Math.min(window.innerWidth / VIEW.width, window.innerHeight / VIEW.height);
    const scale = Math.max(1, Math.floor(fit));
    this.app.canvas.style.width = `${VIEW.width * scale}px`;
    this.app.canvas.style.height = `${VIEW.height * scale}px`;
  };

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    if (event.key === 'F1') {
      event.preventDefault();
      this.overlay.toggle();
      return;
    }
    if (event.code === AUDIO.muteKey) {
      // A utility binding, not a gameplay action: it never reaches the InputManager.
      event.preventDefault();
      if (!event.repeat) this.audio.toggleMute();
      return;
    }
    this.onGesture();
    // Bound gameplay keys consume their default (arrows scroll, space scrolls, etc.).
    if (this.input.handleKey(event.code, true)) event.preventDefault();
  };

  private readonly onKeyUp = (event: KeyboardEvent): void => {
    if (this.input.handleKey(event.code, false)) event.preventDefault();
  };

  /** Losing focus mid-keypress must not leave the hero running forever. */
  private readonly onBlur = (): void => {
    this.input.blur();
  };

  /**
   * The browser only starts audio inside a user gesture: the first key press or tap is
   * that gesture. Repeat calls are idempotent and cheap.
   */
  private readonly onGesture = (): void => {
    this.audio.unlock().catch((error: unknown) => {
      this.recordError('audio unlock failed', error);
    });
  };

  private recordError(message: string, cause?: unknown): void {
    this.errors.push(message);
    console.error(`[BELLWARD] ${message}`, cause);
  }
}
