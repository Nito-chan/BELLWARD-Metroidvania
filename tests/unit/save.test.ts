import { afterEach, describe, expect, it, vi } from 'vitest';
import { MAP } from '../../src/config/map';
import { SAVE } from '../../src/config/save';
import { getBench } from '../../src/data/benches';
import { ALL_ROOMS } from '../../src/data/rooms';
import { RunProgress } from '../../src/save/RunProgress';
import {
  loadRunSave,
  maxHpForProgress,
  maxHpForSigils,
  migrateRunSave,
  parseRunSave,
  writeRunSave,
  type RunSave,
  type SaveStorage,
} from '../../src/save/runSave';

class MemoryStorage implements SaveStorage {
  readonly data = new Map<string, string>();

  getItem(key: string): string | null {
    return this.data.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.data.set(key, value);
  }
}

function validSave(overrides: Partial<RunSave> = {}): RunSave {
  return {
    version: SAVE.version,
    roomId: 'belfry-terrace',
    spawn: { x: 420, y: 320 },
    hp: 5,
    sigils: [],
    visitedRooms: ['belfry-terrace'],
    checkpointBenchId: null,
    pickups: [],
    brokenSecrets: [],
    mapPins: [],
    charmsOwned: [],
    charmsEquipped: [],
    nailLevel: 0,
    shards: 0,
    ordeals: [],
    tideDoorOpened: false,
    endingSeen: false,
    ...overrides,
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('run save validation', () => {
  it('round-trips a complete document through storage', () => {
    const storage = new MemoryStorage();
    const save = validSave({
      hp: 6,
      sigils: ['bellbearer'],
      visitedRooms: ['belfry-terrace', 'belfry-antechamber', 'bellbearer-arena'],
      checkpointBenchId: 'terrace-weeping-stone',
    });

    expect(writeRunSave(save, storage)).toBe(true);
    expect(loadRunSave(storage)).toEqual(save);
    expect(parseRunSave(save)).toEqual(save);
  });

  it('derives the mask ceiling from sigils and full shard sets', () => {
    expect(maxHpForSigils(0)).toBe(5);
    expect(maxHpForSigils(1)).toBe(6);
    expect(maxHpForSigils(3)).toBe(8);
    expect(maxHpForProgress(3, 4)).toBe(9);
    expect(maxHpForProgress(0, 3)).toBe(5);
    expect(() => maxHpForSigils(5)).toThrow(/sigil count/);
    expect(() => maxHpForSigils(-1)).toThrow(/sigil count/);
  });

  it('migrates a v1 document in place without losing its durable facts', () => {
    const v1 = {
      version: 1,
      roomId: 'belfry-terrace',
      spawn: { x: 420, y: 320 },
      hp: 5,
      sigils: ['bellbearer'],
      visitedRooms: ['belfry-terrace', 'belfry-antechamber', 'bellbearer-arena'],
      checkpointBenchId: 'terrace-weeping-stone',
    };
    const migrated = migrateRunSave(v1);
    expect(migrated).toMatchObject({
      version: SAVE.version,
      roomId: 'belfry-terrace',
      pickups: ['terrace-tideglass'],
      mapPins: [],
      charmsOwned: [],
      nailLevel: 0,
      shards: 0,
      ordeals: [],
      tideDoorOpened: false,
      endingSeen: false,
    });
    expect(parseRunSave(migrated)).not.toBeNull();

    const storage = new MemoryStorage();
    storage.setItem(SAVE.storageKey, JSON.stringify(v1));
    expect(loadRunSave(storage)?.version).toBe(SAVE.version);
    expect(loadRunSave(storage)?.pickups).toEqual(['terrace-tideglass']);
  });

  it('migrates a v3 document and grants the Tideglass to a terrace visitor', () => {
    const base = {
      version: 3,
      roomId: 'belfry-terrace',
      spawn: { x: 420, y: 320 },
      hp: 5,
      sigils: [],
      visitedRooms: ['belfry-terrace'],
      checkpointBenchId: null,
      pickups: [],
      brokenSecrets: [],
      charmsOwned: [],
      charmsEquipped: [],
      nailLevel: 0,
      shards: 0,
      ordeals: [],
      tideDoorOpened: false,
      endingSeen: false,
    };
    const migrated = migrateRunSave(base);
    expect(migrated).toMatchObject({
      version: SAVE.version,
      mapPins: [],
      pickups: ['terrace-tideglass'],
    });
    expect(parseRunSave(migrated)).not.toBeNull();

    const neverVisited = migrateRunSave({ ...base, visitedRooms: ['belfry-antechamber'] });
    expect(neverVisited).toMatchObject({ version: SAVE.version, mapPins: [], pickups: [] });
  });

  it('accepts wax marks only on charted rooms', () => {
    const charted = validSave({
      visitedRooms: ['belfry-terrace', 'drowned-gallery'],
      mapPins: [{ roomId: 'drowned-gallery', kind: 'mark' }],
    });
    expect(parseRunSave(charted)).not.toBeNull();

    expect(
      parseRunSave(
        validSave({
          visitedRooms: ['belfry-terrace'],
          mapPins: [{ roomId: 'drowned-gallery', kind: 'mark' }],
        }),
      ),
    ).toBeNull();
    expect(
      parseRunSave(validSave({ mapPins: [{ roomId: 'missing-room', kind: 'mark' }] })),
    ).toBeNull();
    expect(
      parseRunSave(
        validSave({
          mapPins: [{ roomId: 'belfry-terrace', kind: 'impostor' as 'mark' }],
        }),
      ),
    ).toBeNull();
    expect(
      parseRunSave(
        validSave({
          mapPins: [
            { roomId: 'belfry-terrace', kind: 'mark' },
            { roomId: 'belfry-terrace', kind: 'mark' },
          ],
        }),
      ),
    ).toBeNull();
    const tooMany = ALL_ROOMS.slice(0, MAP.savePinLimit + 1).map((room) => ({
      roomId: room.id,
      kind: 'mark' as const,
    }));
    expect(
      parseRunSave(
        validSave({
          visitedRooms: tooMany.map((pin) => pin.roomId),
          mapPins: tooMany,
        }),
      ),
    ).toBeNull();
  });

  it('rejects impossible pickup, charm and Ordeal combinations', () => {
    expect(parseRunSave(validSave({ pickups: ['missing-pickup'] }))).toBeNull();
    expect(parseRunSave(validSave({ pickups: ['bellthief-tide-bell'], sigils: [] }))).toBeNull();
    expect(
      parseRunSave(
        validSave({
          pickups: ['gallery-quick-mend'],
          charmsOwned: [],
        }),
      ),
    ).toBeNull();
    expect(
      parseRunSave(
        validSave({
          pickups: ['gallery-quick-mend'],
          charmsOwned: ['quickMend'],
          charmsEquipped: ['quickMend'],
        }),
      ),
    ).not.toBeNull();
    expect(
      parseRunSave(
        validSave({
          pickups: ['gallery-quick-mend', 'ossuary-light-step', 'aqueduct-ember-greed'],
          charmsOwned: ['quickMend', 'lightStep', 'emberGreed'],
          charmsEquipped: ['quickMend', 'lightStep', 'emberGreed'],
        }),
      ),
    ).not.toBeNull();
    expect(
      parseRunSave(
        validSave({
          ordeals: ['bellbearer'],
          sigils: [],
        }),
      ),
    ).toBeNull();
    expect(
      parseRunSave(
        validSave({
          ordeals: ['bellbearer'],
          sigils: ['bellbearer'],
          visitedRooms: ['belfry-terrace', 'bellbearer-arena'],
          hp: 6,
        }),
      ),
    ).not.toBeNull();
  });

  it('rejects a wrong version, unknown room and invalid spawn', () => {
    expect(parseRunSave(validSave({ version: SAVE.version + 1 }))).toBeNull();
    expect(parseRunSave(validSave({ roomId: 'missing-room' }))).toBeNull();
    expect(parseRunSave(validSave({ spawn: { x: 10, y: 300 } }))).toBeNull();
    expect(parseRunSave(validSave({ spawn: { x: Number.NaN, y: 320 } }))).toBeNull();
    expect(parseRunSave(validSave({ spawn: { x: 420, y: 0 } }))).toBeNull();
  });

  it('rejects impossible HP for the sigil count', () => {
    expect(parseRunSave(validSave({ hp: 0 }))).toBeNull();
    expect(parseRunSave(validSave({ hp: 6 }))).toBeNull();
    expect(parseRunSave(validSave({ hp: 7, sigils: ['bellbearer'] }))).toBeNull();
    expect(parseRunSave(validSave({ hp: 6, sigils: ['bellbearer'] }))).not.toBeNull();
  });

  it('rejects unknown or duplicate sigils', () => {
    expect(parseRunSave(validSave({ sigils: ['impostor' as 'bellbearer'] }))).toBeNull();
    expect(parseRunSave(validSave({ sigils: ['bellbearer', 'bellbearer'], hp: 6 }))).toBeNull();
  });

  it('rejects unknown, duplicate or incomplete charted rooms', () => {
    expect(parseRunSave(validSave({ visitedRooms: [] }))).toBeNull();
    expect(parseRunSave(validSave({ visitedRooms: ['missing-room'] }))).toBeNull();
    expect(
      parseRunSave(validSave({ visitedRooms: ['belfry-terrace', 'belfry-terrace'] })),
    ).toBeNull();
    expect(parseRunSave(validSave({ visitedRooms: ['belfry-antechamber'] }))).toBeNull();
  });

  it('rejects an unknown checkpoint or a checkpoint outside the charted rooms', () => {
    expect(parseRunSave(validSave({ checkpointBenchId: 'missing-bench' }))).toBeNull();
    expect(parseRunSave(validSave({ checkpointBenchId: 'nave-bell-keepers-rest' }))).toBeNull();
    expect(
      parseRunSave(
        validSave({
          visitedRooms: ['belfry-terrace', 'belfry-antechamber'],
          checkpointBenchId: 'nave-bell-keepers-rest',
        }),
      ),
    ).not.toBeNull();
  });

  it('treats corrupt storage as absent and never throws', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const storage = new MemoryStorage();
    storage.setItem(SAVE.storageKey, '{not json');
    expect(loadRunSave(storage)).toBeNull();
    expect(loadRunSave(null)).toBeNull();

    const throwing: SaveStorage = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    };
    expect(loadRunSave(throwing)).toBeNull();
    expect(writeRunSave(validSave(), throwing)).toBe(false);
    expect(warn).toHaveBeenCalled();
  });
});

