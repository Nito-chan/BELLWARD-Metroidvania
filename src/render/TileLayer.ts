import { Container, Sprite } from 'pixi.js';
import { RENDER } from '../config/render';
import type { Tilemap } from '../world/Tilemap';
import { roleIsSolid, type TileRole } from '../world/tiles';
import type { ArtProvider } from './ArtProvider';

/**
 * Draws every non-empty tile as a sprite. Decorative tiles render in a lower container
 * so a window or cobweb can never paint over a solid ledge. The layer is static; the
 * camera moves the parent world container.
 *
 * Small sprites are cheap even on software WebGL — far cheaper than flattening the
 * room into one large alpha-blended quad, which is a fill-rate trap (D018).
 */
export class TileLayer {
  readonly view = new Container();

  constructor(tilemap: Tilemap, art: ArtProvider) {
    const decor = new Container();
    const solid = new Container();
    this.view.addChild(decor, solid);

    tilemap.forEachTile((tx, ty, role: TileRole) => {
      const sprite = new Sprite(art.tile(role, tx, ty));
      sprite.position.set(tx * RENDER.tileSize, ty * RENDER.tileSize);
      (roleIsSolid(role) ? solid : decor).addChild(sprite);
    });
  }
}
