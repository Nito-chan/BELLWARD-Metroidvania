/** Shared vocabulary for the DOM region map. */

export type MapNodeState = 'current' | 'visited' | 'unknown';

export type MapNodeSnapshot = {
  readonly roomId: string;
  /** Short label used on the map. Unknown rooms never leak their real name. */
  readonly label: string;
  /** I/II/III for arenas, ENTRY/HUB for the safe rooms. */
  readonly kicker: string;
  readonly state: MapNodeState;
  readonly detail: string;
  /** Full accessible name, including room, boss and rest-point status. */
  readonly ariaLabel: string;
  readonly x: number;
  readonly y: number;
  /** True when the run's last rest was in this room. */
  readonly restPoint: boolean;
};

export type MapLinkSnapshot = {
  readonly from: string;
  readonly to: string;
  /** False until both ends are charted; drawn as a faint dashed route. */
  readonly revealed: boolean;
};

export type MapSnapshot = {
  readonly nodes: readonly MapNodeSnapshot[];
  readonly links: readonly MapLinkSnapshot[];
  readonly currentRoomId: string;
  readonly visitedCount: number;
  readonly totalCount: number;
  readonly sigilCount: number;
  readonly bossCount: number;
  readonly checkpoint: {
    readonly name: string;
    readonly roomName: string;
  } | null;
};