describe('RunProgress', () => {
  it('starts fresh when storage is empty', () => {
    const progress = new RunProgress(new MemoryStorage());
    expect(progress.loaded).toBe(false);
    expect(progress.resume).toBeNull();
    expect(progress.sigilCount).toBe(0);
    expect(progress.maxHp).toBe(5);
    expect(progress.visitedRooms).toEqual([]);
    expect(progress.checkpoint).toBeNull();
  });

  it('restores a loaded run, including its checkpoint and charted rooms', () => {
    const storage = new MemoryStorage();
    const save = validSave({
      hp: 6,
      sigils: ['bellbearer'],
      visitedRooms: ['belfry-terrace', 'belfry-antechamber', 'bellbearer-arena'],
      checkpointBenchId: 'terrace-weeping-stone',
    });
    writeRunSave(save, storage);

    const progress = new RunProgress(storage);
    expect(progress.loaded).toBe(true);
    expect(progress.resume).toEqual(save);
    expect(progress.maxHp).toBe(6);
    expect(progress.sigils).toEqual(['bellbearer']);
    expect(progress.visitedRooms).toEqual(save.visitedRooms);
    expect(progress.checkpoint?.id).toBe('terrace-weeping-stone');
  });

  it('presses and removes wax only on charted rooms and persists it', () => {
    const storage = new MemoryStorage();
    const progress = new RunProgress(storage);
    progress.visit('belfry-terrace');
    progress.visit('drowned-gallery');

    expect(progress.hasTideglass).toBe(false);
    expect(progress.collectPickup('terrace-tideglass')).toBe(true);
    expect(progress.hasTideglass).toBe(true);
    expect(progress.toggleMapPin('bellbearer-arena')).toBe('unknown');
    expect(progress.toggleMapPin('missing-room')).toBe('unknown');
    expect(progress.toggleMapPin('drowned-gallery')).toBe('added');
    expect(progress.hasMapPin('drowned-gallery')).toBe(true);
    expect(progress.mapPins).toEqual([{ roomId: 'drowned-gallery', kind: 'mark' }]);

    expect(
      progress.save({
        roomId: 'belfry-terrace',
        spawn: { x: 420, y: 320 },
        hp: 5,
        reason: 'map',
      }),
    ).toBe(true);
    expect(loadRunSave(storage)?.mapPins).toEqual([{ roomId: 'drowned-gallery', kind: 'mark' }]);

    expect(progress.toggleMapPin('drowned-gallery')).toBe('removed');
    expect(progress.hasMapPin('drowned-gallery')).toBe(false);
  });

  it('stops at the wax limit until a mark is removed', () => {
    const progress = new RunProgress(new MemoryStorage());
    const rooms = [
      'belfry-terrace',
      'belfry-antechamber',
      'drowned-gallery',
      'sunless-aqueduct',
      'bellows',
      'wall-claw-shaft',
    ];
    for (const roomId of rooms) progress.visit(roomId);

    for (const roomId of rooms.slice(0, MAP.pinLimit)) {
      expect(progress.toggleMapPin(roomId)).toBe('added');
    }
    expect(progress.toggleMapPin(rooms[MAP.pinLimit] ?? 'wall-claw-shaft')).toBe('full');
    expect(progress.mapPins).toHaveLength(MAP.pinLimit);

    expect(progress.toggleMapPin(rooms[0] ?? 'belfry-terrace')).toBe('removed');
    expect(progress.toggleMapPin(rooms[MAP.pinLimit] ?? 'wall-claw-shaft')).toBe('added');
  });

  it('collects shards, charms, secret walls and Ordeals without double-granting', () => {
    const progress = new RunProgress(new MemoryStorage());
    progress.visit('belfry-terrace');
    expect(progress.collectPickup('gallery-shard-low')).toBe(true);
    expect(progress.collectPickup('gallery-shard-low')).toBe(false);
    expect(progress.shards).toBe(10);
    expect(progress.collectPickup('gallery-quick-mend')).toBe(true);
    expect(progress.charmsOwned).toEqual(['quickMend']);
    expect(progress.charmsEquipped).toEqual(['quickMend']);
    expect(progress.collectPickup('gallery-health-shard')).toBe(true);
    expect(progress.healthShards).toBe(1);
    expect(progress.maxHp).toBe(5);

    expect(progress.breakSecret('drowned-gallery')).toBe(true);
    expect(progress.breakSecret('drowned-gallery')).toBe(false);
    expect(progress.hasBrokenSecret('drowned-gallery')).toBe(true);

    expect(progress.canCollectPickup('bellthief-tide-bell')).toBe(false);
    expect(progress.collectPickup('bellthief-tide-bell')).toBe(false);
    expect(progress.addSigil('bellThief')).toBe(true);
    expect(progress.canCollectPickup('bellthief-tide-bell')).toBe(true);
    expect(progress.collectPickup('bellthief-tide-bell')).toBe(true);
    expect(progress.hasPickup('bellthief-tide-bell')).toBe(true);
    expect(progress.addOrdeal('bellThief')).toBe(true);
    expect(progress.addOrdeal('bellThief')).toBe(false);
  });

  it('enforces the three-slot charm belt and the nail price', () => {
    const progress = new RunProgress(new MemoryStorage());
    progress.visit('belfry-terrace');
    for (const id of [
      'gallery-quick-mend',
      'ossuary-light-step',
      'aqueduct-ember-greed',
      'reliquary-long-reach',
    ]) {
      progress.collectPickup(id);
    }
    expect(progress.charmsEquipped).toEqual(['quickMend', 'lightStep', 'emberGreed']);
    expect(progress.toggleCharm('longReach')).toBe(false);
    expect(progress.toggleCharm('quickMend')).toBe(true);
    expect(progress.toggleCharm('longReach')).toBe(true);

    expect(progress.buyNailUpgrade()).toBe(false);
    progress.grantShards(30);
    expect(progress.buyNailUpgrade()).toBe(true);
    expect(progress.nails.level).toBe(1);
    expect(progress.shards).toBe(0);
    expect(progress.buyNailUpgrade()).toBe(false);
  });

  it('accumulates progression and writes it back through storage', () => {
    const storage = new MemoryStorage();
    const progress = new RunProgress(storage);
    progress.visit('belfry-terrace');
    progress.visit('belfry-antechamber');
    expect(progress.addSigil('wardenMoss')).toBe(true);
    expect(progress.addSigil('wardenMoss')).toBe(false);
    expect(progress.maxHp).toBe(6);

    const bench = getBench('nave-bell-keepers-rest');
    progress.setCheckpoint(bench);
    expect(
      progress.save({
        roomId: 'belfry-antechamber',
        spawn: bench.spawn,
        hp: 6,
        reason: 'bench',
      }),
    ).toBe(true);

    const stored = loadRunSave(storage);
    expect(stored?.roomId).toBe('belfry-antechamber');
    expect(stored?.spawn).toEqual(bench.spawn);
    expect(stored?.sigils).toEqual(['wardenMoss']);
    expect(stored?.visitedRooms).toEqual(['belfry-terrace', 'belfry-antechamber']);
    expect(stored?.checkpointBenchId).toBe('nave-bell-keepers-rest');

    const debug = progress.debugRun('belfry-antechamber');
    expect(debug.roomId).toBe('belfry-antechamber');
    expect(debug.maxHp).toBe(6);
    expect(debug.checkpoint).toEqual({
      roomId: 'belfry-antechamber',
      benchId: 'nave-bell-keepers-rest',
      name: "The Bell-Keeper's Rest",
    });
    expect(progress.debugSave()).toMatchObject({ present: true, lastWrite: 'bench' });
  });

  it('clamps HP into the valid mask range when saving', () => {
    const storage = new MemoryStorage();
    const progress = new RunProgress(storage);
    progress.visit('belfry-terrace');

    expect(
      progress.save({
        roomId: 'belfry-terrace',
        spawn: { x: 420, y: 320 },
        hp: 999,
        reason: 'room',
      }),
    ).toBe(true);
    expect(loadRunSave(storage)?.hp).toBe(5);
  });

  it('reports a blocked write without corrupting in-memory progress', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const storage: SaveStorage = {
      getItem: () => null,
      setItem: () => {
        throw new Error('quota');
      },
    };
    const progress = new RunProgress(storage);
    progress.visit('belfry-terrace');
    expect(
      progress.save({
        roomId: 'belfry-terrace',
        spawn: { x: 420, y: 320 },
        hp: 5,
        reason: 'boot',
      }),
    ).toBe(false);
    expect(progress.visitedRooms).toEqual(['belfry-terrace']);
    expect(progress.debugSave()).toMatchObject({ present: false, lastWrite: null });
    expect(warn).toHaveBeenCalled();
  });
});
