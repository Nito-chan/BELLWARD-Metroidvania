/** The read-only debug snapshot. This is the contract E2E tests and the F1 overlay use. */
import type { AudioDebugState } from '../audio/AudioManager';
import type { Bindings } from '../input/bindings';
import type { SaveReason } from '../save/runSave';
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

/** Boss snapshot inside a scene. Present only in arena rooms. */
export type SceneBossDebugState = {
  kind: string;
  name: string;
  /** Feet-center, in world pixels. */
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  phase: number;
  phaseCount: number;
  phaseName: string;
  warded: boolean;
  /** Posture and its ceiling; at zero the boss is open to a KNELL. */
  posture: number;
  maxPosture: number;
  postureBroken: boolean;
  state: string;
  pattern: string | null;
  /** True when this is a hard-mode Ordeal rematch. */
  ordeal?: boolean;
  /** 0..1 wind-up warning fill. */
  telegraph: number;
  hidden: boolean;
  alive: boolean;
  deathElapsed: number;
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
    focus: number;
    maxFocus: number;
    /** 0..1 heal channel fill. */
    healProgress: number;
    /** -1 touching a left wall, 1 a right wall, 0 free. */
    wallContact: -1 | 0 | 1;
    wallSliding: boolean;
    /** True while the Keeper's Guard is braced. */
    guarding: boolean;
    /** Player posture for the parry/block loop. */
    posture: number;
    maxPosture: number;
    /** True while a perfect parry has opened a Hook Counter. */
    counterReady: boolean;
    /** True during the opening beats of a fresh guard. */
    perfectParry: boolean;
    /** Hookline state, target ids and reach for E2E and the F1 overlay. */
    hook: {
      state: 'idle' | 'zip' | 'hang';
      enabled: boolean;
      anchorId: string | null;
      candidateId: string | null;
      range: number;
      cooldown: number;
    };
    nailLevel: number;
    charms: string[];
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
    posture: number;
    maxPosture: number;
    postureBroken: boolean;
  }>;
  /** Number of live projectiles. */
  projectiles: number;
  /** Active boss snapshot; null outside arenas (and in claimed arenas). */
  boss: SceneBossDebugState | null;
  /** Nearest bench while it is in interaction range; null otherwise. */
  bench: {
    id: string;
    name: string;
    inRange: boolean;
  } | null;
  /** True while a living boss keeps the arena's return door locked. */
  exitLocked: boolean;
  /** Collectibles still visible in this room. */
  pickupsRemaining: number;
  /** True once this room's secret wall has shattered. */
  secretBroken: boolean;
  /** True when the Tide-Bell opened the sealed door in the current visit. */
  sealOpen: boolean;
  /** Remaining hitstop ticks (the world is frozen while > 0). */
  hitstop: number;
};

/** Run-level progression kept by the composition root, not the scene. */
export type RunDebugState = {
  /** Current room id; changes on every transition. */
  roomId: string;
  /** Boss kinds whose sigils were claimed this run. */
  sigils: string[];
  /** Base masks plus one per sigil. */
  maxHp: number;
  /** Rooms charted on the map, in region order. */
  visitedRooms: string[];
  /** Last bench rest, or null before the first rest. */
  checkpoint: {
    roomId: string;
    benchId: string;
    name: string;
  } | null;
  /** Spendable bell shards. */
  shards: number;
  /** Durable collectible ids already granted. */
  pickups: string[];
  /** Rooms whose breakable secret wall has been shattered. */
  brokenSecrets: string[];
  /** Number of mask shards found toward the next mask. */
  healthShards: number;
  /** Nail upgrade level (0..2). */
  nailLevel: number;
  charmsOwned: string[];
  charmsEquipped: string[];
  /** True once the Wall Claw is owned. */
  wallClaw: boolean;
  /** True once the Hookline is owned. */
  hookline: boolean;
  /** True once the Longline range upgrade is owned. */
  longline: boolean;
  /** True once the Censer is owned. */
  censer: boolean;
  /** True once the Toll is owned. */
  toll: boolean;
  /** Boss kinds whose Ordeal has been cleared. */
  ordeals: string[];
  /** True once the Tide-door ending fired. */
  sliceComplete: boolean;
};

/** Persistence status: useful for E2E proof that a rest actually reached storage. */
export type SaveDebugState = {
  key: string;
  version: number;
  /** True when a valid document was loaded or a write has succeeded. */
  present: boolean;
  /** True when boot restored a document (rather than starting fresh). */
  loaded: boolean;
  /** Why the most recent successful write happened, or null when none has succeeded. */
  lastWrite: SaveReason | null;
};

/** The first-run start card's state, used by E2E and the diagnostics overlay. */
export type TitleDebugState = {
  open: boolean;
  /** True when boot restored a run; the card then leads with Continue. */
  hasSave: boolean;
  /** True after the first Begin anew click; the second erases the run. */
  newRunArmed: boolean;
  primaryLabel: string;
  focus: string | null;
};

export type OnboardingDebugState = {
  open: boolean;
};

/** Touch overlay availability and currently held buttons. */
export type TouchDebugState = {
  /** True when this device mounted the on-screen controls. */
  enabled: boolean;
  /** True while gameplay is live and no DOM overlay owns the screen. */
  visible: boolean;
  /** Actions currently held by a pointer, for diagnostics. */
  held: string[];
};

export type AccessibilityDebugState = {
  screenShake: boolean;
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
  /** Run progression (sigils, masks, charted rooms and checkpoint). */
  run: RunDebugState;
  /** Save-document status for diagnostics and E2E. */
  save: SaveDebugState;
  /** Audio director snapshot: mix, unlock gate, current track, load failures. */
  audio: AudioDebugState;
  /** Pause overlay snapshot; bindings are visible even while the menu is closed. */
  menu: MenuDebugState;
  /** Boot title card state. */
  title: TitleDebugState;
  /** First-run hint strip state. */
  onboarding: OnboardingDebugState;
  /** On-screen touch controls (disabled and hidden on mouse/keyboard devices). */
  touch: TouchDebugState;
  /** Persisted accessibility preferences. */
  accessibility: AccessibilityDebugState;
  /** Captured runtime errors; empty in a healthy session. */
  errors: string[];
};
