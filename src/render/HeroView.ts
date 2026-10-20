import type { ArtProvider } from './ArtProvider';
import { CharacterView, type CharacterPose, type Facing } from './CharacterView';

export type { Facing };
export type HeroPose = CharacterPose;

/**
 * The hero is the shared character view with the knight's art and a wide contact shadow.
 * Keeping the wrapper means scene code names the hero explicitly while enemies reuse the
 * exact same slicing, flipping, animation and flash logic.
 */
export class HeroView extends CharacterView {
  constructor(provider: ArtProvider) {
    super(provider, provider.hero, { shadow: { rx: 9, ry: 3 } });
  }
}
