/**
 * Owns the bench equipment flow: the DOM overlay, the live bench reference, purchases and
 * charm toggles. Game keeps only the pause/resume boundary and the RunSession lifecycle.
 */
import { CHARMS, CHARM_ORDER, CHARM_SLOTS, type CharmId } from '../../config/progression';
import type { RunSession } from '../../core/RunSession';
import type { BenchRef } from '../../data/benches';
import { BenchOverlay, type BenchChange, type BenchState } from './BenchOverlay';

export type BenchControllerOptions = {
  readonly run: RunSession;
  readonly announce: (text: string) => void;
  /** Freezes the simulation and clears held input. */
  readonly onPause: () => void;
  /** Resumes after the overlay has closed. */
  readonly onResume: () => void;
};

export class BenchController {
  private readonly overlay: BenchOverlay;
  private benchRef: BenchRef | null = null;

  constructor(private readonly options: BenchControllerOptions) {
    this.overlay = new BenchOverlay({
      getState: () => this.state(),
      onToggleCharm: (id) => this.toggleCharm(id),
      onBuyNail: () => this.buyNail(),
      onClose: () => this.finishClose(),
      announce: options.announce,
    });
  }

  get isOpen(): boolean {
    return this.overlay.isOpen;
  }

  open(bench: BenchRef): void {
    if (this.overlay.isOpen) return;
    this.benchRef = bench;
    this.options.onPause();
    this.overlay.open();
  }

  close(): void {
    this.overlay.close();
  }

  private finishClose(): void {
    this.benchRef = null;
    this.options.onResume();
  }

  private state(): BenchState {
    const progress = this.options.run.progress;
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
    const progress = this.options.run.progress;
    const name = CHARMS[id].name;
    if (!progress.charmsOwned.includes(id)) {
      return { ok: false, message: `${name} has not been found yet.` };
    }
    const wasEquipped = progress.charmsEquipped.includes(id);
    if (!progress.toggleCharm(id)) {
      return { ok: false, message: 'No free charm slots. Set another charm aside first.' };
    }
    this.afterChange();
    return {
      ok: true,
      message: wasEquipped ? `${name} set aside.` : `${name} equipped.`,
    };
  }

  private buyNail(): BenchChange {
    const progress = this.options.run.progress;
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
    this.afterChange();
    return { ok: true, message: `The nail is tempered to +${progress.nails.level}.` };
  }

  /** Equipment changes are durable immediately and visible on the loaded hero. */
  private afterChange(): void {
    this.options.run.scene?.applyProgress(
      this.options.run.progress.loadout,
      this.options.run.progress.shards,
    );
    this.options.run.saveAtBench();
  }
}
