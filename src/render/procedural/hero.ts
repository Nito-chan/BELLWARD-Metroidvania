import type { Texture } from 'pixi.js';
import { PALETTE } from '../../config/palette';
import type { AnimationClip, CharacterArt } from '../Animation';
import { hex, paint } from './canvas';

/**
 * The procedural knight: a 12-frame 32x48 strip that mirrors HERO_ART's clip set and
 * durations, so gameplay, debug state and tests behave identically when the packed
 * Fantasy Knight is unavailable. Poses are slight silhouette changes — enough to read
 * state at 32x48.
 */

const HERO_FRAME_W = 32;
const HERO_FRAME_H = 48;

type Pose = {
  /** Vertical body offset. */
  bob: number;
  /** Horizontal cloak sway. */
  cloak: number;
  /** Leg lift, negative lifts the left leg, positive the right. */
  legLift: number;
  /** How the sword is held. */
  sword: 'idle' | 'raised' | 'down' | 'forward' | 'overhead';
  /** Forward lean of the torso, in pixels. */
  lean: number;
};

/** Frame order: 0-1 idle, 2-5 run, 6 jump, 7 fall, 8 attack1, 9 attack2, 10 dash, 11 turn. */
const POSES: readonly Pose[] = [
  { bob: 0, cloak: 0, legLift: 0, sword: 'idle', lean: 0 },
  { bob: 1, cloak: 1, legLift: 0, sword: 'idle', lean: 0 },
  { bob: 0, cloak: 1, legLift: -2, sword: 'idle', lean: 1 },
  { bob: 1, cloak: 0, legLift: 0, sword: 'idle', lean: 1 },
  { bob: 0, cloak: -1, legLift: 2, sword: 'idle', lean: 1 },
  { bob: 1, cloak: 0, legLift: 0, sword: 'idle', lean: 1 },
  { bob: -2, cloak: 2, legLift: 2, sword: 'raised', lean: 0 },
  { bob: 1, cloak: 3, legLift: -2, sword: 'down', lean: -1 },
  { bob: 0, cloak: 1, legLift: 0, sword: 'forward', lean: 2 },
  { bob: -1, cloak: 0, legLift: 1, sword: 'overhead', lean: 1 },
  { bob: 1, cloak: 4, legLift: 3, sword: 'forward', lean: 3 },
  { bob: 1, cloak: -3, legLift: 1, sword: 'idle', lean: -2 },
];

function drawSword(ctx: CanvasRenderingContext2D, ox: number, y: number, pose: Pose): void {
  ctx.strokeStyle = hex(PALETTE.brass);
  ctx.lineWidth = 2;
  ctx.beginPath();
  switch (pose.sword) {
    case 'idle':
      ctx.moveTo(ox + 24, y + 12);
      ctx.lineTo(ox + 24, y + 31);
      break;
    case 'raised':
      ctx.moveTo(ox + 20, y + 12);
      ctx.lineTo(ox + 22, y - 2);
      break;
    case 'down':
      ctx.moveTo(ox + 22, y + 20);
      ctx.lineTo(ox + 28, y + 34);
      break;
    case 'forward':
      ctx.moveTo(ox + 20, y + 22);
      ctx.lineTo(ox + 31, y + 24);
      break;
    case 'overhead':
      ctx.moveTo(ox + 18, y + 16);
      ctx.lineTo(ox + 28, y + 6);
      break;
  }
  ctx.stroke();
}

function drawKnight(ctx: CanvasRenderingContext2D, ox: number, poseIndex: number): void {
  const pose = POSES[poseIndex] ?? POSES[0];
  if (!pose) return;
  const { bob, lean } = pose;

  // Cloak first so the body reads on top.
  ctx.fillStyle = hex(PALETTE.cavern);
  ctx.beginPath();
  ctx.moveTo(ox + 10, 22 + bob);
  ctx.lineTo(ox + 22, 22 + bob);
  ctx.lineTo(ox + 24 + pose.cloak, 40 + bob);
  ctx.lineTo(ox + 8 + pose.cloak, 40 + bob);
  ctx.closePath();
  ctx.fill();

  // Legs.
  ctx.fillStyle = hex(PALETTE.stone);
  ctx.fillRect(ox + 12 + pose.legLift, 35 + bob, 4, 11 - bob);
  ctx.fillRect(ox + 17 - pose.legLift, 35 + bob, 4, 11 - bob);

  // Torso, belt and pauldrons.
  ctx.fillStyle = hex(PALETTE.stoneLit);
  ctx.fillRect(ox + 11 + lean, 22 + bob, 10, 14);
  ctx.fillStyle = hex(PALETTE.brassDark);
  ctx.fillRect(ox + 11 + lean, 33 + bob, 10, 2);

  // Head and visor.
  ctx.fillStyle = hex(PALETTE.stone);
  ctx.fillRect(ox + 13 + lean, 14 + bob, 6, 8);
  ctx.fillStyle = hex(PALETTE.void);
  ctx.fillRect(ox + 14 + lean, 18 + bob, 4, 2);

  drawSword(ctx, ox + lean, bob, pose);
}

export function buildHeroArt(): { art: CharacterArt; texture: Texture } {
  const texture = paint(HERO_FRAME_W * POSES.length, HERO_FRAME_H, (ctx) => {
    for (let frame = 0; frame < POSES.length; frame += 1) {
      drawKnight(ctx, frame * HERO_FRAME_W, frame);
    }
  });

  const clips: Record<string, AnimationClip> = {
    idle: {
      loop: true,
      frames: [
        { frame: 0, ticks: 30 },
        { frame: 1, ticks: 30 },
      ],
    },
    run: {
      loop: true,
      frames: [
        { frame: 2, ticks: 8 },
        { frame: 3, ticks: 8 },
        { frame: 4, ticks: 8 },
        { frame: 5, ticks: 8 },
      ],
    },
    turn: { loop: false, frames: [{ frame: 11, ticks: 9 }] },
    jump: { loop: false, frames: [{ frame: 6, ticks: 9 }] },
    fall: { loop: true, frames: [{ frame: 7, ticks: 12 }] },
    attack1: { loop: false, frames: [{ frame: 8, ticks: 16 }] },
    attack2: { loop: false, frames: [{ frame: 9, ticks: 20 }] },
    dash: { loop: false, frames: [{ frame: 10, ticks: 8 }] },
    guard: { loop: true, frames: [{ frame: 8, ticks: 40 }] },
    parry: {
      loop: false,
      frames: [
        { frame: 8, ticks: 5 },
        { frame: 9, ticks: 7 },
      ],
    },
  };

  return {
    texture,
    art: {
      textureKey: 'proc.hero',
      sheet: { frameWidth: HERO_FRAME_W, frameHeight: HERO_FRAME_H, columns: POSES.length },
      origin: { x: 16, y: 46 },
      animations: clips,
    },
  };
}
