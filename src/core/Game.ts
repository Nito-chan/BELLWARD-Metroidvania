import { Application, Rectangle } from 'pixi.js';
import { AudioManager } from '../audio/AudioManager';
import { HowlerBackend } from '../audio/HowlerBackend';
import { AUDIO } from '../config/audio';
import { DEBUG } from '../config/debug';
import { PALETTE } from '../config/palette';
import { BOSS_KINDS } from '../config/enemies';
import { CHARMS, CHARM_ORDER, CHARM_SLOTS, type CharmId } from '../config/progression';
import { RENDER } from '../config/render';
import { SIM, VIEW, WORLD } from '../config/world';
import type { GameDebugState } from '../debug/DebugState';
import { DebugOverlay } from '../debug/DebugOverlay';
import { InputManager } from '../input/InputManager';
import { loadBindings, saveBindings, type Bindings } from '../input/bindings';
import { Announcer } from '../ui/Announcer';
import { BenchOverlay, type BenchChange, type BenchState } from '../ui/bench/BenchOverlay';
import { EndingOverlay } from '../ui/ending/EndingOverlay';
import { MenuSystem } from '../ui/menu/MenuSystem';
import type { MenuScreen } from '../ui/menu/menuTypes';
import type { BenchRef } from '../data/benches';
import { ArtProvider } from '../render/ArtProvider';
import type { RoomSpawn } from '../world/Room';
import { BellwardError, formatError } from './Errors';
import { EventBus } from './EventBus';
import { Loop } from './Loop';
import { Rng } from './Rng';
import { RunSession } from './RunSession';
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
  private readonly announcer = new Announcer();
  private readonly audio = new AudioManager(new HowlerBackend(), { rng: this.rng.fork() });
  private readonly run = new RunSession();
  private readonly loop = new Loop({
    dt: SIM.dt,
    maxFrameTime: SIM.maxFrameTime,
    step: () => this.onTick(),
    render: (alpha: number) => this.onRender(alpha),
    onError: (error: unknown) => this.recordError('simulation frame failed', error),
  });
  private bindings: Bindings;
  private readonly input: InputManager;
  private readonly menu: MenuSystem;
  private readonly benchOverlay: BenchOverlay;
  private readonly endingOverlay: EndingOverlay;
  private benchRef: BenchRef | null = null;

  private ready = false;
  private lastWholeSecond = 0;
  private overlayFrameCounter = 0;
  /** Suppress the menu key edges that closed an overlay on the first resumed tick. */
  private menuLatch = false;
  /** Physical menu keys currently down; survives an InputManager reset. */
  private readonly menuKeysDown = new Set<string>();

  constructor() {
    this.bindings = loadBindings();
    this.input = new InputManager({ bindings: this.bindings });
    this.menu = new MenuSystem({
      bindings: this.bindings,
      audio: this.audio,
      applyBindings: (next) => {
        this.bindings = next;
        this.menuKeysDown.clear();
        this.input.setBindings(next);
        saveBindings(next);
      },
      onClose: () => this.resumeFromMenu(),
      getMap: () => this.run.mapSnapshot(),
      mapKeyCodes: () => this.bindings.keyboard.map,
    });
    this.benchOverlay = new BenchOverlay({
      getState: () => this.benchState(),
      onToggleCharm: (id) => this.toggleCharm(id),
      onBuyNail: () => this.buyNail(),
      onClose: () => this.resumeFromOverlay(),
      announce: (text) => this.announcer.say(text),
    });
    this.endingOverlay = new EndingOverlay({
      onClose: () => this.resumeFromOverlay(),
      announce: (text) => this.announcer.say(text),
    });
  }

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

    const art = await ArtProvider.load();
    this.run.begin({
      art,
      audio: this.audio,
      rng: this.rng,
      stage: this.app.stage,
      announce: (text) => this.announcer.say(text),
      onBench: (bench) => this.openBench(bench),
      onEnding: (title, subtitle) => this.openEnding(title, subtitle),
    });
    window.addEventListener('resize', this.onResize);
    this.onResize();

    this.overlay.mount();
    this.menu.mount();
    window.addEventListener('keydown', this.onMenuKeyDown, true);
    window.addEventListener('keyup', this.onMenuKeyUp, true);
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onBlur);
    window.addEventListener('pointerdown', this.onGesture);

    // Registering sounds before any gesture lets Howler buffer them while the context
    // is still suspended; nothing is audible until the first gesture unlocks it.
    this.audio.load();

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
      scene: this.run.scene?.debugState() ?? null,
      run: this.run.progress.debugRun(this.run.roomId),
      save: this.run.progress.debugSave(),
      audio: this.audio.debugState(),
      menu: this.menu.debugState(),
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
    if (this.menu.isOpen || this.benchOverlay.isOpen || this.endingOverlay.isOpen) return;
    const snapshot = this.input.snapshot();

    if (this.menuLatch) {
      if (
        this.menuKeysDown.size === 0 &&
        !snapshot.held.has('pause') &&
        !snapshot.held.has('map')
      ) {
        this.menuLatch = false;
      }
    } else if (snapshot.pressed.has('pause')) {
      this.openMenu('pause');
      return;
    } else if (snapshot.pressed.has('map')) {
      this.openMenu('map');
      return;
    }

    const wholeSecond = Math.floor(this.loop.stats.tickCount * SIM.dt);
    if (wholeSecond > this.lastWholeSecond) {
      this.lastWholeSecond = wholeSecond;
      this.events.emit('secondElapsed', { seconds: wholeSecond });
    }
    if (this.run.scene) {
      const events = this.run.tick(this.loop.stats.tickCount, snapshot);
      for (const event of events) this.audio.onPlayerEvent(event);
    }
    this.audio.tick(this.loop.stats.tickCount);
  }

  /** Freezes the simulation but keeps rendering the scene behind the overlay. */
  private openMenu(screen: MenuScreen): void {
    if (this.benchOverlay.isOpen || this.endingOverlay.isOpen) return;
    this.input.reset();
    this.loop.pause();
    this.menu.open(screen);
  }

  /** Resumes from the overlay without letting a held pause/map input re-open it. */
  private resumeFromMenu(): void {
    this.menuLatch = true;
    this.input.reset();
    this.loop.resume();
    this.app.canvas.focus();
  }

  private benchState(): BenchState {
    const progress = this.run.progress;
    const nails = progress.nails;
    const slotsUsed = [...progress.charmsEquipped].reduce(
      (total, id) => total + CHARMS[id].cost,
      0,
    );
    return {
      benchName: this.benchRef?.name ?? 'The Bench',
      shards: progress.shards,
      nailLevel: nails.level,
      nailMax: nails.maxLevel,
      nextCost: nails.nextCost,
      slotsUsed,
      slotsTotal: CHARM_SLOTS,
      charms: CHARM_ORDER.map((id) => ({
        id,
        name: CHARMS[id].name,
        description: CHARMS[id].description,
        cost: CHARMS[id].cost,
        owned: progress.charmsOwned.includes(id),
        equipped: progress.charmsEquipped.includes(id),
      })),
    };
  }

  private toggleCharm(id: CharmId): BenchChange {
    const progress = this.run.progress;
    const name = CHARMS[id].name;
    if (!progress.charmsOwned.includes(id)) {
      return { ok: false, message: `${name} has not been found yet.` };
    }
    const wasEquipped = progress.charmsEquipped.includes(id);
    if (!progress.toggleCharm(id)) {
      return { ok: false, message: 'No free charm slots. Set another charm aside first.' };
    }
    this.afterBenchChange();
    return {
      ok: true,
      message: wasEquipped ? `${name} set aside.` : `${name} equipped.`,
    };
  }

  private buyNail(): BenchChange {
    const progress = this.run.progress;
    const cost = progress.nails.nextCost;
    if (cost === null) return { ok: false, message: 'The nail is already fully tempered.' };
    if (progress.shards < cost) {
      return {
        ok: false,
        message: `The forge wants ${cost} shards. You carry ${progress.shards}.`,
      };
    }
    if (!progress.buyNailUpgrade()) {
      return { ok: false, message: 'The forge refuses; nothing was spent.' };
    }
    this.afterBenchChange();
    return { ok: true, message: `The nail is tempered to +${progress.nails.level}.` };
  }

  /** Equipment changes are durable immediately and visible on the loaded hero. */
  private afterBenchChange(): void {
    this.run.scene?.applyProgress(this.run.progress.loadout, this.run.progress.shards);
    this.run.saveAtBench();
  }

  private openBench(bench: BenchRef): void {
    this.benchRef = bench;
    this.input.reset();
    this.loop.pause();
    this.benchOverlay.open();
  }

  private openEnding(title: string, subtitle: string): void {
    const progress = this.run.progress;
    this.input.reset();
    this.loop.pause();
    this.endingOverlay.open(title, subtitle, {
      sigils: progress.sigils.length,
      bossCount: BOSS_KINDS.length,
      shards: progress.shards,
      charms: progress.charmsOwned.length,
    });
  }

  private resumeFromOverlay(): void {
    this.benchRef = null;
    this.menuLatch = true;
    this.input.reset();
    this.loop.resume();
    this.app.canvas.focus();
  }

  /** DEV-only: jump straight into a room (optionally at a validated spawn) for E2E. */
  debugLoadRoom(roomId: string, spawn?: RoomSpawn): void {
    if (!this.ready) throw new BellwardError('debugLoadRoom() called before boot() completed');
    // A test may jump rooms between a keydown and keyup; never carry a held run key.
    this.input.reset();
    this.run.debugLoadRoom(roomId, spawn);
  }

  /** DEV-only: kill the hero through the real damage path for respawn coverage. */
  debugKillPlayer(): boolean {
    return this.run.scene?.debugKillPlayer() ?? false;
  }

  /** DEV-only: hold i-frames open while a probe inspects boss phases. */
  debugProtectPlayer(): boolean {
    return this.run.scene?.debugProtectPlayer(DEBUG.protectTicks) ?? false;
  }

  /** DEV-only: route damage through the boss's real phase/gate logic. */
  debugDamageBoss(amount: number): boolean {
    return this.run.scene?.debugDamageBoss(amount) ?? false;
  }

  /** DEV-only: break the Bellbearer's shield without replaying the wall charge. */
  debugBreakWard(): boolean {
    return this.run.scene?.debugBreakWard() ?? false;
  }

  /** DEV-only: kill the active boss to exercise rewards, banners and door unlocking. */
  debugDefeatBoss(): void {
    this.run.scene?.debugDefeatBoss();
  }

  private onRender(alpha: number): void {
    const scene = this.run.scene;
    if (scene) scene.render(alpha);
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

  private readonly onMenuKeyDown = (event: KeyboardEvent): void => {
    const keyboard = this.bindings.keyboard;
    if (keyboard.pause.includes(event.code) || keyboard.map.includes(event.code)) {
      this.menuKeysDown.add(event.code);
    }
  };

  private readonly onMenuKeyUp = (event: KeyboardEvent): void => {
    this.menuKeysDown.delete(event.code);
  };

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    if (this.menu.isOpen || this.benchOverlay.isOpen || this.endingOverlay.isOpen) return;
    if (event.defaultPrevented) return;
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
    if (this.menu.isOpen || this.benchOverlay.isOpen || this.endingOverlay.isOpen) return;
    if (event.defaultPrevented) return;
    if (this.input.handleKey(event.code, false)) event.preventDefault();
  };

  /** Losing focus mid-keypress must not leave the hero running forever. */
  private readonly onBlur = (): void => {
    this.input.blur();
    this.menuKeysDown.clear();
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
