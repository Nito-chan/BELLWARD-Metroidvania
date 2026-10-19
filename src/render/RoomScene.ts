import { Container, Graphics, Sprite, Texture } from 'pixi.js';
import { PALETTE } from '../config/palette';
import { DEMO } from '../config/render';
import { SIM, VIEW } from '../config/world';
import { BellwardError } from '../core/Errors';
import type { Rng } from '../core/Rng';
import type { SceneDebugState } from '../debug/DebugState';
import type { Room } from '../world/Room';
import type { ArtProvider } from './ArtProvider';
import { Camera } from './Camera';
import { HeroView, type Facing } from './HeroView';
import { ParallaxLayer } from './ParallaxLayer';
import { PropLayer } from './PropLayer';
import { TileLayer } from './TileLayer';

type Mote = {
  readonly view: Sprite;
  readonly baseX: number;
  readonly phase: number;
  readonly speed: number;
};

const MOTE_COUNT = 28;

/**
 * M1 room scene: renders the belfry terrace and walks the hero along a scripted patrol.
 * The patrol is a camera/animation showcase only — M2 replaces it with the player
 * controller. Simulation state changes exclusively in update(); render() only samples
 * interpolated camera positions.
 */
export class RoomScene {
  readonly view = new Container();
  private readonly camera: Camera;
  private readonly heroView: HeroView;
  private readonly backgrounds: ParallaxLayer[] = [];
  private readonly motes: Mote[] = [];
  private readonly world = new Container();
  private heroX: number;
  private readonly heroY: number;
  private facing: Facing = 1;
  private pauseTicksLeft = 0;

  constructor(
    private readonly room: Room,
    private readonly art: ArtProvider,
    rng: Rng,
  ) {
    this.camera = new Camera(room.bounds);
    this.heroX = room.spawn.x;
    this.heroY = room.spawn.y;
    this.camera.snapTo(this.heroX, this.heroY + DEMO.focusOffsetY);

    // A layer only travels (roomWidth - viewWidth) * factor pixels across the whole
    // room, so each background needs a short strip — not an infinite tiling shader.
    const panRange = Math.max(0, room.bounds.w - VIEW.width);
    for (const key of room.definition.backgrounds) {
      const background = art.background(key);
      if (!background) {
        throw new BellwardError(
          `room "${room.definition.id}" requests unknown background "${key}"`,
        );
      }
      const layer = new ParallaxLayer(background, panRange * background.factor);
      this.backgrounds.push(layer);
      this.view.addChild(layer.view);
    }

    this.world.addChild(new TileLayer(room.tilemap, art).view);
    this.world.addChild(new PropLayer(room.definition.props, 'back', art).view);
    this.heroView = new HeroView(art);
    this.world.addChild(this.heroView.view);
    this.world.addChild(new PropLayer(room.definition.props, 'front', art).view);
    this.view.addChild(this.world);

    const ambient = new Graphics()
      .rect(0, 0, VIEW.width, VIEW.height)
      .fill(PALETTE[room.definition.ambient.tint]);
    ambient.alpha = room.definition.ambient.alpha;
    this.view.addChild(ambient);

    const moteLayer = new Container();
    for (let i = 0; i < MOTE_COUNT; i += 1) {
      // One shared white texture means the motes batch into a single draw call.
      const mote = new Sprite(Texture.WHITE);
      mote.anchor.set(0.5);
      mote.width = 3;
      mote.height = 3;
      mote.tint = PALETTE.echo;
      moteLayer.addChild(mote);
      this.motes.push({
        view: mote,
        baseX: rng.float(0, VIEW.width),
        phase: rng.float(0, Math.PI * 2),
        speed: rng.float(0.3, 0.9),
      });
    }
    this.view.addChild(moteLayer);
  }

  /** Advances the simulation by one fixed tick. */
  update(tickCount: number): void {
    const moving = this.advancePatrol();
    this.heroView.setPose(this.heroX, this.heroY, this.facing, moving ? 'run' : 'idle');
    this.heroView.tick();
    this.camera.update(this.heroX, this.heroY + DEMO.focusOffsetY);
    this.updateMotes(tickCount);
  }

  /** Samples the interpolated camera and snaps the world to whole pixels. */
  render(alpha: number): void {
    const view = this.camera.view(alpha);
    const x = Math.round(view.x);
    const y = Math.round(view.y);
    this.world.position.set(-x, -y);
    for (const layer of this.backgrounds) layer.follow({ x, y });
  }

  debugState(): SceneDebugState {
    return {
      roomId: this.room.definition.id,
      roomName: this.room.definition.name,
      tiles: this.room.tilemap.tileCount,
      art: {
        mode: this.art.mode,
        loaded: this.art.loadedKeys(),
        failures: [...this.art.failures],
      },
      camera: { x: this.camera.x, y: this.camera.y },
      hero: {
        x: this.heroX,
        y: this.heroY,
        animation: this.heroView.animation,
        facing: this.facing,
      },
    };
  }

  /** Returns true while the hero is walking. */
  private advancePatrol(): boolean {
    if (this.pauseTicksLeft > 0) {
      this.pauseTicksLeft -= 1;
      return false;
    }
    this.heroX += this.facing * DEMO.patrol.speed * SIM.dt;
    if (this.heroX >= DEMO.patrol.maxX) {
      this.heroX = DEMO.patrol.maxX;
      this.facing = -1;
      this.pauseTicksLeft = DEMO.patrol.pauseTicks;
    } else if (this.heroX <= DEMO.patrol.minX) {
      this.heroX = DEMO.patrol.minX;
      this.facing = 1;
      this.pauseTicksLeft = DEMO.patrol.pauseTicks;
    }
    return true;
  }

  private updateMotes(tickCount: number): void {
    const t = tickCount / 60;
    const span = VIEW.height + 80;
    for (const mote of this.motes) {
      const travel = (mote.phase * 101 + t * mote.speed * 22) % span;
      const x = mote.baseX + Math.sin(t * 0.6 + mote.phase) * 16;
      mote.view.position.set(x, VIEW.height + 40 - travel);
      mote.view.alpha = 0.2 + 0.5 * (0.5 + 0.5 * Math.sin(t * 1.7 + mote.phase));
    }
  }
}
