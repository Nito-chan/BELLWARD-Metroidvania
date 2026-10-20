import { Container, Sprite } from 'pixi.js';
import { PALETTE } from '../config/palette';
import type { PropLayerName, RoomProp } from '../world/Room';
import type { ArtProvider } from './ArtProvider';

/** Draws props for one depth band, anchored at their bottom-center. */
export class PropLayer {
  readonly view = new Container();

  constructor(props: readonly RoomProp[], layer: PropLayerName, art: ArtProvider) {
    for (const prop of props) {
      if (prop.layer !== layer) continue;
      const sprite = new Sprite(art.prop(prop.art));
      sprite.anchor.set(0.5, 1);
      sprite.position.set(prop.x, prop.y);
      if (prop.tint) sprite.tint = PALETTE[prop.tint];
      this.view.addChild(sprite);
    }
  }
}
