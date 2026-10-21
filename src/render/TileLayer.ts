import { Container, Sprite } from 'pixi.js';
import { RENDER } from '../config/render';
import type { Tilemap } from '../world/Tilemap';
import { roleIsSolid, type TileRole } from '../world/tiles';
import type { ArtProvider } from './ArtProvider';

/**
 * Draws every non-empty tile as a sprite. Decorative tiles render in a lower container
 * so a window or cobweb can never paint over a solid ledge. The layer is static except
 * for whole-role removal (broken secret walls), which keeps the renderer in lockstep
 * with the collision grid.
 *
 * Small sprites are cheap even on software WebGL — far cheaper than flattening the
 * room into one large alpha-blended quad, which is a fill-rate trap (D018).
 */
export class TileLayer {
  readonly view = new Container();
  private readonly byRole = new Map<TileRole, Sprite[]>();

  constructor(tilemap: Tilemap, art: ArtProvider) {
    const decor = new Container();
    const solid = new Container();
    this.view.addChild(decor, solid);

    tilemap.forEachTile((tx, ty, role: TileRole) => {
      const sprite = new Sprite(art.tile(role, tx, ty));
      sprite.position.set(tx * RENDER.tileSize, ty * RENDER.tileSize);
      (roleIsSolid(role) ? solid : decor).addChild(sprite);
      const group = this.byRole.get(role);
      if (group) group.push(sprite);
      else this.byRole.set(role, [sprite]);
    });
  }

  /** Removes every sprite of a role after the tilemap cleared the matching cells. */
  removeRole(role: TileRole): number {
    const sprites = this.byRole.get(role);
    if (!sprites) return 0;
    for (const sprite of sprites) {
      sprite.removeFromParent();
      sprite.destroy();
    }
    this.byRole.delete(role);
    return sprites.length;
  }
}
