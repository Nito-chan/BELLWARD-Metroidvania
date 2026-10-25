/**
 * In-memory run progression plus its save/load boundary. Game asks this class for the
 * mask ceiling, Focus loadout, sigils, charted rooms, collectibles, shards, charms and
 * checkpoint; this class is the only place that knows how those facts become a persisted
 * document.
 */
import type { BossKind } from '../config/enemies';
import { BOSS_KINDS } from '../config/enemies';
import { MAP, type MapPin, type MapPinKind } from '../config/map';
import { CHARMS, CHARM_ORDER, CHARM_SLOTS, NAIL, type CharmId } from '../config/progression';
import { SAVE } from '../config/save';
import { getBench, type BenchRef } from '../data/benches';
import { getPickup, healthShardCount, isPickupId } from '../data/pickups';
import { ALL_ROOMS, ROOMS, getRoom } from '../data/rooms';
import type { RunDebugState, SaveDebugState } from '../debug/DebugState';
import type { PlayerLoadout } from '../player/PlayerLoadout';
import type { RunSave, SaveReason, SaveStorage } from './runSave';
import { defaultRunStorage, loadRunSave, maxHpForProgress, writeRunSave } from './runSave';

export type RunSaveSnapshot = {
  readonly roomId: string;
  readonly spawn: { x: number; y: number };
  readonly hp: number;
  readonly reason: SaveReason;
};

