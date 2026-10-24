import { Graphics } from 'pixi.js';
import { PALETTE } from '../config/palette';

/**
 * The Last Bell's flood. The dark volume sits behind the actors so the Keeper and hero
 * stay readable; a second, very light wash and the hard surface line sit in front. The
 * line is the hazard boundary, not decoration, so it is the brightest element.
 */
export class FloodView {
  /** Tinted floor/terrain volume, added before the actor layer. */
  readonly volume = new Graphics();
  /** Light actor wash, surface line and ripples, added above the front props. */
  readonly surface = new Graphics();
  private levelValue: number | null = null;

  constructor(
    private readonly width: number,
    private readonly height: number,
  ) {
    this.volume.visible = false;
    this.surface.visible = false;
  }

  /** Current water-surface Y, or null when the arena is dry. */
  get level(): number | null {
    return this.levelValue;
  }

  setLevel(lineY: number | null): void {
    if (lineY === this.levelValue) return;
    this.levelValue = lineY;

    this.volume.clear();
    this.surface.clear();
    if (lineY === null) {
      this.volume.visible = false;
      this.surface.visible = false;
      return;
    }

    const y = Math.max(0, Math.min(this.height, lineY));
    const depth = this.height - y;

    // Deep water over the floor and submerged props.
    this.volume.rect(0, y, this.width, depth).fill({
      color: PALETTE.deepWater,
      alpha: 0.48,
    });
    // A slightly greener band near the surface gives the volume some depth.
    this.volume.rect(0, y, this.width, Math.min(40, depth)).fill({
      color: PALETTE.cavern,
      alpha: 0.16,
    });

    // A light wash over actors keeps submerged silhouettes readable.
    this.surface.rect(0, y, this.width, depth).fill({
      color: PALETTE.deepWater,
      alpha: 0.14,
    });
    this.surface.rect(0, y, this.width, 2).fill({
      color: PALETTE.echo,
      alpha: 0.55,
    });
    this.surface.rect(0, y, this.width, 1).fill({
      color: PALETTE.bone,
      alpha: 0.65,
    });
    for (let x = 12; x < this.width; x += 48) {
      this.surface.rect(x, y + 3, 18, 1).fill({
        color: PALETTE.echo,
        alpha: 0.26,
      });
    }

    this.volume.visible = true;
    this.surface.visible = true;
  }
}
