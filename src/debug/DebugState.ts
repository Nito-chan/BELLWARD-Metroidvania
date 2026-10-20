/** The read-only debug snapshot. This is the contract E2E tests and the F1 overlay use. */
import type { AudioDebugState } from '../audio/AudioManager';
import type { Bindings } from '../input/bindings';
import type { CaptureTarget, MenuScreen } from '../ui/menu/menuTypes';

/** Pause overlay snapshot: screen, capture target, focus and the live binding document. */
export type MenuDebugState = {
  open: boolean;
  screen: MenuScreen | null;
  capture: CaptureTarget | null;
  status: string;
  /** data-focus-id of the focused menu control, or null when nothing inside is focused. */
  focus: string | null;
  bindings: Bindings;
};

/** Room/art snapshot for the active scene. */
export type SceneDebugState = {
  roomId: string;
  roomName: string;
  /** Number of non-empty tiles drawn for the room. */
  tiles: number;
  art: {
    mode: 'packed' | 'procedural';
    /** Packed texture keys that loaded successfully. */
    loaded: string[];
    /** Packed textures that fell back to procedural art. Should be empty in a healthy build. */
    failures: string[];
  };
  /** Smoothed camera top-left, in world pixels. */
  camera: { x: number; y: number };
  player: {
    /** Feet-center, in world pixels. */
    x: number;
    y: number;
    /** Velocity in pixels per second. */
    vx: number;
    vy: number;
    /** Controller state (idle/run/skid/jump/fall/attack/dash/hurt/dead). */
    state: string;
    /** Active animation clip. */
    animation: string;
    facing: -1 | 1;
    grounded: boolean;
    /** Feet Y at the apex of the jump in progress, or null while grounded. */
    jumpPeakY: number | null;
    /** Feet Y at the apex of the last completed jump, or null before the first one. */
    lastJumpPeakY: number | null;
    /** Ticks since the current clip started. */
    clipTick: number;
    /** Current and maximum health. */
    hp: number;
    maxHp: number;
    /** Remaining invulnerability ticks (0 = hittable). */
    invulnerableTicks: number;
    /** True while the death sequence is playing. */
    dead: boolean;
    /** True while a swing's damage window is open. */
    attackActive: boolean;
  };
  /** Live enemies, in spawn order. Dead enemies are removed before this snapshot. */
  enemies: Array<{
    kind: string;
    name: string;
    /** Feet-center, in world pixels. */
    x: number;
    y: number;
    hp: number;
    maxHp: number;
    state: string;
    animation: string;
    facing: -1 | 1;
  }>;
  /** Number of live projectiles. */
  projectiles: number;
  /** Remaining hitstop ticks (the world is frozen while > 0). */
  hitstop: number;
};

export type GameDebugState = {
  /** True once boot() finished (renderer up, scene mounted, loop running). */
  ready: boolean;
  /** Backing-store size of the game canvas, in real pixels. */
  canvas: {
    width: number;
    height: number;
  };
  /** Rendered frames since boot. */
  frameCount: number;
  /** Simulation ticks since boot. */
  tickCount: number;
  /** Simulated seconds (tickCount * dt). */
  simTime: number;
  /** Smoothed real frames per second. */
  smoothedFps: number;
  /** Active renderer backend name (e.g. "webgl"). */
  renderer: string;
  /** Active room snapshot; null until the scene mounts. */
  scene: SceneDebugState | null;
  /** Audio director snapshot: mix, unlock gate, current track, load failures. */
  audio: AudioDebugState;
  /** Pause overlay snapshot; bindings are visible even while the menu is closed. */
  menu: MenuDebugState;
  /** Captured runtime errors; empty in a healthy session. */
  errors: string[];
};
