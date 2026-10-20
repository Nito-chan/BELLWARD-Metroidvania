import { Container } from 'pixi.js';
import type { Vec2 } from '../core/Types';
import { InteractPrompt } from '../ui/InteractPrompt';
import type { RoomBench } from '../world/Room';
import type { ArtProvider } from './ArtProvider';
import { BenchLayer } from './BenchLayer';

/**
 * Proximity-driven rest points. The scene never heals or saves: it exposes the bench the
 * player invoked, and RunSession rebuilds the room from the bench's clean checkpoint spawn.
 * The arrival banner's announcement is protected on the first scan after a rebuild.
 */
export class BenchInteraction {
  readonly worldView = new Container();
  readonly screenView: Container;
  private readonly layer: BenchLayer;
  private readonly prompt = new InteractPrompt();
  private readonly announce: (text: string) => void;
  private pendingRest: RoomBench | null = null;
  private focusedValue: RoomBench | null = null;
  private lastAnnouncedId: string | null = null;
  private firstScan = true;

  constructor(benches: readonly RoomBench[], art: ArtProvider, announce: (text: string) => void) {
    this.announce = announce;
    this.layer = new BenchLayer(benches, art);
    this.worldView.addChild(this.layer.view);
    this.screenView = this.prompt.view;
  }

  get focused(): RoomBench | null {
    return this.focusedValue;
  }

  update(feet: Vec2, dead: boolean, interactPressed: boolean, tickCount: number): void {
    const near = dead ? null : this.layer.findInRange(feet);
    this.focusedValue = near;
    this.layer.setFocused(near?.id ?? null);
    this.layer.tick(tickCount);

    if (near) this.prompt.show(near.name);
    else this.prompt.hide();

    if (!near) {
      this.lastAnnouncedId = null;
    } else if (near.id !== this.lastAnnouncedId) {
      if (!this.firstScan) {
        this.announce(`${near.name}. Rest here to save your progress and set your return.`);
      }
      this.lastAnnouncedId = near.id;
    }
    this.firstScan = false;

    if (near && !dead && interactPressed) this.pendingRest = near;
  }

  consumeRest(): RoomBench | null {
    const bench = this.pendingRest;
    this.pendingRest = null;
    return bench;
  }
}
