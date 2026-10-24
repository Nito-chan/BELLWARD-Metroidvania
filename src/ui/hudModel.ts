/**
 * Pure HUD models. Keeping the text and slot decisions here gives the menu/HUD tests a
 * DOM-free contract while the Pixi classes stay responsible only for drawing.
 */
import { HOOKLINE_LABEL, WEAPON_LABELS, type WeaponId } from '../config/weapons';

export type ArsenalSlotView = {
  readonly id: WeaponId | 'hookline';
  readonly label: string;
  readonly owned: boolean;
  readonly active: boolean;
};

/** The four-slot plaque order is part of the HUD contract, not an implementation detail. */
export function arsenalReadout(
  weapon: WeaponId,
  hasCenser: boolean,
  hasToll: boolean,
  hasHookline: boolean,
): readonly ArsenalSlotView[] {
  return [
    { id: 'nail', label: WEAPON_LABELS.nail, owned: true, active: weapon === 'nail' },
    {
      id: 'hookline',
      label: HOOKLINE_LABEL,
      owned: hasHookline,
      active: false,
    },
    {
      id: 'censer',
      label: WEAPON_LABELS.censer,
      owned: hasCenser,
      active: weapon === 'censer',
    },
    {
      id: 'toll',
      label: WEAPON_LABELS.toll,
      owned: hasToll,
      active: weapon === 'toll',
    },
  ];
}

/** The Last Keeper's phase-specific progress, with no entity references. */
export type LastKeeperHudInfo = {
  readonly chainCount: number;
  readonly chainOpen: boolean;
  readonly answerCount: number;
  readonly answerWindow: boolean;
  readonly ritualActive: boolean;
};

/** Everything the boss bar needs from the simulation, with no entity references. */
export type BossHudInfo = {
  readonly name: string;
  readonly hp: number;
  readonly maxHp: number;
  readonly phaseIndex: number;
  readonly phaseCount: number;
  readonly phaseName: string;
  readonly warded: boolean;
  readonly posture: number;
  readonly maxPosture: number;
  readonly postureBroken: boolean;
  readonly alive: boolean;
  readonly lastKeeper?: LastKeeperHudInfo;
};

/**
 * The phase line is also the mechanic readout: chains, the Censer window, answers and
 * the sealed final phase are all spelled out instead of hidden behind a colour.
 */
export function bossHudSubtitle(info: BossHudInfo): string {
  if (!info.alive) return 'A bell-sigil remains';
  const parts = [info.phaseName];
  if (info.warded) parts.push('WARDED');
  const keeper = info.lastKeeper;
  if (keeper?.ritualActive) {
    parts.push(`ANSWERS ${keeper.answerCount} / 3`);
    parts.push('INVULNERABLE');
    if (keeper.answerWindow) parts.push('RING NOW');
  } else if (keeper && info.phaseIndex === 1) {
    parts.push(`CHAINS ${keeper.chainCount} / 3`);
    if (keeper.chainOpen) parts.push('CHAIN OPEN');
  }
  return parts.join('  ·  ');
}