export class RunProgress {
  private readonly sigilsValue = new Set<BossKind>();
  private readonly visitedValue = new Set<string>();
  private readonly pickupsValue = new Set<string>();
  private readonly brokenSecretsValue = new Set<string>();
  private readonly mapPinsValue = new Map<string, MapPinKind>();
  private readonly charmsOwnedValue = new Set<CharmId>();
  private readonly charmsEquippedValue = new Set<CharmId>();
  private readonly ordealsValue = new Set<BossKind>();
  private checkpointValue: BenchRef | null = null;
  private nailLevelValue = 0;
  private shardsValue = 0;
  private tideDoorOpenedValue = false;
  private endingSeenValue = false;
  private resumeValue: RunSave | null;
  private loadedValue: boolean;
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
    for (const id of save.pickups) this.pickupsValue.add(id);
    for (const roomId of save.brokenSecrets) this.brokenSecretsValue.add(roomId);
    for (const pin of save.mapPins) this.mapPinsValue.set(pin.roomId, pin.kind);
    for (const charm of save.charmsOwned) this.charmsOwnedValue.add(charm);
    for (const charm of save.charmsEquipped) this.charmsEquippedValue.add(charm);
    for (const ordeal of save.ordeals) this.ordealsValue.add(ordeal);
    this.checkpointValue = save.checkpointBenchId ? getBench(save.checkpointBenchId) : null;
    this.nailLevelValue = save.nailLevel;
    this.shardsValue = save.shards;
    this.tideDoorOpenedValue = save.tideDoorOpened;
    this.endingSeenValue = save.endingSeen;
  }

  /** True when boot restored a valid document (possibly migrated from v1). */
  get loaded(): boolean {
    return this.loadedValue;
  }

  /** True once this session has written a valid document. */
  get present(): boolean {
    return this.presentValue;
  }

  /**
   * Discards every durable run fact before a new run overwrites the save slot. The
   * storage key is intentionally not removed: the following boot save replaces it
   * atomically, so a crash between reset and save cannot leave a half-deleted run.
   */
  reset(): void {
    this.sigilsValue.clear();
    this.visitedValue.clear();
    this.pickupsValue.clear();
    this.brokenSecretsValue.clear();
    this.mapPinsValue.clear();
    this.charmsOwnedValue.clear();
    this.charmsEquippedValue.clear();
    this.ordealsValue.clear();
    this.checkpointValue = null;
    this.nailLevelValue = 0;
    this.shardsValue = 0;
    this.tideDoorOpenedValue = false;
    this.endingSeenValue = false;
    this.resumeValue = null;
    this.loadedValue = false;
    this.presentValue = false;
    this.lastWriteValue = null;
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
    return maxHpForProgress(this.sigilsValue.size, this.healthShards);
  }

  get healthShards(): number {
    return healthShardCount(this.pickupsValue);
  }

  get visitedRooms(): readonly string[] {
    return ALL_ROOMS.map((room) => room.id).filter((roomId) => this.visitedValue.has(roomId));
  }

  get checkpoint(): BenchRef | null {
    return this.checkpointValue;
  }

  get pickups(): readonly string[] {
    return [...this.pickupsValue].sort();
  }

  get brokenSecrets(): readonly string[] {
    return [...this.brokenSecretsValue].sort();
  }

  /** The chart is earned once; every later visit opens the same glass. */
  get hasTideglass(): boolean {
    return this.pickupsValue.has('terrace-tideglass');
  }

  get mapPins(): readonly MapPin[] {
    return ALL_ROOMS.filter((room) => this.mapPinsValue.has(room.id)).map((room) => ({
      roomId: room.id,
      kind: this.mapPinsValue.get(room.id) ?? 'mark',
    }));
  }

  hasMapPin(roomId: string): boolean {
    return this.mapPinsValue.has(roomId);
  }

  /**
   * Adds or removes one wax mark. Unknown rooms, unseen rooms and a full tablet are
   * rejected without touching the document, so a failed press is never persisted.
   */
  toggleMapPin(roomId: string): 'added' | 'removed' | 'full' | 'unknown' {
    if (!ROOMS[roomId] || !this.visitedValue.has(roomId)) return 'unknown';
    if (this.mapPinsValue.delete(roomId)) return 'removed';
    if (this.mapPinsValue.size >= MAP.pinLimit) return 'full';
    this.mapPinsValue.set(roomId, 'mark');
    return 'added';
  }

  get charmsOwned(): readonly CharmId[] {
    return CHARM_ORDER.filter((id) => this.charmsOwnedValue.has(id));
  }

  get charmsEquipped(): readonly CharmId[] {
    return CHARM_ORDER.filter((id) => this.charmsEquippedValue.has(id));
  }

  get nails(): { level: number; maxLevel: number; nextCost: number | null } {
    const nextCost = this.nailLevelValue < NAIL.maxLevel ? NAIL.costs[this.nailLevelValue] : null;
    return { level: this.nailLevelValue, maxLevel: NAIL.maxLevel, nextCost: nextCost ?? null };
  }

  get shards(): number {
    return this.shardsValue;
  }

  get ordeals(): readonly BossKind[] {
    return BOSS_KINDS.filter((kind) => this.ordealsValue.has(kind));
  }

  get tideDoorOpened(): boolean {
    return this.tideDoorOpenedValue;
  }

  get endingSeen(): boolean {
    return this.endingSeenValue;
  }

  /** Records that the player crossed the Tide door and saw the midpoint card. */
  markTideDoorOpened(): boolean {
    if (this.tideDoorOpenedValue) return false;
    this.tideDoorOpenedValue = true;
    return true;
  }

  /** Records that the earned final ending was seen. One-shot per run. */
  markEndingSeen(): boolean {
    if (this.endingSeenValue) return false;
    this.endingSeenValue = true;
    return true;
  }

  get loadout(): PlayerLoadout {
    return {
      charms: [...this.charmsEquipped],
      nailLevel: this.nailLevelValue,
      wallClaw: this.hasPickup('aqueduct-wall-claw'),
      hookline: this.hasPickup('aqueduct-hookline'),
      longline: this.hasPickup('shaft-longline'),
      censer: this.hasPickup('reliquary-censer'),
      toll: this.hasPickup('upper-toll'),
    };
  }

  hasSigil(kind: BossKind): boolean {
    return this.sigilsValue.has(kind);
  }

  hasPickup(id: string): boolean {
    return this.pickupsValue.has(id);
  }

  hasBrokenSecret(roomId: string): boolean {
    return this.brokenSecretsValue.has(roomId);
  }

  hasOrdeal(kind: BossKind): boolean {
    return this.ordealsValue.has(kind);
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

  /**
   * Grants a pickup once. Unknown ids and keyed pickups whose gate is still closed are
   * rejected rather than silently collected. Charms auto-equip while a slot is free.
   */
  collectPickup(id: string): boolean {
    if (!isPickupId(id) || this.pickupsValue.has(id)) return false;
    const pickup = getPickup(id);
    if (pickup.requiresSigil && !this.sigilsValue.has(pickup.requiresSigil)) return false;

    this.pickupsValue.add(id);
    if (pickup.kind === 'shard') this.shardsValue += pickup.amount ?? 0;
    if (pickup.charm) {
      this.charmsOwnedValue.add(pickup.charm);
      this.equipIfRoom(pickup.charm);
    }
    return true;
  }

  /** True when a pickup exists, is still uncollected and its gate is open. */
  canCollectPickup(id: string): boolean {
    if (!isPickupId(id) || this.pickupsValue.has(id)) return false;
    const pickup = getPickup(id);
    return !pickup.requiresSigil || this.sigilsValue.has(pickup.requiresSigil);
  }

  /** Records a shattered secret wall in the parent room. */
  breakSecret(roomId: string): boolean {
    getRoom(roomId);
    if (this.brokenSecretsValue.has(roomId)) return false;
    this.brokenSecretsValue.add(roomId);
    return true;
  }

  /** Equips/unequips an owned charm. Returns false when refused. */
  toggleCharm(id: CharmId): boolean {
    if (!this.charmsOwnedValue.has(id)) return false;
    if (this.charmsEquippedValue.has(id)) {
      this.charmsEquippedValue.delete(id);
      return true;
    }
    if (this.usedCharmSlots + CHARMS[id].cost > CHARM_SLOTS) return false;
    this.charmsEquippedValue.add(id);
    return true;
  }

  /** Buys the next nail level with shards. */
  buyNailUpgrade(): boolean {
    if (this.nailLevelValue >= NAIL.maxLevel) return false;
    const cost = NAIL.costs[this.nailLevelValue] ?? Number.POSITIVE_INFINITY;
    if (this.shardsValue < cost) return false;
    this.shardsValue -= cost;
    this.nailLevelValue += 1;
    return true;
  }

  addOrdeal(kind: BossKind): boolean {
    if (!this.sigilsValue.has(kind) || this.ordealsValue.has(kind)) return false;
    this.ordealsValue.add(kind);
    return true;
  }

  /** Adds an Ordeal reward in shards. */
  grantShards(amount: number): void {
    this.shardsValue += Math.max(0, Math.floor(amount));
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
      pickups: this.pickups,
      brokenSecrets: this.brokenSecrets,
      mapPins: this.mapPins,
      charmsOwned: this.charmsOwned,
      charmsEquipped: this.charmsEquipped,
      nailLevel: this.nailLevelValue,
      shards: this.shardsValue,
      ordeals: this.ordeals,
      tideDoorOpened: this.tideDoorOpenedValue,
      endingSeen: this.endingSeenValue,
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
      shards: this.shardsValue,
      pickups: [...this.pickups],
      brokenSecrets: [...this.brokenSecrets],
      mapPins: [...this.mapPins],
      healthShards: this.healthShards,
      nailLevel: this.nailLevelValue,
      charmsOwned: [...this.charmsOwned],
      charmsEquipped: [...this.charmsEquipped],
      wallClaw: this.hasPickup('aqueduct-wall-claw'),
      hookline: this.hasPickup('aqueduct-hookline'),
      longline: this.hasPickup('shaft-longline'),
      censer: this.hasPickup('reliquary-censer'),
      toll: this.hasPickup('upper-toll'),
      ordeals: [...this.ordeals],
      tideDoorOpened: this.tideDoorOpenedValue,
      endingSeen: this.endingSeenValue,
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

  private get usedCharmSlots(): number {
    let slots = 0;
    for (const id of this.charmsEquippedValue) slots += CHARMS[id].cost;
    return slots;
  }

  private equipIfRoom(id: CharmId): void {
    if (this.usedCharmSlots + CHARMS[id].cost <= CHARM_SLOTS) {
      this.charmsEquippedValue.add(id);
    }
  }
}
