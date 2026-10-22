import { Graphics } from 'pixi.js';
import { PALETTE } from '../config/palette';
import type { ArtProvider } from './ArtProvider';
import { CharacterView, type CharacterPose, type Facing } from './CharacterView';

export type { Facing };
export type HeroPose = CharacterPose;

/**
 * The hero is the shared character view with the knight's art, a wide contact shadow and
 * the Keeper's Guard arc. The arc is drawn in front of the brace and brightens inside the
 * perfect-parry window, so the guard's timing is readable without a HUD trip.
 */
export class HeroView extends CharacterView {
  private readonly guardArc = new Graphics();
  private lastX = 0;
  private lastY = 0;
  private lastFacing: Facing = 1;

  constructor(provider: ArtProvider) {
    super(provider, provider.hero, { shadow: { rx: 9, ry: 3 } });
    this.view.addChild(this.guardArc);
  }

  override setPose(pose: CharacterPose): void {
    this.lastX = pose.x;
    this.lastY = pose.y;
    this.lastFacing = pose.facing;
    super.setPose(pose);
  }

  /** Draws the brace. `perfect` lights the opening window. */
  setGuard(active: boolean, perfect: boolean): void {
    const arc = this.guardArc;
    arc.clear();
    if (!active) {
      arc.visible = false;
      return;
    }
    arc.position.set(this.lastX, this.lastY - 24);
    arc.scale.x = this.lastFacing;
    arc.arc(8, 0, 19, -1.15, 1.15).stroke({
      width: perfect ? 3 : 2,
      color: perfect ? PALETTE.ember : PALETTE.brass,
      alpha: perfect ? 0.95 : 0.6,
    });
    arc
      .arc(8, 0, 15, -0.95, 0.95)
      .stroke({ width: 1, color: PALETTE.bone, alpha: perfect ? 0.7 : 0.35 });
    arc.visible = true;
  }
}
