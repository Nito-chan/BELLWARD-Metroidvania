/**
 * In-memory run progression plus its save/load boundary. Game asks this class for the
 * mask ceiling, sigil ownership, charted rooms and checkpoint; this class is the only
 * place that knows how those facts become a persisted document.
 */
import type { BossKind } from '../config/enemies';
import { BOSS_KINDS } from '../config/enemies';
import { SAVE } from '../config/save';
import { getBench, type BenchRef } from '../data/benches';
import { ALL_ROOMS, getRoom } from '../data/rooms';
import type { RunDebugState, SaveDebugState } from '../debug/DebugState';
import type { RunSave, SaveReason, SaveStorage } from './runSave';
import { defaultRunStorage, loadRunSave, maxHpForSigils, writeRunSave } from './runSave';

export type RunSaveSnapshot = {
  readonly roomId: string;
  readonly spawn: { x: number; y: number };
  readonly hp: number;
  readonly reason: SaveReason;
};

export class RunProgress {
  private readonly sigilsValue = new Set<BossKind>();
  private readonly visitedValue = new Set<string>();
  private checkpointValue: BenchRef | null = null;
  private readonly resumeValue: RunSave | null;
  private readonly loadedValue: boolean;
  private presentValue = false;
  private lastWriteValue: SaveReason | null = null;

  constructor(private readonly storage: SaveStorage | null = defaultRunStorage()) {
    const save = loadRunSave(storage);
    this.resumeValue = save;
    this.loadedValue = save !== null;
    if (!save) return;

    this.presentValue = true;
    for (const sigil of save.sigils) this.sigilsValue.add(sigil);
    for (const roomId of save.visitedRooms) this.visitedValue.add(roomId);
    this.checkpointValue = save.checkpointBenchId ? getBench(save.checkpointBenchId) : null;
  }

  /** True when boot restored a valid document. */
  get loaded(): boolean {
    return this.loadedValue;
  }

  /** The document boot restored, consumed exactly once by Game. */
  get resume(): RunSave | null {
    return this.resumeValue;
  }

  get sigilCount(): number {
    return this.sigilsValue.size;
  }

  get sigils(): readonly BossKind[] {
    return BOSS_KINDS.filter((kind) => this.sigilsValue.has(kind));
  }

  get maxHp(): number {
    return maxHpForSigils(this.sigilsValue.size);
  }

  get visitedRooms(): readonly string[] {
    return ALL_ROOMS.map((room) => room.id).filter((roomId) => this.visitedValue.has(roomId));
  }

  get checkpoint(): BenchRef | null {
    return this.checkpointValue;
  }

  hasSigil(kind: BossKind): boolean {
    return this.sigilsValue.has(kind);
  }

  /** Returns false when the sigil was already claimed, so rewards cannot double-grant. */
  addSigil(kind: BossKind): boolean {
    if (this.sigilsValue.has(kind)) return false;
    this.sigilsValue.add(kind);
    return true;
  }

  visit(roomId: string): void {
    getRoom(roomId);
    this.visitedValue.add(roomId);
  }

  setCheckpoint(bench: BenchRef): void {
    this.checkpointValue = bench;
  }

  /** Writes the current durable state. Returns false when storage rejects the write. */
  save(snapshot: RunSaveSnapshot): boolean {
    getRoom(snapshot.roomId);
    const hp = Math.max(1, Math.min(this.maxHp, Math.floor(snapshot.hp)));
    const document: RunSave = {
      version: SAVE.version,
      roomId: snapshot.roomId,
      spawn: { x: snapshot.spawn.x, y: snapshot.spawn.y },
      hp,
      sigils: this.sigils,
      visitedRooms: this.visitedRooms,
      checkpointBenchId: this.checkpointValue?.id ?? null,
    };
    const written = writeRunSave(document, this.storage);
    if (written) {
      this.presentValue = true;
      this.lastWriteValue = snapshot.reason;
    }
    return written;
  }

  debugRun(roomId: string): RunDebugState {
    const checkpoint = this.checkpointValue;
    return {
      roomId,
      sigils: [...this.sigils],
      maxHp: this.maxHp,
      visitedRooms: [...this.visitedRooms],
      checkpoint: checkpoint
        ? { roomId: checkpoint.roomId, benchId: checkpoint.id, name: checkpoint.name }
        : null,
    };
  }

  debugSave(): SaveDebugState {
    return {
      key: SAVE.storageKey,
      version: SAVE.version,
      present: this.presentValue,
      loaded: this.loadedValue,
      lastWrite: this.lastWriteValue,
    };
  }
}
