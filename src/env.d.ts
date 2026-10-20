/// <reference types="vite/client" />

import type { FrameSample } from './core/Game';
import type { GameDebugState } from './debug/DebugState';

declare global {
  interface Window {
    /** DEV-only read-only debug handle, installed by src/main.ts. */
    __game?: {
      debugState: () => GameDebugState;
      sampleFrame: () => FrameSample;
      debugLoadRoom: (roomId: string) => void;
      debugDamageBoss: (amount: number) => boolean;
      debugBreakWard: () => boolean;
      debugDefeatBoss: () => void;
    };
  }
}

export {};
