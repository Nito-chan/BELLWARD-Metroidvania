import { Container, Graphics } from 'pixi.js';
import { PALETTE } from '../config/palette';
import { VIEW } from '../config/world';
import { BellwardError } from '../core/Errors';
import type { Rng } from '../core/Rng';
import type { Room } from '../world/Room';
import type { ArtProvider } from './ArtProvider';
import { MoteField } from './MoteField';
import { ParallaxLayer } from './ParallaxLayer';

/**
 * Everything behind and in front of the play field: parallax strips, the room tint and
 * drifting motes. Two separate containers preserve the layer order around the world.
 */
export class SceneBackdrop {
  readonly backgroundView = new Container();
  readonly overlayView = new Container();
  private readonly backgrounds: ParallaxLayer[] = [];
  private readonly motes: MoteField;

  constructor(room: Room, art: ArtProvider, rng: Rng) {
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
      this.backgroundView.addChild(layer.view);
    }

    const ambient = new Graphics()
      .rect(0, 0, VIEW.width, VIEW.height)
      .fill(PALETTE[room.definition.ambient.tint]);
    ambient.alpha = room.definition.ambient.alpha;
    this.motes = new MoteField(rng);
    this.overlayView.addChild(ambient, this.motes.view);
  }

  follow(camera: { x: number; y: number }): void {
    for (const layer of this.backgrounds) layer.follow(camera);
  }

  update(tickCount: number): void {
    this.motes.update(tickCount);
  }
}
