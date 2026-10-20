import { describe, expect, it } from 'vitest';
import { ALL_ROOMS } from '../../src/data/rooms';
import { MAP_LAYOUT } from '../../src/ui/map/mapLayout';
import { buildMapSnapshot } from '../../src/ui/map/mapModel';

describe('region map model', () => {
  it('places every authored room on the chart exactly once', () => {
    expect(Object.keys(MAP_LAYOUT).sort()).toEqual(ALL_ROOMS.map((room) => room.id).sort());
  });

  it('charts only the starting room and hides every destination on a fresh run', () => {
    const map = buildMapSnapshot({
      currentRoomId: 'belfry-terrace',
      visitedRoomIds: ['belfry-terrace'],
      sigils: [],
      checkpoint: null,
    });

    expect(map.totalCount).toBe(5);
    expect(map.visitedCount).toBe(1);
    expect(map.links).toHaveLength(4);
    expect(map.links.every((link) => !link.revealed)).toBe(true);
    const terrace = map.nodes.find((node) => node.roomId === 'belfry-terrace');
    expect(terrace?.state).toBe('current');
    expect(terrace?.detail).toBe('You are here');
    const arena = map.nodes.find((node) => node.roomId === 'bellbearer-arena');
    expect(arena).toMatchObject({
      state: 'unknown',
      label: 'Unknown',
      kicker: '?',
      detail: 'Uncharted',
      ariaLabel: 'Uncharted chamber',
    });
    expect(arena?.label).not.toContain('Undercroft');
  });

  it('reveals charted rooms, routes, sigils and the checkpoint', () => {
    const map = buildMapSnapshot({
      currentRoomId: 'bellthief-arena',
      visitedRoomIds: ALL_ROOMS.map((room) => room.id),
      sigils: ['bellbearer'],
      checkpoint: { name: 'The Weeping Stone', roomId: 'belfry-terrace' },
    });

    expect(map.visitedCount).toBe(5);
    expect(map.sigilCount).toBe(1);
    expect(map.links.every((link) => link.revealed)).toBe(true);
    expect(map.nodes.find((node) => node.roomId === 'bellthief-arena')?.state).toBe('current');
    expect(map.nodes.find((node) => node.roomId === 'bellbearer-arena')?.detail).toBe(
      'Sigil claimed',
    );
    expect(map.nodes.find((node) => node.roomId === 'warden-arena')?.detail).toBe('The bell waits');

    const terrace = map.nodes.find((node) => node.roomId === 'belfry-terrace');
    expect(terrace?.restPoint).toBe(true);
    expect(terrace?.ariaLabel).toContain('rest point');

    expect(map.checkpoint).toEqual({
      name: 'The Weeping Stone',
      roomName: 'The Belfry Terrace',
    });
  });

  it('adds a boss name to the accessible label without leaking it before discovery', () => {
    const map = buildMapSnapshot({
      currentRoomId: 'belfry-antechamber',
      visitedRoomIds: ['belfry-terrace', 'belfry-antechamber', 'warden-arena'],
      sigils: [],
      checkpoint: null,
    });

    const warden = map.nodes.find((node) => node.roomId === 'warden-arena');
    expect(warden?.ariaLabel).toContain('Warden Moss');
    expect(warden?.label).toBe('Moss Choir');

    const hidden = map.nodes.find((node) => node.roomId === 'bellthief-arena');
    expect(hidden?.ariaLabel).toBe('Uncharted chamber');
  });
});
