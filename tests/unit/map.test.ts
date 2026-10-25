import { describe, expect, it } from 'vitest';
import { ALL_ROOMS, getRoom } from '../../src/data/rooms';
import { MAP_ATLAS } from '../../src/ui/map/mapAtlas';
import { buildRoomGeometry } from '../../src/ui/map/mapGeometry';
import { buildMapSnapshot, type MapModelInput } from '../../src/ui/map/mapModel';

function mapInput(overrides: Partial<MapModelInput> = {}): MapModelInput {
  return {
    currentRoomId: 'belfry-terrace',
    playerPosition: null,
    visitedRoomIds: ['belfry-terrace'],
    sigils: [],
    checkpoint: null,
    pickups: [],
    brokenSecrets: [],
    pins: [],
    tideglass: true,
    tideDoorOpened: false,
    endingSeen: false,
    arsenal: false,
    hasTideBell: false,
    ...overrides,
  };
}

describe('Tideglass atlas', () => {
  it('places every authored room exactly once on a unique atlas cell', () => {
    expect(MAP_ATLAS.map((room) => room.roomId).sort()).toEqual(
      ALL_ROOMS.map((room) => room.id).sort(),
    );
    const cells = new Set(MAP_ATLAS.map((room) => `${room.col}:${room.row}`));
    expect(cells.size).toBe(MAP_ATLAS.length);
  });

  it('keeps every room label and region copy present', () => {
    for (const atlas of MAP_ATLAS) {
      expect(atlas.label.length).toBeGreaterThan(0);
      expect(atlas.kicker.length).toBeGreaterThan(0);
      expect(atlas.region.length).toBeGreaterThan(0);
      expect(atlas.note.length).toBeGreaterThan(0);
    }
  });
});

describe('Tideglass model', () => {
  it('charts only the starting room and reveals its neighbours as ghosts', () => {
    const map = buildMapSnapshot(mapInput());

    expect(map.totalCount).toBe(13);
    expect(map.chartedCount).toBe(1);
    expect(map.ghostCount).toBe(2);
    expect(map.links).toHaveLength(2);
    expect(map.links.every((link) => link.state === 'ghost')).toBe(true);
    expect(map.links.every((link) => link.path.startsWith('M '))).toBe(true);

    const terrace = map.rooms.find((room) => room.roomId === 'belfry-terrace');
    expect(terrace?.state).toBe('current');
    expect(terrace?.geometry).not.toBeNull();
    expect(terrace?.geometry?.solid.length).toBeGreaterThan(0);
    expect(terrace?.geometry?.surfaces.length).toBeGreaterThan(0);

    const gallery = map.rooms.find((room) => room.roomId === 'drowned-gallery');
    expect(gallery?.state).toBe('ghost');
    expect(gallery?.geometry).toBeNull();
    expect(gallery?.exits).toEqual([]);

    const arena = map.rooms.find((room) => room.roomId === 'bellbearer-arena');
    expect(arena?.state).toBe('unheard');
    expect(arena?.label).toBe('Unheard');
    expect(arena?.ariaLabel).toBe('Unheard place.');
  });

  it('reveals charted rooms, bells, secrets and the checkpoint', () => {
    const map = buildMapSnapshot(
      mapInput({
        currentRoomId: 'bellthief-arena',
        visitedRoomIds: ALL_ROOMS.map((room) => room.id),
        sigils: ['bellbearer'],
        checkpoint: { name: 'The Weeping Stone', roomId: 'belfry-terrace' },
      }),
    );

    expect(map.chartedCount).toBe(13);
    expect(map.ghostCount).toBe(0);
    expect(map.sigilCount).toBe(1);
    expect(map.bossCount).toBe(4);
    expect(map.rooms.find((room) => room.roomId === 'bellthief-arena')?.state).toBe('current');
    expect(map.rooms.find((room) => room.roomId === 'bellbearer-arena')?.bossClaimed).toBe(true);
    expect(map.rooms.find((room) => room.roomId === 'warden-arena')?.remainingBoss).toBe(true);

    const terrace = map.rooms.find((room) => room.roomId === 'belfry-terrace');
    expect(terrace?.benchName).toBe('The Weeping Stone');
    expect(terrace?.ariaLabel).toContain('rest point');

    expect(map.checkpoint).toEqual({
      name: 'The Weeping Stone',
      roomId: 'belfry-terrace',
    });
  });

  it('plots the Keeper inside the current room without leaving its bounds', () => {
    const map = buildMapSnapshot(
      mapInput({
        currentRoomId: 'belfry-antechamber',
        visitedRoomIds: ['belfry-terrace', 'belfry-antechamber'],
        playerPosition: { x: 420, y: 320 },
      }),
    );
    const room = map.rooms.find((entry) => entry.roomId === 'belfry-antechamber');
    expect(room).toBeDefined();
    expect(map.currentPosition).not.toBeNull();
    if (!room || !map.currentPosition) return;
    expect(map.currentPosition.x).toBeGreaterThanOrEqual(room.rect.x);
    expect(map.currentPosition.x).toBeLessThanOrEqual(room.rect.x + room.rect.w);
    expect(map.currentPosition.y).toBeGreaterThanOrEqual(room.rect.y);
    expect(map.currentPosition.y).toBeLessThanOrEqual(room.rect.y + room.rect.h);
  });

  it('shows wax only on charted rooms', () => {
    const map = buildMapSnapshot(
      mapInput({
        visitedRoomIds: ['belfry-terrace', 'drowned-gallery'],
        pins: [
          { roomId: 'drowned-gallery', kind: 'mark' },
          { roomId: 'bellbearer-arena', kind: 'mark' },
        ],
      }),
    );

    expect(map.pins).toEqual([{ roomId: 'drowned-gallery', kind: 'mark' }]);
    expect(map.pinCount).toBe(1);
    expect(map.pinLimit).toBe(5);
    expect(map.rooms.find((room) => room.roomId === 'drowned-gallery')?.pinned).toBe(true);
    expect(map.rooms.find((room) => room.roomId === 'bellbearer-arena')?.pinned).toBe(false);
  });

  it('marks a chamber swept only after every obligation is answered', () => {
    const before = buildMapSnapshot(
      mapInput({
        currentRoomId: 'bellbearer-arena',
        visitedRoomIds: ['belfry-terrace', 'belfry-antechamber', 'bellbearer-arena'],
      }),
    );
    expect(before.rooms.find((room) => room.roomId === 'bellbearer-arena')?.swept).toBe(false);

    const after = buildMapSnapshot(
      mapInput({
        currentRoomId: 'bellbearer-arena',
        visitedRoomIds: ['belfry-terrace', 'belfry-antechamber', 'bellbearer-arena'],
        sigils: ['bellbearer'],
      }),
    );
    expect(after.rooms.find((room) => room.roomId === 'bellbearer-arena')?.swept).toBe(true);
    expect(after.sweptCount).toBe(1);
  });

  it('keeps the lead thread aligned with the run', () => {
    expect(buildMapSnapshot(mapInput({ tideglass: false })).lead).toContain('dark');
    expect(buildMapSnapshot(mapInput()).lead).toContain('Three bells');
    expect(
      buildMapSnapshot(mapInput({ sigils: ['bellbearer', 'wardenMoss', 'bellThief'] })).lead,
    ).toContain('Ward of Four');
    expect(
      buildMapSnapshot(
        mapInput({
          sigils: ['bellbearer', 'wardenMoss', 'bellThief'],
          arsenal: true,
          hasTideBell: true,
          tideDoorOpened: true,
        }),
      ).lead,
    ).toContain('Last Bell');
  });

  it('seals the Tide door until the arsenal and Tide-Bell are both present', () => {
    const visited = ['belfry-terrace', 'wall-claw-shaft', 'upper-gallery', 'last-bell'];
    const sealed = buildMapSnapshot(
      mapInput({ currentRoomId: 'upper-gallery', visitedRoomIds: visited }),
    );
    const tideLink = sealed.links.find(
      (link) => link.from === 'last-bell' || link.to === 'last-bell',
    );
    expect(tideLink?.state).toBe('sealed');
    expect(tideLink?.requirement).toContain('Ward of Four');
    expect(tideLink?.requirement).toContain('Tide-Bell');

    const open = buildMapSnapshot(
      mapInput({
        currentRoomId: 'upper-gallery',
        visitedRoomIds: visited,
        arsenal: true,
        hasTideBell: true,
      }),
    );
    const openTide = open.links.find(
      (link) => link.from === 'last-bell' || link.to === 'last-bell',
    );
    expect(openTide?.state).toBe('open');
  });
});

describe('Tideglass geometry', () => {
  it('draws the real terrace plan and drops a broken seam when it is shattered', () => {
    const terrace = getRoom('belfry-terrace');
    const plan = buildRoomGeometry(terrace, { secretBroken: false, sealOpen: false });
    expect(plan.solid.length).toBeGreaterThan(0);
    expect(plan.surfaces.length).toBeGreaterThan(0);

    const gallery = getRoom('drowned-gallery');
    const sealed = buildRoomGeometry(gallery, { secretBroken: false, sealOpen: false });
    const broken = buildRoomGeometry(gallery, { secretBroken: true, sealOpen: false });
    expect(sealed.breakables.length).toBeGreaterThan(0);
    expect(broken.breakables.length).toBeLessThan(sealed.breakables.length);
  });
});
